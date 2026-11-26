const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  toggleAlwaysOnTop: (enable) => ipcRenderer.invoke('window:toggle-always-on-top', enable),
  setFullScreen: (enable) => ipcRenderer.invoke('window:set-fullscreen', enable),
  setStreamMode: (payload) => ipcRenderer.invoke('window:set-stream-mode', payload),
  preventSleep: (enable) => ipcRenderer.invoke('system:prevent-sleep', enable),

  // Device & Mirroring
  detectUsbDevices: () => ipcRenderer.invoke('device:detect-usb'),
  detectWifiDevices: () => ipcRenderer.invoke('device:detect-wifi'),
  adbForward: (serial) => ipcRenderer.invoke('device:adb-forward', serial),
  checkControlAdb: (serial) => ipcRenderer.invoke('control:status', serial),
  sendPhoneInput: (payload) => ipcRenderer.invoke('control:input', payload),
  saveRecording: (payload) => ipcRenderer.invoke('recording:save', payload),
});
