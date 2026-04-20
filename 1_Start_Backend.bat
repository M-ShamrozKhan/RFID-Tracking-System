@echo off
TITLE RFID Backend Server
echo ==============================================
echo 🚀 LAUNCHING RFID BACKEND API SERVER...
echo ==============================================
echo.
cd "%~dp0\RFID_Backend"
"C:\Program Files\dotnet\dotnet.exe" run --urls="http://localhost:5000"
pause
