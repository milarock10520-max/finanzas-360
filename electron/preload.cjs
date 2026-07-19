const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    isElectron: true,
    signInWithGoogle: () => ipcRenderer.invoke('auth:google-signin'),
    connectGoogleCalendar: () => ipcRenderer.invoke('auth:google-connect-calendar'),
});
