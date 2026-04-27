@echo off
title RFID Permanent Services
echo ====================================================
echo RFID Permanent Server ^& Tunnel (Auto-Restart)
echo ====================================================

REM Kill existing conflicting processes
taskkill /F /IM RFID_Backend.exe /T >nul 2>&1
taskkill /F /IM cloudflared.exe /T >nul 2>&1

REM Start the Backend in an auto-restart loop in a new window
start "RFID_Backend_AutoRestart" cmd /c "title RFID_Backend_Runner && cd RFID_Backend && :loop_backend && echo [Backend] Starting... && dotnet run --urls http://localhost:5000 && echo [Backend] Crashed! Restarting in 3s... && timeout /t 3 >nul && goto loop_backend"

REM Wait 5 seconds for backend to initialize
timeout /t 5 >nul

REM Start LocalTunnel in an auto-restart loop in a new window
start "RFID_Tunnel_AutoRestart" cmd /c "title RFID_Tunnel_Runner && :loop_tunnel && echo [Tunnel] Starting... && npx localtunnel --port 5000 --subdomain rfid-tracking && echo [Tunnel] Disconnected! Restarting in 3s... && timeout /t 3 >nul && goto loop_tunnel"

echo.
echo [SUCCESS] Backend and Tunnel are now running permanently in the background.
echo.
echo Your Permanent URL is:
echo https://rfid-tracking.loca.lt
echo.
echo (Do not close the new black windows that just opened)
pause
