// Conexión PERMANENTE con Google (Calendar/Tasks) para la app nativa.
//
// Flujo: el login NATIVO de Google (hoja del sistema DENTRO de la app, sin
// Safari) devuelve un `serverAuthCode`. Lo enviamos a nuestro servidor, que lo
// canjea por un refresh token y lo guarda. Desde ahí la app pide tokens de
// acceso frescos sin volver a iniciar sesión.
//
// El "linkToken" es un secreto aleatorio que genera la app y guarda localmente;
// identifica de forma segura su refresh token en el servidor.

import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const API_BASE = (Capacitor.isNativePlatform() || window.desktop?.isElectron)
    ? 'https://finanzas-360.milarock10520.workers.dev'
    : '';

const GOOGLE_OAUTH_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/tasks'];

function getLinkToken() {
    let t = null;
    try { t = localStorage.getItem('google_link_token'); } catch (e) { /* */ }
    if (!t) {
        t = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
        try { localStorage.setItem('google_link_token', t); } catch (e) { /* */ }
    }
    return t;
}

// Pide al servidor un access token fresco (renovación silenciosa, sin UI).
export async function obtenerTokenGoogle() {
    let linkToken = null;
    try { linkToken = localStorage.getItem('google_link_token'); } catch (e) { /* */ }
    if (!linkToken) throw new Error('sin_link');

    const res = await fetch(`${API_BASE}/api/google/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkToken })
    });
    if (!res.ok) {
        // 404 = nunca conectó; 401 = el usuario revocó / refresh token inválido.
        if (res.status === 404 || res.status === 401) {
            try { localStorage.removeItem('google_connected'); } catch (e) { /* */ }
        }
        throw new Error('token_no_disponible');
    }
    const data = await res.json();
    try {
        localStorage.setItem('google_calendar_token', JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
        localStorage.setItem('google_connected', '1');
    } catch (e) { /* */ }
    return data; // { token, expiresAt }
}

// Conecta Google con el login NATIVO (in-app) y deja la conexión permanente.
export async function conectarGoogle() {
    // Escritorio (Electron): el navegador del sistema hace el consentimiento
    // (loopback RFC 8252) y ya devuelve un refresh_token directo (access_type=
    // offline+prompt=consent), así que se lo mandamos al servidor tal cual en
    // vez de un serverAuthCode para que lo guarde bajo el linkToken.
    if (window.desktop?.isElectron) {
        const { refreshToken, accessToken, expiresIn } = await window.desktop.connectGoogleCalendar();
        const linkToken = getLinkToken();

        if (refreshToken) {
            try {
                const res = await fetch(`${API_BASE}/api/google/connect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ linkToken, refreshToken })
                });
                if (res.ok) {
                    try { localStorage.setItem('google_connected', '1'); } catch (e) { /* */ }
                    const r = await obtenerTokenGoogle().catch(() => null);
                    if (r && r.token) return r;
                } else {
                    console.warn('Guardar refreshToken falló:', res.status);
                }
            } catch (e) {
                console.warn('Error en /api/google/connect:', e);
            }
        }

        if (accessToken) {
            const expiresAt = Date.now() + ((Number(expiresIn) || 3600) * 1000);
            try {
                localStorage.setItem('google_calendar_token', JSON.stringify({ token: accessToken, expiresAt }));
                if (refreshToken) localStorage.setItem('google_connected', '1');
            } catch (e) { /* */ }
            return { token: accessToken, expiresAt };
        }

        throw new Error('Google no devolvió credenciales válidas.');
    }

    // 1) Login nativo: hoja de Google dentro de la app (no Safari). Pide permisos
    //    de Calendar/Tasks. Devuelve un serverAuthCode canjeable por refresh token.
    const result = await FirebaseAuthentication.signInWithGoogle({ scopes: GOOGLE_OAUTH_SCOPES });
    const cred = result?.credential || {};
    const serverAuthCode = cred.serverAuthCode;
    const accessTokenInmediato = cred.accessToken;

    const linkToken = getLinkToken();

    // 2) Canje en el servidor (si hay serverAuthCode) -> guarda el refresh token.
    if (serverAuthCode) {
        try {
            const res = await fetch(`${API_BASE}/api/google/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ linkToken, serverAuthCode })
            });
            if (res.ok) {
                try { localStorage.setItem('google_connected', '1'); } catch (e) { /* */ }
                // 3) Primer token fresco desde el servidor (confirma que el refresh
                //    token quedó bien guardado).
                const r = await obtenerTokenGoogle().catch(() => null);
                if (r && r.token) return r;
            } else {
                console.warn('Canje de serverAuthCode falló:', res.status);
            }
        } catch (e) {
            console.warn('Error en /api/google/connect:', e);
        }
    }

    // Respaldo: usa el access token inmediato del login nativo (~1h) si el canje
    // permanente no estuvo disponible. La app seguirá funcionando hoy.
    if (accessTokenInmediato) {
        const expiresAt = Date.now() + 55 * 60 * 1000;
        try {
            localStorage.setItem('google_calendar_token', JSON.stringify({ token: accessTokenInmediato, expiresAt }));
            if (serverAuthCode) localStorage.setItem('google_connected', '1');
        } catch (e) { /* */ }
        return { token: accessTokenInmediato, expiresAt };
    }

    throw new Error('Google no devolvió credenciales válidas.');
}

// Borra la conexión: en el servidor y localmente.
export async function desconectarGoogle() {
    let linkToken = null;
    try { linkToken = localStorage.getItem('google_link_token'); } catch (e) { /* */ }
    try {
        await fetch(`${API_BASE}/api/google/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkToken })
        });
    } catch (e) { /* */ }
    try { await FirebaseAuthentication.signOut(); } catch (e) { /* */ }
    try {
        localStorage.removeItem('google_connected');
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_link_token');
    } catch (e) { /* */ }
}
