// start-electron.cjs
// Wrapper to strip ELECTRON_RUN_AS_NODE before launching Electron GUI.
// This env var is set by some IDEs (e.g. Antigravity) to enable Node REPL mode,
// which causes Electron's main-process APIs (app, ipcMain, etc.) to be undefined.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

// Resolve the actual electron.exe path
const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
if (!fs.existsSync(electronPath)) {
  console.error('[mirror-euy] Cannot find electron.exe at:', electronPath);
  process.exit(1);
}

// Build a clean env without ELECTRON_RUN_AS_NODE
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;
env.NODE_ENV = 'development';

console.log('[mirror-euy] Launching Electron GUI (NODE_ENV=development)...');
console.log('[mirror-euy] ELECTRON_RUN_AS_NODE stripped =', !env.ELECTRON_RUN_AS_NODE);

const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: env,
  windowsHide: false,
});

child.on('close', (code) => process.exit(code ?? 0));
child.on('error', (err) => { console.error(err); process.exit(1); });
