// Sesión de Gemini Live por WebSocket (token efímero que entrega /api/voz-token).
// Eventos que recibe `on`:
//   estado(s)         'conectando' | 'lista' | 'reconectando'
//   audio(base64)     fragmento de voz de Gemini (PCM 24 kHz)
//   tuTexto(t)        transcripción incremental de lo que dice el usuario
//   iaTexto(t)        transcripción incremental de lo que responde Gemini
//   turnoFin()        Gemini terminó de responder
//   interrumpido()    el usuario habló encima: cortar el audio
//   herramientas(fcs) [{ id, name, args }] que la app debe ejecutar (o rechazar)
//   cancelar(ids)     herramientas que Gemini ya no necesita
//   error(msg)
//
// Si la conexión se corta (o Google avisa con goAway), se reconecta sola con un
// token nuevo y retoma la MISMA conversación gracias a sessionResumption.

import { API_BASE, auth } from '../lib/firebase';

const encabezados = async () => {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    return { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) };
};

async function pedirToken() {
    const res = await fetch(`${API_BASE}/api/voz-token`, { method: 'POST', headers: await encabezados(), body: '{}' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el asistente de voz.');
    return data;
}

// Diagnóstico mínimo (sin audio ni texto de la conversación) para ver cortes en el registro del Worker.
export const registrarVoz = (evento, detalle = '') => {
    encabezados().then(headers => fetch(`${API_BASE}/api/voz-token`, {
        method: 'POST', headers, body: JSON.stringify({ log: { evento, detalle: String(detalle).slice(0, 200) } }),
    })).catch(() => {});
};

const leerMensaje = async (raw) => {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (raw instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(raw));
    if (raw && typeof raw.text === 'function') return JSON.parse(await raw.text());
    return null;
};

const MAX_REINTENTOS = 3;

// `cfgInicial` (opcional): un token ya pedido, para arrancar más rápido.
export async function abrirSesion({ contexto, on, cfgInicial }) {
    let ws = null;
    let lista = false;
    let cerradoAPropósito = false;
    let handle = null;          // para reanudar la conversación tras un corte
    let reintentos = 0;
    let reconectando = false;

    const conectar = async (cfg) => {
        lista = false;
        const socket = new WebSocket(`${cfg.wsUrl}?access_token=${encodeURIComponent(cfg.token)}`);
        socket.binaryType = 'arraybuffer';
        ws = socket;

        socket.onopen = () => {
            socket.send(JSON.stringify({
                setup: {
                    model: cfg.model,
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voz } } },
                    },
                    systemInstruction: { parts: [{ text: `${cfg.systemInstruction}\n\nDATOS DEL USUARIO EN TIEMPO REAL:\n${contexto}` }] },
                    tools: cfg.tools,
                    // Turnos ágiles: detecta el fin de la frase con ~0,5 s de silencio.
                    realtimeInputConfig: {
                        automaticActivityDetection: {
                            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                            prefixPaddingMs: 120,
                            silenceDurationMs: 550,
                        },
                    },
                    sessionResumption: handle ? { handle } : {},
                    contextWindowCompression: { slidingWindow: {} },
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
            }));
        };

        socket.onmessage = async (ev) => {
            if (socket !== ws) return;
            let msg;
            try { msg = await leerMensaje(ev.data); } catch { return; }
            if (!msg) return;
            if (msg.setupComplete) {
                lista = true; reintentos = 0; reconectando = false;
                on.estado?.('lista');
                return;
            }
            const sc = msg.serverContent;
            if (sc) {
                if (sc.interrupted) on.interrumpido?.();
                (sc.modelTurn?.parts || []).forEach(p => { if (p.inlineData?.data) on.audio?.(p.inlineData.data); });
                if (sc.inputTranscription?.text) on.tuTexto?.(sc.inputTranscription.text);
                if (sc.outputTranscription?.text) on.iaTexto?.(sc.outputTranscription.text);
                if (sc.turnComplete) on.turnoFin?.();
            }
            if (msg.toolCall?.functionCalls?.length) on.herramientas?.(msg.toolCall.functionCalls);
            if (msg.toolCallCancellation?.ids?.length) on.cancelar?.(msg.toolCallCancellation.ids);
            if (msg.sessionResumptionUpdate) {
                const u = msg.sessionResumptionUpdate;
                if (u.resumable && u.newHandle) handle = u.newHandle;
            }
            // Google va a cerrar la conexión: reconectamos antes, sin perder la conversación.
            if (msg.goAway) { registrarVoz('goAway', msg.goAway.timeLeft); reconectar('goAway'); }
        };

        socket.onclose = (ev) => {
            if (socket !== ws || cerradoAPropósito) return;
            registrarVoz('cierre', `${ev.code} ${ev.reason || ''} lista=${lista}`);
            reconectar(`${ev.code} ${ev.reason || ''}`.trim());
        };
    };

    const reconectar = async (motivo) => {
        if (cerradoAPropósito || reconectando) return;
        reconectando = true;
        const viejo = ws;
        ws = null;
        try { viejo?.close(1000); } catch { /* ya cerrada */ }
        if (reintentos >= MAX_REINTENTOS) {
            on.error?.(motivo ? `Se cortó la conexión (${motivo}).` : 'Se cortó la conexión con el asistente de voz.');
            return;
        }
        reintentos++;
        on.estado?.('reconectando');
        try {
            await new Promise(r => setTimeout(r, 300 * reintentos));
            reconectando = false;
            await conectar(await pedirToken());
        } catch (e) {
            reconectando = false;
            on.error?.(e?.message || 'No se pudo reconectar el asistente de voz.');
        }
    };

    on.estado?.('conectando');
    await conectar(cfgInicial || await pedirToken());

    const enviar = (obj) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
    return {
        lista: () => lista,
        audio: (base64) => { if (lista) enviar({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } }); },
        responder: (respuestas) => enviar({ toolResponse: { functionResponses: respuestas } }),
        cerrar: () => { cerradoAPropósito = true; try { ws?.close(1000); } catch { /* ya cerrada */ } },
    };
}

export { pedirToken };
