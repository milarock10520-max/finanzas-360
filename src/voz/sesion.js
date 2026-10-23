// Sesión de Gemini Live por WebSocket (token efímero que entrega /api/voz-token).
// Eventos que recibe `on`:
//   estado(s)         'conectando' | 'lista' | 'cerrada'
//   audio(base64)     fragmento de voz de Gemini (PCM 24 kHz)
//   tuTexto(t)        transcripción incremental de lo que dice el usuario
//   iaTexto(t)        transcripción incremental de lo que responde Gemini
//   turnoFin()        Gemini terminó de responder
//   interrumpido()    el usuario habló encima: cortar el audio
//   herramientas(fcs) [{ id, name, args }] que la app debe ejecutar (o rechazar)
//   cancelar(ids)     herramientas que Gemini ya no necesita
//   error(msg)

import { API_BASE, auth } from '../lib/firebase';

async function pedirToken() {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    const res = await fetch(`${API_BASE}/api/voz-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: '{}',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el asistente de voz.');
    return data;
}

const leerMensaje = async (raw) => {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (raw instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(raw));
    if (raw && typeof raw.text === 'function') return JSON.parse(await raw.text());
    return null;
};

export async function abrirSesion({ contexto, on }) {
    on.estado?.('conectando');
    const cfg = await pedirToken();
    const ws = new WebSocket(`${cfg.wsUrl}?access_token=${encodeURIComponent(cfg.token)}`);
    ws.binaryType = 'arraybuffer';
    let lista = false;
    let cerradoAPropósito = false;

    ws.onopen = () => {
        ws.send(JSON.stringify({
            setup: {
                model: cfg.model,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voz } } },
                },
                systemInstruction: { parts: [{ text: `${cfg.systemInstruction}\n\nDATOS DEL USUARIO EN TIEMPO REAL:\n${contexto}` }] },
                tools: cfg.tools,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
        }));
    };

    ws.onmessage = async (ev) => {
        let msg;
        try { msg = await leerMensaje(ev.data); } catch { return; }
        if (!msg) return;
        if (msg.setupComplete) { lista = true; on.estado?.('lista'); return; }
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
        if (msg.goAway) on.error?.('La sesión de voz está por terminar. Vuelve a tocar el micrófono para seguir.');
    };

    ws.onerror = () => { if (!lista) on.error?.('No se pudo conectar con el asistente de voz.'); };
    ws.onclose = (ev) => {
        if (!cerradoAPropósito && ev.code !== 1000) {
            on.error?.(ev.reason ? `Se cortó la conexión: ${ev.reason}` : 'Se cortó la conexión con el asistente de voz.');
        }
        on.estado?.('cerrada');
    };

    const enviar = (obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
    return {
        lista: () => lista,
        audio: (base64) => { if (lista) enviar({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } }); },
        texto: (t) => enviar({ realtimeInput: { text: t } }),
        responder: (respuestas) => enviar({ toolResponse: { functionResponses: respuestas } }),
        cerrar: () => { cerradoAPropósito = true; try { ws.close(1000); } catch { /* ya cerrada */ } },
    };
}
