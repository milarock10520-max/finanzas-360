const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    isElectron: true,
    signInWithGoogle: () => ipcRenderer.invoke('auth:google-signin'),
});
