import { Capacitor } from '@capacitor/core';

// Inicialización de funciones nativas. No hace nada en web.
export async function initNative() {
    if (!Capacitor.isNativePlatform()) return;

    // Barra de estado: estilo acorde al tema índigo de la app.
    try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Light });
    } catch (e) {
        console.warn('StatusBar no disponible:', e);
    }

    // Las notificaciones de agenda son LOCALES (programadas en el dispositivo) y
    // gestionan su propio permiso desde src/native/notificaciones.js.
}
