// Servidor de autorización OAuth 2.1 para el conector MCP (Gemini u otro asistente).
//
// Flujo (authorization code + cliente confidencial, PKCE opcional):
//   1. Gemini descubre /.well-known/oauth-protected-resource y
//      /.well-known/oauth-authorization-server.
//   2. Abre GET /oauth/authorize: una página que explica qué se comparte y pide
//      iniciar sesión con Google (Firebase Auth, igual que la app).
//   3. La página manda el ID token de Firebase a POST /oauth/authorize; si el uid
//      está en MCP_ALLOWED_UIDS se emite un código de un solo uso (5 min).
//   4. Gemini canjea el código en POST /oauth/token con su client_id/secret y
//      recibe un access token (1 h) y un refresh token (30 días, rotativo).
//
// Los tokens son aleatorios; en KV solo se guarda su hash SHA-256 (prefijo mcp:).
// Revocar: quitar el uid de MCP_ALLOWED_UIDS corta el acceso al instante (se
// revisa en cada llamada a /mcp).
//
// Variables de entorno:
//   - MCP_CLIENT_ID / MCP_CLIENT_SECRET  (los mismos que se pegan en Gemini)
//   - MCP_ALLOWED_UIDS   uids de Firebase con acceso, separados por coma
//   - MCP_REDIRECT_URIS  (opcional) redirect_uri exactas permitidas, separadas por coma.
//                        Sin ella se aceptan https://*.google.com/*.

import { verificarIdToken } from '../lib/auth.js';
import { projectIdDe } from '../lib/firestore.js';

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

function redirectPermitida(env, uri) {
    let u;
    try { u = new URL(uri); } catch { return false; }
    const exactas = lista(env.MCP_REDIRECT_URIS);
    if (exactas.length) return exactas.includes(uri);
    return u.protocol === 'https:' && (u.hostname === 'google.com' || u.hostname.endsWith('.google.com'));
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

function paginaAutorizar({ params, error }) {
    // JSON embebido en <script>: se escapa "<" para que no pueda cerrar la etiqueta.
    const datos = JSON.stringify(params || {}).replace(/</g, '\\u003c');
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
  button{height:50px;border-radius:14px;border:0;font-weight:800;font-size:15px;cursor:pointer}
  .si{background:#6B84FF;color:#05081A}.cancelar{background:#161B28;color:#EDF0F7}
  button:disabled{opacity:.5;cursor:default}
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
    <button class="cancelar" id="cancelar" type="button">Cancelar</button>
    <button class="si" id="permitir" type="button">Iniciar sesión y permitir</button>
  </div>
  <p class="err" id="msg" role="alert"></p>`}
</div>
${error ? '' : `<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script>
  const params = ${datos};
  firebase.initializeApp({ apiKey: "AIzaSyDfTuH2oXtjlYg1-1b0tDESI3hDDxCiGYw", authDomain: "appfinanzas-84626.firebaseapp.com", projectId: "appfinanzas-84626" });
  const msg = document.getElementById('msg');
  const volver = (q) => { const u = new URL(params.redirect_uri); Object.entries(q).forEach(([k, v]) => v && u.searchParams.set(k, v)); location.href = u.toString(); };
  document.getElementById('cancelar').onclick = () => volver({ error: 'access_denied', state: params.state });
  document.getElementById('permitir').onclick = async (e) => {
    e.target.disabled = true; msg.textContent = '';
    try {
      const cred = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/oauth/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, params }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || 'No se pudo autorizar.');
      await firebase.auth().signOut();
      location.href = data.redirect;
    } catch (err) {
      msg.textContent = err.message || 'No se pudo autorizar.';
      e.target.disabled = false;
    }
  };
</script>`}
</body></html>`;
}

const html = (cuerpo, status = 200) => new Response(cuerpo, {
    status,
    headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
    },
});

const PARAMS = ['response_type', 'client_id', 'redirect_uri', 'state', 'scope', 'code_challenge', 'code_challenge_method', 'resource'];

// GET /oauth/authorize
export function autorizarGet(context) {
    const url = new URL(context.request.url);
    const params = Object.fromEntries(PARAMS.map(k => [k, url.searchParams.get(k) || '']));
    const v = validarSolicitud(context.env, params);
    return html(paginaAutorizar(v.error ? { error: v.error } : { params }), v.error ? 400 : 200);
}

// POST /oauth/authorize  { idToken, params } -> { redirect }
export async function autorizarPost(context) {
    const { request, env } = context;
    let cuerpo;
    try { cuerpo = await request.json(); } catch { return errorOAuth('invalid_request', 'Cuerpo inválido.'); }
    const params = Object.fromEntries(PARAMS.map(k => [k, String(cuerpo?.params?.[k] || '')]));
    const v = validarSolicitud(env, params);
    if (v.error) return errorOAuth('invalid_request', v.error);

    let uid;
    try { uid = await verificarIdToken(cuerpo.idToken, projectIdDe(env)); } catch { return errorOAuth('access_denied', 'No se pudo verificar tu sesión.', 401); }
    if (!uidPermitido(env, uid)) {
        console.warn('mcp-oauth: uid sin permiso intentó conectar');
        return errorOAuth('access_denied', 'Esta cuenta no tiene permiso para conectar Finanzas 360.', 403);
    }

    const codigo = aleatorio();
    await env.GOOGLE_TOKENS.put(`mcp:code:${await sha256(codigo)}`, JSON.stringify({
        uid,
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        code_challenge: params.code_challenge || null,
    }), { expirationTtl: TTL_CODIGO });

    const destino = new URL(params.redirect_uri);
    destino.searchParams.set('code', codigo);
    if (params.state) destino.searchParams.set('state', params.state);
    console.log('mcp-oauth: código emitido');
    return json({ redirect: destino.toString() });
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
