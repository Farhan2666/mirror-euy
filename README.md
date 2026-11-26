# ⚡ Mirror Euy - Ultra Low-Latency Stream Receiver

> *"Pixel-Perfect Streaming, Zero Latency Illusions"*

**Mirror Euy** adalah aplikasi desktop receiver screen mirroring smartphone-ke-PC kelas esports dengan latensi sub-50ms yang dirancang khusus untuk mobile live streamers, software educators, dan gamers.

---

## 🚀 Fitur Utama

1. **Wire-Grade Low Latency (<50ms)**
   - Akselerasi hardware USB 3.0 & WiFi 6.
   - Real-time telemetry: Latency (ms), Jitter, Bitrate (Mbps), Dropped frames, dan FPS counter (30 / 60 / 90 FPS).

2. **Auto Hybrid USB/WiFi Failover**
   - Transisi otomatis tanpa blackout bila koneksi USB terlepas atau packet loss WiFi > 5%.

3. **Lossless Codec Toggle**
   - Mendukung switch cepat antara **HEVC (H.265)** untuk efisiensi tinggi, **PNG Lossless** untuk kualitas pixel-perfect pada teks/UI, dan **H.264 High Profile**.

4. **Streamer HUD & OBS Auto Scene Switcher**
   - Integrasi OBS Websockets (port 4455) dengan penggantian scene otomatis saat game dibuka.
   - Twitch / YouTube live comment overlay & alert notifikasi langsung di sudut layar.

5. **Live Annotation & Real-Time Collaboration**
   - Menggambar coretan, garis panah, dan highlight langsung di atas layar mirroring.
   - Sesi kolaborasi multi-user hingga 5 peserta dengan kontrol izin co-host.

6. **One-Click Recording Bundling**
   - Rekam layar smartphone dan audio tersinkronisasi dalam satu klik dengan ekspor format video.

---

## 🛠️ Tech Stack

- **Desktop Framework:** Electron 33 (Native window, IPC bridge, Power Save Blocker, ADB USB device detection)
- **Frontend:** React 18, TypeScript, Vite 5
- **Styling:** Tailwind CSS (Theme Quantum Black `#0A0A14`, Neon Plasma `#00FFC1`, Stable Blue `#0066FF`, Error Red `#FF2E4D`)
- **Icons:** Lucide React

---

## 💻 Cara Menjalankan

### Mode Development:
```bash
# Masuk ke direktori proyek
cd D:\project\mirror-euy

# Jalankan Vite + Electron secara bersamaan
npm run dev
```
Atau cukup klik dua kali file **`run-dev.bat`**.

### Build Produksi:
```bash
npm run build
```

---

## 📁 Struktur Direktori

```
D:\project\mirror-euy\
├── electron\
│   ├── main.cjs        # Main process Electron (Window, IPC, USB/ADB detector)
│   └── preload.cjs     # Context bridge & secure API exposure
├── src\
│   ├── components\
│   │   ├── HeaderBar.tsx           # Cyberpunk titlebar dengan live telemetry & window control
│   │   ├── ConnectView.tsx         # Layar penemuan perangkat (USB/WiFi radar scan)
│   │   ├── ReceiverCanvas.tsx      # Canvas interaktif phone screen dengan dynamic feed 60/90fps
│   │   ├── StreamerHUD.tsx         # Corner HUD meter & chat overlay
│   │   ├── FloatingControls.tsx    # Bottom floating dock (Record, Codec, OBS, Anotasi)
│   │   ├── CollaborationModal.tsx  # Modal berbagi sesi kolaborasi (maks. 5 user)
│   │   └── SettingsModal.tsx       # Konfigurasi OBS, resolusi, failover, & battery saver
│   ├── types.ts                    # TypeScript definitions
│   ├── App.tsx                     # State orchestrator & layout utama
│   └── main.tsx                    # Entry point React
├── public\
│   └── logo.svg                    # Brand logo overlapping rhombus
├── package.json
└── vite.config.ts
```
