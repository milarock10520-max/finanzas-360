const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { signInWithGoogleDesktop, connectGoogleCalendarDesktop } = require('./googleAuth.cjs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        icon: path.join(__dirname, '..', 'build', 'icon.ico'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const startUrl = !app.isPackaged
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '..', 'dist', 'client', 'index.html')}`;

    win.loadURL(startUrl);

    // Cualquier intento de abrir una ventana nueva (p. ej. un popup de login de
    // Google) se manda al navegador del sistema en vez de abrir otra ventana de
    // Electron, porque Google bloquea el OAuth dentro de navegadores embebidos.
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    ipcMain.handle('auth:google-signin', () => signInWithGoogleDesktop());
    ipcMain.handle('auth:google-connect-calendar', () => connectGoogleCalendarDesktop());

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
