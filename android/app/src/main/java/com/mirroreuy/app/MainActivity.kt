package com.mirroreuy.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.chip.ChipGroup
import java.net.Inet4Address
import java.net.NetworkInterface

class MainActivity : AppCompatActivity() {

    private lateinit var tvIpAddress: TextView
    private lateinit var tvConnInfoLabel: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvMetrics: TextView
    private lateinit var tvBadgeStatus: TextView
    private lateinit var btnToggleMirror: Button

    private lateinit var chipGroupConn: ChipGroup
    private lateinit var chipGroupMode: ChipGroup
    private lateinit var chipGroupRes: ChipGroup
    private lateinit var chipGroupFps: ChipGroup

    private val uiHandler = Handler(Looper.getMainLooper())
    private val statusPoller = object : Runnable {
        override fun run() {
            refreshStatus()
            uiHandler.postDelayed(this, 1000)
        }
    }

    private val captureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val width = when (chipGroupRes.checkedChipId) {
                R.id.chip480p -> 480
                R.id.chip1080p -> 1080
                else -> 720
            }
            val fps = if (chipGroupFps.checkedChipId == R.id.chip60fps) 60 else 30
            val quality = if (chipGroupMode.checkedChipId == R.id.chipModeGame) 62 else 75

            val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
                action = ScreenCaptureService.ACTION_START
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(ScreenCaptureService.EXTRA_DATA, result.data)
                putExtra(ScreenCaptureService.EXTRA_WIDTH, width)
                putExtra(ScreenCaptureService.EXTRA_FPS, fps)
                putExtra(ScreenCaptureService.EXTRA_QUALITY, quality)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            refreshStatus()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvIpAddress = findViewById(R.id.tvIpAddress)
        tvConnInfoLabel = findViewById(R.id.tvConnInfoLabel)
        tvStatus = findViewById(R.id.tvStatus)
        tvMetrics = findViewById(R.id.tvMetrics)
        tvBadgeStatus = findViewById(R.id.tvBadgeStatus)
        btnToggleMirror = findViewById(R.id.btnToggleMirror)

        chipGroupConn = findViewById(R.id.chipGroupConn)
        chipGroupMode = findViewById(R.id.chipGroupMode)
        chipGroupRes = findViewById(R.id.chipGroupRes)
        chipGroupFps = findViewById(R.id.chipGroupFps)

        requestNotificationPermissionIfNeeded()
        updateConnectionBanner()

        chipGroupConn.setOnCheckedStateChangeListener { _, _ ->
            updateConnectionBanner()
        }

        btnToggleMirror.setOnClickListener {
            if (ScreenCaptureService.isRunning) {
                val stopIntent = Intent(this, ScreenCaptureService::class.java).apply {
                    action = ScreenCaptureService.ACTION_STOP
                }
                startService(stopIntent)
                refreshStatus()
            } else {
                val projectionManager =
                    getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                captureLauncher.launch(projectionManager.createScreenCaptureIntent())
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateConnectionBanner()
        uiHandler.post(statusPoller)
    }

    override fun onPause() {
        uiHandler.removeCallbacks(statusPoller)
        super.onPause()
    }

    private fun updateConnectionBanner() {
        val isUsb = chipGroupConn.checkedChipId == R.id.chipUsb
        if (isUsb) {
            tvConnInfoLabel.text = "Mode Kabel USB (ADB Port ${ScreenCaptureService.WS_PORT}):"
            tvIpAddress.text = "USB Debugging Aktif → Siap"
        } else {
            val ip = getWifiIpAddress()
            tvConnInfoLabel.text = "Masukkan IP ini di Mirror Euy PC (tab WiFi):"
            tvIpAddress.text = "$ip : ${ScreenCaptureService.WS_PORT}"
        }
    }

    private fun refreshStatus() {
        val running = ScreenCaptureService.isRunning
        val err = ScreenCaptureService.lastError
        val clients = ScreenCaptureService.connectedClients
        val fps = ScreenCaptureService.currentFps

        if (running) {
            tvBadgeStatus.text = "LIVE"
            tvBadgeStatus.setBackgroundColor(0xFFDCFCE7.toInt())
            tvBadgeStatus.setTextColor(0xFF15803D.toInt())
            tvStatus.text = if (clients > 0) {
                "Terhubung ke PC! Layar sedang dikirim."
            } else {
                "Server aktif di port ${ScreenCaptureService.WS_PORT}. Menunggu PC..."
            }
            btnToggleMirror.text = "Hentikan Mirroring"
            btnToggleMirror.setBackgroundColor(0xFFEF4444.toInt())
        } else {
            tvBadgeStatus.text = "OFFLINE"
            tvBadgeStatus.setBackgroundColor(0xFFE2E8F0.toInt())
            tvBadgeStatus.setTextColor(0xFF475569.toInt())
            tvStatus.text = err ?: "Siap. Tekan Mulai Mirroring untuk membuka server."
            btnToggleMirror.text = "Mulai Mirroring"
            btnToggleMirror.setBackgroundColor(0xFF2563EB.toInt())
        }

        tvMetrics.text = "PC Terhubung: $clients | FPS: $fps"
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    100
                )
            }
        }
    }

    private fun getWifiIpAddress(): String {
        // 1. Prefer WifiManager IPv4 directly
        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            @Suppress("DEPRECATION")
            val ipInt = wm?.connectionInfo?.ipAddress ?: 0
            if (ipInt != 0) {
                return String.format(
                    "%d.%d.%d.%d",
                    ipInt and 0xff,
                    ipInt shr 8 and 0xff,
                    ipInt shr 16 and 0xff,
                    ipInt shr 24 and 0xff
                )
            }
        } catch (_: Exception) {}

        // 2. Fallback to wlan / ap / eth interfaces (ignore cellular rmnet/ccmni)
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces().toList()
            val preferred = interfaces.filter {
                val name = it.name.lowercase()
                name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("eth")
            }
            for (intf in (preferred + interfaces)) {
                val name = intf.name.lowercase()
                if (name.contains("rmnet") || name.contains("ccmni") || name.contains("tun")) continue
                for (addr in intf.inetAddresses) {
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        return addr.hostAddress ?: continue
                    }
                }
            }
        } catch (_: Exception) {}

        return "WiFi Tidak Aktif"
    }
}
