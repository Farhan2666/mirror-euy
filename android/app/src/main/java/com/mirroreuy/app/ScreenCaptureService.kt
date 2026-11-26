package com.mirroreuy.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.Display
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.io.ByteArrayOutputStream
import java.net.InetSocketAddress
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

class ScreenCaptureService : Service() {

    companion object {
        const val ACTION_START = "com.mirroreuy.app.ACTION_START"
        const val ACTION_STOP = "com.mirroreuy.app.ACTION_STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"
        const val EXTRA_WIDTH = "stream_width"
        const val EXTRA_FPS = "target_fps"
        const val EXTRA_QUALITY = "jpeg_quality"
        const val WS_PORT = 8888
        private const val CHANNEL_ID = "mirror_euy_capture"
        private const val NOTIF_ID = 101

        @Volatile var isRunning = false
            private set
        @Volatile var connectedClients = 0
            private set
        @Volatile var currentFps = 0
            private set
        @Volatile var lastError: String? = null
            private set
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var wsServer: StreamWebSocketServer? = null
    private var captureThread: HandlerThread? = null
    private var captureHandler: Handler? = null

    private var audioRecord: AudioRecord? = null
    private var audioThread: Thread? = null
    private var displayManager: DisplayManager? = null

    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) {}
        override fun onDisplayRemoved(displayId: Int) {}
        override fun onDisplayChanged(displayId: Int) {
            if (displayId == Display.DEFAULT_DISPLAY && isRunning && virtualDisplay != null) {
                doResize()
            }
        }
    }

    private var baseShortEdge = 540
    private var streamWidth = 540
    private var streamHeight = 960
    private var targetFps = 30
    private var jpegQuality = 55
    private var densityDpi = DisplayMetrics.DENSITY_HIGH
    private var lastFrameTime = 0L
    private var fpsCounter = 0
    private var fpsTickTime = 0L
    private val isProcessingFrame = AtomicBoolean(false)
    private val isResizing = AtomicBoolean(false)
    private val jpegOut = ByteArrayOutputStream(65536)

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            stopStreaming()
            stopSelf()
        }
    }

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

                baseShortEdge = intent.getIntExtra(EXTRA_WIDTH, 540)
                targetFps = intent.getIntExtra(EXTRA_FPS, 30)
                jpegQuality = intent.getIntExtra(EXTRA_QUALITY, 55)

                if (resultCode == Activity.RESULT_OK && data != null) {
                    try {
                        val fgType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                        } else {
                            0
                        }
                        ServiceCompat.startForeground(this, NOTIF_ID, createNotification(), fgType)
                        startStreaming(resultCode, data)
                    } catch (e: Exception) {
                        lastError = "Gagal start service: ${e.message}"
                        stopSelf()
                    }
                } else {
                    lastError = "Izin rekam layar ditolak"
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

    @Suppress("DEPRECATION")
    private fun computeStreamDimensions() {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        wm.defaultDisplay.getRealMetrics(metrics)
        densityDpi = metrics.densityDpi

        val realW = metrics.widthPixels.coerceAtLeast(1)
        val realH = metrics.heightPixels.coerceAtLeast(1)

        if (realW > realH) {
            // Landscape: short edge is height
            streamHeight = baseShortEdge
            streamWidth = ((baseShortEdge.toFloat() * realW / realH).toInt() and 0xFFFE).coerceAtLeast(2)
        } else {
            // Portrait: short edge is width
            streamWidth = baseShortEdge
            streamHeight = ((baseShortEdge.toFloat() * realH / realW).toInt() and 0xFFFE).coerceAtLeast(2)
        }
    }

    private fun setupImageReader(): ImageReader {
        val minFrameIntervalMs = (1000L / targetFps.coerceAtLeast(1)).coerceAtLeast(14L)
        val w = streamWidth
        val h = streamHeight
        val reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        reader.setOnImageAvailableListener({ r ->
            if (isResizing.get()) {
                r.acquireLatestImage()?.close()
                return@setOnImageAvailableListener
            }
            val image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val now = System.currentTimeMillis()
                if (now - lastFrameTime < minFrameIntervalMs || connectedClients <= 0) {
                    return@setOnImageAvailableListener
                }

                val conns = wsServer?.connections
                if (conns.isNullOrEmpty() || conns.all { it.hasBufferedData() }) {
                    return@setOnImageAvailableListener
                }
                if (!isProcessingFrame.compareAndSet(false, true)) {
                    return@setOnImageAvailableListener
                }

                lastFrameTime = now

                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride = planes[0].rowStride
                val rowPadding = rowStride - pixelStride * w

                val bitmap = Bitmap.createBitmap(
                    w + rowPadding / pixelStride,
                    h,
                    Bitmap.Config.ARGB_8888
                )
                bitmap.copyPixelsFromBuffer(buffer)

                val cropped = if (rowPadding > 0) {
                    Bitmap.createBitmap(bitmap, 0, 0, w, h).also { bitmap.recycle() }
                } else {
                    bitmap
                }

                jpegOut.reset()
                cropped.compress(Bitmap.CompressFormat.JPEG, jpegQuality, jpegOut)
                cropped.recycle()

                val jpegBytes = jpegOut.toByteArray()
                val packet = ByteBuffer.allocate(1 + jpegBytes.size)
                packet.put(0x01.toByte())
                packet.put(jpegBytes)
                packet.flip()

                for (conn in conns) {
                    if (conn.isOpen && !conn.hasBufferedData()) {
                        conn.send(packet.duplicate())
                    }
                }

                fpsCounter++
                if (now - fpsTickTime >= 1000L) {
                    currentFps = fpsCounter
                    fpsCounter = 0
                    fpsTickTime = now
                }
            } catch (_: Exception) {
            } finally {
                isProcessingFrame.set(false)
                image.close()
            }
        }, captureHandler)
        return reader
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (!isRunning || mediaProjection == null || virtualDisplay == null) return
        doResize()
    }

    private fun doResize() {
        if (isResizing.getAndSet(true)) return
        captureHandler?.post {
            try {
                val oldW = streamWidth
                val oldH = streamHeight
                computeStreamDimensions()

                if (streamWidth == oldW && streamHeight == oldH) {
                    isResizing.set(false)
                    return@post
                }

                // 1. Stop old reader from receiving frames
                val oldReader = imageReader
                oldReader?.setOnImageAvailableListener(null, null)

                // 2. Create new reader with new dimensions
                val newReader = setupImageReader()
                imageReader = newReader

                // 3. Resize virtual display and attach new surface
                virtualDisplay?.resize(streamWidth, streamHeight, densityDpi)
                virtualDisplay?.setSurface(newReader.surface)

                // 4. Close old reader safely
                try { oldReader?.close() } catch (_: Exception) {}

                // 5. Notify PC about new dimensions
                Log.d("MirrorEuy", "Resized stream to ${streamWidth}x${streamHeight}")
                wsServer?.broadcast(
                    """{"type":"info","width":$streamWidth,"height":$streamHeight,"device":"${android.os.Build.MODEL}"}"""
                )
            } catch (e: Exception) {
                Log.e("MirrorEuy", "Resize error: ${e.message}")
            } finally {
                isResizing.set(false)
            }
        }
    }

    private fun startStreaming(resultCode: Int, data: Intent) {
        if (isRunning) return
        lastError = null
        isRunning = true

        try {
            computeStreamDimensions()

            captureThread = HandlerThread("MirrorEuyCapture").apply { start() }
            captureHandler = Handler(captureThread!!.looper)

            wsServer = StreamWebSocketServer(InetSocketAddress("0.0.0.0", WS_PORT)).apply {
                isReuseAddr = true
                isTcpNoDelay = true
                start()
            }

            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, data)
            mediaProjection?.registerCallback(projectionCallback, captureHandler)

            fpsTickTime = System.currentTimeMillis()
            imageReader = setupImageReader()

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "MirrorEuyDisplay",
                streamWidth,
                streamHeight,
                densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                captureHandler
            )

            displayManager = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
            displayManager?.registerDisplayListener(displayListener, captureHandler)

            startAudioCapture()
        } catch (e: Exception) {
            lastError = "Error capture: ${e.message}"
            stopStreaming()
            stopSelf()
        }
    }

    @SuppressLint("MissingPermission")
    private fun startAudioCapture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w("MirrorEuy", "RECORD_AUDIO permission not granted")
            return
        }
        val projection = mediaProjection ?: return

        try {
            val sampleRate = 48000
            val config = AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
                .build()

            val minBuf = AudioRecord.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_IN_STEREO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(4096)

            val recorder = AudioRecord.Builder()
                .setAudioFormat(audioFormat)
                .setBufferSizeInBytes(minBuf * 2)
                .setAudioPlaybackCaptureConfig(config)
                .build()

            if (recorder.state != AudioRecord.STATE_INITIALIZED) {
                Log.e("MirrorEuy", "AudioRecord failed to initialize")
                recorder.release()
                return
            }

            audioRecord = recorder
            recorder.startRecording()
            Log.d("MirrorEuy", "AudioPlaybackCapture started at ${sampleRate}Hz Stereo")

            audioThread = Thread {
                val pcmBuf = ByteArray(4096)
                while (isRunning && audioRecord != null) {
                    val read = recorder.read(pcmBuf, 0, pcmBuf.size)
                    if (read > 0 && connectedClients > 0) {
                        val packet = ByteBuffer.allocate(1 + read)
                        packet.put(0x02.toByte())
                        packet.put(pcmBuf, 0, read)
                        packet.flip()

                        val conns = wsServer?.connections
                        if (conns != null) {
                            for (conn in conns) {
                                if (conn.isOpen && !conn.hasBufferedData()) {
                                    conn.send(packet.duplicate())
                                }
                            }
                        }
                    }
                }
            }.apply {
                name = "MirrorEuyAudio"
                start()
            }
        } catch (e: Exception) {
            Log.e("MirrorEuy", "startAudioCapture error: ${e.message}")
        }
    }

    private fun stopStreaming() {
        isRunning = false
        connectedClients = 0
        currentFps = 0
        try { displayManager?.unregisterDisplayListener(displayListener) } catch (_: Exception) {}
        try { audioRecord?.stop() } catch (_: Exception) {}
        try { audioRecord?.release() } catch (_: Exception) {}
        try { audioThread?.interrupt() } catch (_: Exception) {}
        try { virtualDisplay?.release() } catch (_: Exception) {}
        try { imageReader?.close() } catch (_: Exception) {}
        try { mediaProjection?.unregisterCallback(projectionCallback) } catch (_: Exception) {}
        try { mediaProjection?.stop() } catch (_: Exception) {}
        try { wsServer?.stop(300) } catch (_: Exception) {}
        try { captureThread?.quitSafely() } catch (_: Exception) {}
        audioRecord = null
        audioThread = null
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
            .setContentText("Server mirroring aktif di port $WS_PORT")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
    }

    inner class StreamWebSocketServer(address: InetSocketAddress) : WebSocketServer(address) {
        override fun onOpen(conn: WebSocket?, handshake: ClientHandshake?) {
            connectedClients = connections.size
            conn?.send("""{"type":"info","width":$streamWidth,"height":$streamHeight,"device":"${android.os.Build.MODEL}"}""")
        }

        override fun onClose(conn: WebSocket?, code: Int, reason: String?, remote: Boolean) {
            connectedClients = connections.size
            if (connectedClients == 0) currentFps = 0
        }

        override fun onMessage(conn: WebSocket?, message: String?) {}

        override fun onError(conn: WebSocket?, ex: Exception?) {
            if (conn == null && ex != null) {
                lastError = "Server error: ${ex.message}"
            }
        }

        override fun onStart() {}
    }
}
