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
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.util.DisplayMetrics
import android.util.Log
import android.view.Display
import android.view.Surface
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
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
    private var wsServer: StreamWebSocketServer? = null
    private var captureThread: HandlerThread? = null
    private var captureHandler: Handler? = null

    // WakeLock — cegah CPU & WiFi dibekukan saat streaming
    private var wakeLock: PowerManager.WakeLock? = null

    private var mediaCodec: MediaCodec? = null
    private var encoderSurface: Surface? = null
    private var encoderThread: Thread? = null
    private val encoderActive = AtomicBoolean(false)
    @Volatile private var spsPpsBytes: ByteArray? = null

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
    private var targetFps = 60
    private var jpegQuality = 55
    private var densityDpi = DisplayMetrics.DENSITY_HIGH
    private var fpsCounter = 0
    private var fpsTickTime = 0L
    private val isResizing = AtomicBoolean(false)

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
                targetFps = intent.getIntExtra(EXTRA_FPS, 60)
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
            streamHeight = (baseShortEdge and 0xFFFE).coerceAtLeast(16)
            streamWidth = ((baseShortEdge.toFloat() * realW / realH).toInt() and 0xFFFE).coerceAtLeast(16)
        } else {
            streamWidth = (baseShortEdge and 0xFFFE).coerceAtLeast(16)
            streamHeight = ((baseShortEdge.toFloat() * realH / realW).toInt() and 0xFFFE).coerceAtLeast(16)
        }
    }

    private fun createH264Encoder(width: Int, height: Int): Pair<MediaCodec, Surface> {
        val bitrate = when {
            baseShortEdge >= 1000 -> 12_000_000
            baseShortEdge >= 700 -> 8_000_000
            else -> 5_000_000
        }
        val fps = targetFps.coerceIn(15, 60)

        fun buildFormat(withBaseline: Boolean): MediaFormat {
            return MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
                setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
                setInteger(MediaFormat.KEY_FRAME_RATE, fps)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
                setInteger(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 100_000)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    setInteger(MediaFormat.KEY_PRIORITY, 0) // Realtime priority
                }
                if (withBaseline) {
                    // TinyH264 requires Baseline / Constrained Baseline (no B-frames)
                    setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline)
                }
            }
        }

        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        val caps = try {
            codec.codecInfo.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC)
        } catch (_: Exception) { null }
        val maxBaselineLevel = caps?.profileLevels
            ?.filter { it.profile == MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline }
            ?.maxOfOrNull { it.level }

        fun buildFormatWithProfile(profile: Int?, level: Int?): MediaFormat {
            return buildFormat(false).apply {
                if (profile != null) {
                    setInteger(MediaFormat.KEY_PROFILE, profile)
                    if (level != null) {
                        setInteger(MediaFormat.KEY_LEVEL, level)
                    }
                }
            }
        }

        try {
            if (maxBaselineLevel != null) {
                codec.configure(
                    buildFormatWithProfile(MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline, maxBaselineLevel),
                    null, null, MediaCodec.CONFIGURE_FLAG_ENCODE
                )
            } else {
                codec.configure(
                    buildFormatWithProfile(MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline, MediaCodecInfo.CodecProfileLevel.AVCLevel5),
                    null, null, MediaCodec.CONFIGURE_FLAG_ENCODE
                )
            }
        } catch (e: Exception) {
            Log.w("MirrorEuy", "Baseline profile configure failed, retrying default: ${e.message}")
            codec.reset()
            codec.configure(buildFormat(false), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        }

        val surface = codec.createInputSurface()
        codec.start()
        return codec to surface
    }

    private fun startEncoderDrain(codec: MediaCodec) {
        encoderActive.set(true)
        fpsTickTime = System.currentTimeMillis()
        fpsCounter = 0

        encoderThread = Thread {
            val bufferInfo = MediaCodec.BufferInfo()
            while (isRunning && encoderActive.get()) {
                try {
                    val outIdx = codec.dequeueOutputBuffer(bufferInfo, 10_000)
                    if (outIdx >= 0) {
                        val outBuf = codec.getOutputBuffer(outIdx)
                        if (outBuf != null && bufferInfo.size > 0) {
                            outBuf.position(bufferInfo.offset)
                            outBuf.limit(bufferInfo.offset + bufferInfo.size)
                            val nalBytes = ByteArray(bufferInfo.size)
                            outBuf.get(nalBytes)

                            val isConfig = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                            if (isConfig) {
                                spsPpsBytes = nalBytes
                            }

                            if (connectedClients > 0) {
                                val packet = ByteBuffer.allocate(1 + nalBytes.size)
                                packet.put(0x03.toByte())
                                packet.put(nalBytes)
                                packet.flip()

                                val conns = wsServer?.connections
                                if (conns != null) {
                                    for (conn in conns) {
                                        if (conn.isOpen) {
                                            conn.send(packet.duplicate())
                                        }
                                    }
                                }
                            }

                            if (!isConfig) {
                                fpsCounter++
                                val now = System.currentTimeMillis()
                                if (now - fpsTickTime >= 1000L) {
                                    currentFps = fpsCounter
                                    fpsCounter = 0
                                    fpsTickTime = now
                                }
                            }
                        }
                        codec.releaseOutputBuffer(outIdx, false)
                    }
                } catch (_: IllegalStateException) {
                    break
                } catch (e: Exception) {
                    if (encoderActive.get()) {
                        Log.e("MirrorEuy", "Encoder drain error: ${e.message}")
                    }
                    break
                }
            }
        }.apply {
            name = "MirrorEuyH264"
            start()
        }
    }

    private fun stopEncoder() {
        encoderActive.set(false)
        try { encoderThread?.join(300) } catch (_: Exception) {}
        try { mediaCodec?.signalEndOfInputStream() } catch (_: Exception) {}
        try { mediaCodec?.stop() } catch (_: Exception) {}
        try { mediaCodec?.release() } catch (_: Exception) {}
        try { encoderSurface?.release() } catch (_: Exception) {}
        encoderThread = null
        mediaCodec = null
        encoderSurface = null
        spsPpsBytes = null
    }

    private fun requestSyncFrame() {
        try {
            val params = Bundle().apply {
                putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0)
            }
            mediaCodec?.setParameters(params)
        } catch (_: Exception) {}
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

                // 1. Stop old H.264 encoder
                stopEncoder()

                // 2. Create new H.264 encoder for new dimensions
                val (newCodec, newSurface) = createH264Encoder(streamWidth, streamHeight)
                mediaCodec = newCodec
                encoderSurface = newSurface

                // 3. Resize virtual display and attach new surface
                virtualDisplay?.resize(streamWidth, streamHeight, densityDpi)
                virtualDisplay?.setSurface(newSurface)

                // 4. Start draining new encoder
                startEncoderDrain(newCodec)

                // 5. Notify PC about new dimensions
                Log.d("MirrorEuy", "Resized H.264 stream to ${streamWidth}x${streamHeight}")
                wsServer?.broadcast(
                    """{"type":"info","codec":"h264","width":$streamWidth,"height":$streamHeight,"device":"${android.os.Build.MODEL}"}"""
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

            val (codec, surface) = createH264Encoder(streamWidth, streamHeight)
            mediaCodec = codec
            encoderSurface = surface

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "MirrorEuyDisplay",
                streamWidth,
                streamHeight,
                densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                surface,
                null,
                captureHandler
            )

            startEncoderDrain(codec)

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
        stopEncoder()
        try { mediaProjection?.unregisterCallback(projectionCallback) } catch (_: Exception) {}
        try { mediaProjection?.stop() } catch (_: Exception) {}
        try { wsServer?.stop(300) } catch (_: Exception) {}
        try { captureThread?.quitSafely() } catch (_: Exception) {}
        try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
        wakeLock = null
        audioRecord = null
        audioThread = null
        virtualDisplay = null
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
            .setContentTitle("Mirror Euy Aktif (H.264)")
            .setContentText("Server mirroring 60 FPS aktif di port $WS_PORT")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
    }

    inner class StreamWebSocketServer(address: InetSocketAddress) : WebSocketServer(address) {
        override fun onOpen(conn: WebSocket?, handshake: ClientHandshake?) {
            connectedClients = connections.size
            conn?.send("""{"type":"info","codec":"h264","width":$streamWidth,"height":$streamHeight,"device":"${android.os.Build.MODEL}"}""")
            val sps = spsPpsBytes
            if (sps != null && conn != null && conn.isOpen) {
                val pkt = ByteBuffer.allocate(1 + sps.size)
                pkt.put(0x03.toByte())
                pkt.put(sps)
                pkt.flip()
                conn.send(pkt)
            }
            requestSyncFrame()
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
