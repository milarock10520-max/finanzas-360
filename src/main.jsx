import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Capacitor } from '@capacitor/core'
import NativeGate from './native/NativeGate.jsx'
import { initNative } from './native/init.js'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <NativeGate>
            <App />
        </NativeGate>
    </React.StrictMode>,
)

// Arranque de funciones nativas (Face ID lo gestiona NativeGate; aquí van push/status bar).
initNative()

// Registrar el service worker solo en web (no aplica en la app nativa ni en Electron).
if (!Capacitor.isNativePlatform() && !window.desktop?.isElectron && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.error('No se pudo registrar el service worker:', err);
        });
    });
}
