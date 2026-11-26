@echo off
title Mirror Euy
echo Menyiapkan Mirror Euy...

:: Hapus proses yang memakai port 5173 (Vite) jika masih ada
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Tunggu sebentar agar port benar-benar bebas
timeout /t 2 /nobreak >nul

cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
call npm run dev
pause
