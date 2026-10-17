import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/f360.css'
import './ui/f360.jsx'
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

// Service worker: modo sin conexión (y avisos en web). En iOS solo funciona cuando la
// interfaz viene del dominio remoto, declarado en WKAppBoundDomains; en Electron no aplica.
const origenRemoto = typeof location !== 'undefined' && location.protocol === 'https:';
if (!window.desktop?.isElectron && 'serviceWorker' in navigator && (!Capacitor.isNativePlatform() || origenRemoto)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
            // Lo que se descargó antes de que el SW tomara control (bundle principal, CSS,
            // fuentes) se le pasa para que también quede guardado.
            const urls = performance.getEntriesByType('resource').map((e) => e.name)
                .filter((u) => u.startsWith(location.origin + '/assets/') || /fonts\.(googleapis|gstatic)\.com/.test(u));
            reg.active?.postMessage({ tipo: 'guardar', urls });
        }).catch((err) => {
            console.error('No se pudo registrar el service worker:', err);
        });
    });
}
