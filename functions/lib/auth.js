// Verificación del token de sesión de Firebase (ID token) en el Worker.
// El cliente envía `Authorization: Bearer <idToken>`; aquí se comprueba la firma
// RS256 con las claves públicas de Google y los campos aud/iss/exp/sub.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cacheClaves = { claves: null, expira: 0 };

const b64urlABytes = (s) => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
};
const b64urlAJson = (s) => JSON.parse(new TextDecoder().decode(b64urlABytes(s)));

async function clavesPublicas() {
    if (cacheClaves.claves && Date.now() < cacheClaves.expira) return cacheClaves.claves;
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error('No se pudieron obtener las claves de Google');
    const { keys } = await res.json();
    const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
    cacheClaves = { claves: keys, expira: Date.now() + maxAge * 1000 };
    return keys;
}

// Devuelve el uid si el token es válido; lanza error si no.
export async function verificarIdToken(idToken, projectId) {
    const partes = String(idToken || '').split('.');
    if (partes.length !== 3) throw new Error('Token mal formado');
    const [h, p, firma] = partes;
    const header = b64urlAJson(h);
    const payload = b64urlAJson(p);
    if (header.alg !== 'RS256') throw new Error('Algoritmo inválido');

    const jwk = (await clavesPublicas()).find(k => k.kid === header.kid);
    if (!jwk) throw new Error('Clave desconocida');
    const clave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, b64urlABytes(firma), new TextEncoder().encode(`${h}.${p}`));
    if (!valido) throw new Error('Firma inválida');

    const ahora = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) throw new Error('Audiencia inválida');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Emisor inválido');
    if (!payload.exp || payload.exp < ahora - 60) throw new Error('Token vencido');
    if (payload.iat && payload.iat > ahora + 300) throw new Error('Token emitido en el futuro');
    if (!payload.sub) throw new Error('Sin usuario');
    return payload.sub;
}

// Lee el token del encabezado Authorization y lo verifica.
export async function usuarioDeRequest(request, env) {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) throw new Error('Falta el token de sesión');
    return verificarIdToken(token, env.FIREBASE_PROJECT_ID || 'appfinanzas-84626');
}
