// Asistente de voz (Gemini Live).
// POST /api/voz-token  →  { token, model, wsUrl, systemInstruction, tools }
//
// La API key de Gemini nunca sale del Worker (secreto GEMINI_API_KEY). Al teléfono
// solo le damos un token efímero de UN uso que caduca en minutos, y solo si tiene
// sesión iniciada en la app. La app abre el WebSocket de Live directamente con ese
// token y ejecuta las herramientas en el dispositivo (como el coach de texto).

import { usuarioDeRequest } from '../lib/auth.js';
import { TOOLS, PERSONA_ACCIONES } from './ai-coach.js';

const MODELO = 'gemini-3.8-live';
const VOZ = 'Kore';
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

const PERSONA_VOZ = `Eres la voz de FINANZAS 360, el coach financiero personal del usuario. Hablas con él en tiempo real por voz.

CÓMO HABLAS:
- Español de Colombia, cálido, cercano y directo. Tutea al usuario.
- Respuestas CORTAS para escuchar: 1 a 3 frases. Si te piden un plan o una explicación, máximo 4 o 5 frases y ofrece profundizar.
- Nada de listas, viñetas, símbolos ni formato: todo se dice en voz alta. Di los montos como se pronuncian ("doscientos mil pesos", "un millón y medio").
- No saludes en cada turno ni repitas lo que el usuario dijo.

DATOS:
- Usa SOLO las cifras de los DATOS DEL USUARIO. NO HAGAS CUENTAS: si hay una cifra lista en "CIFRAS LISTAS PARA TUS CONSEJOS", úsala tal cual.
- Si falta un dato, dilo y sugiere registrarlo en la app. Nunca inventes.
- Si te preguntan algo general de finanzas (qué es un CDT, cómo funciona el interés compuesto), explícalo simple y con un ejemplo corto.`;

// Esquema JSON del coach → esquema de Gemini (tipos en mayúscula).
const aEsquemaGemini = (s) => {
    if (!s || typeof s !== 'object') return s;
    const out = {};
    for (const [k, v] of Object.entries(s)) {
        if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
        else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, d]) => [p, aEsquemaGemini(d)]));
        else if (k === 'items') out.items = aEsquemaGemini(v);
        else out[k] = v;
    }
    return out;
};

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
};

export async function onRequestPost({ request, env }) {
    try {
        await usuarioDeRequest(request, env);
    } catch {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers });
    }
    if (!env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'El asistente de voz no está configurado (falta GEMINI_API_KEY).' }), { status: 503, headers });
    }

    const ahora = Date.now();
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
        method: 'POST',
        headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uses: 1,
            expireTime: new Date(ahora + 30 * 60 * 1000).toISOString(),
            newSessionExpireTime: new Date(ahora + 2 * 60 * 1000).toISOString(),
            // Sin bidiGenerateContentSetup (no se puede combinar con `uses`): la
            // configuración la envía la app en el mensaje setup del WebSocket.
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.name) {
        console.error('voz-token: Gemini respondió', res.status, JSON.stringify(data).slice(0, 300));
        return new Response(JSON.stringify({ error: 'No se pudo iniciar el asistente de voz. Intenta de nuevo.' }), { status: 502, headers });
    }

    return new Response(JSON.stringify({
        token: data.name,
        model: `models/${MODELO}`,
        wsUrl: WS_URL,
        voz: VOZ,
        systemInstruction: PERSONA_VOZ + PERSONA_ACCIONES,
        tools: [{
            functionDeclarations: TOOLS.map(t => ({ name: t.name, description: t.description, parameters: aEsquemaGemini(t.input_schema) })),
        }],
    }), { status: 200, headers });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
    });
}
