const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  toggleAlwaysOnTop: (enable) => ipcRenderer.invoke('window:toggle-always-on-top', enable),
  setFullScreen: (enable) => ipcRenderer.invoke('window:set-fullscreen', enable),
  preventSleep: (enable) => ipcRenderer.invoke('system:prevent-sleep', enable),

  // Device & Mirroring
  detectUsbDevices: () => ipcRenderer.invoke('device:detect-usb'),
  detectWifiDevices: () => ipcRenderer.invoke('device:detect-wifi'),
  adbForward: (serial) => ipcRenderer.invoke('device:adb-forward', serial),
  saveRecording: (payload) => ipcRenderer.invoke('recording:save', payload),
});
