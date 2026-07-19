// Endpoints para el COACH PROACTIVO (agente programado de Claude en la nube).
//
// El agente corre con la suscripción personal del usuario (sin ANTHROPIC_API_KEY):
//   1. POST /api/coach-context  { token, userId }           -> contexto en texto
//   2. (el agente redacta el mensaje)
//   3. POST /api/coach-push     { token, userId, content }  -> guarda el mensaje en
//      coach_mensajes con origin:'proactivo' y read:false; la app lo muestra en el
//      chat del coach al instante (onSnapshot) y dispara un toast en escritorio.
//
// Auth y acceso a Firestore idénticos a coach-summary.js / quick-expense.js
// (secreto compartido en el body + cuenta de servicio vía REST).
//
// Variables de entorno necesarias (ya desplegadas):
//   - SHORTCUT_SECRET_TOKEN
//   - FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

const APP_ID = 'mi-finanzas-app-v1';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
};

// --- Utilidades base64url / JWT (copiadas de coach-summary.js) ---
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

// --- Lectura de campos Firestore (copiado de coach-summary.js) ---
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

async function fetchCollection(token, projectId, userId, coll) {
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/${APP_ID}/users/${userId}/${coll}`;
    const out = [];
    let pageToken = '';
    do {
        const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) break;
        const data = await res.json();
        // __id conserva el id del doc (necesario para correlacionar
        // proyecto_items.proyectoId con su proyecto).
        (data.documents || []).forEach((d) => out.push({ __id: (d.name || '').split('/').pop(), ...docToObj(d) }));
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return out;
}

// --- Helpers de fechas / formato ---
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

const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function seccionRutina(rutina) {
    if (!rutina.length) return 'RUTINA SEMANAL:\nEl usuario aún no ha configurado su rutina.';
    const hoy = new Date().getDay();
    const manana = (hoy + 1) % 7;
    const bloquesDe = (dia) => rutina
        .filter(b => b.dia === dia && b.horaInicio)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
        .map(b => `  - ${b.horaInicio} ${b.emoji || ''} ${b.titulo}`)
        .join('\n');
    return `RUTINA SEMANAL (${rutina.length} bloques configurados):
Hoy ${DIAS_NOMBRES[hoy]}:
${bloquesDe(hoy) || '  (sin bloques hoy)'}
Mañana ${DIAS_NOMBRES[manana]}:
${bloquesDe(manana) || '  (sin bloques mañana)'}`;
}

function seccionProyectos(proyectos, items) {
    const activos = proyectos.filter(p => p.estado !== 'archivado');
    if (!activos.length) return 'PROYECTOS LABORALES:\nSin proyectos activos.';
    const hoyKey = dateKey();
    const lineas = activos.map(p => {
        const its = items.filter(i => i.proyectoId === p.__id);
        const tareas = its.filter(i => i.tipo === 'tarea');
        const pend = tareas.filter(t => t.estado === 'pendiente').length;
        const curso = tareas.filter(t => t.estado === 'en_curso').length;
        const hechas = tareas.filter(t => t.estado === 'hecha').length;
        const avances = its.filter(i => i.tipo === 'avance')
            .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
            .slice(0, 3)
            .map(a => `    · ${a.fecha}: ${a.texto}`).join('\n');
        const metas = its.filter(i => i.tipo === 'meta' && !i.completada && i.fechaLimite)
            .map(m => `    · Meta: ${m.titulo} (límite ${m.fechaLimite}${m.fechaLimite < hoyKey ? ' ⚠️ VENCIDA' : ''})`).join('\n');
        return `- ${p.emoji || ''} ${p.nombre}: tareas ${pend} pendientes / ${curso} en curso / ${hechas} hechas` +
            (avances ? `\n  Últimos avances:\n${avances}` : '') +
            (metas ? `\n  Metas con fecha:\n${metas}` : '');
    });
    return `PROYECTOS LABORALES ACTIVOS (${activos.length}):\n${lineas.join('\n')}`;
}

function buildContexto(data) {
    const { transacciones, deudas, metas, presupuesto, limites, habitos, diario, perfil, rutina, proyectos, proyectoItems } = data;
    const perfilNotas = (perfil && perfil[0] && perfil[0].notas) ? perfil[0].notas : '';
    const hoyKey = dateKey();
    const mesKey = hoyKey.slice(0, 7);
    const esEsteMes = (fecha) => typeof fecha === 'string' && fecha.slice(0, 7) === mesKey;
    const esHoy = (fecha) => fecha === hoyKey;

    const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const totalGastos = transacciones.filter(t => t.tipo === 'gasto').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const saldo = totalIngresos - totalGastos;
    const ingresosMes = transacciones.filter(t => t.tipo === 'ingreso' && esEsteMes(t.fecha)).reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const gastosMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esEsteMes(t.fecha)).reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const deudasPend = deudas.reduce((a, d) => a + (Number(d.montoTotal || 0) - Number(d.montoPagado || 0)), 0);

    const gastosPorCat = {};
    transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esEsteMes(t.fecha))
        .forEach(t => { gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });

    const limitesTxt = limites.map(l => {
        const g = gastosPorCat[l.categoria] || 0;
        const pct = l.limite > 0 ? Math.round((g / l.limite) * 100) : 0;
        return `- ${l.categoria}: ${fmt(g)} de ${fmt(l.limite)} (${pct}%)${g > l.limite ? ' ⚠️ EXCEDIDO' : ''}`;
    }).join('\n');

    const gastosHoy = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esHoy(t.fecha));
    const totalGastoHoy = gastosHoy.reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const gastosHoyTxt = gastosHoy.map(t => `- ${t.categoria}: ${fmt(t.monto)}${t.descripcion ? ` (${t.descripcion})` : ''}`).join('\n');

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
        const plan = m.fechaObjetivo ? `, fecha objetivo ${m.fechaObjetivo}` : '';
        return `- ${m.nombre} (financiera${plan}): ${fmt(a)} de ${fmt(o)} (${o > 0 ? Math.round(a / o * 100) : 0}%)`;
    }).join('\n');

    const habitosTxt = habitos.map(h => {
        const streak = calcStreak(h.historial || []);
        const hechoHoy = (h.historial || []).includes(hoyKey);
        return `- ${h.emoji || ''} ${h.nombre}: racha ${streak} día(s)${hechoHoy ? ' (hecho hoy)' : ' (pendiente hoy)'}`;
    }).join('\n');

    const MOODS = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
    const diarioOrd = [...diario].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5);
    const diarioTxt = diarioOrd.map(d => `- ${d.fecha} ${MOODS[d.animo] || ''} (${d.animo || '?'}/5)${d.texto ? `: "${d.texto}"` : ''}`).join('\n');

    return `FECHA/HORA DEL SERVIDOR: ${new Date().toISOString()} (día local del usuario: ${DIAS_NOMBRES[new Date().getDay()]} ${hoyKey})

PERFIL DEL USUARIO (memoria de largo plazo):
${perfilNotas ? `- ${perfilNotas}` : '- (Sin notas de perfil.)'}

RESUMEN FINANCIERO:
- Saldo disponible: ${fmt(saldo)}
- Ingresos del mes: ${fmt(ingresosMes)} | Gastos del mes: ${fmt(gastosMes)}
- Deudas pendientes: ${fmt(deudasPend)}
- Gastado HOY: ${fmt(totalGastoHoy)} (${gastosHoy.length} gasto(s))
${gastosHoyTxt || '- Sin gastos registrados hoy.'}

LÍMITES DE GASTO:
${limitesTxt || 'No hay límites definidos.'}

METAS:
${metasTxt || 'No hay metas.'}

HÁBITOS Y RACHAS:
${habitosTxt || 'No hay hábitos.'}

DIARIO / ESTADO DE ÁNIMO (últimas entradas):
${diarioTxt || 'Sin entradas.'}

${seccionRutina(rutina)}

${seccionProyectos(proyectos, proyectoItems)}`;
}

const authError = () => new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: CORS });

// Acepta el secreto propio del coach (COACH_SECRET_TOKEN) o, como respaldo, el
// de los atajos de Siri (SHORTCUT_SECRET_TOKEN).
const tokenValido = (env, token) =>
    !!token && ((env.COACH_SECRET_TOKEN && token === env.COACH_SECRET_TOKEN) ||
        (env.SHORTCUT_SECRET_TOKEN && token === env.SHORTCUT_SECRET_TOKEN));

// POST /api/coach-context  { token, userId }
export async function contextPost(context) {
    const { request, env } = context;
    try {
        const { token, userId } = await request.json();
        if (!tokenValido(env, token)) return authError();
        if (!userId) return new Response(JSON.stringify({ error: 'Falta userId' }), { status: 400, headers: CORS });

        const projectId = env.FIREBASE_PROJECT_ID || 'appfinanzas-84626';
        const accessToken = await getAccessToken(env);

        const [transacciones, deudas, metas, presupuesto, limites, habitos, diario, perfil, rutina, proyectos, proyectoItems] = await Promise.all(
            ['transacciones', 'deudas', 'metas', 'presupuesto', 'limites', 'habitos', 'diario', 'coach_perfil', 'rutina', 'proyectos', 'proyecto_items']
                .map(c => fetchCollection(accessToken, projectId, userId, c))
        );

        const contexto = buildContexto({ transacciones, deudas, metas, presupuesto, limites, habitos, diario, perfil, rutina, proyectos, proyectoItems });
        return new Response(JSON.stringify({ contexto, generadoEn: new Date().toISOString() }), { status: 200, headers: CORS });
    } catch (e) {
        console.error('coach-context error:', e);
        return new Response(JSON.stringify({ error: 'interno' }), { status: 500, headers: CORS });
    }
}

// POST /api/coach-push  { token, userId, content }
export async function pushPost(context) {
    const { request, env } = context;
    try {
        const { token, userId, content } = await request.json();
        if (!tokenValido(env, token)) return authError();
        if (!userId || !content) return new Response(JSON.stringify({ error: 'Faltan userId o content' }), { status: 400, headers: CORS });

        const projectId = env.FIREBASE_PROJECT_ID || 'appfinanzas-84626';
        const accessToken = await getAccessToken(env);

        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/${APP_ID}/users/${userId}/coach_mensajes`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    role: { stringValue: 'assistant' },
                    content: { stringValue: String(content) },
                    createdAt: { stringValue: new Date().toISOString() },
                    origin: { stringValue: 'proactivo' },
                    read: { booleanValue: false },
                },
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            console.error('coach-push firestore error:', res.status, err);
            return new Response(JSON.stringify({ error: 'firestore' }), { status: 502, headers: CORS });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
    } catch (e) {
        console.error('coach-push error:', e);
        return new Response(JSON.stringify({ error: 'interno' }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 200, headers: CORS });
}
