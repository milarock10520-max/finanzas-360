const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    isElectron: true,
    signInWithGoogle: () => ipcRenderer.invoke('auth:google-signin'),
    connectGoogleCalendar: () => ipcRenderer.invoke('auth:google-connect-calendar'),
    // Recordatorios de rutina: sincronización renderer <-> menú del tray.
    setRecordatorios: (v) => ipcRenderer.send('recordatorios:set', v),
    onRecordatoriosChanged: (cb) => {
        const h = (_e, v) => cb(v);
        ipcRenderer.on('recordatorios:changed', h);
        return () => ipcRenderer.removeListener('recordatorios:changed', h);
    },
    onRecordatoriosResync: (cb) => {
        const h = () => cb();
        ipcRenderer.on('recordatorios:resync', h);
        return () => ipcRenderer.removeListener('recordatorios:resync', h);
    },
    showWindow: () => ipcRenderer.send('app:show-window'),
    // Hoja de Google para Gemini (permiso drive.file guardado cifrado en el proceso principal).
    conectarHoja: () => ipcRenderer.invoke('hoja:conectar'),
    tokenHoja: () => ipcRenderer.invoke('hoja:token'),
    desconectarHoja: () => ipcRenderer.invoke('hoja:desconectar'),
});
