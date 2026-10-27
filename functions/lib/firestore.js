// Lectura de Firestore desde el Worker con la cuenta de servicio (REST).
// Mismo mecanismo que coach-summary.js / coach-proactivo.js, en un módulo
// reutilizable para el servidor MCP.
//
// Variables de entorno: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

export const APP_ID = 'mi-finanzas-app-v1';
export const projectIdDe = (env) => env.FIREBASE_PROJECT_ID || 'appfinanzas-84626';

function base64url(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
    let key = pem || '';
    if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
    if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
    const body = key.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

// Token de la cuenta de servicio (scope datastore). Se reutiliza mientras el isolate viva.
let cacheToken = { token: null, expira: 0 };
export async function tokenServicio(env) {
    if (cacheToken.token && Date.now() < cacheToken.expira) return cacheToken.token;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: env.FIREBASE_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    };
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claim))}`;
    const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importPrivateKey(env.FIREBASE_PRIVATE_KEY), new TextEncoder().encode(unsigned));
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${base64url(firma)}`,
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('No se pudo obtener el token de la cuenta de servicio');
    cacheToken = { token: data.access_token, expira: Date.now() + 50 * 60 * 1000 };
    return data.access_token;
}

function val(field) {
    if (!field) return undefined;
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.timestampValue !== undefined) return field.timestampValue;
    if (field.arrayValue !== undefined) return (field.arrayValue.values || []).map(val);
    if (field.mapValue !== undefined) {
        const o = {};
        const f = field.mapValue.fields || {};
        for (const k in f) o[k] = val(f[k]);
        return o;
    }
    if (field.nullValue !== undefined) return null;
    return undefined;
}

// Todos los documentos de una colección del usuario, con su id.
export async function leerColeccion(env, uid, coleccion) {
    const token = await tokenServicio(env);
    const base = `https://firestore.googleapis.com/v1/projects/${projectIdDe(env)}/databases/(default)/documents/artifacts/${APP_ID}/users/${encodeURIComponent(uid)}/${coleccion}`;
    const out = [];
    let pageToken = '';
    do {
        const res = await fetch(`${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Firestore ${coleccion}: ${res.status}`);
        const data = await res.json();
        (data.documents || []).forEach((d) => {
            const o = { id: (d.name || '').split('/').pop() };
            const f = d.fields || {};
            for (const k in f) o[k] = val(f[k]);
            out.push(o);
        });
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return out;
}
