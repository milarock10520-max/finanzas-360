// Audio del asistente de voz (Gemini Live).
// - Micrófono → PCM 16 bits, 16 kHz, mono, en base64 (lo que pide Live).
// - Respuesta de Gemini (PCM 16 bits, 24 kHz) → se reproduce en cola, sin cortes.
// iOS exige crear/reanudar el AudioContext dentro del toque del usuario: por eso
// prepararAudio() se llama en el onClick del botón del micrófono.

let ctx = null;

export function prepararAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx || ctx.state === 'closed') ctx = new AC({ latencyHint: 'interactive' });
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
}

const WORKLET = `
class Captura extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('f360-captura', Captura);
`;

const aBase64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
};

// Nivel 0..1 de un analizador (para animar la esfera).
const nivelDe = (analizador, buf) => {
    analizador.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.min(1, Math.sqrt(s / buf.length) * 4);
};

// Captura del micrófono. onChunk(base64) cada ~100 ms.
export async function iniciarMicrofono(onChunk) {
    const ac = prepararAudio();
    if (!ac) throw new Error('Este dispositivo no soporta audio web.');
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await ac.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const fuente = ac.createMediaStreamSource(stream);
    const nodo = new AudioWorkletNode(ac, 'f360-captura');
    const analizador = ac.createAnalyser();
    analizador.fftSize = 512;
    const bufNivel = new Float32Array(analizador.fftSize);
    // El worklet necesita estar conectado al destino para procesar; va en silencio.
    const mudo = ac.createGain();
    mudo.gain.value = 0;
    fuente.connect(analizador);
    fuente.connect(nodo);
    nodo.connect(mudo).connect(ac.destination);

    const razon = ac.sampleRate / 16000;
    const POR_ENVIO = 1600; // 100 ms a 16 kHz
    let pendiente = new Int16Array(POR_ENVIO);
    let lleno = 0;
    let resto = 0; // posición fraccional entre bloques para remuestrear sin saltos
    let silenciado = false;

    nodo.port.onmessage = ({ data }) => {
        if (silenciado) return;
        for (let pos = resto; pos < data.length; pos += razon) {
            const i = Math.floor(pos);
            const f = pos - i;
            const a = data[i];
            const b = i + 1 < data.length ? data[i + 1] : a;
            const v = Math.max(-1, Math.min(1, a + (b - a) * f));
            pendiente[lleno++] = v < 0 ? v * 0x8000 : v * 0x7fff;
            if (lleno === POR_ENVIO) {
                onChunk(aBase64(new Uint8Array(pendiente.buffer)));
                pendiente = new Int16Array(POR_ENVIO);
                lleno = 0;
            }
            resto = pos + razon - data.length;
        }
    };

    return {
        nivel: () => (silenciado ? 0 : nivelDe(analizador, bufNivel)),
        silenciar: (v) => { silenciado = v; },
        detener: () => {
            nodo.port.onmessage = null;
            try { fuente.disconnect(); nodo.disconnect(); mudo.disconnect(); } catch { /* ya desconectado */ }
            stream.getTracks().forEach(t => t.stop());
        },
    };
}

// Reproductor en cola del audio de Gemini (24 kHz).
export function crearReproductor() {
    const ac = prepararAudio();
    const salida = ac.createGain();
    const analizador = ac.createAnalyser();
    analizador.fftSize = 512;
    const bufNivel = new Float32Array(analizador.fftSize);
    salida.connect(analizador);
    analizador.connect(ac.destination);
    let siguiente = 0;
    const activos = new Set();

    return {
        reproducir(base64) {
            const bin = atob(base64);
            const n = bin.length >> 1;
            const buf = ac.createBuffer(1, n, 24000);
            const canal = buf.getChannelData(0);
            for (let i = 0; i < n; i++) {
                let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
                if (v >= 0x8000) v -= 0x10000;
                canal[i] = v / 0x8000;
            }
            const src = ac.createBufferSource();
            src.buffer = buf;
            src.connect(salida);
            const inicio = Math.max(ac.currentTime + 0.03, siguiente);
            src.start(inicio);
            siguiente = inicio + buf.duration;
            activos.add(src);
            src.onended = () => activos.delete(src);
        },
        // Interrupción: el usuario habló encima, se corta lo que estaba sonando.
        cortar() {
            activos.forEach(s => { try { s.stop(); } catch { /* ya terminó */ } });
            activos.clear();
            siguiente = 0;
        },
        hablando: () => activos.size > 0,
        nivel: () => nivelDe(analizador, bufNivel),
        detener() {
            this.cortar();
            try { salida.disconnect(); analizador.disconnect(); } catch { /* ya desconectado */ }
        },
    };
}
