import { Capacitor } from '@capacitor/core';

// Inicialización de funciones nativas. No hace nada en web.
export async function initNative() {
    if (!Capacitor.isNativePlatform()) return;

    // El estilo de la barra de estado lo fija el tema (src/ui/f360.jsx).

    // Las notificaciones de agenda son LOCALES (programadas en el dispositivo) y
    // gestionan su propio permiso desde src/native/notificaciones.js.
}
