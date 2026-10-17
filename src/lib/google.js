import { conectarGoogle, obtenerTokenGoogle, desconectarGoogle } from '../native/googleAuth';
import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';

// =============================================
// === GOOGLE OAUTH (flujo implícito) ===
// =============================================
export const GOOGLE_CLIENT_ID = '871176559846-qctr4g2s05te327su654gpg91oq85gfd.apps.googleusercontent.com';
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

// Pide un token de acceso de Google.
// interactive=true muestra el selector de cuenta; interactive=false intenta una renovación silenciosa
// (prompt:'' reutiliza la sesión y el consentimiento ya dados, sin volver a pedir permisos).
export const GOOGLE_API_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/tasks'];

export const requestGoogleToken = (interactive) => {
    // App nativa (iOS) o escritorio (Electron): flujo OAuth del lado del servidor
    // (conexión permanente). interactive=true abre el navegador para autorizar
    // una vez; interactive=false pide un token fresco al servidor en silencio
    // (renovación sin UI).
    if (Capacitor.isNativePlatform() || window.desktop?.isElectron) {
        return interactive ? conectarGoogle() : obtenerTokenGoogle();
    }

    return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services no está cargado aún.'));
        return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
            if (response.error) { reject(response); return; }
            const expiresAt = Date.now() + ((Number(response.expires_in) || 3600) * 1000);
            try {
                localStorage.setItem('google_calendar_token', JSON.stringify({ token: response.access_token, expiresAt }));
                localStorage.setItem('google_connected', '1');
            } catch (e) { /* almacenamiento lleno o bloqueado */ }
            resolve({ token: response.access_token, expiresAt });
        },
        error_callback: (err) => reject(err),
    });
    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
    });
};

// Borra el token y la marca de "conectado" (detiene la renovación silenciosa).
export const disconnectGoogle = () => {
    if (Capacitor.isNativePlatform()) {
        // En nativo también revoca el refresh token guardado en el servidor.
        desconectarGoogle().catch(() => {});
        return;
    }
    try {
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_connected');
    } catch (e) { /* ignora */ }
};
