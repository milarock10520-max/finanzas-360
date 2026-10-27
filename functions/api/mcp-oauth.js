// Servidor de autorización OAuth 2.1 para el conector MCP (Gemini u otro asistente).
//
// Flujo (authorization code + cliente confidencial, PKCE opcional):
//   1. Gemini descubre /.well-known/oauth-protected-resource y
//      /.well-known/oauth-authorization-server.
//   2. Abre GET /oauth/authorize: una página que explica qué se comparte.
//   3. "Iniciar sesión y permitir" va a GET /oauth/login, que guarda la solicitud en
//      KV y redirige (misma pestaña, sin popup) al login de Google con el cliente web
//      del proyecto de Firebase.
//   4. Google vuelve a /api/google/callback con state "mcp.<id>": el servidor canjea
//      el código, obtiene el uid de Firebase (accounts:signInWithIdp) y, si está en
//      MCP_ALLOWED_UIDS, emite un código de un solo uso (5 min) hacia Gemini.
//   5. Gemini canjea el código en POST /oauth/token con su client_id/secret y
//      recibe un access token (1 h) y un refresh token (30 días, rotativo).
//
// Sin popup a propósito: Gemini abre esta página dentro de su propio flujo y el
// navegador corta la comunicación con una ventana emergente (auth/popup-blocked).
//
// Los tokens son aleatorios; en KV solo se guarda su hash SHA-256 (prefijo mcp:).
// Revocar: quitar el uid de MCP_ALLOWED_UIDS corta el acceso al instante (se
// revisa en cada llamada a /mcp).
//
// Variables de entorno:
//   - MCP_CLIENT_ID / MCP_CLIENT_SECRET  (los mismos que se pegan en Gemini)
//   - MCP_ALLOWED_UIDS   uids de Firebase con acceso, separados por coma
//   - GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET  (ya existentes: cliente web
//                        de Google del proyecto; /api/google/callback ya está autorizado)
//   - MCP_REDIRECT_URIS  (opcional) redirect_uri exactas permitidas, separadas por coma.
//                        Sin ella se aceptan https://*.google.com/* y el retorno de Gemini
//                        (https://oauth-redirect.googleusercontent.com/r/*).

// Clave web pública de Firebase (la misma que va en el bundle de la app).
const FIREBASE_WEB_API_KEY = 'AIzaSyDfTuH2oXtjlYg1-1b0tDESI3hDDxCiGYw';
const TTL_LOGIN = 600;
const TTL_CODIGO = 300;
const TTL_ACCESO = 3600;
const TTL_REFRESCO = 30 * 24 * 3600;
export const SCOPE = 'finanzas.lectura';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...JSON_HEADERS, ...extra } });
const errorOAuth = (error, descripcion, status = 400) => json({ error, error_description: descripcion }, status);

// --- Utilidades ---
const aleatorio = (bytes = 32) => {
    const b = crypto.getRandomValues(new Uint8Array(bytes));
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sha256 = async (texto) => {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
    return btoa(String.fromCharCode(...h)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
// Comparación en tiempo constante (sobre los hashes, que siempre miden lo mismo).
const igualesSeguro = async (a, b) => {
    const [x, y] = await Promise.all([sha256(String(a || '')), sha256(String(b || ''))]);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0 && !!a && !!b;
};
const lista = (v) => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
export const uidPermitido = (env, uid) => !!uid && lista(env.MCP_ALLOWED_UIDS).includes(uid);

const GEMINI_REDIRECT_HOST = 'oauth-redirect.googleusercontent.com';

function redirectPermitida(env, uri) {
    let u;
    try { u = new URL(uri); } catch { return false; }
    const exactas = lista(env.MCP_REDIRECT_URIS);
    if (exactas.length) return exactas.includes(uri);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return false;
    // Gemini (apps conectadas personalizadas) vuelve por el servicio de retorno OAuth de
    // Google: https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-…
    // Solo ese host exacto (el resto de googleusercontent.com aloja contenido de usuarios) y solo
    // la ruta de los conectores de Gemini: /r/<id> reenvía a cualquier proyecto de Google Cloud.
    if (u.hostname === GEMINI_REDIRECT_HOST) return u.pathname.startsWith('/r/user_bound_custom-mcp-');
    return u.hostname === 'google.com' || u.hostname.endsWith('.google.com');
}

const configurado = (env) => !!(env.MCP_CLIENT_ID && env.MCP_CLIENT_SECRET && env.MCP_ALLOWED_UIDS);

// Parámetros de /oauth/authorize validados (o un error para mostrar en pantalla).
function validarSolicitud(env, p) {
    if (!configurado(env)) return { error: 'El conector no está configurado en el servidor.' };
    if (p.response_type !== 'code') return { error: 'response_type no soportado.' };
    if (!p.client_id || p.client_id !== env.MCP_CLIENT_ID) return { error: 'Cliente desconocido.' };
    if (!p.redirect_uri || !redirectPermitida(env, p.redirect_uri)) {
        console.warn('mcp-oauth: redirect_uri rechazada:', p.redirect_uri);
        return { error: 'Dirección de retorno no permitida.' };
    }
    if (p.code_challenge && (p.code_challenge_method || 'plain') !== 'S256') return { error: 'Solo se admite PKCE S256.' };
    return { ok: true };
}

// --- Metadatos (descubrimiento) ---
export function metadatosRecurso(request) {
    const origin = new URL(request.url).origin;
    return json({
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        scopes_supported: [SCOPE],
        bearer_methods_supported: ['header'],
        resource_name: 'Finanzas 360',
    });
}

export function metadatosServidor(request) {
    const origin = new URL(request.url).origin;
    return json({
        issuer: origin,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        scopes_supported: [SCOPE],
    });
}

// --- Página de autorización ---
const escaparHTML = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function paginaAutorizar({ error, permitir, cancelar }) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar Finanzas 360</title>
<style>
  :root{color-scheme:light dark}
  body{font-family:Manrope,-apple-system,system-ui,sans-serif;background:#06080E;color:#EDF0F7;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
  .card{background:#0E121C;border:1px solid #222939;border-radius:28px;padding:28px;max-width:440px;width:100%}
  .logo{width:52px;height:52px;border-radius:16px;background:#6B84FF;color:#05081A;display:grid;place-items:center;font-weight:800;font-size:24px;margin-bottom:14px}
  h1{font-size:22px;margin:0 0 6px}
  p{font-size:15px;line-height:1.5;color:#A6AEC0;margin:0 0 14px}
  ul{margin:0 0 14px;padding-left:20px;color:#EDF0F7;font-size:14px;line-height:1.7}
  .no{color:#FB7185}
  .btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
  .btn{height:50px;border-radius:14px;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;text-decoration:none;text-align:center;padding:0 10px}
  .si{background:#6B84FF;color:#05081A}.cancelar{background:#161B28;color:#EDF0F7}
  .err{color:#FB7185;font-weight:700;margin-top:12px}
</style></head><body>
<div class="card">
  <div class="logo">F</div>
  <h1>Conectar Finanzas 360</h1>
  ${error ? `<p class="err">${escaparHTML(error)}</p>` : `
  <p>Un asistente de IA pide permiso para <b>leer</b> tus datos de Finanzas 360. No podrá crear, editar ni borrar nada.</p>
  <ul>
    <li>Saldo, movimientos y análisis del mes</li>
    <li>Presupuesto, topes y pagos próximos</li>
    <li>Metas, inversiones, deudas y cuentas</li>
    <li>Hábitos, rutina y recordatorios</li>
  </ul>
  <p class="no">Nunca se comparten: contraseñas de la bóveda, credenciales de proyectos, tu diario ni el chat del coach.</p>
  <div class="btns">
    <a class="btn cancelar" href="${escaparHTML(cancelar)}">Cancelar</a>
    <a class="btn si" href="${escaparHTML(permitir)}">Iniciar sesión y permitir</a>
  </div>`}
</div>
</body></html>`;
}

const html = (cuerpo, status = 200) => new Response(cuerpo, {
    status,
    headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
    },
});
const paginaError = (mensaje, status = 400) => html(paginaAutorizar({ error: mensaje }), status);
const redirigir = (destino) => new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });

// Vuelta al asistente con una página 200 que navega sola (meta refresh), no con un 302.
// La vuelta viene de una cadena de redirecciones que empezó en un formulario de Google
// (accounts.google.com → callback → relay de Gemini → gemini.google.com); el navegador
// puede cancelar esa cadena y Gemini nunca canjea el código. Una página intermedia corta
// la cadena: la meta refresh es una navegación nueva. Ver
// https://discuss.ai.google.dev/t/gemini-spark-custom-mcp-oauth-stops-after-302-callback-and-never-calls-token/177327
const volverAlAsistente = (destino) => html(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${escaparHTML(destino)}">
<title>Volviendo al asistente…</title>
<style>body{font-family:Manrope,-apple-system,system-ui,sans-serif;background:#06080E;color:#EDF0F7;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center}a{color:#6B84FF;font-weight:800}</style>
</head><body><p>Volviendo al asistente…<br><br><a href="${escaparHTML(destino)}">Continuar</a></p></body></html>`);

const PARAMS = ['response_type', 'client_id', 'redirect_uri', 'state', 'scope', 'code_challenge', 'code_challenge_method', 'resource'];
const paramsDe = (url) => Object.fromEntries(PARAMS.map(k => [k, url.searchParams.get(k) || '']));
const conQuery = (base, q) => { const u = new URL(base); Object.entries(q).forEach(([k, v]) => v && u.searchParams.set(k, v)); return u.toString(); };

// GET /oauth/authorize: página de permiso (enlaces simples, sin JavaScript).
export function autorizarGet(context) {
    const url = new URL(context.request.url);
    const params = paramsDe(url);
    const v = validarSolicitud(context.env, params);
    if (v.error) return paginaError(v.error);
    return html(paginaAutorizar({
        permitir: `/oauth/login?${url.searchParams.toString()}`,
        cancelar: conQuery(params.redirect_uri, { error: 'access_denied', state: params.state }),
    }));
}

// GET /oauth/login: guarda la solicitud y manda al login de Google en la misma pestaña.
export async function loginGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const params = paramsDe(url);
    const v = validarSolicitud(env, params);
    if (v.error) return paginaError(v.error);
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return paginaError('Falta el cliente de Google en el servidor.', 500);

    const id = aleatorio();
    await env.GOOGLE_TOKENS.put(`mcp:login:${await sha256(id)}`, JSON.stringify(params), { expirationTtl: TTL_LOGIN });
    return redirigir(conQuery('https://accounts.google.com/o/oauth2/v2/auth', {
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        redirect_uri: `${url.origin}/api/google/callback`,
        response_type: 'code',
        scope: 'openid email',
        prompt: 'select_account',
        state: `mcp.${id}`,
    }));
}

// ¿Este callback de Google es de un login del conector? (state "mcp.<id>")
export const esCallbackMcp = (url) => (url.searchParams.get('state') || '').startsWith('mcp.');

// GET /api/google/callback?state=mcp.<id>: Google -> uid de Firebase -> código hacia el asistente.
export async function callbackGoogle(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const clave = `mcp:login:${await sha256(url.searchParams.get('state').slice(4))}`;
    const raw = await env.GOOGLE_TOKENS.get(clave);
    if (!raw) return paginaError('La solicitud venció o ya se usó. Vuelve a conectar desde el asistente.');
    await env.GOOGLE_TOKENS.delete(clave); // un solo uso
    const params = JSON.parse(raw);
    const v = validarSolicitud(env, params);
    if (v.error) return paginaError(v.error);
    if (url.searchParams.get('error') || !url.searchParams.get('code')) {
        return volverAlAsistente(conQuery(params.redirect_uri, { error: 'access_denied', state: params.state }));
    }

    // 1. Código de Google -> id_token (canje directo con Google por TLS: no hace falta verificar la firma).
    const tg = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code: url.searchParams.get('code'),
            client_id: env.GOOGLE_OAUTH_CLIENT_ID,
            client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
            redirect_uri: `${url.origin}/api/google/callback`,
            grant_type: 'authorization_code',
        }),
    }).then(r => r.json()).catch(() => ({}));
    if (!tg.id_token) {
        console.error('mcp-oauth: Google no devolvió id_token', tg.error || '');
        return paginaError('No se pudo verificar tu cuenta de Google. Intenta de nuevo.', 502);
    }

    // 2. id_token de Google -> uid de Firebase (lo mismo que hace la app al iniciar sesión).
    const fb = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${env.FIREBASE_WEB_API_KEY || FIREBASE_WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postBody: `id_token=${tg.id_token}&providerId=google.com`, requestUri: url.origin, returnSecureToken: true }),
    }).then(r => r.json()).catch(() => ({}));
    const uid = fb.localId;
    if (!uid) {
        console.error('mcp-oauth: Firebase no devolvió uid', fb.error?.message || '');
        return paginaError('No se pudo verificar tu cuenta en Finanzas 360. Intenta de nuevo.', 502);
    }
    if (!uidPermitido(env, uid)) {
        console.warn('mcp-oauth: uid sin permiso intentó conectar');
        return paginaError('Esta cuenta de Google no tiene permiso para conectar Finanzas 360. Usa la misma cuenta con la que entras a la app.', 403);
    }

    // 3. Código propio de un solo uso hacia el asistente.
    const codigo = aleatorio();
    await env.GOOGLE_TOKENS.put(`mcp:code:${await sha256(codigo)}`, JSON.stringify({
        uid,
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        code_challenge: params.code_challenge || null,
    }), { expirationTtl: TTL_CODIGO });
    console.log('mcp-oauth: código emitido');
    return volverAlAsistente(conQuery(params.redirect_uri, { code: codigo, state: params.state }));
}

// --- Emisión de tokens ---
async function emitirTokens(env, uid) {
    const acceso = aleatorio();
    const refresco = aleatorio();
    await Promise.all([
        env.GOOGLE_TOKENS.put(`mcp:at:${await sha256(acceso)}`, JSON.stringify({ uid }), { expirationTtl: TTL_ACCESO }),
        env.GOOGLE_TOKENS.put(`mcp:rt:${await sha256(refresco)}`, JSON.stringify({ uid }), { expirationTtl: TTL_REFRESCO }),
    ]);
    return json({ access_token: acceso, token_type: 'Bearer', expires_in: TTL_ACCESO, refresh_token: refresco, scope: SCOPE });
}

// Credenciales del cliente: Basic (client_secret_basic) o en el cuerpo (client_secret_post).
function credencialesCliente(request, form) {
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Basic ')) {
        try {
            const [id, secreto] = atob(auth.slice(6)).split(':');
            return { id: decodeURIComponent(id || ''), secreto: decodeURIComponent(secreto || '') };
        } catch { return { id: '', secreto: '' }; }
    }
    return { id: form.get('client_id') || '', secreto: form.get('client_secret') || '' };
}

// POST /oauth/token
export async function tokenPost(context) {
    const { request, env } = context;
    if (!configurado(env)) return errorOAuth('server_error', 'Conector sin configurar.', 500);
    let form;
    try { form = new URLSearchParams(await request.text()); } catch { return errorOAuth('invalid_request', 'Cuerpo inválido.'); }

    const { id, secreto } = credencialesCliente(request, form);
    if (id !== env.MCP_CLIENT_ID || !(await igualesSeguro(secreto, env.MCP_CLIENT_SECRET))) {
        return errorOAuth('invalid_client', 'Credenciales de cliente inválidas.', 401);
    }

    const tipo = form.get('grant_type');
    if (tipo === 'authorization_code') {
        const clave = `mcp:code:${await sha256(form.get('code') || '')}`;
        const raw = await env.GOOGLE_TOKENS.get(clave);
        if (!raw) return errorOAuth('invalid_grant', 'Código inválido o vencido.');
        await env.GOOGLE_TOKENS.delete(clave); // un solo uso
        const c = JSON.parse(raw);
        if (c.client_id !== id || c.redirect_uri !== form.get('redirect_uri')) return errorOAuth('invalid_grant', 'El código no corresponde a esta solicitud.');
        if (c.code_challenge && (await sha256(form.get('code_verifier') || '')) !== c.code_challenge) return errorOAuth('invalid_grant', 'code_verifier inválido.');
        if (!uidPermitido(env, c.uid)) return errorOAuth('invalid_grant', 'Acceso revocado.');
        return emitirTokens(env, c.uid);
    }

    if (tipo === 'refresh_token') {
        const clave = `mcp:rt:${await sha256(form.get('refresh_token') || '')}`;
        const raw = await env.GOOGLE_TOKENS.get(clave);
        if (!raw) return errorOAuth('invalid_grant', 'Refresh token inválido o vencido.');
        await env.GOOGLE_TOKENS.delete(clave); // rotación: cada refresh token sirve una vez
        const { uid } = JSON.parse(raw);
        if (!uidPermitido(env, uid)) return errorOAuth('invalid_grant', 'Acceso revocado.');
        return emitirTokens(env, uid);
    }

    return errorOAuth('unsupported_grant_type', 'grant_type no soportado.');
}

// uid dueño de un access token (o null si no es válido / fue revocado).
export async function uidDeToken(env, token) {
    if (!token) return null;
    const raw = await env.GOOGLE_TOKENS.get(`mcp:at:${await sha256(token)}`);
    if (!raw) return null;
    const { uid } = JSON.parse(raw);
    return uidPermitido(env, uid) ? uid : null;
}
