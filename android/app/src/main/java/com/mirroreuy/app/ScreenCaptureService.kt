package com.mirroreuy.app

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.io.ByteArrayOutputStream
import java.net.InetSocketAddress
import java.nio.ByteBuffer

class ScreenCaptureService : Service() {

    companion object {
        const val ACTION_START = "com.mirroreuy.app.ACTION_START"
        const val ACTION_STOP = "com.mirroreuy.app.ACTION_STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"
        const val WS_PORT = 8888
        private const val CHANNEL_ID = "mirror_euy_capture"
        private const val NOTIF_ID = 101

        @Volatile
        var isRunning = false
            private set
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var wsServer: StreamWebSocketServer? = null
    private var captureThread: HandlerThread? = null
    private var captureHandler: Handler? = null

    private var streamWidth = 720
    private var streamHeight = 1280
    private var lastFrameTime = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                val data: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(EXTRA_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(EXTRA_DATA)
                }

                if (resultCode == Activity.RESULT_OK && data != null) {
                    startForeground(NOTIF_ID, createNotification())
                    startStreaming(resultCode, data)
                } else {
                    stopSelf()
                }
            }
            ACTION_STOP -> {
                stopStreaming()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startStreaming(resultCode: Int, data: Intent) {
        if (isRunning) return
        isRunning = true

        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)

        // Scale down to 720p width while preserving aspect ratio for low-latency streaming
        val aspect = metrics.heightPixels.toFloat() / metrics.widthPixels.toFloat()
        streamWidth = 720
        streamHeight = (720 * aspect).toInt().coerceAtLeast(1)

        captureThread = HandlerThread("MirrorEuyCapture").apply { start() }
        captureHandler = Handler(captureThread!!.looper)

        wsServer = StreamWebSocketServer(InetSocketAddress(WS_PORT)).apply {
            isReuseAddr = true
            start()
        }

        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, data)

        imageReader = ImageReader.newInstance(streamWidth, streamHeight, PixelFormat.RGBA_8888, 2)
        imageReader?.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                // Throttle to ~30 fps max to keep latency & CPU low
                val now = System.currentTimeMillis()
                if (now - lastFrameTime < 30 || wsServer?.connections.isNullOrEmpty()) {
                    return@setOnImageAvailableListener
                }
                lastFrameTime = now

                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride = planes[0].rowStride
                val rowPadding = rowStride - pixelStride * streamWidth

                val bitmap = Bitmap.createBitmap(
                    streamWidth + rowPadding / pixelStride,
                    streamHeight,
                    Bitmap.Config.ARGB_8888
                )
                bitmap.copyPixelsFromBuffer(buffer)

                val cropped = if (rowPadding > 0) {
                    Bitmap.createBitmap(bitmap, 0, 0, streamWidth, streamHeight).also {
                        bitmap.recycle()
                    }
                } else {
                    bitmap
                }

                val out = ByteArrayOutputStream()
                cropped.compress(Bitmap.CompressFormat.JPEG, 72, out)
                cropped.recycle()

                val jpegBytes = out.toByteArray()
                // Packet format: [0x01 (video frame)] + JPEG bytes
                val packet = ByteBuffer.allocate(1 + jpegBytes.size)
                packet.put(0x01.toByte())
                packet.put(jpegBytes)
                packet.flip()

                wsServer?.broadcast(packet)
            } catch (_: Exception) {
            } finally {
                image.close()
            }
        }, captureHandler)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "MirrorEuyDisplay",
            streamWidth,
            streamHeight,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface,
            null,
            captureHandler
        )
    }

    private fun stopStreaming() {
        isRunning = false
        try { virtualDisplay?.release() } catch (_: Exception) {}
        try { imageReader?.close() } catch (_: Exception) {}
        try { mediaProjection?.stop() } catch (_: Exception) {}
        try { wsServer?.stop(500) } catch (_: Exception) {}
        try { captureThread?.quitSafely() } catch (_: Exception) {}
        virtualDisplay = null
        imageReader = null
        mediaProjection = null
        wsServer = null
        captureThread = null
    }

    override fun onDestroy() {
        stopStreaming()
        super.onDestroy()
    }

    private fun createNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Mirror Euy Screen Capture",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Mirror Euy Aktif")
            .setContentText("Mengirim layar ke PC di port $WS_PORT")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
    }

    inner class StreamWebSocketServer(address: InetSocketAddress) : WebSocketServer(address) {
        override fun onOpen(conn: WebSocket?, handshake: ClientHandshake?) {
            conn?.send("""{"type":"info","width":$streamWidth,"height":$streamHeight,"device":"${Build.MODEL}"}""")
        }

        override fun onClose(conn: WebSocket?, code: Int, reason: String?, remote: Boolean) {}
        override fun onMessage(conn: WebSocket?, message: String?) {}
        override fun onError(conn: WebSocket?, ex: Exception?) {}
        override fun onStart() {}
    }
}
