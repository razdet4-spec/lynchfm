# Простая сборка без electron-builder

Из-за проблем с electron-builder, используем electron-packager:

```powershell
cd C:\Users\xaxxa\OneDrive\Desktop\LynchFM\broadcaster

# Установите electron-packager
npm install --save-dev electron-packager

# Соберите portable версию
npx electron-packager . "LynchFM-Broadcaster" --platform=win32 --arch=x64 --out=dist-portable --overwrite --asar=false

# Или просто запустите build-portable.bat
build-portable.bat
```

Готовая программа будет в папке `dist-portable\LynchFM-Broadcaster-win32-x64\`

Запустите `LynchFM-Broadcaster.exe` из этой папки!

