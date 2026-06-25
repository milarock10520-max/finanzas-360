// Endpoint para el Coach por voz (Atajo de Siri).
// POST /api/coach-summary
//
// Construye el contexto financiero y de vida del usuario leyendo Firestore
// (vía cuenta de servicio + REST, igual que quick-expense.js), llama a la API
// de Claude y devuelve una respuesta hablada, lista para que Siri la lea.
//
// Body JSON:
//   { token: "<SHORTCUT_SECRET_TOKEN>", userId: "<uid>", pregunta?: "texto opcional" }
//
// Variables de entorno (secrets) necesarias en el Worker:
//   - SHORTCUT_SECRET_TOKEN : palabra secreta (la misma del Atajo).
//   - ANTHROPIC_API_KEY     : API key de Anthropic.
//   - FIREBASE_PROJECT_ID   : appfinanzas-84626
//   - FIREBASE_CLIENT_EMAIL : del JSON de la cuenta de servicio.
//   - FIREBASE_PRIVATE_KEY  : del JSON de la cuenta de servicio (con \n).

const APP_ID = 'mi-finanzas-app-v1';
const MODEL = 'claude-opus-4-8';

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

// --- Lectura de campos Firestore ---
function val(field) {
    if (!field) return undefined;
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.booleanValue !== undefined) return field.booleanValue;
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

function docToObj(doc) {
    const o = {};
    const f = doc.fields || {};
    for (const k in f) o[k] = val(f[k]);
    return o;
}

// Lee todos los documentos de una colección (paginado).
async function fetchCollection(token, projectId, userId, coll) {
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/${APP_ID}/users/${userId}/${coll}`;
    const out = [];
    let pageToken = '';
    do {
        const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) break;
        const data = await res.json();
        (data.documents || []).forEach((d) => out.push(docToObj(d)));
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return out;
}

// --- Helpers de fechas / rachas ---
const dateKey = (d = new Date()) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const calcStreak = (historial) => {
    const set = new Set(historial || []);
    let streak = 0;
    const cursor = new Date();
    if (!set.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (set.has(dateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
};

const fmt = (n) => '$' + (Number(n) || 0).toLocaleString('es-CO');

function buildContext(data) {
    const { transacciones, deudas, metas, presupuesto, limites, habitos, diario, perfil } = data;
    const perfilNotas = (perfil && perfil[0] && perfil[0].notas) ? perfil[0].notas : '';
    // Comparación por texto (YYYY-MM-DD) para evitar el desfase de zona horaria de new Date().
    const hoyKey = dateKey();
    const mesKey = hoyKey.slice(0, 7);
    const esEsteMes = (fecha) => typeof fecha === 'string' && fecha.slice(0, 7) === mesKey;
    const esHoy = (fecha) => fecha === hoyKey;

    const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const totalGastos = transacciones.filter(t => t.tipo === 'gasto').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const saldo = totalIngresos - totalGastos;
    const ingresosMes = transacciones.filter(t => t.tipo === 'ingreso' && esEsteMes(t.fecha)).reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const gastosMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && esEsteMes(t.fecha)).reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const deudasPend = deudas.reduce((a, d) => a + (Number(d.montoTotal || 0) - Number(d.montoPagado || 0)), 0);

    const gastosPorCat = {};
    transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && esEsteMes(t.fecha))
        .forEach(t => { gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });
    const gastosCatTxt = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `- ${c}: ${fmt(v)}`).join('\n');

    const limitesTxt = limites.map(l => {
        const g = gastosPorCat[l.categoria] || 0;
        const pct = l.limite > 0 ? Math.round((g / l.limite) * 100) : 0;
        return `- ${l.categoria}: ${fmt(g)} de ${fmt(l.limite)} (${pct}%)${g > l.limite ? ' ⚠️ EXCEDIDO' : ''}`;
    }).join('\n');

    const metasTxt = metas.map(m => {
        if (m.tipo === 'personal') {
            const chk = m.checklist || [];
            const hechos = chk.filter(c => c.completado).length;
            let l = `- ${m.nombre} (personal): ${m.completada ? 'completada' : 'en progreso'}`;
            if (chk.length) l += `, avances ${hechos}/${chk.length}`;
            return l;
        }
        const a = Number(m.ahorroActual) || 0;
        const o = Number(m.montoObjetivo) || 0;
        return `- ${m.nombre} (financiera): ${fmt(a)} de ${fmt(o)} (${o > 0 ? Math.round(a / o * 100) : 0}%)`;
    }).join('\n');

    const deudasTxt = deudas.map(d => {
        const t = Number(d.montoTotal) || 0;
        const p = Number(d.montoPagado) || 0;
        return `- ${d.nombre}: restan ${fmt(t - p)} de ${fmt(t)}`;
    }).join('\n');

    const presTxt = presupuesto.map(i => `- ${i.concepto} (${i.categoria}): ${fmt(i.monto)}${i.lastPaid ? ' [pagado]' : ' [pendiente]'}${i.diaPago ? ` paga el ${i.diaPago}` : ''}`).join('\n');

    // Movimientos de hoy
    const gastosHoy = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && esHoy(t.fecha));
    const totalGastoHoy = gastosHoy.reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const totalIngresoHoy = transacciones.filter(t => t.tipo === 'ingreso' && esHoy(t.fecha)).reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const gastosHoyTxt = gastosHoy.map(t => `- ${t.categoria}: ${fmt(t.monto)}${t.descripcion ? ` (${t.descripcion})` : ''}`).join('\n');

    const habitosTxt = habitos.map(h => {
        const streak = calcStreak(h.historial || []);
        const hoy = (h.historial || []).includes(dateKey());
        return `- ${h.emoji || ''} ${h.nombre}: racha ${streak} día(s)${hoy ? ' (hecho hoy)' : ' (pendiente hoy)'}`;
    }).join('\n');

    const MOODS = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
    const diarioOrd = [...diario].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5);
    const diarioTxt = diarioOrd.map(d => `- ${d.fecha} ${MOODS[d.animo] || ''} (${d.animo || '?'}/5)${d.texto ? `: "${d.texto}"` : ''}`).join('\n');

    return `PERFIL DEL USUARIO (memoria de largo plazo, tenlo SIEMPRE presente):
${perfilNotas ? `- Notas del usuario: ${perfilNotas}` : '- (Sin notas de perfil.)'}

RESUMEN FINANCIERO GENERAL:
- Saldo disponible actual: ${fmt(saldo)}
- Ingresos de este mes: ${fmt(ingresosMes)}
- Gastos de este mes: ${fmt(gastosMes)}
- Total de deudas pendientes: ${fmt(deudasPend)}

MOVIMIENTOS DE HOY (${hoyKey}):
- Total gastado hoy: ${fmt(totalGastoHoy)} (${gastosHoy.length} gasto(s))
- Total ingresado hoy: ${fmt(totalIngresoHoy)}
${gastosHoyTxt || '- Sin gastos registrados hoy.'}

GASTOS DE ESTE MES POR CATEGORÍA:
${gastosCatTxt || 'Sin gastos este mes.'}

LÍMITES DE GASTO:
${limitesTxt || 'No hay límites definidos.'}

PRESUPUESTO / GASTOS FIJOS:
${presTxt || 'No hay gastos fijos.'}

METAS:
${metasTxt || 'No hay metas.'}

DEUDAS:
${deudasTxt || 'No hay deudas.'}

HÁBITOS Y RACHAS:
${habitosTxt || 'No hay hábitos.'}

DIARIO / ESTADO DE ÁNIMO:
${diarioTxt || 'Sin entradas.'}`;
}

const PERSONA = `Eres FINANZAS 360 AI COACH respondiendo por voz a través de Siri. El usuario te escucha, NO te lee. Por eso:
1. Responde en español, en un solo párrafo corto y natural, como si hablaras. Máximo 4-5 frases.
2. NO uses viñetas, asteriscos, emojis, números de lista ni símbolos como $ (di "pesos"). Las cifras dilas en palabras o números hablados (ej. "dos millones de pesos").
3. Sé cálido, directo y útil. Da el dato más importante primero.
4. Si el usuario no hizo una pregunta concreta, dale un resumen hablado de cómo va su mes: saldo, gasto vs ingreso, algún hábito o pendiente relevante.
5. NUNCA inventes datos: usa solo lo provisto. Si falta algo, dilo brevemente.`;

export async function onRequestOptions() {
    return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { userId, token, pregunta } = body;

        // 1) Validar token secreto
        if (!env.SHORTCUT_SECRET_TOKEN || token !== env.SHORTCUT_SECRET_TOKEN) {
            return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: CORS });
        }
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Falta userId' }), { status: 400, headers: CORS });
        }
        if (!env.ANTHROPIC_API_KEY) {
            return new Response(JSON.stringify({ error: 'Falta ANTHROPIC_API_KEY' }), { status: 500, headers: CORS });
        }

        // 2) Leer Firestore con cuenta de servicio
        const accessToken = await getAccessToken(env);
        const projectId = env.FIREBASE_PROJECT_ID || 'appfinanzas-84626';

        const [transacciones, deudas, metas, presupuesto, limites, habitos, diario, perfil] = await Promise.all([
            fetchCollection(accessToken, projectId, userId, 'transacciones'),
            fetchCollection(accessToken, projectId, userId, 'deudas'),
            fetchCollection(accessToken, projectId, userId, 'metas'),
            fetchCollection(accessToken, projectId, userId, 'presupuesto'),
            fetchCollection(accessToken, projectId, userId, 'limites'),
            fetchCollection(accessToken, projectId, userId, 'habitos'),
            fetchCollection(accessToken, projectId, userId, 'diario'),
            fetchCollection(accessToken, projectId, userId, 'coach_perfil'),
        ]);

        const ctx = buildContext({ transacciones, deudas, metas, presupuesto, limites, habitos, diario, perfil });

        // 3) Llamar a Claude
        const userQ = (pregunta && String(pregunta).trim())
            ? String(pregunta).trim()
            : '¿Cómo voy este mes? Dame un resumen hablado breve.';

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 600,
                system: [
                    { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
                    { type: 'text', text: `DATOS DEL USUARIO EN TIEMPO REAL:\n${ctx}` },
                ],
                messages: [{ role: 'user', content: userQ }],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            return new Response(JSON.stringify({ error: 'Error en la API de Claude', status: res.status, details: errText }), { status: 502, headers: CORS });
        }

        const data = await res.json();
        const reply = (data.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join(' ')
            .trim();

        // Devolvemos texto plano para que el Atajo lo lea directamente.
        return new Response(JSON.stringify({ reply, respuesta: reply }), { status: 200, headers: CORS });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Error interno', details: error.message }), { status: 500, headers: CORS });
    }
}
