const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { exec, execFile } = require('child_process');

let mainWindow = null;
let powerSaveId = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0D2F3F',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    icon: fs.existsSync(path.join(__dirname, '../public/logo.png')) ? path.join(__dirname, '../public/logo.png') : undefined,
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL('http://localhost:5173');
      }, 1000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
      powerSaveBlocker.stop(powerSaveId);
    }
  });
}

// Window control IPC
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:toggle-always-on-top', (event, enable) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(enable, 'screen-saver');
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle('window:set-fullscreen', (event, enable) => {
  if (mainWindow) {
    mainWindow.setFullScreen(!!enable);
    return mainWindow.isFullScreen();
  }
  return false;
});

let preStreamState = null;

ipcMain.handle('window:set-stream-mode', (event, payload) => {
  if (!mainWindow) return false;
  const { enable, aspectW, aspectH } = payload || {};

  if (enable) {
    if (!preStreamState) {
      preStreamState = {
        wasMaximized: mainWindow.isMaximized(),
        wasFullScreen: mainWindow.isFullScreen(),
        bounds: mainWindow.getBounds(),
      };
    }
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    if (mainWindow.isMaximized()) mainWindow.unmaximize();

    mainWindow.setMinimumSize(240, 240);

    const w = Math.max(1, Number(aspectW) || 540);
    const h = Math.max(1, Number(aspectH) || 1170);
    const isLandscape = w > h;

    // Fit cleanly inside current display workArea
    const { screen } = require('electron');
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    const maxW = Math.floor(display.workAreaSize.width * 0.85);
    const maxH = Math.floor(display.workAreaSize.height * 0.88);

    let targetH = isLandscape ? Math.min(540, maxH) : Math.min(820, maxH);
    let targetW = Math.round(targetH * (w / h));
    if (targetW > maxW) {
      targetW = maxW;
      targetH = Math.round(targetW * (h / w));
    }

    mainWindow.setAspectRatio(w / h);
    mainWindow.setSize(Math.max(240, targetW), Math.max(240, targetH));
    return true;
  } else {
    mainWindow.setAspectRatio(0);
    mainWindow.setMinimumSize(960, 640);
    if (preStreamState) {
      if (preStreamState.wasMaximized) {
        mainWindow.maximize();
      } else if (preStreamState.bounds) {
        mainWindow.setBounds(preStreamState.bounds);
      }
      preStreamState = null;
    }
    return false;
  }
});

// Power Save Blocker for live streamers (prevents sleep during stream)
ipcMain.handle('system:prevent-sleep', (event, enable) => {
  if (enable) {
    if (powerSaveId === null || !powerSaveBlocker.isStarted(powerSaveId)) {
      powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    }
  } else {
    if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
      powerSaveBlocker.stop(powerSaveId);
      powerSaveId = null;
    }
  }
  return powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId);
});

function getAdbBinary() {
  const localPlatformTools = path.join(process.env.USERPROFILE || '', 'platform-tools', 'adb.exe');
  if (fs.existsSync(localPlatformTools)) {
    return localPlatformTools;
  }
  return 'adb';
}

function getAdbCommand() {
  const bin = getAdbBinary();
  return bin === 'adb' ? 'adb' : `"${bin}"`;
}

let cachedScreenSize = null; // { shortEdge, longEdge }

function runAdbShell(args, serial) {
  const adbBin = getAdbBinary();
  const fullArgs = serial ? ['-s', serial, 'shell', ...args] : ['shell', ...args];
  return new Promise((resolve) => {
    execFile(adbBin, fullArgs, { timeout: 3000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message, stdout: '' });
      } else {
        resolve({ success: true, stdout: stdout || '' });
      }
    });
  });
}

async function getPhoneScreenSize(serial) {
  if (cachedScreenSize) return cachedScreenSize;
  const res = await runAdbShell(['wm', 'size'], serial);
  if (res.success && res.stdout) {
    const match = res.stdout.match(/Override size:\s*(\d+)x(\d+)/i) || res.stdout.match(/Physical size:\s*(\d+)x(\d+)/i);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      cachedScreenSize = { shortEdge: Math.min(w, h), longEdge: Math.max(w, h) };
      return cachedScreenSize;
    }
  }
  return { shortEdge: 1080, longEdge: 2400 };
}

// Detect USB / ADB connected devices
ipcMain.handle('device:detect-usb', async () => {
  const adb = getAdbCommand();
  return new Promise((resolve) => {
    exec(`${adb} devices -l`, (error, stdout) => {
      if (error || !stdout) {
        resolve({ hasAdb: false, devices: [] });
        return;
      }

      const lines = stdout.split('\n').filter(l => l.trim() && !l.includes('List of devices'));
      const found = lines.map((line, idx) => {
        const parts = line.trim().split(/\s+/);
        const serial = parts[0] || `device_${idx}`;
        const modelMatch = line.match(/model:(\S+)/);
        const rawName = modelMatch ? modelMatch[1].replace(/_/g, ' ') : `Android (${serial})`;
        return {
          id: serial,
          name: rawName,
          type: 'USB',
          status: parts[1] === 'device' ? 'ready' : 'unauthorized',
          serial,
        };
      });

      resolve({ hasAdb: true, devices: found });
    });
  });
});

// Forward TCP port 8888 over USB ADB so PC can connect to ws://127.0.0.1:8888
ipcMain.handle('device:adb-forward', async (event, serial) => {
  const adb = getAdbCommand();
  return new Promise((resolve) => {
    const cmd = serial ? `${adb} -s "${serial}" forward tcp:8888 tcp:8888` : `${adb} forward tcp:8888 tcp:8888`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, port: 8888 });
      }
    });
  });
});

function probePort(ip, port, timeoutMs = 350) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.connect(port, ip);
  });
}

// Scan local WiFi/LAN subnets for Mirror Euy Android servers listening on port 8888
ipcMain.handle('device:detect-wifi', async () => {
  const interfaces = os.networkInterfaces();
  const localIps = [];
  const subnets = new Set();

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const lower = name.toLowerCase();
    // Skip obvious virtual/VPN adapters when scanning
    if (lower.includes('vethernet') || lower.includes('wsl') || lower.includes('virtualbox') || lower.includes('vmware')) {
      continue;
    }
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        localIps.push(addr.address);
        const parts = addr.address.split('.');
        if (parts.length === 4) {
          subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }

  const foundDevices = [];
  for (const subnet of subnets) {
    const probes = [];
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${subnet}.${i}`;
      if (localIps.includes(targetIp)) continue;
      probes.push(
        probePort(targetIp, 8888, 350).then((open) => {
          if (open) {
            foundDevices.push({
              id: `wifi_${targetIp}`,
              name: `Android (${targetIp})`,
              ip: targetIp,
              port: 8888,
              type: 'WiFi',
              status: 'ready',
            });
          }
        })
      );
    }
    await Promise.all(probes);
  }

  return { localIps, devices: foundDevices };
});

// Check if ADB control is available & fetch physical screen size
ipcMain.handle('control:status', async (event, serial) => {
  const adbBin = getAdbBinary();
  const hasDevice = await new Promise((resolve) => {
    execFile(adbBin, ['devices'], { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) return resolve(false);
      const lines = stdout.split('\n').filter(l => l.trim() && !l.includes('List of devices'));
      resolve(lines.some(l => /\s+device\b/.test(l)));
    });
  });
  if (!hasDevice) {
    cachedScreenSize = null;
    return { ready: false };
  }
  const size = await getPhoneScreenSize(serial);
  return { ready: true, size };
});

// Send touch / swipe / key / text input to Android via ADB
ipcMain.handle('control:input', async (event, payload) => {
  const { type, serial, isLandscape } = payload || {};
  if (!type) return { success: false };

  if (type === 'key') {
    const code = parseInt(payload.keyCode, 10);
    if (Number.isNaN(code)) return { success: false };
    return runAdbShell(['input', 'keyevent', String(code)], serial);
  }

  if (type === 'text') {
    const raw = String(payload.text || '');
    if (!raw) return { success: false };
    // Escape space for adb shell input text
    const safe = raw.replace(/ /g, '%s').replace(/(["'\\`$!&|;<>()?*~])/g, '\\$1');
    return runAdbShell(['input', 'text', safe], serial);
  }

  const size = await getPhoneScreenSize(serial);
  const targetW = isLandscape ? size.longEdge : size.shortEdge;
  const targetH = isLandscape ? size.shortEdge : size.longEdge;
  const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));

  if (type === 'tap') {
    const x = Math.round(clamp(payload.nx) * targetW);
    const y = Math.round(clamp(payload.ny) * targetH);
    return runAdbShell(['input', 'tap', String(x), String(y)], serial);
  }

  if (type === 'swipe') {
    const x1 = Math.round(clamp(payload.nx1) * targetW);
    const y1 = Math.round(clamp(payload.ny1) * targetH);
    const x2 = Math.round(clamp(payload.nx2) * targetW);
    const y2 = Math.round(clamp(payload.ny2) * targetH);
    const dur = Math.max(60, Math.min(1500, Math.round(Number(payload.durationMs) || 200)));
    return runAdbShell(['input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(dur)], serial);
  }

  return { success: false };
});

// Save recording dialog — selalu simpan sebagai MP4 (konversi dari WebM via ffmpeg)
ipcMain.handle('recording:save', async (event, { defaultName, buffer, convertToMp4 }) => {
  if (!mainWindow) return null;

  const filters = [
    { name: 'Video MP4', extensions: ['mp4'] },
    { name: 'Video WebM', extensions: ['webm'] },
  ];
  const mp4Name = (defaultName || `MirrorEuy_${Date.now()}.webm`).replace(/\.webm$/i, '.mp4');

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Simpan Rekaman Mirror Euy',
    defaultPath: mp4Name,
    filters,
  });

  if (!result.canceled && result.filePath) {
    try {
      const savePath = result.filePath;
      const isMp4Out = savePath.toLowerCase().endsWith('.mp4');

      if (isMp4Out && convertToMp4) {
        // Simpan WebM sementara lalu konversi ke MP4 pakai ffmpeg-static
        const tmpPath = path.join(os.tmpdir(), `mirroreuy_tmp_${Date.now()}.webm`);
        fs.writeFileSync(tmpPath, Buffer.from(buffer));

        let ffmpegPath;
        try { ffmpegPath = require('ffmpeg-static'); } catch { ffmpegPath = null; }

        if (ffmpegPath && fs.existsSync(ffmpegPath)) {
          await new Promise((resolve, reject) => {
            const args = [
              '-y', '-i', tmpPath,
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-movflags', '+faststart',
              savePath,
            ];
            const { spawn } = require('child_process');
            const proc = spawn(ffmpegPath, args);
            proc.on('close', (code) => {
              try { fs.unlinkSync(tmpPath); } catch {}
              if (code === 0) resolve(true);
              else reject(new Error(`ffmpeg exit code ${code}`));
            });
            proc.on('error', (err) => {
              try { fs.unlinkSync(tmpPath); } catch {}
              reject(err);
            });
          });
        } else {
          // ffmpeg tidak ada, simpan langsung sebagai webm
          fs.writeFileSync(savePath, Buffer.from(buffer));
        }
      } else {
        fs.writeFileSync(savePath, Buffer.from(buffer));
      }

      return { success: true, path: savePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
