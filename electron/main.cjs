const { app, BrowserWindow, Tray, Menu, ipcMain, shell, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { signInWithGoogleDesktop, connectGoogleCalendarDesktop } = require('./googleAuth.cjs');

let win = null;
// El tray debe ser module-level: si lo recoge el GC, el icono desaparece.
let tray = null;
// Espejo del ajuste del renderer (localStorage); se actualiza vía IPC.
let recordatoriosOn = true;
app.isQuiting = false;

// Una sola instancia: una segunda copia duplicaría el programador de
// recordatorios (toasts dobles). La instancia perdedora muere en silencio.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (win) {
            win.show();
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    // Sin esto, los toasts de Windows no se muestran en la app empaquetada.
    // Debe coincidir exactamente con build.appId de electron-builder.
    app.setAppUserModelId('com.finanzas360.desktop');

    // Primera ejecución empaquetada: arrancar con Windows por defecto
    // (el usuario puede apagarlo desde el menú del tray).
    const ensureAutoLaunchDefault = () => {
        if (!app.isPackaged) return;
        const marker = path.join(app.getPath('userData'), 'autolaunch-configurado');
        if (!fs.existsSync(marker)) {
            app.setLoginItemSettings({ openAtLogin: true });
            fs.writeFileSync(marker, '1');
        }
    };

    const buildTrayMenu = () => Menu.buildFromTemplate([
        { label: 'Abrir Finanzas 360', click: () => { win?.show(); win?.focus(); } },
        { type: 'separator' },
        {
            label: 'Iniciar con Windows',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        },
        {
            label: 'Recordatorios',
            type: 'checkbox',
            checked: recordatoriosOn,
            click: (item) => {
                recordatoriosOn = item.checked;
                win?.webContents.send('recordatorios:changed', recordatoriosOn);
            },
        },
        { type: 'separator' },
        { label: 'Salir', click: () => { app.isQuiting = true; app.quit(); } },
    ]);

    const createTray = () => {
        tray = new Tray(path.join(__dirname, '..', 'build', 'icon.ico'));
        tray.setToolTip('Finanzas 360');
        tray.setContextMenu(buildTrayMenu());
        tray.on('double-click', () => { win?.show(); win?.focus(); });
    };

    const createWindow = () => {
        win = new BrowserWindow({
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

        // Cerrar la ventana la esconde al tray: la app sigue viva para que los
        // recordatorios de rutina se disparen aunque "cierres" Finanzas 360.
        win.on('close', (e) => {
            if (!app.isQuiting) {
                e.preventDefault();
                win.hide();
            }
        });
    };

    app.whenReady().then(() => {
        ipcMain.handle('auth:google-signin', () => signInWithGoogleDesktop());
        ipcMain.handle('auth:google-connect-calendar', () => connectGoogleCalendarDesktop());

        // Handshake: el renderer reporta su ajuste persistido al arrancar y en
        // cada toggle de la campana; aquí solo se refleja en el menú del tray
        // (sin eco de vuelta, para no crear un bucle).
        ipcMain.on('recordatorios:set', (_e, v) => {
            recordatoriosOn = !!v;
            tray?.setContextMenu(buildTrayMenu());
        });
        ipcMain.on('app:show-window', () => { win?.show(); win?.focus(); });

        ensureAutoLaunchDefault();
        createWindow();
        createTray();

        // Tras suspender/reanudar el PC los timers del renderer quedan corridos:
        // avisamos para que recalcule el próximo recordatorio.
        powerMonitor.on('resume', () => win?.webContents.send('recordatorios:resync'));

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    // Cubre app.quit() y el apagado del SO: sin esto el handler de 'close'
    // bloquearía la salida escondiendo la ventana.
    app.on('before-quit', () => { app.isQuiting = true; });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}
