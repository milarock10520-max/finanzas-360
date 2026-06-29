// Flujo OAuth de Google del lado del servidor para una conexión PERMANENTE.
//
// El flujo implícito (token directo) caduca en ~1h y no da refresh token. Aquí
// usamos el flujo de "authorization code" con access_type=offline, que SÍ
// entrega un refresh token. El refresh token se guarda en KV (servidor) y la
// app pide tokens de acceso frescos cuando los necesita, sin re-loguear.
//
// Seguridad: la app genera un "linkToken" aleatorio (secreto de portador) y lo
// pasa como `state`. El refresh token se guarda bajo ese linkToken. Solo quien
// tenga el linkToken (la app en el dispositivo) puede pedir tokens.

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

function redirectUri(request) {
    return new URL(request.url).origin + '/api/google/callback';
}

// Página simple que se muestra dentro del navegador tras autorizar.
function paginaHTML(titulo, mensaje, ok) {
    const color = ok ? '#16a34a' : '#dc2626';
    const icono = ok ? '✅' : '⚠️';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Finanzas 360</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#1e293b;border-radius:24px;padding:32px;max-width:360px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  .icon{font-size:56px;margin-bottom:12px}
  h1{font-size:22px;margin:0 0 8px;color:${color}}
  p{font-size:15px;line-height:1.5;color:#94a3b8;margin:0}
  .hint{margin-top:20px;font-size:13px;color:#64748b}
</style></head><body>
<div class="card">
  <div class="icon">${icono}</div>
  <h1>${titulo}</h1>
  <p>${mensaje}</p>
  <p class="hint">Toca <b>Listo</b> (arriba a la izquierda) para volver a la app.</p>
</div></body></html>`;
}

// GET /api/google/callback?code=...&state=<linkToken>
// Google redirige aquí tras el consentimiento. Intercambiamos el código por
// tokens y guardamos el refresh token bajo el linkToken.
export async function callbackGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // linkToken
    const error = url.searchParams.get('error');

    const html = (t, m, ok) => new Response(paginaHTML(t, m, ok), {
        status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

    if (error) return html('No se autorizó', 'Cancelaste o Google rechazó el acceso. Puedes intentarlo de nuevo desde la app.', false);
    if (!code || !state) return html('Falta información', 'La respuesta de Google vino incompleta. Intenta de nuevo.', false);

    const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return html('Servidor sin configurar', 'Faltan las credenciales OAuth en el servidor.', false);

    try {
        const body = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri(request),
            grant_type: 'authorization_code'
        });
        const res = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });
        const data = await res.json();
        if (!res.ok || !data.refresh_token) {
            console.error('Error intercambiando código:', res.status, JSON.stringify(data));
            // Sin refresh_token suele pasar si no se forzó prompt=consent o ya estaba autorizado.
            return html('No se pudo conectar', data.error_description || 'Google no devolvió un refresh token. Intenta de nuevo.', false);
        }

        await env.GOOGLE_TOKENS.put(`gauth:${state}`, JSON.stringify({
            refresh_token: data.refresh_token,
            createdAt: Date.now()
        }));

        return html('¡Conectado!', 'Tu Google Calendar y Tasks quedaron conectados de forma permanente.', true);
    } catch (e) {
        console.error('callback error:', e);
        return html('Error', 'Ocurrió un error al conectar. Intenta de nuevo.', false);
    }
}

// POST /api/google/token  { linkToken }
// Devuelve un access token fresco usando el refresh token guardado.
export async function tokenPost(context) {
    const { request, env } = context;
    try {
        const { linkToken } = await request.json();
        if (!linkToken) return new Response(JSON.stringify({ error: 'Falta linkToken' }), { status: 400, headers: cors });

        const raw = await env.GOOGLE_TOKENS.get(`gauth:${linkToken}`);
        if (!raw) return new Response(JSON.stringify({ error: 'no_conectado' }), { status: 404, headers: cors });

        const { refresh_token } = JSON.parse(raw);
        const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token,
            grant_type: 'refresh_token'
        });
        const res = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) {
            console.error('Error refrescando token:', res.status, JSON.stringify(data));
            // invalid_grant = el usuario revocó el acceso o el refresh token expiró.
            if (data.error === 'invalid_grant') {
                await env.GOOGLE_TOKENS.delete(`gauth:${linkToken}`);
                return new Response(JSON.stringify({ error: 'reconectar' }), { status: 401, headers: cors });
            }
            return new Response(JSON.stringify({ error: 'refresh_fallido' }), { status: 502, headers: cors });
        }

        const expiresAt = Date.now() + ((Number(data.expires_in) || 3600) * 1000);
        return new Response(JSON.stringify({ token: data.access_token, expiresAt }), { status: 200, headers: cors });
    } catch (e) {
        console.error('token error:', e);
        return new Response(JSON.stringify({ error: 'interno' }), { status: 500, headers: cors });
    }
}

// POST /api/google/disconnect  { linkToken } — borra el refresh token guardado.
export async function disconnectPost(context) {
    const { request, env } = context;
    try {
        const { linkToken } = await request.json();
        if (linkToken) await env.GOOGLE_TOKENS.delete(`gauth:${linkToken}`);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    } catch (e) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    }
}

export async function optionsHandler() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
        }
    });
}

// URL de autorización (la usa la app para abrir el navegador).
export function buildAuthUrl({ clientId, redirect, state }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
        include_granted_scopes: 'true'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
