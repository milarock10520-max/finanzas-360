import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { Trash2, Calendar, Save, CheckCircle2, Sparkles, X, UserCog, Mic, ArrowRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { BottomSheet, fmtCOP } from '../ui/f360.jsx';
import { memoriaTexto } from './memoria.js';
import { cuentasTexto } from '../lib/cuentas';
import { aCOP, tasaUSDGuardada } from '../lib/moneda';
import { esPosicionInversion } from '../lib/inversiones';
import { leerResumen, leerLecturas, CLAVE_RESUMEN, CLAVE_LECTURAS } from '../native/programador';
import { CATEGORIAS_GASTOS, CATEGORIAS_INGRESOS, MOODS, calcStreak, dateKey, formatCurrency, formatUSD, proximaFechaPago } from '../lib/finanzas';
import { API_BASE, app, auth } from '../lib/firebase';

const VozIA = lazy(() => import('../voz/Voz.jsx'));

// Hallazgos del coach calculados localmente (sin IA, al instante). Se muestran en la
// tarjeta de Inicio y en la hoja "Tu coach hoy".
// tono: 'expense' (rojo), 'warn' (ámbar), 'income' (verde), 'primary' (azul).
// Encabezados para el backend del coach: incluye el token de sesión de Firebase.
const encabezadosCoach = async () => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export const calcularAlertasCoach = ({ transacciones = [], limites = [], presupuestoItems = [] }) => {
    const alertas = [];
    const hoyKey = dateKey();
    const mesKey = hoyKey.slice(0, 7);
    const esEsteMes = (f) => typeof f === 'string' && f.slice(0, 7) === mesKey;
    const esHoy = (f) => f === hoyKey;

    // Gastos del mes por categoría (para límites)
    const gastosPorCat = {};
    transacciones
        .filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esEsteMes(t.fecha))
        .forEach(t => { gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });

    // Límites excedidos (el más grave primero)
    limites
        .map(l => ({ l, g: gastosPorCat[l.categoria] || 0, tope: Number(l.limite) || 0 }))
        .filter(x => x.tope > 0 && x.g > x.tope)
        .sort((a, b) => (b.g / b.tope) - (a.g / a.tope))
        .forEach(({ l, g, tope }) => {
            alertas.push({
                tipo: 'limite', tono: 'expense',
                titulo: `Superaste el tope de ${l.categoria}`,
                texto: `Pasaste tu límite de ${l.categoria}: llevas ${formatCurrency(g)} de ${formatCurrency(tope)} este mes.`,
                categoria: l.categoria, gastado: g, tope, pct: g / tope,
            });
        });

    // Balance del mes
    const ingMes = transacciones.filter(t => t.tipo === 'ingreso' && esEsteMes(t.fecha)).reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const gasMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esEsteMes(t.fecha)).reduce((a, c) => a + (Number(c.monto) || 0), 0);
    if (ingMes > 0 && gasMes > ingMes) {
        alertas.push({ tipo: 'balance', tono: 'expense', titulo: 'Gastaste más de lo que ingresaste', texto: `Este mes has gastado más de lo que ingresaste: ${formatCurrency(gasMes)} vs ${formatCurrency(ingMes)}.` });
    }

    // Gasto hormiga de hoy
    const hormigaHoy = transacciones
        .filter(t => t.tipo === 'gasto' && esHoy(t.fecha) && t.categoria === 'Gastos Hormiga')
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);
    if (hormigaHoy > 0) {
        alertas.push({ tipo: 'hormiga', tono: 'warn', titulo: 'Gastos hormiga hoy', texto: `Hoy llevas ${formatCurrency(hormigaHoy)} en gastos hormiga. Los pequeños gastos suman al final del mes.` });
    }

    // Pagos próximos (≤3 días, no pagados este ciclo)
    presupuestoItems.forEach(i => {
        const prox = proximaFechaPago(i.diaPago);
        if (prox && prox.dias <= 3 && i.lastPaid !== mesKey) {
            const cuando = prox.dias === 0 ? 'vence hoy' : prox.dias === 1 ? 'vence mañana' : `en ${prox.dias} días`;
            alertas.push({ tipo: 'pago', tono: 'warn', titulo: `${i.concepto} ${cuando}`, texto: `Pago próximo: ${i.concepto} ${cuando} (${formatCurrency(i.monto)}).` });
        }
    });

    // Reconocimiento: tasa de ahorro del mes
    if (ingMes > 0 && gasMes < ingMes) {
        const pct = (ingMes - gasMes) / ingMes;
        alertas.push({ tipo: 'ahorro', tono: 'income', titulo: 'Vas ahorrando este mes', texto: `Ahorraste el ${(pct * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}% de tus ingresos este mes.`, pct });
    }

    return alertas;
};

// Markdown mínimo (negritas y saltos de línea) escapando el HTML de la respuesta.
export const mdLite = (txt) => String(txt || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^\s*-{3,}\s*$/gm, '')                       // separadores ---
    .replace(/^\s*#{1,6}\s*(.+)$/gm, '**$1**')             // encabezados -> negrita
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, '<br/>');

// =============================================
// === COMPONENTE: AI COACH (CLAUDE OPUS 4.8) ===
// =============================================
export const AICoach = ({ transacciones, deudas, metas, presupuestoItems, limites, habitos = [], diario = [], googleToken = null, coachMensajes = [], coachPerfil = [], coachMemoria = [], cuentas = [], recordatorios = [], rutina = [], genericAdd, genericUpdate, genericDelete, chatOpen = false, setChatOpen = () => {}, sheetOpen = false, setSheetOpen = () => {}, vozOpen = false, setVozOpen = () => {} }) => {
    // El chat y la hoja "Tu coach hoy" se controlan desde App (tarjeta de Inicio).
    const isOpen = chatOpen;
    const setIsOpen = setChatOpen;
    const [sheetInput, setSheetInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showPerfil, setShowPerfil] = useState(false);
    const [perfilDraft, setPerfilDraft] = useState('');
    const [perfilGuardado, setPerfilGuardado] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [vozError, setVozError] = useState('');
    // Acción agéntica pendiente de confirmar (la IA pidió ejecutar algo).
    const [pendingConfirm, setPendingConfirm] = useState(null);
    // Coach proactivo: análisis del día (se muestra en la hoja "Tu coach hoy").
    const [proactivoMensaje, setProactivoMensaje] = useState('');
    const [proactivoCargando, setProactivoCargando] = useState(false);
    const alertasLocales = useMemo(
        () => calcularAlertasCoach({ transacciones, limites, presupuestoItems }),
        [transacciones, limites, presupuestoItems]
    );
    const proactivoHechoRef = useRef(false);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const nativeSRRef = useRef(null); // módulo del plugin nativo de voz (solo iOS)

    // ¿El navegador soporta reconocimiento de voz? (Safari iOS usa el prefijo webkit)
    const SpeechRecognition = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;
    // En la app nativa usamos el dictado de iOS (la Web Speech API no funciona en WKWebView).
    // Electron expone webkitSpeechRecognition pero sin el servicio de Google detrás (falla con
    // 'network'): en escritorio se habla por el asistente de voz del menú lateral.
    const vozDisponible = Capacitor.isNativePlatform() || (!!SpeechRecognition && !window.desktop?.isElectron);

    const baseInputRef = useRef('');

    // Detiene el dictado (web o nativo).
    const detenerVoz = async () => {
        if (Capacitor.isNativePlatform()) {
            try { await nativeSRRef.current?.stop(); } catch (_) {}
            try { await nativeSRRef.current?.removeAllListeners(); } catch (_) {}
            setIsListening(false);
            return;
        }
        try { recognitionRef.current?.stop(); } catch (_) {}
    };

    // Dictado nativo de iOS mediante @capacitor-community/speech-recognition.
    const iniciarVozNativa = async () => {
        try {
            const { SpeechRecognition: SR } = await import('@capacitor-community/speech-recognition');
            nativeSRRef.current = SR;

            const perm = await SR.requestPermissions();
            if (perm?.speechRecognition !== 'granted') {
                setVozError('Permiso de voz denegado. Actívalo en Ajustes → Finanzas 360 → Micrófono y Reconocimiento de voz.');
                return;
            }

            baseInputRef.current = input ? input + ' ' : '';
            await SR.removeAllListeners();
            await SR.addListener('partialResults', (data) => {
                const t = data?.matches?.[0];
                if (typeof t === 'string') setInput(baseInputRef.current + t);
            });
            await SR.addListener('listeningState', (data) => {
                if (data?.status === 'stopped') setIsListening(false);
            });
            await SR.start({ language: 'es-CO', partialResults: true, popup: false });
            setIsListening(true);
        } catch (e) {
            console.error('Error al iniciar dictado nativo:', e);
            setVozError('No se pudo iniciar el dictado de voz.');
            setIsListening(false);
        }
    };

    const toggleVoz = async () => {
        setVozError('');
        // Si ya está escuchando, detener.
        if (isListening) {
            await detenerVoz();
            return;
        }
        // App nativa: dictado de iOS.
        if (Capacitor.isNativePlatform()) {
            await iniciarVozNativa();
            return;
        }
        // Web: Web Speech API del navegador.
        if (!SpeechRecognition) {
            setVozError('Tu navegador no soporta dictado por voz.');
            return;
        }
        try {
            const rec = new SpeechRecognition();
            rec.lang = 'es-CO';
            rec.continuous = true;
            rec.interimResults = true;
            baseInputRef.current = input ? input + ' ' : '';

            rec.onresult = (event) => {
                let texto = '';
                for (let i = 0; i < event.results.length; i++) {
                    texto += event.results[i][0].transcript;
                }
                setInput(baseInputRef.current + texto);
            };
            rec.onerror = (e) => {
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    setVozError('Permiso de micrófono denegado. Actívalo en los ajustes del navegador.');
                } else if (e.error === 'no-speech') {
                    setVozError('No te escuché. Intenta de nuevo.');
                }
                setIsListening(false);
            };
            rec.onend = () => setIsListening(false);

            recognitionRef.current = rec;
            rec.start();
            setIsListening(true);
        } catch (e) {
            console.error('Error al iniciar reconocimiento de voz:', e);
            setVozError('No se pudo iniciar el dictado.');
            setIsListening(false);
        }
    };

    // Detener el micrófono al cerrar el chat.
    useEffect(() => {
        if (!isOpen && isListening) {
            detenerVoz();
        }
    }, [isOpen, isListening]);

    const perfilDoc = coachPerfil[0] || null;
    const perfilNotas = perfilDoc?.notas || '';
    // Perfil que escribe el análisis semanal (Claude con la suscripción).
    const perfilIA = coachMemoria.find(m => m.id === 'perfil') || coachMemoria.find(m => m.texto) || null;

    // Sincronizar el borrador del editor cuando carga/cambia el perfil guardado.
    useEffect(() => {
        if (!showPerfil) setPerfilDraft(perfilNotas);
    }, [perfilNotas, showPerfil]);

    const handleGuardarPerfil = async () => {
        try {
            if (perfilDoc && genericUpdate) {
                await genericUpdate('coach_perfil', perfilDoc.id, { notas: perfilDraft, updatedAt: new Date().toISOString() });
            } else if (genericAdd) {
                await genericAdd('coach_perfil', { notas: perfilDraft, updatedAt: new Date().toISOString() });
            }
            setPerfilGuardado(true);
            setTimeout(() => setPerfilGuardado(false), 2000);
            setShowPerfil(false);
        } catch (e) { console.error('Error al guardar el perfil del coach:', e); }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, pendingConfirm]);

    // Cargar/sincronizar el historial guardado en Firestore (memoria del coach).
    // Mientras el coach está "escribiendo" no sobreescribimos para no pisar el
    // mensaje optimista que se muestra al instante.
    useEffect(() => {
        if (isTyping) return;
        const ordenados = [...coachMensajes]
            .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
            .map(m => ({ id: m.id, role: m.role, content: m.content, origin: m.origin }));
        setMessages(ordenados);
    }, [coachMensajes, isTyping]);

    // Los mensajes proactivos (del agente programado de Claude) llegan como no
    // leídos; al estar el chat abierto se marcan leídos (apaga el toast pendiente).
    useEffect(() => {
        coachMensajes
            .filter(m => m.origin === 'proactivo' && m.read === false)
            .forEach(m => genericUpdate('coach_mensajes', m.id, { read: true }));
    }, [coachMensajes]);

    const handleNuevaConversacion = async () => {
        if (!coachMensajes.length) { setMessages([]); return; }
        if (!window.confirm('¿Borrar todo el historial del coach? Esto no se puede deshacer.')) return;
        const ids = coachMensajes.map(m => m.id);
        setMessages([]);
        try {
            await Promise.all(ids.map(id => genericDelete && genericDelete('coach_mensajes', id)));
        } catch (e) { console.error('Error al borrar historial del coach:', e); }
    };

    const buildFinancialContext = async () => {
        const fmt = (n) => '$' + (Number(n) || 0).toLocaleString('es-CO');
        // Comparación por texto YYYY-MM-DD para evitar desfases de zona horaria
        // (las fechas se guardan como 'YYYY-MM-DD' en hora local).
        const hoyKey = dateKey();
        const mesKey = hoyKey.slice(0, 7); // 'YYYY-MM'
        const esEsteMes = (fecha) => typeof fecha === 'string' && fecha.slice(0, 7) === mesKey;
        const esHoy = (fecha) => fecha === hoyKey;

        // --- Resumen general ---
        // Mismo cálculo que la pantalla de Inicio: ingresos - gastos (las inversiones
        // de tipo patrimonio no son 'gasto', así que no se descuentan del saldo).
        const totalIngresosAll = transacciones.filter(t => t.tipo === 'ingreso').reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const totalGastosAll = transacciones.filter(t => t.tipo === 'gasto').reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const saldo = totalIngresosAll - totalGastosAll;
        const ingresosMes = transacciones.filter(t => t.tipo === 'ingreso' && esEsteMes(t.fecha)).reduce((acc, t) => acc + t.monto, 0);
        const gastosMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esEsteMes(t.fecha)).reduce((acc, t) => acc + t.monto, 0);
        const deudasPendientes = deudas.reduce((acc, d) => acc + (Number(d.montoTotal || 0) - Number(d.montoPagado || 0)), 0);
        const inversiones = transacciones.filter(esPosicionInversion);
        const tasaUSD = tasaUSDGuardada();
        const inversionesTotales = inversiones.reduce((acc, t) => acc + (aCOP(Number(t.monto) || 0, t.moneda, tasaUSD) ?? 0), 0);

        // --- Gastos del mes por categoría ---
        const gastosPorCat = {};
        transacciones
            .filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esEsteMes(t.fecha))
            .forEach(t => { gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });
        const gastosCatTxt = Object.entries(gastosPorCat)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, val]) => `- ${cat}: ${fmt(val)}`)
            .join('\n');

        // --- Movimientos de HOY (clave para preguntas tipo "gastos de hoy") ---
        const gastosHoy = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && esHoy(t.fecha));
        const ingresosHoyArr = transacciones.filter(t => t.tipo === 'ingreso' && esHoy(t.fecha));
        const totalGastoHoy = gastosHoy.reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const totalIngresoHoy = ingresosHoyArr.reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const gastosHoyPorCat = {};
        gastosHoy.forEach(t => { gastosHoyPorCat[t.categoria] = (gastosHoyPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });
        const gastosHoyTxt = gastosHoy.length === 0
            ? 'No hay gastos registrados hoy.'
            : gastosHoy
                .map(t => `- ${t.concepto || t.categoria} (${t.categoria}): ${fmt(t.monto)}`)
                .join('\n');
        const gastosHoyCatTxt = Object.entries(gastosHoyPorCat)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, val]) => `- ${cat}: ${fmt(val)}`)
            .join('\n');

        // --- Límites de gasto y su estado actual ---
        const limitesTxt = limites.map(l => {
            const gastado = gastosPorCat[l.categoria] || 0;
            const pct = l.limite > 0 ? Math.round((gastado / l.limite) * 100) : 0;
            const estado = gastado > l.limite ? '⚠️ EXCEDIDO' : 'ok';
            return `- ${l.categoria}: ${fmt(gastado)} de ${fmt(l.limite)} (${pct}%) ${estado}`;
        }).join('\n');

        // --- Presupuesto / gastos fijos ---
        const totalPresupuesto = presupuestoItems.reduce((acc, i) => acc + (Number(i.monto) || 0), 0);
        const presupuestoTxt = presupuestoItems
            .map(i => `- ${i.concepto} (${i.categoria}): ${fmt(i.monto)}${i.lastPaid ? ' [pagado este ciclo]' : ' [pendiente]'}`)
            .join('\n');

        // --- Metas (personales y financieras) ---
        const metasTxt = metas.map(m => {
            if (m.tipo === 'personal') {
                const checklist = m.checklist || [];
                const hechos = checklist.filter(c => c.completado).length;
                let linea = `- ${m.nombre} (personal, plazo: ${m.plazo || 'sin definir'}): ${m.completada ? '✅ completada' : 'en progreso'}`;
                if (checklist.length > 0) {
                    const pctChk = Math.round((hechos / checklist.length) * 100);
                    const pendientes = checklist.filter(c => !c.completado).map(c => c.texto);
                    linea += `; avances ${hechos}/${checklist.length} (${pctChk}%)`;
                    if (pendientes.length > 0) linea += `; pendientes: ${pendientes.join(', ')}`;
                }
                // Ahorro vinculado a una meta financiera
                if (m.metaFinancieraId) {
                    const mf = metas.find(x => x.id === m.metaFinancieraId);
                    if (mf) {
                        const a = Number(mf.ahorroActual) || 0;
                        const o = Number(mf.montoObjetivo) || 0;
                        const p = o > 0 ? Math.round((a / o) * 100) : 0;
                        linea += `; ahorro vinculado "${mf.nombre}": ${fmt(a)} de ${fmt(o)} (${p}%)`;
                    }
                }
                return linea;
            }
            const actual = Number(m.ahorroActual) || 0;
            const objetivo = Number(m.montoObjetivo) || 0;
            const pct = objetivo > 0 ? Math.round((actual / objetivo) * 100) : 0;
            const plan = m.fechaObjetivo ? `, fecha objetivo ${m.fechaObjetivo} (${m.frecuencia || 'quincenal'})` : '';
            return `- ${m.nombre} (financiera, plazo: ${m.plazo || 'sin definir'}${plan}): ${fmt(actual)} de ${fmt(objetivo)} (${pct}%)`;
        }).join('\n');

        // --- Deudas detalladas ---
        const deudasTxt = deudas.map(d => {
            const total = Number(d.montoTotal) || 0;
            const pagado = Number(d.montoPagado) || 0;
            const restante = total - pagado;
            const pct = total > 0 ? Math.round((pagado / total) * 100) : 0;
            return `- ${d.nombre}: restan ${fmt(restante)} de ${fmt(total)} (pagado ${pct}%${d.cuotas ? `, ${d.cuotas} cuotas` : ''})`;
        }).join('\n');

        // --- Inversiones detalladas ---
        const inversionesTxt = inversiones.map(t => {
            const tasa = t.tasaInteres ? `, tasa ${t.tasaInteres}% E.A.` : '';
            const tipo = t.subTipo ? ` [${t.subTipo}]` : '';
            const tk = t.ticker ? `, ticker ${t.ticker}` : '';
            const montoTxt = t.moneda === 'USD' ? formatUSD(Number(t.monto) || 0) : fmt(t.monto);
            const util = Number(t.utilidad) || 0;
            const montoBase = Number(t.monto) || 0;
            const rent = montoBase > 0 ? ((util / montoBase) * 100).toFixed(1) : '0';
            const utilTxt = util !== 0 ? `, utilidad ${util >= 0 ? '+' : ''}${t.moneda === 'USD' ? formatUSD(util) : fmt(util)} (${rent}%)` : '';
            return `- ${t.concepto || t.categoria}${tipo}: ${montoTxt}${tasa}${tk}${utilTxt}`;
        }).join('\n');

        // --- Hábitos y rachas ---
        const habitosTxt = (habitos || []).map(h => {
            const hist = h.historial || [];
            const streak = calcStreak(hist);
            const hoy = hist.includes(dateKey());
            // últimos 7 días: cuántos completados
            let ultimos7 = 0;
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                if (hist.includes(dateKey(d))) ultimos7++;
            }
            return `- [id ${h.id}] ${h.emoji || ''} ${h.nombre}: racha de ${streak} día(s)${hoy ? ' (✅ hecho hoy)' : ' (⬜ pendiente hoy)'}, ${ultimos7}/7 últimos días`;
        }).join('\n');

        // --- Diario / estado de ánimo (últimas 7 entradas) ---
        const moodEmoji = (v) => (MOODS.find(m => m.v === v)?.e || '');
        const diarioOrdenado = [...(diario || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        const ultimasEntradas = diarioOrdenado.slice(0, 7);
        const diarioTxt = ultimasEntradas.map(d => {
            const txt = d.texto ? `: "${d.texto}"` : '';
            return `- ${d.fecha} ${moodEmoji(d.animo)} (ánimo ${d.animo || '?'}/5)${txt}`;
        }).join('\n');
        const animosValidos = ultimasEntradas.filter(d => d.animo).map(d => d.animo);
        const promedioAnimo = animosValidos.length > 0
            ? (animosValidos.reduce((a, c) => a + c, 0) / animosValidos.length).toFixed(1)
            : null;

        // --- Google: agenda (7 días) y tareas, con id para poder moverlas o completarlas ---
        let googleTasksTxt = '';
        let agendaTxt = '';
        if (googleToken) {
            const auth = { headers: { Authorization: `Bearer ${googleToken}` } };
            const desde = new Date(); desde.setHours(0, 0, 0, 0);
            const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 8);
            const [tareasRes, eventosRes] = await Promise.all([
                fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=50', auth).catch(() => null),
                fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${desde.toISOString()}&timeMax=${hasta.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=60`, auth).catch(() => null),
            ]);
            try {
                if (tareasRes?.ok) {
                    const gdata = await tareasRes.json();
                    googleTasksTxt = (gdata.items || [])
                        .filter(t => t.status !== 'completed')
                        .map(t => `- [id ${t.id}] ${t.title}${t.due ? ` (vence ${t.due.split('T')[0]})` : ''}`)
                        .join('\n');
                }
                if (eventosRes?.ok) {
                    const edata = await eventosRes.json();
                    agendaTxt = (edata.items || []).map(ev => {
                        const ini = ev.start?.dateTime, fin = ev.end?.dateTime;
                        const fecha = (ini || ev.start?.date || '').slice(0, 10);
                        const hora = ini ? `${new Date(ini).toTimeString().slice(0, 5)}–${fin ? new Date(fin).toTimeString().slice(0, 5) : ''}` : 'todo el día';
                        return `- [id ${ev.id}] ${fecha} ${hora} · ${ev.summary || '(sin título)'}`;
                    }).join('\n');
                }
            } catch (_) { /* ignorar errores de Google */ }
        }
        const googleEstado = googleToken ? 'CONECTADO' : 'NO CONECTADO (debe ir a Todo → Agenda → "Conectar Google")';

        // --- Recordatorios, hábitos con aviso y rutina (asistente personal) ---
        const NOMBRES_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
        const diasTxt = (d) => (Array.isArray(d) && d.length && d.length < 7 ? ` (${d.map(x => NOMBRES_DIA[x]).join(', ')})` : '');
        const recordatoriosTxt = recordatorios.map(r => {
            const estado = r.activo === false ? ' [PAUSADO]' : '';
            if (r.sistema === 'resumen') return `- [id ${r.id}] Resumen de la mañana a las ${r.hora || '06:30'}${estado}`;
            if (r.sistema === 'lectura') return `- [id ${r.id}] Lectura del día a las ${r.hora || '21:00'}${estado}`;
            const cuando = r.tipo === 'intervalo' ? `cada ${r.cadaMin} min de ${r.desde} a ${r.hasta}` : r.tipo === 'unico' ? `el ${r.fecha} a las ${r.hora}` : `a las ${r.hora}`;
            return `- [id ${r.id}] ${r.emoji || ''} ${r.titulo}: ${cuando}${diasTxt(r.dias)}${estado}`;
        }).join('\n');
        const rutinaHoyTxt = rutina.filter(b => b.dia === new Date().getDay()).sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''))
            .map(b => `- ${b.horaInicio}–${b.horaFin} ${b.titulo}`).join('\n');

        // --- Perfil de largo plazo (memoria estable que el usuario define) ---
        const metasActivas = metas.filter(m => !m.completada)
            .map(m => m.nombre)
            .slice(0, 6)
            .join(', ');
        const habitosClave = (habitos || []).map(h => h.nombre).slice(0, 6).join(', ');
        const perfilBloque = `PERFIL DEL USUARIO (memoria de largo plazo, tenlo SIEMPRE presente):
${perfilNotas ? `- Notas que el usuario quiere que recuerdes: ${perfilNotas}` : '- (El usuario aún no escribió notas de perfil.)'}
- Metas activas: ${metasActivas || 'ninguna definida'}
- Hábitos que cultiva: ${habitosClave || 'ninguno definido'}`;

        return `${perfilBloque}

RESUMEN FINANCIERO GENERAL:
- Saldo disponible actual: ${fmt(saldo)}
- Ingresos de este mes: ${fmt(ingresosMes)}
- Gastos de este mes: ${fmt(gastosMes)}
- Total de gastos fijos presupuestados: ${fmt(totalPresupuesto)}
- Total invertido en portafolio: ${fmt(inversionesTotales)}
- Total de deudas pendientes: ${fmt(deudasPendientes)}

MOVIMIENTOS DE HOY (${hoyKey}):
- Total gastado hoy: ${fmt(totalGastoHoy)} (${gastosHoy.length} gasto(s))
- Total ingresado hoy: ${fmt(totalIngresoHoy)}
Detalle de gastos de hoy:
${gastosHoyTxt}
Gastos de hoy por categoría:
${gastosHoyCatTxt || 'Ninguno.'}

GASTOS DE ESTE MES POR CATEGORÍA:
${gastosCatTxt || 'Sin gastos registrados este mes.'}

LÍMITES DE GASTO (TOPES) Y SU ESTADO:
${limitesTxt || 'No hay límites definidos.'}

PRESUPUESTO / GASTOS FIJOS:
${presupuestoTxt || 'No hay gastos fijos definidos.'}

METAS DEL USUARIO:
${metasTxt || 'No hay metas definidas.'}

DEUDAS:
${deudasTxt || 'No hay deudas registradas.'}

INVERSIONES / PORTAFOLIO:
${inversionesTxt || 'No hay inversiones registradas.'}

GOOGLE (Calendar y Tasks): ${googleEstado}

AGENDA DE GOOGLE CALENDAR (hoy y próximos 7 días):
${agendaTxt || (googleToken ? 'No hay eventos.' : '(no disponible: Google no está conectado)')}

TAREAS DE GOOGLE TASKS:
${googleTasksTxt || (googleToken ? 'No hay tareas pendientes en Google Tasks.' : '(no disponible: Google no está conectado)')}

RECORDATORIOS (notificaciones que le llegan al celular):
${recordatoriosTxt || 'Ninguno.'}

RUTINA DE HOY:
${rutinaHoyTxt || 'Sin bloques de rutina hoy.'}

HÁBITOS Y RACHAS:
${habitosTxt || 'No hay hábitos registrados.'}

DIARIO / ESTADO DE ÁNIMO (últimas entradas)${promedioAnimo ? ` — promedio reciente: ${promedioAnimo}/5` : ''}:
${diarioTxt || 'No hay entradas en el diario.'}

${cuentasTexto(cuentas, transacciones)}

${memoriaTexto(transacciones)}

PERFIL FINANCIERO (lo que el análisis semanal ha aprendido del usuario):
${perfilIA?.texto || '(Aún no generado.)'}`;
    };

    // --- MODO AGÉNTICO: el coach puede EJECUTAR acciones ---

    // Etiqueta legible para la tarjeta de confirmación de cada acción.
    const describirAccion = (tu) => {
        const i = tu.input || {};
        switch (tu.name) {
            case 'registrar_transaccion':
                return {
                    icon: i.tipo === 'ingreso' ? '💰' : '💸',
                    titulo: i.tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar gasto',
                    detalle: `${formatCurrency(Number(i.monto) || 0)} · ${i.categoria || ''}${i.concepto ? ` · ${i.concepto}` : ''}`
                };
            case 'crear_evento_calendar':
                return { icon: '📅', titulo: 'Crear evento en Calendar', detalle: `${i.titulo} · ${i.fecha}${i.hora ? ` a las ${i.hora}` : ' (todo el día)'}` };
            case 'crear_tarea':
                return { icon: '✅', titulo: 'Crear tarea en Tasks', detalle: `${i.titulo}${i.fecha_limite ? ` · vence ${i.fecha_limite}` : ''}` };
            case 'registrar_deuda':
                return { icon: '🏦', titulo: 'Registrar deuda', detalle: `${i.nombre} · ${formatCurrency(Number(i.monto_total) || 0)}${i.cuotas ? ` · ${i.cuotas} cuotas` : ''}` };
            case 'crear_meta':
                return { icon: '🎯', titulo: 'Crear meta', detalle: `${i.nombre}${i.monto_objetivo ? ` · ${formatCurrency(Number(i.monto_objetivo))}` : ''}${i.plazo ? ` · ${i.plazo}` : ''}` };
            case 'crear_recordatorio': {
                const cuando = i.tipo === 'intervalo' ? `cada ${i.cada_min || 60} min de ${i.desde || '08:00'} a ${i.hasta || '18:00'}`
                    : i.tipo === 'unico' ? `${i.fecha} a las ${i.hora}` : `a las ${i.hora}`;
                return { icon: i.emoji || '🔔', titulo: 'Crear recordatorio', detalle: `${i.titulo} · ${cuando}${i.dias && i.dias !== 'todos' ? ` · ${i.dias.replace('_', ' ')}` : ''}` };
            }
            case 'eliminar_recordatorio': {
                const r = recordatorios.find(x => x.id === i.recordatorio_id);
                return { icon: '🗑️', titulo: 'Eliminar recordatorio', detalle: r ? r.titulo : i.recordatorio_id };
            }
            case 'pausar_recordatorio': {
                const r = recordatorios.find(x => x.id === i.recordatorio_id);
                const accion = i.activo === false ? 'Pausar' : i.activo === true ? 'Reactivar' : 'Cambiar';
                return { icon: '⏸️', titulo: `${accion} recordatorio`, detalle: `${r ? r.titulo : i.recordatorio_id}${i.hora ? ` · nueva hora ${i.hora}` : ''}` };
            }
            case 'mover_evento_calendar':
                return { icon: '📅', titulo: 'Mover evento', detalle: `al ${i.fecha} a las ${i.hora}` };
            case 'eliminar_evento_calendar':
                return { icon: '🗑️', titulo: 'Eliminar evento de Calendar', detalle: 'Se borrará de tu Google Calendar' };
            case 'completar_tarea':
                return { icon: '✅', titulo: 'Completar tarea', detalle: 'Se marcará como hecha en Google Tasks' };
            default:
                return { icon: '⚙️', titulo: tu.name, detalle: '' };
        }
    };

    // Ejecuta UNA herramienta solicitada por el coach. Devuelve texto de resultado
    // que se le reenvía al modelo como tool_result para que confirme en lenguaje natural.
    const ejecutarHerramienta = async (tu) => {
        const input = tu.input || {};
        const fmtYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        try {
            switch (tu.name) {
                case 'registrar_transaccion': {
                    const tipo = input.tipo === 'ingreso' ? 'ingreso' : 'gasto';
                    const lista = tipo === 'ingreso' ? CATEGORIAS_INGRESOS : CATEGORIAS_GASTOS;
                    const categoria = lista.includes(input.categoria) ? input.categoria : 'Otros';
                    const monto = Number(input.monto);
                    if (!monto || monto <= 0) return 'Error: el monto no es válido.';
                    await genericAdd('transacciones', {
                        tipo, monto,
                        concepto: input.concepto || (tipo === 'ingreso' ? 'Ingreso' : 'Gasto'),
                        categoria,
                        fecha: input.fecha || dateKey(),
                        createdAt: new Date().toISOString()
                    });
                    return `OK: ${tipo} de ${formatCurrency(monto)} registrado en "${categoria}".`;
                }
                case 'registrar_deuda': {
                    const montoTotal = Number(input.monto_total);
                    if (!montoTotal || montoTotal <= 0) return 'Error: el monto total no es válido.';
                    await genericAdd('deudas', {
                        nombre: input.nombre || 'Deuda',
                        montoTotal,
                        montoPagado: 0,
                        cuotas: input.cuotas ? Number(input.cuotas) : null
                    });
                    return `OK: deuda "${input.nombre}" de ${formatCurrency(montoTotal)} registrada.`;
                }
                case 'crear_meta': {
                    const esFin = input.tipo === 'financiera';
                    await genericAdd('metas', {
                        nombre: input.nombre || 'Meta',
                        plazo: input.plazo || '',
                        tipo: esFin ? 'financiera' : 'personal',
                        montoObjetivo: esFin ? Number(input.monto_objetivo || 0) : 0,
                        ahorroActual: 0,
                        ...(esFin ? {
                            fechaObjetivo: input.fecha_objetivo || null,
                            frecuencia: input.frecuencia || 'quincenal',
                            aportes: [],
                            createdAt: new Date().toISOString(),
                        } : {}),
                        completada: false,
                        checklist: [],
                        metaFinancieraId: null
                    });
                    return `OK: meta "${input.nombre}" creada${esFin && input.fecha_objetivo ? ` con fecha objetivo ${input.fecha_objetivo}` : ''}.`;
                }
                case 'crear_evento_calendar': {
                    if (!googleToken) return 'Error: no hay conexión con Google. Pídele al usuario que conecte su cuenta en la sección Agenda.';
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    let evento;
                    if (input.hora) {
                        const start = new Date(`${input.fecha}T${input.hora}:00`);
                        const dur = Number(input.duracion_min) || 60;
                        const end = new Date(start.getTime() + dur * 60000);
                        evento = { summary: input.titulo, start: { dateTime: start.toISOString(), timeZone: tz }, end: { dateTime: end.toISOString(), timeZone: tz } };
                    } else {
                        const end = new Date(`${input.fecha}T00:00:00`); end.setDate(end.getDate() + 1);
                        evento = { summary: input.titulo, start: { date: input.fecha }, end: { date: fmtYmd(end) } };
                    }
                    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(evento)
                    });
                    if (!res.ok) {
                        if (res.status === 401 || res.status === 403) return 'Error: el permiso de Google Calendar expiró. Pídele al usuario que reconecte su cuenta de Google.';
                        return 'Error: no se pudo crear el evento en Calendar.';
                    }
                    return `OK: evento "${input.titulo}" creado en Google Calendar.`;
                }
                case 'crear_tarea': {
                    if (!googleToken) return 'Error: no hay conexión con Google. Pídele al usuario que conecte su cuenta en la sección Agenda.';
                    const tbody = { title: input.titulo };
                    if (input.fecha_limite) tbody.due = new Date(`${input.fecha_limite}T00:00:00`).toISOString();
                    const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(tbody)
                    });
                    if (!res.ok) {
                        if (res.status === 401 || res.status === 403) return 'Error: el permiso de Google Tasks expiró. Pídele al usuario que reconecte su cuenta de Google.';
                        return 'Error: no se pudo crear la tarea.';
                    }
                    return `OK: tarea "${input.titulo}" creada en Google Tasks.`;
                }
                case 'crear_recordatorio': {
                    const NOMBRES = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3, jueves: 4, viernes: 5, sabado: 6, 'sábado': 6 };
                    const txt = String(input.dias || 'todos').toLowerCase();
                    const dias = txt === 'laborales' ? [1, 2, 3, 4, 5] : txt === 'fin_de_semana' ? [0, 6]
                        : txt === 'todos' ? [] : txt.split(/[,\s]+/).map(d => NOMBRES[d.trim()]).filter(d => d !== undefined);
                    const tipo = ['hora', 'intervalo', 'unico'].includes(input.tipo) ? input.tipo : 'hora';
                    const hhmm = (v, def) => (/^\d{1,2}:\d{2}$/.test(v || '') ? v.padStart(5, '0') : def);
                    if (tipo !== 'intervalo' && !/^\d{1,2}:\d{2}$/.test(input.hora || '')) return 'Error: falta la hora del recordatorio (HH:MM).';
                    if (tipo === 'unico' && !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha || '')) return 'Error: falta la fecha del recordatorio (YYYY-MM-DD).';
                    const habito = input.habito_id ? habitos.find(h => h.id === input.habito_id) : null;
                    await genericAdd('recordatorios', {
                        titulo: String(input.titulo || 'Recordatorio').slice(0, 80), emoji: input.emoji || '🔔', tipo,
                        ...(tipo === 'intervalo'
                            ? { desde: hhmm(input.desde, '08:00'), hasta: hhmm(input.hasta, '18:00'), cadaMin: Math.max(15, Number(input.cada_min) || 60) }
                            : { hora: hhmm(input.hora, '08:00') }),
                        ...(tipo === 'unico' ? { fecha: input.fecha } : {}),
                        dias, mensaje: input.mensaje || '', habitoId: habito ? habito.id : null,
                        activo: true, origen: 'ia', createdAt: new Date().toISOString(),
                    });
                    return `OK: recordatorio "${input.titulo}" creado; le llegará como notificación al celular.`;
                }
                case 'eliminar_recordatorio': {
                    const r = recordatorios.find(x => x.id === input.recordatorio_id);
                    if (!r) return 'Error: no encontré ese recordatorio.';
                    if (r.sistema) {
                        await genericUpdate('recordatorios', r.id, { activo: false });
                        return `OK: "${r.titulo}" quedó pausado (es parte del asistente; se puede reactivar).`;
                    }
                    await genericDelete('recordatorios', r.id);
                    return `OK: recordatorio "${r.titulo}" eliminado.`;
                }
                case 'pausar_recordatorio': {
                    const r = recordatorios.find(x => x.id === input.recordatorio_id);
                    if (!r) return 'Error: no encontré ese recordatorio.';
                    const cambios = {};
                    if (typeof input.activo === 'boolean') cambios.activo = input.activo;
                    if (/^\d{1,2}:\d{2}$/.test(input.hora || '')) cambios.hora = input.hora.padStart(5, '0');
                    if (!Object.keys(cambios).length) return 'Error: no indicaste qué cambiar.';
                    await genericUpdate('recordatorios', r.id, cambios);
                    return `OK: recordatorio "${r.titulo}" actualizado.`;
                }
                case 'mover_evento_calendar': {
                    if (!googleToken) return 'Error: Google no está conectado. Pídele que vaya a Todo → Agenda → Conectar Google.';
                    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.evento_id)}`;
                    const auth = { Authorization: `Bearer ${googleToken}` };
                    const actual = await fetch(url, { headers: auth });
                    if (!actual.ok) return 'Error: no encontré ese evento en Calendar.';
                    const ev = await actual.json();
                    const durAnterior = ev.start?.dateTime && ev.end?.dateTime ? (new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000 : 60;
                    const start = new Date(`${input.fecha}T${input.hora}:00`);
                    const end = new Date(start.getTime() + (Number(input.duracion_min) || durAnterior) * 60000);
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const res = await fetch(url, {
                        method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ start: { dateTime: start.toISOString(), timeZone: tz }, end: { dateTime: end.toISOString(), timeZone: tz } }),
                    });
                    if (!res.ok) return 'Error: no se pudo mover el evento.';
                    return `OK: evento "${ev.summary || ''}" movido al ${input.fecha} a las ${input.hora}.`;
                }
                case 'eliminar_evento_calendar': {
                    if (!googleToken) return 'Error: Google no está conectado. Pídele que vaya a Todo → Agenda → Conectar Google.';
                    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.evento_id)}`, {
                        method: 'DELETE', headers: { Authorization: `Bearer ${googleToken}` },
                    });
                    if (!res.ok && res.status !== 410) return 'Error: no se pudo eliminar el evento.';
                    return 'OK: evento eliminado de Google Calendar.';
                }
                case 'completar_tarea': {
                    if (!googleToken) return 'Error: Google no está conectado. Pídele que vaya a Todo → Agenda → Conectar Google.';
                    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(input.tarea_id)}`, {
                        method: 'PATCH', headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'completed' }),
                    });
                    if (!res.ok) return 'Error: no se pudo completar la tarea.';
                    return 'OK: tarea marcada como hecha en Google Tasks.';
                }
                default:
                    return 'Error: herramienta desconocida.';
            }
        } catch (e) {
            console.error('Error ejecutando herramienta', tu.name, e);
            return 'Error al ejecutar la acción: ' + (e?.message || 'desconocido');
        }
    };

    // Llama al backend en modo agéntico. Devuelve { reply, content, stop_reason }.
    // Contexto completo (fecha, calendario resuelto y datos financieros), compartido por el
    // chat y el asistente de voz.
    const contextoConFecha = async () => {
        const baseCtx = await buildFinancialContext();
        const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });
        // Calendario ya resuelto: los modelos abiertos se equivocan con "el viernes", "mañana"…
        const proximos = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() + i + 1);
            const etiqueta = i === 0 ? 'mañana' : d.toLocaleDateString('es-CO', { weekday: 'long' });
            return `${etiqueta} ${d.getDate()} = ${dateKey(d)}`;
        }).join('; ');
        return `FECHA Y HORA ACTUAL: ${ahora} (hoy = ${dateKey()}).\nPRÓXIMOS DÍAS (usa esto para "mañana", "el viernes", "la otra semana"; "el viernes" = el PRÓXIMO viernes de esta lista): ${proximos}.\n\n${baseCtx}`;
    };
    const contextoRef = useRef(contextoConFecha);
    contextoRef.current = contextoConFecha;
    const ejecutarRef = useRef(null);
    ejecutarRef.current = ejecutarHerramienta;
    const obtenerContextoVoz = useCallback(() => contextoRef.current(), []);
    const ejecutarVoz = useCallback((tu) => ejecutarRef.current(tu), []);

    // --- ASISTENTE PROACTIVO: la IA escribe el resumen de la próxima mañana y las
    // lecturas de la semana; se guardan en el teléfono y el programador las agenda.
    const firmaSistema = recordatorios.filter(r => r.sistema).map(r => `${r.id}:${r.hora}:${r.activo}`).join('|');
    useEffect(() => {
        if (!firmaSistema) return;
        const t = setTimeout(async () => {
            const ahora = new Date();
            const resumenRec = recordatorios.find(r => r.sistema === 'resumen' && r.activo !== false);
            const lecturaRec = recordatorios.find(r => r.sistema === 'lectura' && r.activo !== false);
            let resumen = null;
            if (resumenRec) {
                const [h, m] = (resumenRec.hora || '06:30').split(':').map(Number);
                const d = new Date(ahora); d.setHours(h, m || 0, 0, 0);
                if (d <= ahora) d.setDate(d.getDate() + 1);
                const fecha = dateKey(d);
                const previo = leerResumen(fecha);
                // Se reescribe si no existe o tiene más de 6 h (así lleva lo último que registraste).
                if (!previo || Date.now() - (previo.at || 0) > 6 * 3600e3) {
                    resumen = { fecha, etiqueta: `${fecha === dateKey(ahora) ? 'hoy' : 'mañana'} ${d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}` };
                }
            }
            const lecturas = leerLecturas();
            const faltan = lecturaRec ? Array.from({ length: 7 }, (_, i) => { const d = new Date(ahora); d.setDate(d.getDate() + i); return dateKey(d); }).filter(f => !lecturas[f]) : [];
            if (!resumen && faltan.length < 3) return; // las lecturas se piden por lotes
            try {
                const ultimo = Number(localStorage.getItem('f360-asistente-intento')) || 0;
                if (Date.now() - ultimo < 30 * 60e3) return; // no insistir si falló hace poco
                localStorage.setItem('f360-asistente-intento', String(Date.now()));
            } catch { /* */ }
            try {
                const res = await fetch(`${API_BASE}/api/asistente-diario`, {
                    method: 'POST', headers: await encabezadosCoach(),
                    body: JSON.stringify({ context: await contextoRef.current(), resumen, lecturas: faltan.length >= 3 ? faltan : [] }),
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.resumen && resumen) localStorage.setItem(CLAVE_RESUMEN(resumen.fecha), JSON.stringify({ ...data.resumen, at: Date.now() }));
                if (data.lecturas) {
                    const hoy = dateKey();
                    const todas = { ...lecturas, ...data.lecturas };
                    Object.keys(todas).forEach(f => { if (f < hoy) delete todas[f]; });
                    localStorage.setItem(CLAVE_LECTURAS, JSON.stringify(todas));
                }
                localStorage.removeItem('f360-asistente-intento');
                // Limpia resúmenes de días pasados.
                Object.keys(localStorage).filter(k => k.startsWith('f360-resumen-') && k.slice(13) < dateKey()).forEach(k => localStorage.removeItem(k));
                window.dispatchEvent(new Event('f360-reprogramar'));
            } catch (e) { console.warn('Asistente proactivo:', e); }
        }, 8000); // después de que la app cargue todo
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaSistema]);

    const llamarCoach = async (msgs) => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('Estás sin conexión. El coach necesita internet; tus gastos sí puedes registrarlos y se sincronizan al volver.');
        }
        const context = await contextoConFecha();
        const res = await fetch(`${API_BASE}/api/ai-coach`, {
            method: 'POST',
            headers: await encabezadosCoach(),
            body: JSON.stringify({ context, messages: msgs, enableTools: true })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error en la API del Coach');
        }
        return res.json();
    };

    // Un paso del agente: si el modelo pide herramientas, muestra la confirmación;
    // si responde texto, lo muestra y lo persiste.
    const pasoAgente = async (msgs) => {
        const data = await llamarCoach(msgs);
        const content = Array.isArray(data.content) ? data.content : [];
        const texto = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || (data.reply || '');
        const toolUses = content.filter(b => b.type === 'tool_use');

        if (toolUses.length > 0) {
            // Confirmar primero: guardamos el estado para reanudar al tocar Confirmar/Cancelar.
            setIsTyping(false);
            setPendingConfirm({ intro: texto, toolUses, assistantContent: content, baseMessages: msgs });
            return;
        }

        const finalTxt = texto || 'No recibí respuesta. Intenta de nuevo.';
        setMessages(prev => [...prev, { role: 'assistant', content: finalTxt }]);
        setIsTyping(false);
        if (genericAdd) {
            genericAdd('coach_mensajes', { role: 'assistant', content: finalTxt, createdAt: new Date(Date.now() + 1).toISOString() })
                .catch(e => console.error('No se pudo guardar la respuesta del coach:', e));
        }
    };

    // El usuario aprobó la acción: ejecutar herramientas y dejar que el modelo confirme.
    const confirmarAccion = async () => {
        const pc = pendingConfirm;
        if (!pc) return;
        setPendingConfirm(null);
        setIsTyping(true);

        const toolResults = [];
        for (const tu of pc.toolUses) {
            const resultado = await ejecutarHerramienta(tu);
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultado });
        }

        const msgs = [
            ...pc.baseMessages,
            { role: 'assistant', content: pc.assistantContent },
            { role: 'user', content: toolResults }
        ];
        try {
            await pasoAgente(msgs);
        } catch (e) {
            console.error('Error tras ejecutar acción:', e);
            const resumen = toolResults.map(r => '• ' + r.content).join('\n');
            const txt = '✅ Hecho:\n' + resumen;
            setMessages(prev => [...prev, { role: 'assistant', content: txt }]);
            setIsTyping(false);
            if (genericAdd) {
                genericAdd('coach_mensajes', { role: 'assistant', content: txt, createdAt: new Date(Date.now() + 1).toISOString() }).catch(() => {});
            }
        }
    };

    // El usuario rechazó la acción: no se ejecuta nada.
    const cancelarAccion = () => {
        setPendingConfirm(null);
        const txt = 'De acuerdo, no hice ningún cambio. ¿Quieres ajustar algo?';
        setMessages(prev => [...prev, { role: 'assistant', content: txt }]);
        if (genericAdd) {
            genericAdd('coach_mensajes', { role: 'assistant', content: txt, createdAt: new Date(Date.now() + 1).toISOString() }).catch(() => {});
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        enviarTexto(input);
    };

    // Envía un mensaje al coach (desde el input del chat, la hoja o una sugerencia).
    const enviarTexto = async (texto) => {
        if (!String(texto || '').trim()) return;
        if (pendingConfirm) return; // hay una acción esperando confirmación

        if (isListening) { try { recognitionRef.current?.stop(); } catch (_) {} }
        const userMsg = String(texto).trim();
        setInput('');

        // Ventana corta de contexto (últimos 12 turnos de texto). La memoria de largo
        // plazo vive en el PERFIL, así que basta para mantener bajo el costo de tokens.
        const historreciente = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));
        const baseMessages = [...historreciente, { role: 'user', content: userMsg }];

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]); // feedback optimista
        setIsTyping(true);

        const userTs = new Date().toISOString();
        if (genericAdd) {
            genericAdd('coach_mensajes', { role: 'user', content: userMsg, createdAt: userTs })
                .catch(e => console.error('No se pudo guardar el mensaje del usuario:', e));
        }

        try {
            await pasoAgente(baseMessages);
        } catch (error) {
            console.error('Coach IA Error:', error);
            const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;
            setMessages(prev => [...prev, { role: 'assistant', content: sinRed ? `📴 ${error.message}` : '❌ Lo siento, hubo un error de conexión con el Coach IA. Intenta de nuevo en unos segundos.' }]);
            setIsTyping(false);
        }
    };

    // --- COACH PROACTIVO ---
    // Alertas locales (sin costo de IA): se calculan al instante con los datos ya cargados.
    const generarProactivo = async () => {
        const hoy = dateKey();

        // El análisis del coach se genera y se muestra UNA SOLA VEZ AL DÍA.
        // Si ya se generó hoy (en esta o en cualquier apertura anterior), no hacemos nada:
        // ni se vuelve a llamar a la IA (ahorro de tokens) ni se vuelve a mostrar el aviso.
        let cache = null;
        try { cache = JSON.parse(localStorage.getItem('coach_proactivo') || 'null'); } catch (e) { /* */ }
        if (cache && cache.fecha === hoy) {
            setProactivoMensaje(cache.mensaje || '');
            return;
        }

        // Reclamamos el día de INMEDIATO (antes de llamar a la IA). Así, si abres la app
        // otra vez mientras este análisis aún se está generando, la segunda apertura ve
        // que el día ya está tomado y no dispara un segundo análisis.
        try { localStorage.setItem('coach_proactivo', JSON.stringify({ fecha: hoy, mensaje: '' })); } catch (e) { /* */ }

        setProactivoCargando(true);
        let mensaje = '';
        try {
            const context = await buildFinancialContext();
            const instruccion = `[MENSAJE PROACTIVO AUTOMÁTICO — el usuario acaba de abrir la app; NO hizo ninguna pregunta]
Actúa como su coach financiero personal y dale un mensaje breve y útil para HOY, basándote SOLO en sus datos reales. Incluye, únicamente si aplica:
- La advertencia más importante (un gasto, límite, deuda o balance que requiera atención).
- Un paso concreto y pequeño para avanzar HOY en una de sus metas de ahorro o personales (con cifras de sus datos).
- Un reconocimiento si va bien en algo (una racha de hábito, una meta cerca, buen ahorro).
Máximo 4 viñetas cortas. Empieza con una frase tipo titular de una línea. Tono cálido, directo y motivador. No saludes de forma larga.`;

            const res = await fetch(`${API_BASE}/api/ai-coach`, {
                method: 'POST',
                headers: await encabezadosCoach(),
                body: JSON.stringify({ context, messages: [{ role: 'user', content: instruccion }] })
            });
            if (res.ok) {
                const data = await res.json();
                mensaje = data.reply || '';
            }
        } catch (e) {
            console.error('Error generando mensaje proactivo:', e);
        }
        // Guardamos el mensaje final manteniendo la fecha de hoy (sigue siendo 1 vez al día).
        try { localStorage.setItem('coach_proactivo', JSON.stringify({ fecha: hoy, mensaje })); } catch (e) { /* */ }
        setProactivoMensaje(mensaje);
        setProactivoCargando(false);

    };

    // Dispara el coach proactivo una sola vez por sesión, cuando ya hay datos cargados.
    useEffect(() => {
        if (proactivoHechoRef.current) return;
        if (transacciones.length === 0 && metas.length === 0) return; // espera a que carguen los datos
        proactivoHechoRef.current = true;
        generarProactivo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transacciones, metas]);

    const TONO = {
        expense: { soft: 'var(--expense-soft)', color: 'var(--expense)' },
        warn: { soft: 'var(--warn-soft)', color: 'var(--warn)' },
        income: { soft: 'var(--income-soft)', color: 'var(--income)' },
        primary: { soft: 'var(--primary-soft)', color: 'var(--primary)' },
    };

    const limiteTop = alertasLocales.find(a => a.tipo === 'limite');
    const sugerencias = [
        limiteTop ? `¿Cómo reduzco mis ${limiteTop.categoria.toLowerCase()}?` : '¿En qué se me va el dinero?',
        'Arma mi plan quincenal',
        'Resumen del mes',
    ];

    const preguntarDesdeHoja = (texto) => {
        if (!String(texto || '').trim()) return;
        setSheetInput('');
        setSheetOpen(false);
        setIsOpen(true);
        enviarTexto(texto);
    };

    // Avatar del coach: anillo cónico girando alrededor de la chispa.
    const AvatarCoach = ({ size = 52 }) => (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(from 0deg, #3355FF, #22D3EE, #A78BFA, #3355FF)', animation: 'spin 4s linear infinite', filter: 'blur(.5px)' }} />
            <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--violet)' }}>
                <Sparkles size={size * 0.42} strokeWidth={1.8} aria-hidden="true" />
            </div>
        </div>
    );

    const hallazgos = alertasLocales.length;

    return (
      <>
        {vozOpen && (
            <Suspense fallback={null}>
                <VozIA abierto={vozOpen} onCerrar={() => setVozOpen(false)} obtenerContexto={obtenerContextoVoz}
                    ejecutarHerramienta={ejecutarVoz} describirAccion={describirAccion} />
            </Suspense>
        )}
        {/* === HOJA "TU COACH HOY" (se abre desde la tarjeta de Inicio) === */}
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Tu coach hoy">
            <div style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <AvatarCoach />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Tu coach hoy</h2>
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                            {hallazgos === 0 ? 'Todo en orden por ahora' : `${hallazgos} ${hallazgos === 1 ? 'hallazgo' : 'hallazgos'} en tus finanzas`}
                        </span>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => setSheetOpen(false)} aria-label="Cerrar">
                        <X size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                </header>

                {hallazgos > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {alertasLocales.map((a, i) => {
                            const t = TONO[a.tono] || TONO.primary;
                            return (
                                <div key={i} className={`rise d${Math.min(8, i + 3)}`} style={{ padding: 14, borderRadius: 18, background: t.soft, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                                        <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: a.tipo === 'limite' ? t.color : 'var(--text)' }}>
                                            {a.tipo === 'limite' ? a.titulo : a.texto}
                                        </span>
                                        {a.tipo === 'limite' && <span className="num" style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{Math.round(a.pct * 100)}%</span>}
                                    </div>
                                    {a.tipo === 'limite' && (
                                        <>
                                            <div className="bar" style={{ background: 'var(--surface)' }}><i style={{ width: `${Math.min(100, a.pct * 100)}%`, background: t.color }} /></div>
                                            <span className="num" style={{ fontSize: 13, color: 'var(--text-2)', letterSpacing: 0 }}>{fmtCOP(a.gastado)} de {fmtCOP(a.tope)} este mes</span>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {proactivoCargando ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-3)', padding: '4px 2px' }}>
                        <span className="live" /> Analizando tus finanzas…
                    </div>
                ) : proactivoMensaje ? (
                    <div className="rise d6" style={{ padding: 14, borderRadius: 18, background: 'var(--violet-soft)', fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}
                        dangerouslySetInnerHTML={{ __html: mdLite(proactivoMensaje) }} />
                ) : null}

                <div className="hscroll rise d6">
                    {sugerencias.map(q => (
                        <button key={q} type="button" className="chip" onClick={() => preguntarDesdeHoja(q)}>{q}</button>
                    ))}
                </div>

                <form className="rise d7" onSubmit={(e) => { e.preventDefault(); preguntarDesdeHoja(sheetInput); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 16px', borderRadius: 18, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                    <label htmlFor="coach-sheet-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Pregunta al coach</label>
                    <input id="coach-sheet-input" value={sheetInput} onChange={e => setSheetInput(e.target.value)} placeholder="Pregúntale a tu coach…"
                        style={{ flex: 1, minWidth: 0, height: 44, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
                    <button type="submit" className="btn btn-primary" aria-label="Enviar" disabled={!sheetInput.trim()} style={{ width: 44, height: 44, borderRadius: 14, padding: 0 }}>
                        <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                </form>

                <div className="rise d8" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setSheetOpen(false)}>Entendido</button>
                    <button type="button" className="btn btn-primary" onClick={() => { setSheetOpen(false); setIsOpen(true); }}>Abrir chat</button>
                </div>
            </div>
        </BottomSheet>

        {/* === CHAT CON EL COACH (hoja a pantalla casi completa) === */}
        <BottomSheet open={isOpen} onClose={() => setIsOpen(false)} label="Chat con tu coach"
            style={{ height: 'calc(100dvh - var(--sat) - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 0 }}>
            {/* Header */}
            <div style={{ padding: '12px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
                <AvatarCoach size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="display" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Coach IA</h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Conoce tus últimos 12 meses y ejecuta acciones</p>
                </div>
                <button type="button" onClick={() => { setPerfilDraft(perfilNotas); setShowPerfil(v => !v); }} aria-label="Sobre mí (lo que el coach siempre recordará)"
                    className="icon-btn" style={showPerfil ? { background: 'var(--primary-soft)', color: 'var(--primary)' } : undefined}>
                    <UserCog size={18} strokeWidth={1.9} aria-hidden="true" />
                </button>
                <button type="button" onClick={handleNuevaConversacion} aria-label="Nueva conversación (borra el historial)" className="icon-btn">
                    <Trash2 size={18} strokeWidth={1.9} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar chat" className="icon-btn">
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
            </div>

            {/* Panel "Sobre mí" (memoria de largo plazo) */}
            {showPerfil && (
                <div style={{ padding: 16, borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="eyebrow" style={{ color: 'var(--violet)' }}>Sobre mí</span>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>Lo que escribas aquí el coach lo recordará en cada conversación: tu situación, prioridades, compromisos, lo que te cuesta.</p>
                    {perfilIA?.texto && (
                        <details style={{ padding: 12, borderRadius: 14, background: 'var(--violet-soft)' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--violet)' }}>
                                Lo que tu coach ha aprendido de ti{perfilIA.updatedAt ? ` · ${new Date(perfilIA.updatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ''}
                            </summary>
                            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--text)', maxHeight: 220, overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: mdLite(perfilIA.texto) }} />
                        </details>
                    )}
                    <textarea value={perfilDraft} onChange={e => setPerfilDraft(e.target.value)} rows={4}
                        placeholder="Ej: Mi prioridad es comprar casa en 2027. Me cuesta controlar gastos en restaurantes."
                        className="input" style={{ height: 'auto', padding: 12, fontSize: 15, resize: 'none', lineHeight: 1.4 }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPerfil(false)}>Cancelar</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleGuardarPerfil}><Save size={16} aria-hidden="true" /> Guardar</button>
                    </div>
                </div>
            )}

            {/* Mensajes */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg)', overscrollBehavior: 'contain' }}>
                {perfilGuardado && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--income)', fontWeight: 700 }}>Perfil guardado</div>
                )}
                {messages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, padding: 24 }}>
                        <AvatarCoach size={64} />
                        <h4 className="display" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pregúntame o pídeme algo</h4>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>Analizo tus finanzas y también ejecuto acciones: “anota 50 mil de mercado”, “agenda reunión mañana 3pm”, “recuérdame pagar el arriendo el viernes”.</p>
                    </div>
                ) : (
                    messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            {m.origin === 'proactivo' && (
                                <span className="eyebrow" style={{ color: 'var(--violet)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={11} aria-hidden="true" /> Mensaje proactivo</span>
                            )}
                            <div style={{
                                maxWidth: '85%', padding: '10px 14px', fontSize: 15, lineHeight: 1.5, borderRadius: 18,
                                ...(m.role === 'user'
                                    ? { background: 'var(--primary)', color: 'var(--on-primary)', borderTopRightRadius: 6 }
                                    : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', borderTopLeftRadius: 6 })
                            }}>
                                {m.role === 'assistant'
                                    ? <div dangerouslySetInnerHTML={{ __html: mdLite(m.content) }} />
                                    : m.content}
                            </div>
                        </div>
                    ))
                )}
                {isTyping && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '12px 14px', borderRadius: 18, borderTopLeftRadius: 6, background: 'var(--surface)', border: '1px solid var(--line)', alignSelf: 'flex-start' }}>
                        {[0, 150, 300].map(d => <span key={d} className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', animationDelay: `${d}ms` }} />)}
                    </div>
                )}
                {pendingConfirm && (
                    <div className="card" style={{ padding: 14, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pendingConfirm.intro && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{pendingConfirm.intro}</p>}
                        {pendingConfirm.toolUses.map((tu, idx) => {
                            const d = describirAccion(tu);
                            return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, background: 'var(--primary-soft)' }}>
                                    <span style={{ fontSize: 18, lineHeight: 1 }}>{d.icon}</span>
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{d.titulo}</p>
                                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', wordBreak: 'break-word' }}>{d.detalle}</p>
                                    </div>
                                </div>
                            );
                        })}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelarAccion}>Cancelar</button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={confirmarAccion}><CheckCircle2 size={16} aria-hidden="true" /> Confirmar</button>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Entrada */}
            <div style={{ padding: '10px 16px calc(var(--sab) + 12px)', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
                {vozError && <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--expense)' }}>{vozError}</p>}
                {isListening && (
                    <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge-dot" style={{ position: 'static' }} /> Escuchando… habla y luego envía.
                    </p>
                )}
                <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                    {vozDisponible && (
                        <button type="button" onClick={toggleVoz} disabled={isTyping || !!pendingConfirm}
                            aria-label={isListening ? 'Detener dictado' : 'Dictar por voz'}
                            className="icon-btn" style={isListening ? { background: 'var(--expense)', color: '#fff', borderColor: 'transparent' } : { background: 'var(--surface)' }}>
                            <Mic size={18} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                    )}
                    <input value={input} onChange={e => setInput(e.target.value)}
                        placeholder={pendingConfirm ? 'Confirma o cancela la acción…' : (isListening ? 'Habla ahora…' : 'Pide consejo o una acción…')}
                        disabled={isTyping || !!pendingConfirm}
                        style={{ flex: 1, minWidth: 0, height: 44, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
                    <button type="submit" className="btn btn-primary" aria-label="Enviar" disabled={!input.trim() || isTyping || !!pendingConfirm} style={{ width: 44, height: 44, borderRadius: 14, padding: 0 }}>
                        <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                </form>
            </div>
        </BottomSheet>

        {/* Escritorio: acceso rápido al coach (en móvil se abre desde la tarjeta de Inicio) */}
        <button type="button" onClick={() => setIsOpen(true)} aria-label="Abrir coach"
            className="hidden md:grid fixed bottom-6 right-6 z-50 place-items-center"
            style={{ width: 56, height: 56, borderRadius: 20, background: 'var(--violet)', color: '#fff', border: 0, boxShadow: 'var(--shadow-lg)', cursor: 'pointer' }}>
            <Sparkles size={24} aria-hidden="true" />
        </button>
      </>
    );
};
