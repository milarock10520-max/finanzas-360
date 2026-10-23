import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { LayoutDashboard, CreditCard, Target, Loader2, ClipboardList, PieChart, ArrowRightCircle, BarChart3, Lock, ListTodo, Flame, Sun, CalendarClock, FolderKanban, LayoutGrid, Wallet, TrendingUp, CloudOff } from 'lucide-react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { programarAgendaDiaria, programarRecordatoriosRutina, estadoPermisoAvisos, pedirPermisoAvisos, enviarAviso, programarRecordatoriosPagos } from './native/notificaciones';
import { recordatoriosPagos, pagosProximos } from './lib/pagos';
import { actualizarWidget, limpiarWidget } from './native/widget';
import { useTasaUSD, aCOP } from './lib/moneda';
import { patrimonioActual } from './lib/patrimonio';
import { pendientesDeReglas, indiceAporte } from './lib/reglas';
import { iniciarRecordatoriosRutina, recordatoriosActivos, setRecordatoriosActivos } from './native/recordatoriosRutina';
import { collection, updateDoc, deleteDoc, doc, onSnapshot, setDoc, runTransaction, writeBatch, arrayUnion } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { ThemeToggle, ScreenHeader, BottomNav, BottomSheet, fmtCOP } from './ui/f360.jsx';
import { AICoach } from './coach/Coach';
import { useVaultSession } from './lib/boveda';
import { formatCurrency, dateKey, esGastoConsumo } from './lib/finanzas';
import { app, appId, auth, db, sinEsperarServidor } from './lib/firebase';
import { requestGoogleToken } from './lib/google';
import { Flujo } from './screens/Flujo';
import { MiDia } from './screens/Inicio';
import { ModulosView } from './screens/Todo';

// Pantallas secundarias: se descargan solo al abrirlas (paquete inicial más liviano).
// Pantallas que se cargan al abrirlas. Con el service worker activo se descargan en
// segundo plano tras el arranque para que también abran sin conexión.
const PANTALLAS = {
    Agenda: () => import('./screens/Agenda'),
    Analisis: () => import('./screens/Analisis'),
    Boveda: () => import('./screens/Boveda'),
    Deudas: () => import('./screens/Deudas'),
    Habitos: () => import('./screens/Habitos'),
    Inversiones: () => import('./screens/Inversiones'),
    Metas: () => import('./screens/Metas'),
    Presupuesto: () => import('./screens/Presupuesto'),
    Proyectos: () => import('./screens/Proyectos'),
    Resumen: () => import('./screens/Resumen'),
    Patrimonio: () => import('./screens/Patrimonio'),
    Cuentas: () => import('./screens/Cuentas'),
    Rutina: () => import('./screens/Rutina'),
};
const precargarPantallas = () => Object.values(PANTALLAS).forEach(cargar => cargar().catch(() => {}));

const ProductivityHub = lazy(() => PANTALLAS.Agenda().then(mod => ({ default: mod.ProductivityHub })));
const FinancialAnalysis = lazy(() => PANTALLAS.Analisis().then(mod => ({ default: mod.FinancialAnalysis })));
const PasswordVault = lazy(() => PANTALLAS.Boveda().then(mod => ({ default: mod.PasswordVault })));
const DebtManager = lazy(() => PANTALLAS.Deudas().then(mod => ({ default: mod.DebtManager })));
const HabitTracker = lazy(() => PANTALLAS.Habitos().then(mod => ({ default: mod.HabitTracker })));
const InvestmentPortfolio = lazy(() => PANTALLAS.Inversiones().then(mod => ({ default: mod.InvestmentPortfolio })));
const GoalTracker = lazy(() => PANTALLAS.Metas().then(mod => ({ default: mod.GoalTracker })));
const BudgetPlanner = lazy(() => PANTALLAS.Presupuesto().then(mod => ({ default: mod.BudgetPlanner })));
const ProyectosSection = lazy(() => PANTALLAS.Proyectos().then(mod => ({ default: mod.ProyectosSection })));
const DashboardView = lazy(() => PANTALLAS.Resumen().then(mod => ({ default: mod.DashboardView })));
const PatrimonioView = lazy(() => PANTALLAS.Patrimonio().then(mod => ({ default: mod.PatrimonioView })));
const CuentasView = lazy(() => PANTALLAS.Cuentas().then(mod => ({ default: mod.CuentasView })));
const RutinaSemanal = lazy(() => PANTALLAS.Rutina().then(mod => ({ default: mod.RutinaSemanal })));

const CargandoPantalla = () => (
    <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}><Loader2 className="animate-spin" size={28} color="var(--primary)" /></div>
);

export default function App() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('midia');
    const [loading, setLoading] = useState(true);
    const [prefillData, setPrefillData] = useState(null);
    const [pendingBudgetId, setPendingBudgetId] = useState(null);
    // Flujo (ingresos/gastos) y coach (tarjeta de Inicio → hoja / chat).
    const [flujoModo, setFlujoModo] = useState('gasto');
    const [flujoFocus, setFlujoFocus] = useState(0);
    const [coachSheet, setCoachSheet] = useState(false);
    const [coachChat, setCoachChat] = useState(false);

    // Datos
    const [transacciones, setTransacciones] = useState([]);
    const [deudas, setDeudas] = useState([]);
    const [metas, setMetas] = useState([]);
    const [presupuestoItems, setPresupuestoItems] = useState([]);
    const [limites, setLimites] = useState([]);
    const [passwords, setPasswords] = useState([]);
    const [vaultConfig, setVaultConfig] = useState([]);
    
    // Hábitos & Settings
    const [habitos, setHabitos] = useState([]);
    const [diario, setDiario] = useState([]);
    const [rutina, setRutina] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [proyectoItems, setProyectoItems] = useState([]);
    const [proyectoCredenciales, setProyectoCredenciales] = useState([]);
    const [coachMensajes, setCoachMensajes] = useState([]);
    const [coachPerfil, setCoachPerfil] = useState([]);
    const [coachMemoria, setCoachMemoria] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [fotosPatrimonio, setFotosPatrimonio] = useState([]);
    const [reglasAhorro, setReglasAhorro] = useState([]);
    // Conexión: sin red la app sigue con los datos en caché y encola los cambios.
    const [enLinea, setEnLinea] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
    useEffect(() => {
        const on = () => setEnLinea(true);
        const off = () => setEnLinea(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    // Con sesión iniciada y el service worker activo, descargar el resto de pantallas
    // en segundo plano para que queden disponibles sin conexión.
    useEffect(() => {
        if (!user || !('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistration) return;
        let timer;
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) navigator.serviceWorker.ready.then(() => { timer = setTimeout(precargarPantallas, 3000); });
        }).catch(() => {});
        return () => clearTimeout(timer);
    }, [user]);

    // Token de Google Calendar persistido: sobrevive recargas mientras no caduque (~1h).
    const [googleToken, setGoogleToken] = useState(() => {
        try {
            const raw = localStorage.getItem('google_calendar_token');
            if (!raw) return null;
            const { token, expiresAt } = JSON.parse(raw);
            if (token && expiresAt && Date.now() < expiresAt) return token;
            localStorage.removeItem('google_calendar_token');
        } catch (e) { /* ignora json corrupto */ }
        return null;
    });

    // Renovación silenciosa del token de Google.
    // Los tokens del flujo implícito caducan en ~1h y no hay refresh token; al cerrar y
    // reabrir la app el token suele estar vencido. Si el usuario ya conectó alguna vez
    // (marca 'google_connected'), renovamos sin interacción y reprogramamos antes de caducar.
    useEffect(() => {
        if (localStorage.getItem('google_connected') !== '1') return;
        let timer;
        let cancelado = false;

        const asegurarToken = async () => {
            if (cancelado) return;
            let expiresAt = 0;
            try {
                const raw = localStorage.getItem('google_calendar_token');
                if (raw) expiresAt = JSON.parse(raw).expiresAt || 0;
            } catch (e) { /* */ }
            // Renueva si no hay token o si caduca en menos de 5 minutos.
            if (Date.now() > expiresAt - 5 * 60 * 1000) {
                try {
                    const res = await requestGoogleToken(false);
                    if (cancelado) return;
                    setGoogleToken(res.token);
                    expiresAt = res.expiresAt;
                } catch (e) {
                    console.warn('No se pudo renovar el token de Google en silencio:', e);
                    return; // El usuario tendrá que reconectar manualmente.
                }
            }
            // Reprograma la próxima renovación 5 min antes de que caduque.
            const espera = Math.max(60 * 1000, expiresAt - Date.now() - 5 * 60 * 1000);
            timer = setTimeout(asegurarToken, espera);
        };

        // En nativo y en escritorio (Electron) la renovación es contra nuestro
        // servidor: arranca de una.
        if (Capacitor.isNativePlatform() || window.desktop?.isElectron) {
            asegurarToken();
            return () => { cancelado = true; clearTimeout(timer); };
        }

        // En web esperamos a que Google Identity Services cargue antes de renovar.
        let intentos = 0;
        const esperarGis = setInterval(() => {
            intentos++;
            if (window.google?.accounts?.oauth2) {
                clearInterval(esperarGis);
                asegurarToken();
            } else if (intentos > 40) {
                clearInterval(esperarGis);
            }
        }, 250);

        return () => { cancelado = true; clearInterval(esperarGis); clearTimeout(timer); };
    }, []);

    // Notificación diaria de agenda (app nativa): reprograma los próximos días a las 6 AM
    // con las reuniones y tareas reales. Se refresca al iniciar sesión y al conectar Google.
    useEffect(() => {
        if (!user) return;
        programarAgendaDiaria(googleToken)
            .then((n) => { if (n) console.log(`[agenda] ${n} notificaciones programadas`); })
            .catch((e) => console.warn('No se pudieron programar notificaciones de agenda:', e));
    }, [user, googleToken]);

    // Recordatorios de rutina: ajuste por dispositivo, espejado desde localStorage.
    // Se actualiza vía CustomEvent (lo disparan la campana del hero y el tray).
    const [recordatoriosOn, setRecordatoriosOn] = useState(recordatoriosActivos());

    useEffect(() => {
        const onChange = (e) => setRecordatoriosOn(e.detail);
        window.addEventListener('recordatorios:changed', onChange);
        // Handshake de arranque con Electron: informa a main el estado persistido
        // (para el checkbox del tray) y escucha los toggles hechos desde el tray.
        window.desktop?.setRecordatorios?.(recordatoriosActivos());
        const off = window.desktop?.onRecordatoriosChanged?.((v) => setRecordatoriosActivos(v));
        return () => { window.removeEventListener('recordatorios:changed', onChange); off?.(); };
    }, []);

    // Escritorio (Electron): cadena de setTimeout en el renderer que dispara
    // toasts nativos de Windows al inicio de cada bloque de rutina.
    useEffect(() => {
        if (!recordatoriosOn) return;
        return iniciarRecordatoriosRutina(rutina);
    }, [rutina, recordatoriosOn]);

    // iOS: notificaciones locales semanales repetitivas por bloque de rutina.
    useEffect(() => {
        if (!user) return;
        programarRecordatoriosRutina(rutina, recordatoriosOn)
            .then((n) => { if (n) console.log(`[rutina] ${n} recordatorios programados`); })
            .catch((e) => console.warn('No se pudieron programar recordatorios de rutina:', e));
    }, [user, rutina, recordatoriosOn]);

    // Toast de mensajes proactivos del coach (escritorio): cuando el agente
    // programado de Claude escribe en coach_mensajes, la app en la bandeja avisa.
    // Solo mensajes creados DESPUÉS de abrir la app (evita re-avisar el historial)
    // y solo una vez por mensaje en esta sesión.
    const proactivosNotificados = useRef(new Set());
    const inicioSesionApp = useRef(new Date().toISOString());
    useEffect(() => {
        if (!window.desktop?.isElectron) return;
        coachMensajes
            .filter(m => m.origin === 'proactivo' && m.read === false
                && (m.createdAt || '') > inicioSesionApp.current
                && !proactivosNotificados.current.has(m.id))
            .forEach(m => {
                proactivosNotificados.current.add(m.id);
                const textoPlano = String(m.content || '').replace(/\*\*/g, '').replace(/\n+/g, ' ').slice(0, 120);
                const n = new Notification('🧠 Tu coach — Finanzas 360', { body: textoPlano });
                n.onclick = () => { window.focus(); window.desktop?.showWindow?.(); };
            });
    }, [coachMensajes]);

    // iOS: recordatorios de pago de tarjetas (corte y fecha límite) y cuotas de deudas.
    useEffect(() => {
        if (!user) return;
        const t = setTimeout(() => {
            programarRecordatoriosPagos(recordatoriosPagos({ deudas, cuentas, transacciones }))
                .then((n) => { if (n) console.log(`[pagos] ${n} recordatorios programados`); })
                .catch((e) => console.warn('No se pudieron programar recordatorios de pagos:', e));
        }, 1500); // espera a que lleguen todas las colecciones
        return () => clearTimeout(t);
    }, [user, deudas, cuentas, transacciones]);

    // Notificaciones (avisos de topes de gasto). En iOS usan notificaciones locales.
    const [notifPermiso, setNotifPermiso] = useState('default');
    useEffect(() => { estadoPermisoAvisos().then(setNotifPermiso); }, []);

    const activarNotificaciones = async () => {
        try {
            const permiso = await pedirPermisoAvisos();
            setNotifPermiso(permiso);
            if (permiso === 'granted') {
                await enviarAviso({ title: 'Avisos activados', body: 'Te avisaré al llegar al 80 % de un tope y cuando lo superes.', tag: 'avisos-activados' });
            } else {
                alert(Capacitor.isNativePlatform()
                    ? 'Las notificaciones están desactivadas. Actívalas en Ajustes → Finanzas 360 → Notificaciones.'
                    : 'Bloqueaste las notificaciones. Actívalas desde los ajustes del navegador para recibir avisos.');
            }
        } catch (e) {
            console.error('Error pidiendo permiso de notificaciones:', e);
        }
    };

    // Aviso al 80 % del tope y al superarlo: una sola vez por categoría y nivel cada mes.
    useEffect(() => {
        if (notifPermiso !== 'granted' || !limites.length) return;
        const mesKey = dateKey().slice(0, 7); // comparación por texto: evita el desfase UTC de new Date('YYYY-MM-DD')

        const gastosPorCat = transacciones
            .filter(t => esGastoConsumo(t) && typeof t.fecha === 'string' && t.fecha.startsWith(mesKey))
            .reduce((acc, t) => {
                acc[t.categoria] = (acc[t.categoria] || 0) + (Number(t.monto) || 0);
                return acc;
            }, {});

        let notificados;
        try { notificados = JSON.parse(localStorage.getItem('limites_notificados') || '{}'); } catch (e) { notificados = {}; }
        if (notificados.mes !== mesKey) notificados = { mes: mesKey, cats: [] };

        const avisos = [];
        limites.forEach(l => {
            const gastado = gastosPorCat[l.categoria] || 0;
            const tope = Number(l.limite) || 0;
            if (tope <= 0) return;
            if (gastado > tope && !notificados.cats.includes(l.categoria)) {
                avisos.push({ title: `Superaste tu tope de ${l.categoria}`, body: `Llevas ${formatCurrency(gastado)} de ${formatCurrency(tope)} este mes (${formatCurrency(gastado - tope)} de más).`, tag: `limite-${l.categoria}` });
                notificados.cats.push(l.categoria, `${l.categoria}@80`);
            } else if (gastado >= tope * 0.8 && gastado <= tope && !notificados.cats.includes(`${l.categoria}@80`)) {
                avisos.push({ title: `Vas en el ${Math.round((gastado / tope) * 100)} % de ${l.categoria}`, body: `Llevas ${formatCurrency(gastado)} de ${formatCurrency(tope)}. Te quedan ${formatCurrency(tope - gastado)} este mes.`, tag: `limite80-${l.categoria}` });
                notificados.cats.push(`${l.categoria}@80`);
            }
        });
        if (!avisos.length) return;
        localStorage.setItem('limites_notificados', JSON.stringify(notificados));
        avisos.forEach(a => enviarAviso(a).catch(e => console.error('No se pudo enviar el aviso:', e)));
    }, [transacciones, limites, notifPermiso]);

    // 1. AUTENTICACIÓN (Google Sign-In)
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleGoogleLogin = async () => {
        setAuthError('');
        try {
            if (Capacitor.isNativePlatform()) {
                // App nativa: Google Sign-In nativo (el popup web no funciona en WKWebView).
                const result = await FirebaseAuthentication.signInWithGoogle();
                const idToken = result.credential?.idToken;
                const accessToken = result.credential?.accessToken;
                const credential = GoogleAuthProvider.credential(idToken, accessToken);
                await signInWithCredential(auth, credential);
            } else if (window.desktop?.isElectron) {
                // Escritorio (Electron): el popup web tampoco funciona (Google bloquea
                // OAuth embebido), así que el login se hace en el navegador del sistema.
                const { idToken, accessToken } = await window.desktop.signInWithGoogle();
                const credential = GoogleAuthProvider.credential(idToken, accessToken);
                await signInWithCredential(auth, credential);
            } else {
                // Web: flujo de popup de siempre.
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            }
        } catch (error) {
            console.error("Error de autenticación:", error);
            setAuthError('No se pudo iniciar sesión. Intenta de nuevo.');
        }
    };

    const handleLogout = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await FirebaseAuthentication.signOut();
            }
            await signOut(auth);
            limpiarWidget();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    };

    // 2. SINCRONIZACIÓN DE DATOS
    useEffect(() => {
        if (!user) return;
        const basePath = `artifacts/${appId}/users/${user.uid}`;

        const unsubTrans = onSnapshot(collection(db, `${basePath}/transacciones`), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTransacciones(data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        });

        const unsubDeudas = onSnapshot(collection(db, `${basePath}/deudas`), (snap) =>
            setDeudas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubMetas = onSnapshot(collection(db, `${basePath}/metas`), (snap) =>
            setMetas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubPresupuesto = onSnapshot(collection(db, `${basePath}/presupuesto`), (snap) =>
            setPresupuestoItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubLimites = onSnapshot(collection(db, `${basePath}/limites`), (snap) =>
            setLimites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubPasswords = onSnapshot(collection(db, `${basePath}/passwords`), (snap) =>
            setPasswords(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubVaultConfig = onSnapshot(collection(db, `${basePath}/vault_config`), (snap) =>
            setVaultConfig(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubHabitos = onSnapshot(collection(db, `${basePath}/habitos`), (snap) =>
            setHabitos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubDiario = onSnapshot(collection(db, `${basePath}/diario`), (snap) =>
            setDiario(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubRutina = onSnapshot(collection(db, `${basePath}/rutina`), (snap) =>
            setRutina(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubProyectos = onSnapshot(collection(db, `${basePath}/proyectos`), (snap) =>
            setProyectos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubProyectoItems = onSnapshot(collection(db, `${basePath}/proyecto_items`), (snap) =>
            setProyectoItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        // Credenciales de proyecto: lo que llega aquí ya viene cifrado; solo se
        // descifra en memoria al desbloquear la bóveda.
        const unsubProyectoCredenciales = onSnapshot(collection(db, `${basePath}/proyecto_credenciales`), (snap) =>
            setProyectoCredenciales(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubCoach = onSnapshot(collection(db, `${basePath}/coach_mensajes`), (snap) =>
            setCoachMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubCoachPerfil = onSnapshot(collection(db, `${basePath}/coach_perfil`), (snap) =>
            setCoachPerfil(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubReglas = onSnapshot(collection(db, `${basePath}/reglas_ahorro`), (snap) =>
            setReglasAhorro(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubPatrimonio = onSnapshot(collection(db, `${basePath}/patrimonio`), (snap) =>
            setFotosPatrimonio(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubCuentas = onSnapshot(collection(db, `${basePath}/cuentas`), (snap) =>
            setCuentas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))));

        const unsubCoachMemoria = onSnapshot(collection(db, `${basePath}/coach_memoria`), (snap) =>
            setCoachMemoria(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubTrans(); unsubDeudas(); unsubMetas(); unsubPresupuesto(); unsubLimites(); unsubPasswords(); unsubVaultConfig(); unsubHabitos(); unsubDiario(); unsubRutina(); unsubProyectos(); unsubProyectoItems(); unsubProyectoCredenciales(); unsubCoach(); unsubCoachPerfil(); unsubCoachMemoria(); unsubCuentas(); unsubPatrimonio(); unsubReglas(); };
    }, [user]);

    // --- ACTIONS FIREBASE ---
    const genericAdd = async (coll, data) => {
        if (!user) {
            console.error('genericAdd: No hay usuario autenticado');
            return null;
        }
        // El id se genera en el dispositivo para devolver la referencia aunque no haya red.
        const ref = doc(collection(db, `artifacts/${appId}/users/${user.uid}/${coll}`));
        await sinEsperarServidor(setDoc(ref, data));
        return ref;
    };

    const genericUpdate = async (coll, id, data) => {
        console.log('genericUpdate llamado:', { coll, id, data });
        if (!user) {
            console.error('genericUpdate: No hay usuario autenticado');
            return null;
        }
        if (!id) {
            console.error('genericUpdate: ID no válido:', id);
            return null;
        }
        try {
            const docRef = doc(db, `artifacts/${appId}/users/${user.uid}/${coll}`, id);
            console.log('Actualizando documento:', docRef.path);
            await sinEsperarServidor(updateDoc(docRef, data));
            console.log('Documento actualizado exitosamente');
            return true;
        } catch (error) {
            console.error('Error en genericUpdate:', error);
            throw error;
        }
    };

    const genericDelete = async (coll, id) => {
        if (!user) return null;
        if (coll === 'transacciones') return borrarMovimiento(id);
        return sinEsperarServidor(deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/${coll}`, id)));
    };

    // Borrar un movimiento deshace lo que arrastra: un aporte de ahorro devuelve su monto a
    // la meta, y un ingreso se lleva los aportes que le apartaron sus reglas de ahorro.
    const borrarMovimiento = async (id) => {
        const base = `artifacts/${appId}/users/${user.uid}`;
        const mov = transacciones.find(t => t.id === id);
        const aportes = mov?.tipo === 'ingreso' ? transacciones.filter(t => t.esAhorro && t.origenIngreso === id) : mov?.esAhorro ? [mov] : [];
        const lote = writeBatch(db);
        const metasCambiadas = new Map();
        aportes.forEach(a => {
            const meta = metasCambiadas.get(a.metaId) || metas.find(m => m.id === a.metaId)
                || metas.find(m => a.concepto === `Ahorro → ${m.nombre}`);
            if (!meta) return;
            const lista = [...(meta.aportes || [])];
            const i = indiceAporte({ aportes: lista }, a);
            if (i >= 0) lista.splice(i, 1);
            const ahorroActual = Math.max((Number(meta.ahorroActual) || 0) - (Number(a.monto) || 0), 0);
            const objetivo = Number(meta.montoObjetivo) || 0;
            metasCambiadas.set(meta.id, { ...meta, aportes: lista, ahorroActual, ...(meta.completada && objetivo > 0 && ahorroActual < objetivo ? { completada: false } : {}) });
        });
        metasCambiadas.forEach(m => lote.update(doc(db, `${base}/metas`, m.id), { aportes: m.aportes, ahorroActual: m.ahorroActual, ...(m.completada === false ? { completada: false } : {}) }));
        aportes.filter(a => a.id !== id).forEach(a => lote.delete(doc(db, `${base}/transacciones`, a.id)));
        lote.delete(doc(db, `${base}/transacciones`, id));
        return sinEsperarServidor(lote.commit());
    };

    // Sesión de bóveda compartida entre Contraseñas y las credenciales de
    // Proyectos (la clave maestra solo vive aquí, en memoria).
    const vault = useVaultSession(vaultConfig, activeTab, genericAdd, genericUpdate);

    // --- HANDLER PARA PRESUPUESTO ---
    const handleEjecutarPago = (item) => {
        setPrefillData({
            concepto: item.concepto,
            monto: item.monto,
            categoria: item.categoria,
        });
        setPendingBudgetId(item.id);
        if (item.categoria === 'Aporte Inversión') setActiveTab('inversiones');
        else { setFlujoModo('gasto'); setActiveTab('flujo'); }
    };

    // Navegación: cada cambio de pantalla vuelve arriba y queda en la pila para "Volver".
    const pilaRef = useRef([]);
    useEffect(() => {
        window.scrollTo(0, 0);
        const pila = pilaRef.current;
        if (pila[pila.length - 1] !== activeTab) pila.push(activeTab);
        if (pila.length > 30) pila.shift();
    }, [activeTab]);
    const volver = () => {
        const pila = pilaRef.current;
        pila.pop();
        setActiveTab(pila.pop() || 'midia');
    };

    const abrirFlujo = (modo = 'gasto', enfocar = false) => {
        setFlujoModo(modo);
        setActiveTab('flujo');
        if (enfocar) setFlujoFocus(n => n + 1);
    };

    // --- DISEÑO: COMPONENTES DE NAVEGACIÓN ---

    const NavItem = ({ id, icon: Icon, label }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm"
                style={isActive
                    ? { background: 'var(--primary)', color: 'var(--on-primary)', boxShadow: '0 12px 28px -12px var(--glow)' }
                    : { color: 'var(--text-2)' }}
            >
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                <span>{label}</span>
            </button>
        );
    }

    // --- CÁLCULOS GLOBALES ---
    const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const totalGastos = transacciones.filter(t => t.tipo === 'gasto').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    // Inversiones con tipo 'inversion_patrimonio' NO se descuentan del saldo
    const saldoActual = totalIngresos - totalGastos;
    const totalDeudaPendiente = deudas.reduce((acc, curr) => acc + (Number(curr.montoTotal || 0) - Number(curr.montoPagado || 0)), 0);
    const tasaUSD = useTasaUSD();
    const totalInvertido = transacciones
        .filter(t => t.categoria === 'Aporte Inversión' || t.esInversion === true)
        .reduce((a, c) => a + (aCOP(Number(c.monto) || 0, c.moneda, tasaUSD?.tasa) ?? 0), 0);

    // Patrimonio neto: foto del mes en curso (colección patrimonio/YYYY-MM), para la historia exacta.
    const patrimonioHoy = useMemo(() => patrimonioActual({ transacciones, deudas, tasaUSD: tasaUSD?.tasa || null }), [transacciones, deudas, tasaUSD]);
    const ultimaFotoRef = useRef('');
    useEffect(() => {
        if (!user || !transacciones.length) return;
        const t = setTimeout(() => {
            const mes = dateKey().slice(0, 7);
            const firma = `${mes}:${Math.round(patrimonioHoy.neto)}`;
            if (ultimaFotoRef.current === firma) return;
            ultimaFotoRef.current = firma;
            setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/patrimonio`, mes), { ...patrimonioHoy, actualizado: new Date().toISOString() }, { merge: true })
                .catch(e => console.warn('No se pudo guardar la foto del patrimonio:', e));
        }, 4000);
        return () => clearTimeout(t);
    }, [user, patrimonioHoy, transacciones.length]);

    // Widget de iOS: saldo, gasto de hoy y del mes, y el próximo pago.
    useEffect(() => {
        if (!user || !transacciones.length) return;
        const t = setTimeout(() => {
            const hoy = dateKey();
            const mes = hoy.slice(0, 7);
            const consumo = transacciones.filter(esGastoConsumo);
            const suma = (lista) => lista.reduce((a, c) => a + (Number(c.monto) || 0), 0);
            const prox = pagosProximos({ presupuestoItems, deudas, cuentas, transacciones })[0];
            const fechaCorta = (f) => (f instanceof Date ? f : new Date(`${f}T12:00:00`)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
            actualizarWidget({
                saldo: saldoActual,
                gastoHoy: suma(consumo.filter(x => x.fecha === hoy)),
                gastoMes: suma(consumo.filter(x => (x.fecha || '').startsWith(mes))),
                proximoPago: prox ? `${prox.concepto} · ${prox.vencido ? 'vencido' : fechaCorta(prox.fecha)}` : '',
            });
        }, 1500);
        return () => clearTimeout(t);
    }, [user, transacciones, presupuestoItems, deudas, cuentas, saldoActual]);

    // Enlaces del widget: finanzas360://gasto abre el registro de gasto; finanzas360://inicio, Inicio.
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let quitar = null;
        let vivo = true;
        import('@capacitor/app').then(({ App: CapApp }) => CapApp.addListener('appUrlOpen', ({ url }) => {
            const destino = (url || '').replace(/^finanzas360:\/\//, '').split(/[/?#]/)[0];
            if (destino === 'gasto') abrirFlujo('gasto', true);
            else if (destino === 'inicio') setActiveTab('midia');
        })).then(h => { if (vivo) quitar = h; else h?.remove(); }).catch(() => {});
        return () => { vivo = false; quitar?.remove(); };
    }, []);

    // Reglas automáticas de ahorro: al entrar un ingreso que cumple una regla, se aparta
    // el aporte a la meta (automático o con confirmación). Cada regla se procesa una sola vez por ingreso.
    const pendientesAhorro = useMemo(() => pendientesDeReglas(reglasAhorro, transacciones, metas), [reglasAhorro, transacciones, metas]);
    const reglasEnCurso = useRef(new Set());
    const [avisoAhorro, setAvisoAhorro] = useState('');
    useEffect(() => {
        if (!avisoAhorro) return;
        const t = setTimeout(() => setAvisoAhorro(''), 5000);
        return () => clearTimeout(t);
    }, [avisoAhorro]);
    // Transacción: lee el ingreso y la meta en el servidor y solo aplica si la regla no se
    // procesó ya (desde este u otro dispositivo). Sin conexión falla y se reintenta luego.
    const aplicarRegla = async (p, aceptar, intento = 0) => {
        const clave = `${p.regla.id}:${p.ingreso.id}`;
        if (reglasEnCurso.current.has(clave)) return;
        reglasEnCurso.current.add(clave);
        const base = `artifacts/${appId}/users/${user.uid}`;
        const ingresoRef = doc(db, `${base}/transacciones`, p.ingreso.id);
        const metaRef = doc(db, `${base}/metas`, p.meta.id);
        const aporteRef = doc(collection(db, `${base}/transacciones`));
        try {
            const aplicado = await runTransaction(db, async (tx) => {
                const ingreso = await tx.get(ingresoRef);
                const meta = await tx.get(metaRef);
                // Recién creado puede no haber llegado aún al servidor: se reintenta en unos segundos.
                if (!ingreso.exists()) throw new Error('ingreso-pendiente');
                if ((ingreso.data().reglasProcesadas || []).includes(p.regla.id)) return false;
                tx.update(ingresoRef, { reglasProcesadas: arrayUnion(p.regla.id) });
                if (!aceptar || !meta.exists()) return false;
                const m = meta.data();
                const nuevo = (Number(m.ahorroActual) || 0) + p.monto;
                const objetivo = Number(m.montoObjetivo) || 0;
                tx.update(metaRef, {
                    ahorroActual: nuevo,
                    aportes: [...(m.aportes || []), { monto: p.monto, fecha: dateKey(), regla: p.regla.id, tx: aporteRef.id }],
                    ...(objetivo > 0 && nuevo >= objetivo ? { completada: true } : {}),
                });
                tx.set(aporteRef, {
                    tipo: 'gasto', monto: p.monto, concepto: `Ahorro → ${p.meta.nombre}`, categoria: 'Ahorro Metas', fecha: dateKey(),
                    esAhorro: true, metaId: p.meta.id, origenIngreso: p.ingreso.id, reglaId: p.regla.id, createdAt: new Date().toISOString(),
                });
                return true;
            });
            if (aplicado) setAvisoAhorro(`Apartamos ${formatCurrency(p.monto)} de "${p.ingreso.concepto || 'tu ingreso'}" para ${(p.meta.nombre || "").trim()}`);
        } catch (e) {
            console.warn('No se pudo aplicar la regla de ahorro (se reintentará):', e);
            reglasEnCurso.current.delete(clave);
            if (intento < 5) setTimeout(() => aplicarRegla(p, aceptar, intento + 1), 3000 * (intento + 1));
        }
    };
    useEffect(() => {
        pendientesAhorro.filter(p => p.regla.auto).forEach(p => aplicarRegla(p, true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendientesAhorro]);
    const reglaPorConfirmar = pendientesAhorro.find(p => !p.regla.auto && !reglasEnCurso.current.has(`${p.regla.id}:${p.ingreso.id}`));

    const runMigration = async () => {
        const oldUid = prompt("Escribe tu ID VIEJO (El que tiene datos):");
        if (!oldUid) return;
        
        // El ID nuevo es el actual autenticado
        const newUid = user.uid;
        
        if (oldUid === newUid) {
            alert("El ID viejo no puede ser igual al nuevo.");
            return;
        }

        const confirm = window.confirm(`¿Seguro que quieres importar todos los datos del usuario ${oldUid} a este dispositivo?`);
        if (!confirm) return;

        try {
            setLoading(true);
            const collections = ['transacciones', 'deudas', 'metas', 'presupuesto', 'limites', 'passwords', 'vault_config', 'habitos', 'diario', 'rutina', 'proyectos', 'proyecto_items', 'proyecto_credenciales', 'coach_mensajes', 'coach_perfil', 'coach_memoria', 'cuentas', 'patrimonio', 'reglas_ahorro'];
            const { getDocs, setDoc, doc } = await import('firebase/firestore');

            let totalMigrated = 0;
            for (const coll of collections) {
                const oldRef = collection(db, `artifacts/${appId}/users/${oldUid}/${coll}`);
                const snapshot = await getDocs(oldRef);
                
                for (const document of snapshot.docs) {
                    const newRef = doc(db, `artifacts/${appId}/users/${newUid}/${coll}`, document.id);
                    await setDoc(newRef, document.data());
                    totalMigrated++;
                }
            }
            alert(`¡Éxito total! 🎉 Se restauraron ${totalMigrated} registros a tu nueva cuenta. Refrescando página...`);
            window.location.reload();
        } catch (error) {
            console.error('Migration error:', error);
            alert('Hubo un error en la migración. Mira la consola para más detalles.');
            setLoading(false);
        }
    };

    if (loading) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>;

    if (!user) return (
        <div style={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden', isolation: 'isolate', background: 'var(--bg)', color: 'var(--text)' }}>
            <div className="orb" style={{ width: 320, height: 320, left: -120, top: -80, background: 'var(--primary)', opacity: .22 }} />
            <div className="orb" style={{ width: 260, height: 260, right: -110, top: 300, background: 'var(--cyan-bright)', opacity: .18, animationDuration: '18s' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: .55, WebkitMaskImage: 'radial-gradient(70% 50% at 50% 38%, #000, transparent 75%)', maskImage: 'radial-gradient(70% 50% at 50% 38%, #000, transparent 75%)' }} />

            <div style={{ position: 'absolute', top: 'calc(var(--sat) + 16px)', right: 20 }}><ThemeToggle /></div>

            <div style={{ minHeight: '100dvh', maxWidth: 440, margin: '0 auto', padding: 'calc(var(--sat) + 72px) 28px calc(var(--sab) + 40px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 28 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
                    <div className="rise d1" style={{ position: 'relative', width: 132, height: 132, display: 'grid', placeItems: 'center' }}>
                        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" style={{ position: 'absolute', inset: 0, animation: 'spin 14s linear infinite' }}>
                            <circle cx="66" cy="66" r="62" fill="none" stroke="var(--primary)" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
                            <circle cx="66" cy="4" r="4" fill="var(--cyan-bright)" />
                        </svg>
                        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" style={{ position: 'absolute', inset: 0, animation: 'spin 9s linear infinite reverse' }}>
                            <circle cx="66" cy="66" r="50" fill="none" stroke="var(--line)" strokeWidth="1" />
                            <circle cx="116" cy="66" r="3" fill="var(--primary)" />
                        </svg>
                        <div className="display" style={{ width: 76, height: 76, borderRadius: 24, display: 'grid', placeItems: 'center', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700, fontSize: 34, boxShadow: '0 18px 40px -12px var(--glow)', animation: 'floaty 5s ease-in-out infinite' }}>F</div>
                    </div>
                    <div className="rise d2" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <h1 className="display" style={{ margin: 0, fontSize: 34, fontWeight: 700 }}>Finanzas 360</h1>
                        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--text-2)' }}>Tu dinero, tus metas y tus hábitos.<br />Todo sincronizado en un solo lugar.</p>
                    </div>
                    <div className="rise d3" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span className="chip" style={{ cursor: 'default' }}><span className="live" />Sincronización en la nube</span>
                        <span className="chip" style={{ cursor: 'default' }}>Coach con IA</span>
                    </div>
                </div>

                <div className="rise d4" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Botón de Google con su logo oficial (guías de marca de Google Sign-In) */}
                    <button type="button" onClick={handleGoogleLogin} className="btn btn-outline" style={{ width: '100%', gap: 12 }}>
                        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                        </svg>
                        Continuar con Google
                    </button>
                    {authError && <p style={{ margin: 0, textAlign: 'center', color: 'var(--expense)', fontSize: 14, fontWeight: 700 }}>{authError}</p>}
                    <p style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'var(--text-3)' }}>
                        <Lock size={14} strokeWidth={2} aria-hidden="true" /> Tus datos se guardan de forma segura y privada
                    </p>
                </div>
            </div>
        </div>
    );

    // Módulos secundarios: se abren desde "Todo" y vuelven ahí.
    const TITULOS_MODULO = {
        habitos: 'Hábitos', rutina: 'Rutina semanal', proyectos: 'Proyectos', dashboard: 'Resumen',
        presupuesto: 'Presupuesto', inversiones: 'Inversiones', deudas: 'Deudas', passwords: 'Bóveda', agenda: 'Agenda',
        cuentas: 'Cuentas', patrimonio: 'Patrimonio',
    };
    // Pantallas rediseñadas que dibujan su propio encabezado (con acciones propias).
    const HEADER_PROPIO = new Set(['deudas', 'habitos', 'inversiones', 'presupuesto', 'rutina', 'proyectos', 'passwords', 'agenda', 'cuentas', 'patrimonio']);
    const volverTodo = volver;
    const navActivo = ['midia', 'flujo', 'analisis', 'metas'].includes(activeTab) ? activeTab : null;
    const flujoProps = { transacciones, cuentas, reglasAhorro, metas, genericAdd, genericUpdate, genericDelete, prefillData, setPrefillData, pendingBudgetId, setPendingBudgetId, setActiveTab };

    return (
        <div style={{ minHeight: '100dvh' }}>
            <div className="status-scrim" aria-hidden="true" />

            {/* SIDEBAR DESKTOP */}
            <aside className="hidden md:flex flex-col w-72 h-full p-6 fixed top-0 left-0 z-10" style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}>
                <div className="flex items-center gap-3 px-2 mb-10 pt-2 cursor-pointer" onClick={runMigration} title="Click para Migrar Datos">
                    <div className="tile display" style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700, fontSize: 18 }}>F</div>
                    <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>Finanzas 360</span>
                </div>
                <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                    <div className="eyebrow px-4 mb-2 mt-2">Mi Vida</div>
                    <NavItem id="midia" icon={Sun} label="Inicio" />
                    <NavItem id="habitos" icon={Flame} label="Hábitos" />
                    <NavItem id="rutina" icon={CalendarClock} label="Rutina" />

                    <div className="eyebrow px-4 mb-2 mt-8">Principal</div>
                    <NavItem id="flujo" icon={ArrowRightCircle} label="Flujo" />
                    <NavItem id="analisis" icon={BarChart3} label="Análisis Mensual" />
                    <NavItem id="presupuesto" icon={ClipboardList} label="Presupuesto" />
                    <NavItem id="dashboard" icon={LayoutDashboard} label="Resumen" />

                    <div className="eyebrow px-4 mb-2 mt-8">Gestión</div>
                    <NavItem id="cuentas" icon={Wallet} label="Cuentas" />
                    <NavItem id="patrimonio" icon={TrendingUp} label="Patrimonio" />
                    <NavItem id="inversiones" icon={PieChart} label="Inversiones" />
                    <NavItem id="deudas" icon={CreditCard} label="Deudas" />
                    <NavItem id="metas" icon={Target} label="Metas" />

                    <div className="eyebrow px-4 mb-2 mt-8">Herramientas</div>
                    <NavItem id="agenda" icon={ListTodo} label="Agenda & Tareas" />
                    <NavItem id="proyectos" icon={FolderKanban} label="Proyectos" />
                    <NavItem id="passwords" icon={Lock} label="Contraseñas" />
                    <NavItem id="todo" icon={LayoutGrid} label="Todo" />
                </nav>
                <div className="pt-4 mt-4" style={{ borderTop: '1px solid var(--line)' }}>
                    <div className="flex items-center gap-3 px-2">
                        {user.photoURL
                            ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
                            : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{ background: 'var(--surface-2)' }}>{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</div>}
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{user.displayName || 'Mi cuenta'}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{user.email}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {avisoAhorro && (
                <div role="status" className="sin-conexion aviso-ahorro">
                    {avisoAhorro}
                </div>
            )}

            {!enLinea && (
                <div role="status" className="sin-conexion">
                    <CloudOff size={14} strokeWidth={2.2} aria-hidden="true" />
                    Sin conexión · tus cambios se guardan y se sincronizan al volver
                </div>
            )}

            <main className="md:ml-72 screen-pad">
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                  <Suspense fallback={<CargandoPantalla />}>
                    {activeTab === 'midia' && (
                        <MiDia user={user} habitos={habitos} diario={diario} transacciones={transacciones} presupuestoItems={presupuestoItems} limites={limites} cuentas={cuentas} deudas={deudas}
                            saldoActual={saldoActual} googleToken={googleToken} genericAdd={genericAdd} genericUpdate={genericUpdate} setActiveTab={setActiveTab}
                            onOpenCoach={() => setCoachSheet(true)} onNuevoMovimiento={(modo) => abrirFlujo(modo, true)} />
                    )}
                    {activeTab === 'flujo' && <Flujo modo={flujoModo} setModo={setFlujoModo} focusToken={flujoFocus} {...flujoProps} />}
                    {activeTab === 'todo' && (
                        <ModulosView onOpen={setActiveTab} onBack={volver} onLogout={handleLogout} user={user}
                            totalInvertido={totalInvertido} totalDeudaPendiente={totalDeudaPendiente} googleToken={googleToken}
                            rutina={rutina} proyectos={proyectos} habitos={habitos} vault={vault} cuentas={cuentas} transacciones={transacciones} patrimonioNeto={patrimonioHoy.neto} />
                    )}
                    {activeTab === 'analisis' && (
                        <FinancialAnalysis transacciones={transacciones} limites={limites} onAjustarTopes={() => setActiveTab('presupuesto')} />
                    )}
                    {activeTab === 'metas' && (
                        <GoalTracker metas={metas} transacciones={transacciones} habitos={habitos} reglas={reglasAhorro} setActiveTab={setActiveTab} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />
                    )}
                    {TITULOS_MODULO[activeTab] && (
                        <>
                            {!HEADER_PROPIO.has(activeTab) && <ScreenHeader title={TITULOS_MODULO[activeTab]} onBack={volverTodo} />}
                            <div className={HEADER_PROPIO.has(activeTab) ? '' : 'mt-5 space-y-8'}>
                                {activeTab === 'habitos' && <HabitTracker habitos={habitos} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onBack={volverTodo} />}
                                {activeTab === 'rutina' && <RutinaSemanal rutina={rutina} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} googleToken={googleToken} onBack={volverTodo} />}
                                {activeTab === 'proyectos' && <ProyectosSection proyectos={proyectos} proyectoItems={proyectoItems} proyectoCredenciales={proyectoCredenciales} vault={vault} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onBack={volverTodo} />}
                                {activeTab === 'dashboard' && <DashboardView saldoActual={saldoActual} totalIngresos={totalIngresos} totalGastos={totalGastos} totalDeudaPendiente={totalDeudaPendiente} transacciones={transacciones} />}
                                {activeTab === 'presupuesto' && <BudgetPlanner presupuestoItems={presupuestoItems} limites={limites} transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onEjecutarPago={handleEjecutarPago} notifPermiso={notifPermiso} onActivarNotif={activarNotificaciones} onBack={volverTodo} />}
                                {activeTab === 'inversiones' && <InvestmentPortfolio transacciones={transacciones} totalInvertido={totalInvertido} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} onBack={volverTodo} />}
                                {activeTab === 'patrimonio' && <PatrimonioView transacciones={transacciones} deudas={deudas} fotos={fotosPatrimonio} onBack={volverTodo} />}
                                {activeTab === 'cuentas' && <CuentasView cuentas={cuentas} transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onBack={volverTodo} />}
                                {activeTab === 'deudas' && <DebtManager deudas={deudas} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onBack={volverTodo} />}
                                {activeTab === 'passwords' && <PasswordVault passwords={passwords} vault={vault} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} user={user} db={db} onBack={volverTodo} />}
                                {activeTab === 'agenda' && <ProductivityHub genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} googleToken={googleToken} setGoogleToken={setGoogleToken} onBack={volverTodo} />}
                            </div>
                        </>
                    )}
                  </Suspense>
                </div>
            </main>

            {reglaPorConfirmar && !coachSheet && !coachChat && (
                <BottomSheet open onClose={() => aplicarRegla(reglaPorConfirmar, false)} label="Regla de ahorro">
                    <div style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span className="eyebrow" style={{ color: 'var(--income)' }}>Regla de ahorro</span>
                        <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>
                            Entró {fmtCOP(reglaPorConfirmar.ingreso.monto)} de {reglaPorConfirmar.ingreso.categoria || 'ingreso'}
                        </h2>
                        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-2)', lineHeight: 1.5 }}>
                            Según tu regla, aparta <b className="num" style={{ color: 'var(--text)' }}>{fmtCOP(reglaPorConfirmar.monto)}</b> para <b style={{ color: 'var(--text)' }}>{reglaPorConfirmar.meta.nombre}</b>. Se descuenta de tu saldo y suma a la meta.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button type="button" className="btn btn-ghost" onClick={() => aplicarRegla(reglaPorConfirmar, false)}>Esta vez no</button>
                            <button type="button" className="btn btn-primary" onClick={() => aplicarRegla(reglaPorConfirmar, true)}>Apartar</button>
                        </div>
                    </div>
                </BottomSheet>
            )}

            <BottomNav active={navActivo} onNavigate={setActiveTab} onAdd={() => abrirFlujo('gasto', true)} />

            <AICoach transacciones={transacciones} deudas={deudas} metas={metas} presupuestoItems={presupuestoItems} limites={limites} habitos={habitos} diario={diario} googleToken={googleToken} coachMensajes={coachMensajes} coachPerfil={coachPerfil} coachMemoria={coachMemoria} cuentas={cuentas} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete}
                chatOpen={coachChat} setChatOpen={setCoachChat} sheetOpen={coachSheet} setSheetOpen={setCoachSheet} />
        </div>
    );
}
