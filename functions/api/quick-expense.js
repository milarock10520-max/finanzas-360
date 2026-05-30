// Endpoint para registrar gastos desde un Atajo de Siri.
// POST /api/quick-expense
//
// Funciona 100% nativo en Cloudflare Workers: NO usa firebase-admin.
// Se autentica con una cuenta de servicio de Firebase firmando un JWT
// (RS256) con Web Crypto y usa la API REST de Firestore.
//
// Variables de entorno (secrets) necesarias en el Worker:
//   - SHORTCUT_SECRET_TOKEN : palabra secreta que también pones en el Atajo.
//   - FIREBASE_PROJECT_ID   : appfinanzas-84626
//   - FIREBASE_CLIENT_EMAIL : del JSON de la cuenta de servicio.
//   - FIREBASE_PRIVATE_KEY  : del JSON de la cuenta de servicio (con \n).

const APP_ID = 'mi-finanzas-app-v1';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
};

// --- Utilidades base64url ---
function base64url(input) {
    let bytes;
    if (typeof input === 'string') {
        bytes = new TextEncoder().encode(input);
    } else {
        bytes = new Uint8Array(input);
    }
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convierte la clave privada PEM (PKCS8) a un objeto CryptoKey para firmar.
async function importPrivateKey(pem) {
    let key = pem || '';
    if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
    if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);

    const body = key
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s+/g, '');
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

    return crypto.subtle.importKey(
        'pkcs8',
        der.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

// Obtiene un access token de Google OAuth2 mediante JWT de cuenta de servicio.
async function getAccessToken(env) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
        iss: env.FIREBASE_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    };

    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
    const cryptoKey = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(unsigned)
    );
    const jwt = `${unsigned}.${base64url(signature)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!data.access_token) {
        throw new Error('No se pudo obtener access token: ' + JSON.stringify(data));
    }
    return data.access_token;
}

// Lee el valor numérico de un campo Firestore (doubleValue o integerValue).
function numField(field) {
    if (!field) return 0;
    if (field.doubleValue !== undefined) return Number(field.doubleValue) || 0;
    if (field.integerValue !== undefined) return Number(field.integerValue) || 0;
    return 0;
}

// Calcula el saldo actual sumando ingresos y restando gastos (paginado).
async function calcularSaldo(token, projectId, userId) {
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/${APP_ID}/users/${userId}/transacciones`;
    let totalIngresos = 0;
    let totalGastos = 0;
    let pageToken = '';

    do {
        const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) break;
        const data = await res.json();
        (data.documents || []).forEach((docu) => {
            const f = docu.fields || {};
            const tipo = f.tipo?.stringValue;
            const monto = numField(f.monto);
            if (tipo === 'ingreso') totalIngresos += monto;
            else if (tipo === 'gasto') totalGastos += monto;
        });
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return totalIngresos - totalGastos;
}

export async function onRequestOptions() {
    return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { concepto, monto, userId, categoria, token } = body;

        // 1) Validar token secreto
        if (!env.SHORTCUT_SECRET_TOKEN || token !== env.SHORTCUT_SECRET_TOKEN) {
            return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: CORS });
        }

        // 2) Validar campos
        if (!concepto || monto === undefined || monto === null || !userId) {
            return new Response(JSON.stringify({ error: 'Faltan campos: concepto, monto, userId' }), { status: 400, headers: CORS });
        }
        const montoNum = parseFloat(monto);
        if (isNaN(montoNum) || montoNum <= 0) {
            return new Response(JSON.stringify({ error: 'Monto inválido' }), { status: 400, headers: CORS });
        }

        // 3) Autenticarse con Google
        const accessToken = await getAccessToken(env);
        const projectId = env.FIREBASE_PROJECT_ID || 'appfinanzas-84626';

        // 4) Crear la transacción vía REST API de Firestore
        const hoy = new Date().toISOString().split('T')[0];
        const ahora = new Date().toISOString();
        const docFields = {
            fields: {
                tipo: { stringValue: 'gasto' },
                concepto: { stringValue: String(concepto) },
                monto: { doubleValue: montoNum },
                categoria: { stringValue: categoria ? String(categoria) : 'Gastos Hormiga' },
                fecha: { stringValue: hoy },
                createdAt: { stringValue: ahora },
                fromShortcut: { booleanValue: true },
            },
        };

        const writeUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/${APP_ID}/users/${userId}/transacciones`;
        const writeRes = await fetch(writeUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(docFields),
        });

        if (!writeRes.ok) {
            const errText = await writeRes.text();
            return new Response(JSON.stringify({ error: 'Error al guardar en Firestore', details: errText }), { status: 500, headers: CORS });
        }

        // 5) Calcular saldo (no crítico: si falla, igual confirmamos el gasto)
        let saldo = null;
        try {
            saldo = await calcularSaldo(accessToken, projectId, userId);
        } catch (_) { /* ignorar */ }

        const montoFmt = montoNum.toLocaleString('es-CO');
        const mensaje = saldo !== null
            ? `Gasto de $${montoFmt} en "${concepto}" registrado. Saldo: $${saldo.toLocaleString('es-CO')}`
            : `Gasto de $${montoFmt} en "${concepto}" registrado`;

        return new Response(JSON.stringify({ success: true, message: mensaje, saldo }), { status: 200, headers: CORS });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Error interno', details: error.message }), { status: 500, headers: CORS });
    }
}
