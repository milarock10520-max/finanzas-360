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
});
