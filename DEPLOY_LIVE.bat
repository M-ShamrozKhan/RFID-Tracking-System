@echo off
title RFID Fully Automatic Deploy
echo ====================================================
echo      RFID SYSTEM - ZERO-TOUCH DEPLOYER
echo ====================================================
echo.

REM 1. Build the project
echo [1/4] Building and Publishing project...
cd RFID_Frontend
call npm run build
cd ..\RFID_Backend
rd /s /q "..\PublishFolder" 2>nul
dotnet publish -c Release -o "..\PublishFolder"
REM copy "RFID_LaptopDB_v4.db" "..\PublishFolder\" /y  <-- REMOVED TO PREVENT OVERWRITING LIVE DATA
cd ..

REM 2. Automatic STOP (app_offline.htm)
echo [2/4] Putting server into Maintenance Mode (Unlocking files)...
echo ^<html^>^<body^>^<h1^>Site is being updated, please wait...^</h1^>^</body^>^</html^> > app_offline.htm
powershell -Command "$p = ConvertTo-SecureString 'Uhf@1234' -AsPlainText -Force; $creds = New-Object System.Management.Automation.PSCredential('deltaforce', $p); $webclient = New-Object System.Net.WebClient; $webclient.Credentials = $creds; $webclient.UploadFile('ftp://rfid-system-tesla.somee.com/www.rfid-system-tesla.somee.com/app_offline.htm', 'app_offline.htm')"

REM 3. Upload files (SKIPPING .db files)
echo [3/4] Uploading latest files...
powershell -Command "$p = ConvertTo-SecureString 'Uhf@1234' -AsPlainText -Force; $creds = New-Object System.Management.Automation.PSCredential('deltaforce', $p); Get-ChildItem -Path 'PublishFolder\*' -Recurse | ForEach-Object { if (!$_.PSIsContainer -and $_.Extension -ne '.db') { $target = 'ftp://rfid-system-tesla.somee.com/www.rfid-system-tesla.somee.com/' + ($_.FullName.Replace((Get-Item 'PublishFolder').FullName + '\', '').Replace('\', '/')); echo \"Uploading: $target\"; $webclient = New-Object System.Net.WebClient; $webclient.Credentials = $creds; $webclient.UploadFile($target, $_.FullName) } }"

REM 4. Automatic START (Delete app_offline.htm)
echo [4/4] Taking site back Online...
powershell -Command "$p = ConvertTo-SecureString 'Uhf@1234' -AsPlainText -Force; $creds = New-Object System.Management.Automation.PSCredential('deltaforce', $p); $url = 'ftp://rfid-system-tesla.somee.com/www.rfid-system-tesla.somee.com/app_offline.htm'; [System.Net.FtpWebRequest]::Create($url).Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile; $request = [System.Net.FtpWebRequest]::Create($url); $request.Credentials = $creds; $request.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile; $request.GetResponse().Close()"
del app_offline.htm

echo.
echo ====================================================
echo      SUCCESS! SYSTEM IS LIVE AND UPDATED.
echo      Link: http://rfid-system-tesla.somee.com
echo ====================================================
echo.
pause
