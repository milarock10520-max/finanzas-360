import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Mic, MicOff, Check, RotateCcw } from 'lucide-react';
import { iniciarMicrofono, crearReproductor } from './audio';
import { abrirSesion, pedirToken, registrarVoz } from './sesion';

// =============================================
// === ASISTENTE DE VOZ (Gemini Live) ===
// =============================================
// Pantalla completa: esfera de energía que reacciona a la voz (cian cuando hablas,
// violeta cuando responde la IA), transcripción en vivo palabra por palabra y
// confirmación antes de cualquier acción (registrar un gasto, crear una meta…).

const ESTADOS = {
    conectando: 'Conectando…',
    reconectando: 'Reconectando…',
    escuchando: 'Te escucho',
    oyendo: 'Escuchando…',
    hablando: 'Respondiendo · toca para interrumpir',
    confirmar: 'Confirma la acción',
    silencio: 'Micrófono en pausa',
    error: 'Sin conexión',
};

// --- Esfera animada (canvas) ---
function Esfera({ niveles, modo }) {
    const ref = useRef(null);
    useEffect(() => {
        const canvas = ref.current;
        const g = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let lado = 0;
        // El tamaño real llega con el layout: se ajusta cada vez que cambia.
        const ajustar = () => {
            lado = canvas.clientWidth;
            canvas.width = canvas.height = Math.round(lado * dpr);
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        ajustar();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
        ro?.observe(canvas);
        const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const particulas = Array.from({ length: 46 }, (_, i) => ({ a: (i / 46) * Math.PI * 2, r: 0.62 + Math.random() * 0.34, v: 0.002 + Math.random() * 0.006, s: 0.6 + Math.random() * 1.6 }));
        let t = 0, suave = 0, raf;
        let tono = [190, 255]; // matiz actual (cian → violeta), interpolado

        const dibujar = () => {
            const { tu, ia } = niveles.current;
            const m = modo.current;
            const objetivo = m === 'hablando' ? 1 : m === 'oyendo' ? 0.8 : m === 'conectando' ? 0.15 : 0.25;
            const energia = Math.max(tu, ia * 1.1);
            suave += (Math.max(energia, objetivo * 0.25) - suave) * 0.12;
            const meta = m === 'hablando' ? [268, 318] : m === 'error' ? [350, 20] : [188, 228];
            tono = tono.map((h, i) => h + (meta[i] - h) * 0.05);
            t += reducir ? 0.004 : 0.016;

            if (!lado) { raf = requestAnimationFrame(dibujar); return; }
            const c = lado / 2, R = lado * 0.26 * (1 + suave * 0.22);
            g.clearRect(0, 0, lado, lado);

            // Halo
            const halo = g.createRadialGradient(c, c, R * 0.4, c, c, lado * 0.5);
            halo.addColorStop(0, `hsla(${tono[0]}, 100%, 60%, ${0.28 + suave * 0.3})`);
            halo.addColorStop(1, 'hsla(230, 100%, 50%, 0)');
            g.fillStyle = halo;
            g.fillRect(0, 0, lado, lado);

            // Anillos orbitales
            g.lineWidth = 1.2;
            for (let k = 0; k < 3; k++) {
                g.save();
                g.translate(c, c);
                g.rotate(t * (0.3 + k * 0.17) * (k % 2 ? -1 : 1));
                g.scale(1, 0.32 + k * 0.08);
                g.beginPath();
                g.arc(0, 0, R * (1.42 + k * 0.2 + suave * 0.15), 0, Math.PI * 2);
                g.strokeStyle = `hsla(${tono[k % 2]}, 100%, 70%, ${0.16 + suave * 0.25})`;
                g.stroke();
                g.restore();
            }

            // Núcleo deformado por la voz
            const puntos = 96;
            g.beginPath();
            for (let i = 0; i <= puntos; i++) {
                const a = (i / puntos) * Math.PI * 2;
                const onda = Math.sin(a * 3 + t * 2.1) * 0.5 + Math.sin(a * 5 - t * 1.7) * 0.3 + Math.sin(a * 8 + t * 3.3) * 0.2;
                const r = R * (1 + onda * (0.03 + suave * 0.16));
                const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
                if (i) g.lineTo(x, y); else g.moveTo(x, y);
            }
            const nucleo = g.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R * 1.1);
            nucleo.addColorStop(0, `hsla(${tono[0]}, 100%, 88%, 0.95)`);
            nucleo.addColorStop(0.45, `hsla(${tono[0]}, 100%, 58%, 0.85)`);
            nucleo.addColorStop(1, `hsla(${tono[1]}, 95%, 45%, 0.75)`);
            g.shadowColor = `hsla(${tono[0]}, 100%, 60%, 0.9)`;
            g.shadowBlur = 30 + suave * 50;
            g.fillStyle = nucleo;
            g.fill();
            g.shadowBlur = 0;

            // Brillo interior
            g.globalCompositeOperation = 'lighter';
            const brillo = g.createRadialGradient(c + Math.cos(t) * R * 0.3, c + Math.sin(t * 1.3) * R * 0.3, 0, c, c, R);
            brillo.addColorStop(0, `hsla(${tono[1]}, 100%, 75%, ${0.25 + suave * 0.35})`);
            brillo.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
            g.fillStyle = brillo;
            g.fill();

            // Partículas
            particulas.forEach(p => {
                p.a += p.v * (1 + suave * 3);
                const rr = R * (1.25 + p.r * (0.6 + suave * 0.6));
                const x = c + Math.cos(p.a) * rr, y = c + Math.sin(p.a) * rr * 0.92;
                g.beginPath();
                g.arc(x, y, p.s * (1 + suave), 0, Math.PI * 2);
                g.fillStyle = `hsla(${tono[0]}, 100%, 80%, ${0.25 + suave * 0.5})`;
                g.fill();
            });
            g.globalCompositeOperation = 'source-over';
            raf = requestAnimationFrame(dibujar);
        };
        dibujar();
        return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
    }, [niveles, modo]);
    return <canvas ref={ref} className="voz-esfera" aria-hidden="true" />;
}

export default function VozIA({ abierto, onCerrar, obtenerContexto, ejecutarHerramienta, describirAccion }) {
    const [estado, setEstado] = useState('conectando');
    const [error, setError] = useState('');
    const [tuTexto, setTuTexto] = useState('');
    const [iaTrozos, setIaTrozos] = useState([]);
    const [pendientes, setPendientes] = useState([]);
    const [silenciado, setSilenciado] = useState(false);
    const [intento, setIntento] = useState(0);

    const niveles = useRef({ tu: 0, ia: 0 });
    const modo = useRef('conectando');
    const turnoCerrado = useRef(true);
    const iaCerrada = useRef(true);
    const sesionRef = useRef(null);
    const micRef = useRef(null);
    const vozRef = useRef(null);
    const textoRef = useRef(null);
    const ignorarIA = useRef(false);

    useEffect(() => {
        if (!abierto) return;
        let vivo = true, raf;
        setEstado('conectando'); setError(''); setTuTexto(''); setIaTrozos([]); setPendientes([]);
        turnoCerrado.current = true;
        iaCerrada.current = true;
        ignorarIA.current = false;

        // El micrófono no envía mientras la IA habla (y un instante después): así no se
        // escucha a sí misma ni se interrumpe sola. Para cortarla, se toca la esfera.
        let finHabla = 0;
        let previos = [];
        const t0 = Date.now();
        const alMicrofono = (b64) => {
            const voz = vozRef.current;
            if (voz?.hablando() && !ignorarIA.current) { finHabla = Date.now(); return; }
            if (Date.now() - finHabla < 350) return;
            const sesion = sesionRef.current;
            if (sesion?.lista()) {
                if (previos.length) { previos.forEach(p => sesion.audio(p)); previos = []; }
                sesion.audio(b64);
            } else {
                // Lo que dices mientras conecta no se pierde: se envía al quedar lista.
                previos.push(b64);
                if (previos.length > 30) previos.shift();
            }
        };

        (async () => {
            try {
                const voz = crearReproductor();
                vozRef.current = voz;
                // Contexto, token y micrófono a la vez: arranca mucho más rápido.
                const [contexto, cfg, mic] = await Promise.all([
                    obtenerContexto(),
                    pedirToken(),
                    iniciarMicrofono(alMicrofono),
                ]);
                micRef.current = mic;
                if (!vivo) { mic.detener(); return; }
                const sesion = await abrirSesion({
                    contexto,
                    cfgInicial: cfg,
                    on: {
                        estado: (s) => {
                            if (!vivo) return;
                            if (s === 'lista') { setEstado('escuchando'); setError(''); registrarVoz('lista', `${Date.now() - t0} ms`); }
                            if (s === 'reconectando') setEstado('reconectando');
                        },
                        audio: (b64) => { if (!ignorarIA.current) voz.reproducir(b64); },
                        interrumpido: () => { voz.cortar(); ignorarIA.current = false; },
                        tuTexto: (t) => {
                            if (turnoCerrado.current) { turnoCerrado.current = false; iaCerrada.current = true; setTuTexto(t.trimStart()); setIaTrozos([]); }
                            else setTuTexto(prev => prev + t);
                        },
                        iaTexto: (t) => {
                            if (ignorarIA.current) return;
                            turnoCerrado.current = true;
                            // Cada respuesta nueva reemplaza a la anterior en pantalla.
                            if (iaCerrada.current) { iaCerrada.current = false; setIaTrozos([{ id: Date.now(), t: t.trimStart() }]); }
                            else setIaTrozos(prev => [...prev, { id: prev.length + Date.now(), t }]);
                        },
                        turnoFin: () => { turnoCerrado.current = true; iaCerrada.current = true; ignorarIA.current = false; },
                        herramientas: (fcs) => setPendientes(prev => [...prev, ...fcs]),
                        cancelar: (ids) => setPendientes(prev => prev.filter(f => !ids.includes(f.id))),
                        error: (m) => { if (vivo) { setError(m); setEstado('error'); } },
                    },
                });
                if (!vivo) { sesion.cerrar(); return; }
                sesionRef.current = sesion;
            } catch (e) {
                if (!vivo) return;
                const permiso = e?.name === 'NotAllowedError';
                registrarVoz('error-inicio', e?.name || e?.message);
                setError(permiso ? 'Necesito permiso para usar el micrófono. Actívalo en Ajustes > Finanzas 360.' : (e?.message || 'No se pudo iniciar el asistente de voz.'));
                setEstado('error');
            }
        })();

        const medir = () => {
            niveles.current = { tu: micRef.current?.nivel() || 0, ia: vozRef.current?.nivel() || 0 };
            raf = requestAnimationFrame(medir);
        };
        medir();

        return () => {
            vivo = false;
            cancelAnimationFrame(raf);
            sesionRef.current?.cerrar(); sesionRef.current = null;
            micRef.current?.detener(); micRef.current = null;
            vozRef.current?.detener(); vozRef.current = null;
        };
    }, [abierto, intento, obtenerContexto]);

    // Estado visible (y modo de la esfera) según quién está hablando.
    useEffect(() => {
        if (!abierto) return;
        const id = setInterval(() => {
            if (estado === 'error' || estado === 'conectando' || estado === 'reconectando') { modo.current = estado === 'reconectando' ? 'conectando' : estado; return; }
            const m = pendientes.length ? 'confirmar'
                : vozRef.current?.hablando() && !ignorarIA.current ? 'hablando'
                : silenciado ? 'silencio'
                : niveles.current.tu > 0.12 ? 'oyendo' : 'escuchando';
            modo.current = m;
            setEstado(prev => (prev === m ? prev : m));
        }, 150);
        return () => clearInterval(id);
    }, [abierto, estado, pendientes.length, silenciado]);

    useEffect(() => { micRef.current?.silenciar(silenciado); }, [silenciado]);
    useEffect(() => { textoRef.current?.scrollTo({ top: textoRef.current.scrollHeight, behavior: 'smooth' }); }, [iaTrozos, tuTexto]);

    const resolver = useCallback(async (fc, aceptar) => {
        setPendientes(prev => prev.filter(f => f.id !== fc.id));
        const result = aceptar
            ? await ejecutarHerramienta({ name: fc.name, input: fc.args || {} })
            : 'El usuario canceló esta acción; no se hizo nada. Pregúntale si quiere cambiar algo.';
        sesionRef.current?.responder([{ id: fc.id, name: fc.name, response: { result } }]);
    }, [ejecutarHerramienta]);

    // Tocar la esfera mientras habla la corta y te devuelve la palabra.
    const interrumpir = useCallback(() => {
        if (!vozRef.current?.hablando()) return;
        vozRef.current.cortar();
        ignorarIA.current = true;
        iaCerrada.current = true;
    }, []);

    if (!abierto) return null;
    const accion = pendientes[0] ? describirAccion({ name: pendientes[0].name, input: pendientes[0].args || {} }) : null;
    const textoIA = iaTrozos.length > 0;

    const hayTexto = error || tuTexto || textoIA || estado !== 'conectando';
    return (
        <div className={`voz voz-${estado}`} role="dialog" aria-modal="true" aria-label="Asistente de voz">
            <button type="button" className="voz-velo" onClick={onCerrar} aria-label="Cerrar asistente de voz" />
            <span className="voz-borde" aria-hidden="true" />

            <div className="voz-panel">
                {accion && (
                    <div className="voz-accion" role="alertdialog" aria-label={accion.titulo}>
                        <span className="voz-accion-icono" aria-hidden="true">{accion.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{accion.titulo}</strong>
                            <span>{accion.detalle}</span>
                        </div>
                        <div className="voz-accion-botones">
                            <button type="button" onClick={() => resolver(pendientes[0], false)} aria-label="Cancelar acción"><X size={18} aria-hidden="true" /></button>
                            <button type="button" className="si" onClick={() => resolver(pendientes[0], true)} aria-label="Confirmar acción"><Check size={18} aria-hidden="true" /></button>
                        </div>
                    </div>
                )}

                {hayTexto && (
                    <div className="voz-burbuja">
                        <span className="voz-estado" role="status"><i />{ESTADOS[estado] || ''}</span>
                        <div className="voz-texto" ref={textoRef} aria-live="polite">
                            {error ? (
                                <p className="voz-error">{error}</p>
                            ) : (
                                <>
                                    {tuTexto && <p className="voz-tu">{tuTexto}</p>}
                                    {textoIA ? (
                                        <p className="voz-ia">{iaTrozos.map(x => <span key={x.id}>{x.t}</span>)}</p>
                                    ) : (
                                        !tuTexto && estado !== 'conectando' && (
                                            <p className="voz-sugerencia">Prueba: “Anota un almuerzo de 25 mil” o “¿Cómo voy este mes?”</p>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="voz-fila">
                    {estado === 'error' ? (
                        <button type="button" className="voz-btn" onClick={() => setIntento(n => n + 1)} aria-label="Reintentar"><RotateCcw size={20} aria-hidden="true" /></button>
                    ) : (
                        <button type="button" className={`voz-btn ${silenciado ? 'off' : ''}`} onClick={() => setSilenciado(v => !v)} aria-pressed={silenciado} aria-label={silenciado ? 'Activar micrófono' : 'Pausar micrófono'}>
                            {silenciado ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
                        </button>
                    )}
                    <button type="button" className="voz-esfera-btn" onClick={interrumpir} aria-label={estado === 'hablando' ? 'Interrumpir respuesta' : 'Asistente de voz'}>
                        <Esfera niveles={niveles} modo={modo} />
                    </button>
                    <button type="button" className="voz-btn" onClick={onCerrar} aria-label="Cerrar asistente de voz"><X size={22} aria-hidden="true" /></button>
                </div>
            </div>
        </div>
    );
}
