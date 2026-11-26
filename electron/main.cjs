const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
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

// Detect USB / ADB connected devices
ipcMain.handle('device:detect-usb', async () => {
  return new Promise((resolve) => {
    exec('adb devices -l', (error, stdout) => {
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
  return new Promise((resolve) => {
    const cmd = serial ? `adb -s "${serial}" forward tcp:8888 tcp:8888` : 'adb forward tcp:8888 tcp:8888';
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, port: 8888 });
      }
    });
  });
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
