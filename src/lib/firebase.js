import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, persistentSingleTabManager } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

export const API_BASE = (Capacitor.isNativePlatform() || window.desktop?.isElectron)
    ? 'https://finanzas-360.milarock10520.workers.dev'
    : '';

// --- CONFIGURACIÓN DE FIREBASE ---
export const misCredencialesReales = {
    apiKey: "AIzaSyDfTuH2oXtjlYg1-1b0tDESI3hDDxCiGYw",
    authDomain: "appfinanzas-84626.firebaseapp.com",
    projectId: "appfinanzas-84626",
    storageBucket: "appfinanzas-84626.firebasestorage.app",
    messagingSenderId: "163542408412",
    appId: "1:163542408412:web:d27518922c09977ffae819"
};

// Configuración segura y robusta
export let firebaseConfig = misCredencialesReales;
// Variable unificada para evitar errores de referencia
export let appId = 'mi-finanzas-app-v1';

try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        firebaseConfig = JSON.parse(__firebase_config);
    }
    if (typeof __app_id !== 'undefined' && __app_id) {
        appId = __app_id;
    }
} catch (e) {
    console.log("Modo standalone detectado, usando credenciales reales.");
}

export const app = initializeApp(firebaseConfig);
// En la app nativa (WKWebView) la persistencia por IndexedDB de Firebase Auth se
// cuelga; forzamos persistencia por localStorage para que onAuthStateChanged dispare.
export const auth = Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: browserLocalPersistence })
    : getAuth(app);

// Caché persistente (IndexedDB): la app abre con los últimos datos aunque no haya
// conexión, y lo que se registre sin red queda en cola y se sincroniza al volver.
// Si el navegador no permite IndexedDB, Firestore sigue funcionando solo en memoria.
const crearDb = () => {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: Capacitor.isNativePlatform() ? persistentSingleTabManager() : persistentMultipleTabManager(),
            }),
        });
    } catch (e) {
        console.warn('Firestore sin caché persistente:', e);
        return getFirestore(app);
    }
};
export const db = crearDb();

// Sin conexión, las escrituras de Firestore se aplican al instante en local pero su
// promesa no se resuelve hasta que el servidor confirma. Para no dejar la interfaz
// esperando, se da por hecha tras un momento; el envío sigue en cola.
export const sinEsperarServidor = (promesa, ms = 2000) => {
    let timer;
    const espera = new Promise(resolve => { timer = setTimeout(resolve, ms); });
    promesa.catch(e => console.error('Escritura rechazada por el servidor:', e));
    return Promise.race([promesa, espera]).finally(() => clearTimeout(timer));
};
