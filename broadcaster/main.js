const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        titleBarStyle: 'default',
        frame: true,
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Открываем DevTools для отладки (всегда)
    // mainWindow.webContents.openDevTools();
    
    // Обработка запросов на доступ к медиа
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        console.log('Запрос разрешения:', permission);
        // Разрешаем все запросы на доступ к медиа
        if (permission === 'media' || permission === 'microphone' || permission === 'camera') {
            callback(true);
        } else {
            callback(false);
        }
    });
    
    // Обработка проверки разрешений
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        if (permission === 'media' || permission === 'microphone' || permission === 'camera') {
            return true;
        }
        return false;
    });
}

// Разрешения для доступа к медиа устройствам
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'WebRTC-H264WithOpenH264FFmpeg');

app.whenReady().then(() => {
    // Запрашиваем разрешения на доступ к медиа
    if (process.platform === 'win32') {
        // Windows - разрешения запрашиваются через системные диалоги
        console.log('Windows detected - media permissions will be requested via system dialogs');
    }
    
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC обработчики
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

