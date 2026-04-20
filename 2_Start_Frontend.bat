@echo off
TITLE RFID Frontend Real-Time Dashboard
echo ==============================================
echo 🌐 LAUNCHING RFID DASHBOARD UI...
echo ==============================================
echo.
cd "%~dp0\RFID_Frontend"
"C:\Program Files\nodejs\npm.cmd" run dev
pause
