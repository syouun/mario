@echo off
rem ============================================================
rem  Super Mario Bros remake - launcher (no build / install needed)
rem
rem    setup.bat          : open index.html in the default browser
rem    setup.bat server   : start a local web server (needs Python)
rem                         and open http://localhost:PORT/
rem                         (falls back to the normal launch if
rem                          Python is not installed)
rem ============================================================
setlocal
cd /d "%~dp0"
title SMB launcher

echo.
echo  === Super Mario Bros remake ===
echo.

if not exist "index.html" (
  echo  [ERROR] index.html was not found in this folder:
  echo          %~dp0
  echo          Please keep setup.bat next to index.html.
  echo.
  pause
  exit /b 1
)
if not exist "js\main.js" (
  echo  [ERROR] js\main.js was not found. The game files look incomplete.
  echo.
  pause
  exit /b 1
)

if /i "%~1"=="server" goto server
goto direct

:server
set "PYCMD="
py -3 --version >nul 2>&1 && set "PYCMD=py -3"
if not defined PYCMD python --version >nul 2>&1 && set "PYCMD=python"
if not defined PYCMD (
  echo  Python was not found. Falling back to the normal launch.
  goto direct
)

set PORT=8000
:findport
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if errorlevel 1 goto portok
set /a PORT+=1
if %PORT% LEQ 8020 goto findport
echo  No free port found (8000-8020). Falling back to the normal launch.
goto direct

:portok
echo  Starting local server on http://localhost:%PORT%/ ...
echo  (A minimized window "SMB local server" stays open. Close it to stop the server.)
start "SMB local server" /min cmd /c "%PYCMD% -m http.server %PORT% --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"
goto done

:direct
echo  Opening index.html in your default browser ...
start "" "%~dp0index.html"

:done
echo.
echo  Controls and details: see README.md
echo  (If the game does not appear, try:  setup.bat server)
echo.
timeout /t 5 >nul
endlocal
exit /b 0
