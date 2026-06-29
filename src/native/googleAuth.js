// Conexión PERMANENTE con Google (Calendar/Tasks) para la app nativa.
//
// Usa el flujo "authorization code" del lado del servidor: la app abre el
// navegador del sistema (Safari), el usuario autoriza UNA vez, y el servidor
// (Cloudflare) guarda un refresh token. Desde ahí la app pide tokens de acceso
// frescos sin volver a iniciar sesión.
//
// El "linkToken" es un secreto aleatorio que genera la app y guarda localmente;
// identifica de forma segura su refresh token en el servidor.

import { Capacitor } from '@capacitor/core';

const API_BASE = Capacitor.isNativePlatform()
    ? 'https://finanzas-360.milarock10520.workers.dev'
    : '';

// ID de cliente OAuth tipo "Aplicación web" (público, no secreto).
export const GOOGLE_OAUTH_WEB_CLIENT_ID = '163542408412-90a73np4ur8hr165f95ra3ba5p63sbql.apps.googleusercontent.com';

const GOOGLE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

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

// Abre el navegador del sistema para autorizar Google. El token NO se recoge
// aquí: al terminar, la página de éxito devuelve a la app por el deep link
// finanzas360://google-connected, y App.jsx llama a finalizarConexionGoogle().
export async function conectarGoogle() {
    const { Browser } = await import('@capacitor/browser');
    const linkToken = getLinkToken();
    try { localStorage.setItem('google_connecting', '1'); } catch (e) { /* */ }
    const redirect = `${API_BASE}/api/google/callback`;
    const params = new URLSearchParams({
        client_id: GOOGLE_OAUTH_WEB_CLIENT_ID,
        redirect_uri: redirect,
        response_type: 'code',
        scope: GOOGLE_OAUTH_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: linkToken,
        include_granted_scopes: 'true'
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    await Browser.open({ url: authUrl });
}

// Tras volver del navegador: cierra el navegador y pide el primer token (con
// reintentos por si el callback del servidor tarda un instante). Devuelve el
// token o null. Idempotente: si no estábamos conectando, no hace nada.
export async function finalizarConexionGoogle() {
    let conectando = false;
    try { conectando = localStorage.getItem('google_connecting') === '1'; } catch (e) { /* */ }
    if (!conectando) return null;

    try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch (e) { /* */ }

    for (let i = 0; i < 6; i++) {
        try {
            const r = await obtenerTokenGoogle();
            if (r && r.token) {
                try { localStorage.removeItem('google_connecting'); } catch (e) { /* */ }
                return r.token;
            }
        } catch (e) { /* aún no está listo */ }
        await new Promise((res) => setTimeout(res, 900));
    }
    return null;
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
    try {
        localStorage.removeItem('google_connected');
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_link_token');
    } catch (e) { /* */ }
}
