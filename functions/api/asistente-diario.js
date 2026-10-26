// Contenido proactivo del asistente: el resumen de la mañana y las lecturas del día.
// POST /api/asistente-diario  { context, resumen?: { fecha, etiqueta }, lecturas?: [fecha] }
//   → { resumen?: { titulo, texto }, lecturas?: { [fecha]: texto } }
//
// La app lo llama al abrirse (como mucho una vez por día) y guarda el resultado en el
// teléfono; las notificaciones se programan localmente con ese texto. Usa el modelo
// gratuito de Workers AI.

import { llamarIA } from '../lib/ia.js';
import { usuarioDeRequest } from '../lib/auth.js';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
};

const SISTEMA = `Eres el asistente personal de FINANZAS 360 y escribes notificaciones para el celular del usuario, en español de Colombia, cálido y directo, tuteándolo.

Devuelves SOLO un objeto JSON válido, sin texto antes ni después, sin bloques de código.

RESUMEN DE LA MAÑANA (si se pide): "titulo" de máximo 40 caracteres que empiece con un emoji, y "texto" de máximo 260 caracteres para ESE día:
- Primero lo más importante del día: reuniones o eventos con hora, tareas que vencen, pagos o cuotas cercanas.
- Luego una línea de su dinero usando SOLO cifras que aparezcan en sus datos (no hagas cuentas).
- Cierra con un consejo o empujón corto y concreto (un hábito, una prioridad).
- Si no tiene nada agendado, dilo en positivo y sugiere una prioridad.

LECTURAS DEL DÍA (si se piden): para cada fecha, un texto de 2 a 4 frases (máximo 320 caracteres), distinto cada día, que deje una idea útil para pensar antes de dormir. Alterna temas: finanzas personales, hábitos, productividad, bienestar y mentalidad. A veces conéctalo con su situación real (sus metas, deudas o hábitos), sin repetir cifras exactas.

Formato exacto:
{"resumen": {"titulo": "...", "texto": "..."}, "lecturas": {"YYYY-MM-DD": "..."}}
Omite "resumen" o "lecturas" si no se piden.`;

// Saca el primer objeto JSON de la respuesta del modelo.
const extraerJSON = (texto) => {
    const t = String(texto || '').replace(/```(?:json)?/g, '');
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
};

const recortar = (s, n) => String(s || '').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
    try {
        await usuarioDeRequest(request, env);
    } catch {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers });
    }
    try {
        const body = await request.json();
        const contexto = String(body.context || '').slice(0, 24000);
        const resumen = body.resumen && body.resumen.fecha ? body.resumen : null;
        const lecturas = Array.isArray(body.lecturas) ? body.lecturas.filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f)).slice(0, 7) : [];
        if (!resumen && !lecturas.length) return new Response(JSON.stringify({}), { status: 200, headers });

        const pedido = [
            resumen ? `Escribe el RESUMEN DE LA MAÑANA para el ${resumen.etiqueta} (${resumen.fecha}). Usa la agenda y las tareas de ESA fecha.` : '',
            lecturas.length ? `Escribe LECTURAS DEL DÍA para estas fechas: ${lecturas.join(', ')}.` : '',
        ].filter(Boolean).join('\n');

        const { texto } = await llamarIA(env, {
            system: `${SISTEMA}\n\nDATOS DEL USUARIO:\n${contexto}`,
            messages: [{ role: 'user', content: pedido }],
            maxTokens: 1800,
            temperature: 0.7,
        });
        const datos = extraerJSON(texto);
        if (!datos) return new Response(JSON.stringify({ error: 'Respuesta inválida del modelo' }), { status: 502, headers });

        const out = {};
        if (resumen && datos.resumen?.texto) {
            out.resumen = { titulo: recortar(datos.resumen.titulo || '☀️ Buenos días', 60), texto: recortar(datos.resumen.texto, 400) };
        }
        if (lecturas.length && datos.lecturas && typeof datos.lecturas === 'object') {
            out.lecturas = Object.fromEntries(lecturas.filter(f => datos.lecturas[f]).map(f => [f, recortar(datos.lecturas[f], 420)]));
        }
        return new Response(JSON.stringify(out), { status: 200, headers });
    } catch (e) {
        console.error('asistente-diario error:', e);
        return new Response(JSON.stringify({ error: 'No disponible' }), { status: 502, headers });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
}
