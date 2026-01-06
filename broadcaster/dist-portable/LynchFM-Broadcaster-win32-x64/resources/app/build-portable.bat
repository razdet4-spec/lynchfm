@echo off
echo Building portable version...
echo.

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Build using electron-packager instead
echo Installing electron-packager...
call npm install --save-dev electron-packager

echo.
echo Creating portable build...
call npx electron-packager . "LynchFM-Broadcaster" --platform=win32 --arch=x64 --out=dist-portable --overwrite --asar=false --icon=assets/icon.ico

echo.
echo Done! Check dist-portable folder
pause

