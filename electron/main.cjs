const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { exec } = require('child_process');

let mainWindow = null;
let powerSaveId = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0A0A14',
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

function getAdbCommand() {
  const localPlatformTools = path.join(process.env.USERPROFILE || '', 'platform-tools', 'adb.exe');
  if (fs.existsSync(localPlatformTools)) {
    return `"${localPlatformTools}"`;
  }
  return 'adb';
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

// Save recording dialog
ipcMain.handle('recording:save', async (event, { defaultName, buffer }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Simpan Rekaman Mirror Euy',
    defaultPath: defaultName || `MirrorEuy_${Date.now()}.webm`,
    filters: [
      { name: 'Video Files', extensions: ['webm', 'mp4', 'mkv'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, Buffer.from(buffer));
      return { success: true, path: result.filePath };
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
