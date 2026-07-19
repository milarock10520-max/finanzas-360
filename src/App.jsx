import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    CreditCard,
    Target,
    Plus,
    Trash2,
    Wallet,
    Calendar,
    Save,
    DollarSign,
    Loader2,
    ClipboardList,
    PieChart,
    CheckCircle2,
    ArrowRightCircle,
    RotateCcw,
    BarChart3,
    Edit2,
    AlertTriangle,
    SlidersHorizontal,
    Sparkles,
    Bell,
    Coins,
    Calculator,
    Zap,
    X,
    StickyNote,
    MessageSquarePlus,
    TrendingUp as ProfitIcon,
    Building2,
    Shield,
    LineChart,
    Briefcase,
    ToggleLeft,
    ToggleRight,
    Eye,
    EyeOff,
    Lock,
    Copy,
    RefreshCw,
    Globe,
    KeyRound,
    Search,
    CalendarDays,
    ListTodo,
    Circle,
    Clock,
    GripVertical,
    Pin,
    PinOff,
    ListChecks,
    Link2,
    Flame,
    Sun,
    Smile,
    BookOpen,
    CalendarClock,
    LogOut,
    UserCog,
    Mic,
    ArrowLeft,
    Archive,
    FolderKanban
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    initializeAuth,
    browserLocalPersistence,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential,
    signOut
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { programarAgendaDiaria } from './native/notificaciones';
import { conectarGoogle, obtenerTokenGoogle, desconectarGoogle } from './native/googleAuth';
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

// --- BASE DE LA API ---
// En web (Cloudflare) las llamadas /api/* son relativas y las sirve el mismo Worker.
// En la app nativa (iOS) la UI corre desde capacitor://localhost, así que apuntamos
// las llamadas /api/* al Worker desplegado en Cloudflare.
const API_BASE = (Capacitor.isNativePlatform() || window.desktop?.isElectron)
    ? 'https://finanzas-360.milarock10520.workers.dev'
    : '';

// --- CONFIGURACIÓN DE FIREBASE ---
const misCredencialesReales = {
    apiKey: "AIzaSyDfTuH2oXtjlYg1-1b0tDESI3hDDxCiGYw",
    authDomain: "appfinanzas-84626.firebaseapp.com",
    projectId: "appfinanzas-84626",
    storageBucket: "appfinanzas-84626.firebasestorage.app",
    messagingSenderId: "163542408412",
    appId: "1:163542408412:web:d27518922c09977ffae819"
};

// Configuración segura y robusta
let firebaseConfig = misCredencialesReales;
// Variable unificada para evitar errores de referencia
let appId = 'mi-finanzas-app-v1';

try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        firebaseConfig = JSON.parse(__firebase_config);
    }
    if (typeof __app_id !== 'undefined' && __app_id) {
        appId = __app_id;
    }
} catch (e) {
    console.log("Modo standalone detectado, usando credenciales reales.");
}

const app = initializeApp(firebaseConfig);
// En la app nativa (WKWebView) la persistencia por IndexedDB de Firebase Auth se
// cuelga; forzamos persistencia por localStorage para que onAuthStateChanged dispare.
const auth = Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: browserLocalPersistence })
    : getAuth(app);
const db = getFirestore(app);

// Utilidad para formatear moneda
const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatUSD = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return 'US$0';
    return 'US' + new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

// Formatea según la moneda de la inversión ('USD' o 'COP' por defecto).
const formatMoney = (amount, moneda) => (moneda === 'USD' ? formatUSD(amount) : formatCurrency(amount));

// --- CONSTANTES ---
const CATEGORIAS_INGRESOS = [
    "Salario", "Freelance", "Retorno Inversión", "Regalos", "Venta", "Otros"
];

const CATEGORIAS_GASTOS = [
    "Vivienda (Arriendo/Hipoteca)", "Servicios Públicos", "Mercado",
    "Transporte", "Entretenimiento", "Salud", "Educación",
    "Ropa", "Deudas", "Aporte Inversión", "Mascotas", "Gastos Hormiga", "Otros"
];

const TIPOS_INVERSION = [
    "CDT / Renta Fija", "Acciones / Bolsa", "Criptomonedas", "Finca Raíz", "Negocio Propio", "Fondo de Emergencia"
];

const PLAZOS_METAS = [
    { value: 'corto', label: 'Corto Plazo (< 1 año)' },
    { value: 'mediano', label: 'Mediano Plazo (1-5 años)' },
    { value: 'largo', label: 'Largo Plazo (> 5 años)' },
];

// --- COMPONENTE: MODAL GASTOS RÁPIDOS (HORMIGA) ---
const QuickExpenseModal = ({ isOpen, onClose, genericAdd, uid }) => {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!concepto || !monto) return;

        setSaving(true);
        await genericAdd('transacciones', {
            tipo: 'gasto',
            monto: parseFloat(monto),
            concepto,
            categoria: 'Gastos Hormiga',
            fecha: dateKey(),
            createdAt: new Date().toISOString()
        });

        setConcepto('');
        setMonto('');
        setSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-24" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Zap className="text-amber-500" size={20} />
                        Gasto Rápido
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            placeholder="¿En qué gastaste? (Ej: Café, Snack)"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors text-lg"
                            autoFocus
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="number"
                            placeholder="Monto ($)"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors text-lg font-bold"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-amber-200 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : '⚡ Registrar Gasto Hormiga'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-4">
                    Se registrará en la categoría "Gastos Hormiga"
                </p>

                {uid && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[11px] text-slate-400 mb-1">Tu ID para el Atajo de Siri:</p>
                        <button
                            type="button"
                            onClick={async () => {
                                try { await navigator.clipboard.writeText(uid); alert('ID copiado. Pégalo en el Atajo de Siri.'); }
                                catch { prompt('Copia tu ID para el Atajo de Siri:', uid); }
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <span className="truncate font-mono">{uid}</span>
                            <Copy size={14} className="text-slate-400 shrink-0" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTES AUXILIARES ---

const DeudaItem = ({ deuda, onAbonar }) => {
    const [pagoInput, setPagoInput] = useState('');
    const montoTotal = Number(deuda.montoTotal) || 0;
    const montoPagado = Number(deuda.montoPagado) || 0;
    const restante = montoTotal - montoPagado;
    const progreso = montoTotal > 0 ? Math.min((montoPagado / montoTotal) * 100, 100) : 0;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-slate-100 w-full">
                <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${progreso}%` }}></div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
                <div>
                    <h4 className="font-bold text-lg text-slate-800">{deuda.nombre}</h4>
                    <div className="text-sm text-slate-500 flex gap-3">
                        <span>Total: {formatCurrency(montoTotal)}</span>
                        <span>•</span>
                        <span className="text-emerald-600">Pagado: {formatCurrency(montoPagado)}</span>
                    </div>
                    <p className="mt-2 text-rose-600 font-bold text-xl">Pendiente: {formatCurrency(restante)}</p>
                </div>
                {restante > 0 ? (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <input
                            type="number" placeholder="Monto abono"
                            className="px-3 py-2 border rounded-lg w-full md:w-32 text-sm outline-none focus:border-rose-500"
                            value={pagoInput} onChange={(e) => setPagoInput(e.target.value)}
                        />
                        <button
                            onClick={() => { onAbonar(deuda, pagoInput); setPagoInput(''); }}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 whitespace-nowrap"
                        >
                            Abonar
                        </button>
                    </div>
                ) : (
                    <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm">¡Pagada! 🎉</span>
                )}
            </div>
        </div>
    );
};

const MetaItem = ({ meta, metasFinancieras = [], onAhorrar, onToggleCompletada, onDelete, onAddNote, onDeleteNote, onAddChecklistItem, onToggleChecklistItem, onDeleteChecklistItem, onLinkMetaFinanciera, onToggleDia, onToggleSeguimiento }) => {
    const [aporte, setAporte] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [showLinkSelect, setShowLinkSelect] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0); // 0 = semana actual; -1 = anterior...

    const notas = meta.notas || [];
    const checklist = meta.checklist || [];
    const checklistDone = checklist.filter(c => c.completado).length;
    const checklistPct = checklist.length > 0 ? Math.round((checklistDone / checklist.length) * 100) : 0;

    // --- Registro diario (días en que se cumplió la meta) ---
    const registroDias = meta.registroDias || [];
    // Activo solo si la meta lo habilitó. Las metas viejas con días ya marcados
    // se muestran activas para no perder su historial.
    const seguimientoActivo = meta.seguimientoDiario === true
        || (meta.seguimientoDiario === undefined && registroDias.length > 0);
    const registroSet = new Set(registroDias);
    const hoyKey = dateKey();
    const mesActual = hoyKey.slice(0, 7);
    const diasEsteMes = registroDias.filter(d => typeof d === 'string' && d.slice(0, 7) === mesActual).length;

    // Racha actual: días consecutivos cumplidos hasta hoy (o ayer si hoy aún no).
    const calcularRacha = () => {
        let racha = 0;
        const d = new Date();
        if (!registroSet.has(dateKey(d))) d.setDate(d.getDate() - 1); // permite contar aunque hoy no esté marcado
        while (registroSet.has(dateKey(d))) { racha++; d.setDate(d.getDate() - 1); }
        return racha;
    };
    const racha = calcularRacha();

    // Días de la semana visible (lunes a domingo) según weekOffset.
    const DIAS_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const baseLunes = (() => {
        const d = new Date();
        const dow = (d.getDay() + 6) % 7; // 0 = lunes
        d.setDate(d.getDate() - dow + weekOffset * 7);
        d.setHours(0, 0, 0, 0);
        return d;
    })();
    const semana = DIAS_LETRA.map((letra, i) => {
        const d = new Date(baseLunes);
        d.setDate(baseLunes.getDate() + i);
        const key = dateKey(d);
        return { letra, num: d.getDate(), key, done: registroSet.has(key), isToday: key === hoyKey, isFuture: key > hoyKey };
    });
    const etiquetaSemana = weekOffset === 0 ? 'Esta semana'
        : weekOffset === -1 ? 'Semana pasada'
        : `${baseLunes.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;

    // Meta financiera vinculada (si existe)
    const metaVinculada = meta.metaFinancieraId
        ? metasFinancieras.find(mf => mf.id === meta.metaFinancieraId)
        : null;

    const handleAddChecklist = () => {
        if (!newChecklistItem.trim()) return;
        onAddChecklistItem(meta, newChecklistItem);
        setNewChecklistItem('');
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        onAddNote(meta, newNote);
        setNewNote('');
    };

    // Panel de notas compartido (elemento JSX, NO un componente anidado:
    // si fuera componente se re-montaría en cada tecla y el input perdería el foco).
    const notesPanel = (
        <div className={`mt-4 pt-4 border-t ${meta.tipo === 'personal' ? 'border-emerald-200' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <StickyNote size={14} /> Notas y Avances
                </h4>
                <button onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                </button>
            </div>

            {/* Input para nueva nota */}
            <div className="flex gap-2 mb-3">
                <input
                    type="text"
                    placeholder="Escribe una nota..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                />
                <button
                    onClick={handleAddNote}
                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700"
                >
                    <MessageSquarePlus size={16} />
                </button>
            </div>

            {/* Lista de notas */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {notas.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Sin notas aún</p>
                ) : (
                    notas.slice().reverse().map((nota, idx) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded-lg flex justify-between items-start gap-2 group">
                            <div className="flex-1">
                                <p className="text-sm text-slate-700">{nota.texto}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(nota.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <button
                                onClick={() => onDeleteNote(meta, notas.length - 1 - idx)}
                                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    // Renderizado para Metas Personales
    if (meta.tipo === 'personal') {
        const objVinc = metaVinculada ? (Number(metaVinculada.montoObjetivo) || 1) : 1;
        const actVinc = metaVinculada ? (Number(metaVinculada.ahorroActual) || 0) : 0;
        const pctVinc = metaVinculada ? Math.min((actVinc / objVinc) * 100, 100) : 0;

        return (
            <div className={`p-6 rounded-2xl shadow-sm border flex flex-col h-full transition-all ${meta.completada ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-start mb-4">
                    <span className={`px-2 py-1 text-xs rounded-md font-bold uppercase tracking-wider
              ${meta.plazo === 'corto' ? 'bg-indigo-100 text-indigo-700' :
                            meta.plazo === 'mediano' ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'}`}>
                        {meta.plazo}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowLinkSelect(!showLinkSelect)}
                            className={`p-1.5 rounded-full transition-all relative ${metaVinculada ? 'bg-emerald-100 text-emerald-600' : showLinkSelect ? 'bg-slate-100 text-slate-600' : 'text-slate-300 hover:text-emerald-500 hover:bg-slate-50'}`}
                            title="Vincular ahorro"
                        >
                            <Link2 size={14} />
                        </button>
                        <button
                            onClick={() => setShowNotes(!showNotes)}
                            className={`p-1.5 rounded-full transition-all relative ${showNotes ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-500 hover:bg-slate-50'}`}
                            title="Ver notas"
                        >
                            <StickyNote size={14} />
                            {notas.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{notas.length}</span>
                            )}
                        </button>
                        <button onClick={() => onDelete(meta.id)} className="text-slate-300 hover:text-rose-500 p-1.5"><Trash2 size={16} /></button>
                    </div>
                </div>

                <h3 className={`text-xl font-bold mb-1 ${meta.completada ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                    {meta.nombre}
                </h3>
                <p className="text-sm text-slate-500 mb-3">{meta.completada ? '¡Meta alcanzada! 🌟' : 'Propósito personal'}</p>

                {/* Selector para vincular meta financiera */}
                {showLinkSelect && (
                    <div className="mb-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-1"><Link2 size={12} /> Vincular con un ahorro</label>
                        <select
                            value={meta.metaFinancieraId || ''}
                            onChange={(e) => { onLinkMetaFinanciera(meta, e.target.value); setShowLinkSelect(false); }}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-emerald-500 bg-white"
                        >
                            <option value="">Sin vínculo</option>
                            {metasFinancieras.map(mf => <option key={mf.id} value={mf.id}>💰 {mf.nombre}</option>)}
                        </select>
                        {metasFinancieras.length === 0 && <p className="text-[11px] text-slate-400 mt-1">Crea una meta financiera primero.</p>}
                    </div>
                )}

                {/* Ahorro vinculado */}
                {metaVinculada && (
                    <div className="mb-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><Coins size={12} /> Ahorro: {metaVinculada.nombre}</span>
                            <span className="text-xs font-bold text-emerald-700">{pctVinc.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-white/70 rounded-full h-2 mb-1.5">
                            <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pctVinc}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                            <span className="font-bold text-emerald-700">{formatCurrency(actVinc)}</span>
                            <span>de {formatCurrency(objVinc)}</span>
                        </div>
                    </div>
                )}

                {/* Checklist de avances */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><ListChecks size={14} /> Avances {checklist.length > 0 && <span className="text-slate-400">({checklistDone}/{checklist.length})</span>}</span>
                        {checklist.length > 0 && <span className={`text-xs font-bold ${checklistPct === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{checklistPct}%</span>}
                    </div>
                    {checklist.length > 0 && (
                        <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                            <div className={`h-2 rounded-full transition-all duration-700 ${checklistPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${checklistPct}%` }}></div>
                        </div>
                    )}
                    <div className="space-y-1.5 mb-3 max-h-44 overflow-y-auto">
                        {checklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 group">
                                <button onClick={() => onToggleChecklistItem(meta, idx)} className="flex-shrink-0">
                                    {item.completado
                                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                                        : <Circle size={18} className="text-slate-300 hover:text-indigo-400" />}
                                </button>
                                <span className={`flex-1 text-sm ${item.completado ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.texto}</span>
                                <button onClick={() => onDeleteChecklistItem(meta, idx)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                        {checklist.length === 0 && <p className="text-xs text-slate-400 py-1">Agrega pasos para llevar el control (ej: cada libro, cada hito).</p>}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Nuevo avance…"
                            value={newChecklistItem}
                            onChange={(e) => setNewChecklistItem(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklist(); } }}
                            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                        />
                        <button onClick={handleAddChecklist} className="bg-indigo-600 text-white px-2.5 rounded-lg hover:bg-indigo-700"><Plus size={16} /></button>
                    </div>

                    {/* Registro diario (rachas) — opcional por meta */}
                    {seguimientoActivo ? (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><CalendarClock size={14} /> Registro diario</span>
                                <div className="flex items-center gap-2 text-[11px] font-bold">
                                    <span className="text-amber-600 flex items-center gap-0.5"><Flame size={12} /> {racha}</span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-indigo-600">{diasEsteMes} este mes</span>
                                    <button onClick={() => onToggleSeguimiento(meta)} className="text-slate-300 hover:text-rose-500 ml-1" title="Desactivar registro diario"><X size={13} /></button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mb-1.5">
                                <button onClick={() => setWeekOffset(weekOffset - 1)} className="text-slate-400 hover:text-indigo-600 p-1" title="Semana anterior">‹</button>
                                <span className="text-[11px] font-semibold text-slate-500">{etiquetaSemana}</span>
                                <button onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))} disabled={weekOffset >= 0} className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 p-1" title="Semana siguiente">›</button>
                            </div>
                            <div className="flex justify-between gap-1">
                                {semana.map((dia) => (
                                    <button
                                        key={dia.key}
                                        onClick={() => !dia.isFuture && onToggleDia(meta, dia.key)}
                                        disabled={dia.isFuture}
                                        title={dia.key}
                                        className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all ${dia.isFuture ? 'opacity-30 cursor-default' : 'hover:bg-slate-50'}`}
                                    >
                                        <span className={`text-[10px] font-bold ${dia.isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{dia.letra}</span>
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                            ${dia.done
                                                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                                                : dia.isToday ? 'bg-white text-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-100 text-slate-500'}`}>
                                            {dia.done ? <CheckCircle2 size={15} /> : dia.num}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => onToggleSeguimiento(meta)}
                            className="mt-4 w-full py-2 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <CalendarClock size={14} /> Activar registro diario
                        </button>
                    )}
                </div>

                {/* Notas (expandible) */}
                {showNotes && notesPanel}

                {/* Botón completar */}
                <button
                    onClick={() => onToggleCompletada(meta)}
                    className={`mt-4 w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all
            ${meta.completada
                            ? 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'}`}
                >
                    {meta.completada ? (
                        <>Completada <CheckCircle2 size={18} /></>
                    ) : (
                        <>Marcar como Lograda</>
                    )}
                </button>
            </div>
        );
    }

    // Renderizado para Metas Financieras
    const actual = Number(meta.ahorroActual) || 0;
    const objetivo = Number(meta.montoObjetivo) || 1;
    const porcentaje = Math.min((actual / objetivo) * 100, 100);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 text-xs rounded-md font-bold uppercase tracking-wider
            ${meta.plazo === 'corto' ? 'bg-emerald-100 text-emerald-700' :
                            meta.plazo === 'mediano' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {meta.plazo}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowNotes(!showNotes)}
                            className={`p-1.5 rounded-full transition-all relative ${showNotes ? 'bg-blue-100 text-blue-600' : 'text-slate-300 hover:text-blue-500 hover:bg-slate-50'}`}
                            title="Ver notas"
                        >
                            <StickyNote size={14} />
                            {notas.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{notas.length}</span>
                            )}
                        </button>
                        <button onClick={() => onDelete(meta.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                    </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">{meta.nombre}</h3>
                <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-500">Actual: <span className="font-bold text-slate-800">{formatCurrency(actual)}</span></span>
                    <span className="text-slate-500">Meta: {formatCurrency(objetivo)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
                    <div className={`h-3 rounded-full transition-all duration-1000 ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${porcentaje}%` }}></div>
                </div>
            </div>

            {showNotes ? (
                notesPanel
            ) : (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                    <input
                        type="number" placeholder="+ Ahorro"
                        value={aporte} onChange={e => setAporte(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={() => { onAhorrar(meta, aporte); setAporte(''); }}
                        className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700"
                    >
                        <Save size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};


const CardResumen = ({ titulo, monto, icono: Icon, color }) => (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between transition-all hover:shadow-md">
        <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{titulo}</p>
            <h3 className="text-2xl font-black text-slate-800">{formatCurrency(monto || 0)}</h3>
        </div>
        <div className={`p-4 rounded-full ${color} bg-current bg-opacity-10`}>
            <Icon size={24} />
        </div>
    </div>
);

// --- COMPONENTES PRINCIPALES ---

const DashboardView = ({ saldoActual, totalIngresos, totalGastos, totalDeudaPendiente, transacciones }) => (
    <div className="space-y-8 animate-in fade-in duration-500">
        {/* Tarjetas Superiores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">

            {/* Saldo Disponible - FEATURED CARD */}
            <div className="bg-blue-600 p-6 md:p-8 rounded-[2rem] shadow-xl shadow-blue-200 text-white relative overflow-hidden group transition-all hover:scale-[1.02] duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl"></div>

                <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                    <div>
                        <p className="text-blue-100 font-medium mb-1 text-sm tracking-wide">Saldo Disponible</p>
                        <h3 className="text-4xl font-extrabold tracking-tight">{formatCurrency(saldoActual)}</h3>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-700/50 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm border border-blue-500/30">
                        <Wallet size={14} className="text-blue-200" />
                        <span className="text-xs font-medium text-blue-100">En billetera/bancos</span>
                    </div>
                </div>
            </div>

            <CardResumen titulo="Ingresos Totales" monto={totalIngresos} icono={TrendingUp} color="text-emerald-500" />
            <CardResumen titulo="Gastos Totales" monto={totalGastos} icono={TrendingDown} color="text-rose-500" />
            <CardResumen titulo="Deudas" monto={totalDeudaPendiente} icono={CreditCard} color="text-rose-600" />
        </div>

        {/* Movimientos Recientes */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Calendar size={20} /></div>
                Movimientos Recientes
            </h3>
            {transacciones.length === 0 ? <p className="text-slate-400 py-8 text-center italic">Aún no hay movimientos registrados.</p> : (
                <div className="space-y-4">
                    {transacciones.slice(0, 5).map(t => (
                        <div key={t.id} className="flex justify-between items-center p-4 hover:bg-slate-50/80 rounded-2xl transition-all group border border-transparent hover:border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${t.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                    {t.tipo === 'ingreso' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 text-base">{t.concepto}</p>
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mt-0.5">{t.categoria}</p>
                                </div>
                            </div>
                            <span className={`font-bold text-lg tracking-tight ${t.tipo === 'ingreso' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {t.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(t.monto)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
);

const FinancialAnalysis = ({ transacciones }) => {
    const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const transaccionesMes = transacciones.filter(t => t.fecha && t.fecha.startsWith(mesSeleccionado));

    const ingresosMes = transaccionesMes.filter(t => t.tipo === 'ingreso').reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
    // Los aportes a inversión NO cuentan como gasto real (no es consumo, es mover dinero a tu patrimonio)
    const gastosMes = transaccionesMes.filter(t => t.tipo === 'gasto' && !t.esInversion).reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
    const balanceMes = ingresosMes - gastosMes;

    const gastosPorCategoria = transaccionesMes
        .filter(t => t.tipo === 'gasto' && !t.esInversion)
        .reduce((acc, curr) => {
            acc[curr.categoria] = (acc[curr.categoria] || 0) + (Number(curr.monto) || 0);
            return acc;
        }, {});

    const sortedCategorias = Object.entries(gastosPorCategoria)
        .sort(([, a], [, b]) => b - a);

    const maxGasto = sortedCategorias.length > 0 ? sortedCategorias[0][1] : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="text-indigo-600" /> Análisis Mensual
                </h2>
                <input
                    type="month"
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-emerald-600 text-sm font-bold">Ingresos</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatCurrency(ingresosMes)}</p>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                    <p className="text-rose-600 text-sm font-bold">Gastos</p>
                    <p className="text-2xl font-bold text-rose-700">{formatCurrency(gastosMes)}</p>
                </div>
                <div className={`p-4 rounded-xl border ${balanceMes >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                    <p className={`${balanceMes >= 0 ? 'text-blue-600' : 'text-orange-600'} text-sm font-bold`}>Balance Neto</p>
                    <p className={`text-2xl font-bold ${balanceMes >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(balanceMes)}</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 mb-6">¿En qué se fue tu dinero?</h3>
                {sortedCategorias.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No hay gastos registrados en este mes.</p>
                ) : (
                    <div className="space-y-4">
                        {sortedCategorias.map(([cat, monto]) => {
                            const porcentaje = (monto / (gastosMes || 1)) * 100;
                            const anchoBarra = (monto / (maxGasto || 1)) * 100;
                            return (
                                <div key={cat}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">{cat}</span>
                                        <span className="text-slate-500">{formatCurrency(monto)} ({porcentaje.toFixed(1)}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3">
                                        <div
                                            className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
                                            style={{ width: `${anchoBarra}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const CategoryLimits = ({ limites, transacciones, genericAdd, genericDelete, notifPermiso, onActivarNotif }) => {
    const [categoria, setCategoria] = useState(CATEGORIAS_GASTOS[0]);
    const [limite, setLimite] = useState('');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const gastosMes = transacciones
        .filter(t => t.tipo === 'gasto' && t.fecha && t.fecha.startsWith(currentMonth))
        .reduce((acc, curr) => {
            acc[curr.categoria] = (acc[curr.categoria] || 0) + (Number(curr.monto) || 0);
            return acc;
        }, {});

    const agregarLimite = async (e) => {
        e.preventDefault();
        const existe = limites.find(l => l.categoria === categoria);
        if (existe) {
            alert(`Ya existe un límite para ${categoria}. Bórralo primero.`);
            return;
        }
        await genericAdd('limites', { categoria, limite: parseFloat(limite) });
        setLimite('');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-right duration-500">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-rose-600">
                    <SlidersHorizontal className="w-6 h-6" /> Configurar Tope
                </h3>
                <form onSubmit={agregarLimite} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none bg-white">
                            {CATEGORIAS_GASTOS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Límite Mensual ($)</label>
                        <input
                            type="number"
                            placeholder="Ej: 300000"
                            value={limite}
                            onChange={e => setLimite(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:border-rose-500"
                            required
                        />
                    </div>
                    <button type="submit" className="w-full bg-rose-600 text-white py-3 rounded-lg font-bold hover:bg-rose-700">Guardar Límite</button>
                </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-bold text-lg text-slate-800">Estado de Topes (Mes Actual)</h3>
                    {notifPermiso === 'granted' ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full">
                            <Bell size={14} /> Avisos activados
                        </span>
                    ) : (
                        <button onClick={onActivarNotif} className="text-xs font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full transition-colors">
                            <Bell size={14} /> Activar avisos de límite
                        </button>
                    )}
                </div>
                {limites.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-500">No has configurado límites de gastos.</p>
                    </div>
                ) : (
                    limites.map(item => {
                        const gastado = gastosMes[item.categoria] || 0;
                        const itemLimite = Number(item.limite) || 1;
                        const porcentaje = Math.min((gastado / itemLimite) * 100, 100);
                        const isOverLimit = gastado > itemLimite;

                        let colorBarra = 'bg-emerald-500';
                        let colorTexto = 'text-emerald-700';
                        if (porcentaje > 70) { colorBarra = 'bg-yellow-500'; colorTexto = 'text-yellow-700'; }
                        if (porcentaje >= 100) { colorBarra = 'bg-rose-500'; colorTexto = 'text-rose-700'; }

                        return (
                            <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        {item.categoria}
                                        {isOverLimit && <AlertTriangle size={16} className="text-rose-500" />}
                                    </h4>
                                    <button onClick={() => genericDelete('limites', item.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                                </div>

                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-500">Gastado: <span className={`font-bold ${colorTexto}`}>{formatCurrency(gastado)}</span></span>
                                    <span className="text-slate-400">Tope: {formatCurrency(itemLimite)}</span>
                                </div>

                                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                    <div className={`h-full ${colorBarra} transition-all duration-700`} style={{ width: `${porcentaje}%` }}></div>
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600 mix-blend-multiply">
                                        {porcentaje.toFixed(0)}%
                                    </span>
                                </div>
                                {isOverLimit && <p className="text-xs text-rose-500 mt-2 font-medium">¡Has excedido tu presupuesto!</p>}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const BudgetPlanner = ({ presupuestoItems, limites, transacciones, genericAdd, genericUpdate, genericDelete, onEjecutarPago, notifPermiso, onActivarNotif }) => {
    const [viewMode, setViewMode] = useState('lista');
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [categoria, setCategoria] = useState(CATEGORIAS_GASTOS[0]);
    const [recurrente, setRecurrente] = useState(true);
    const [diaPago, setDiaPago] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [montoEdit, setMontoEdit] = useState('');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const nombreMesActual = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    // Calcular total presupuesto
    const totalPresupuesto = presupuestoItems.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
    // Un ítem es fijo si recurrente === true. Los ítems antiguos (sin el campo) se tratan como fijos.
    const esFijo = (item) => item.recurrente !== false;

    const agregarObligacion = async (e) => {
        e.preventDefault();
        const dp = parseInt(diaPago);
        await genericAdd('presupuesto', { concepto, monto: parseFloat(monto), categoria, lastPaid: '', recurrente, diaPago: (dp >= 1 && dp <= 31) ? dp : null });
        setConcepto(''); setMonto(''); setRecurrente(true); setDiaPago('');
    };

    const toggleRecurrente = async (item) => {
        await genericUpdate('presupuesto', item.id, { recurrente: !esFijo(item) });
    };

    const iniciarEdicion = (item) => {
        setEditandoId(item.id);
        setMontoEdit(item.monto);
    };

    const guardarEdicion = async (id) => {
        await genericUpdate('presupuesto', id, { monto: parseFloat(montoEdit) });
        setEditandoId(null);
    };

    const prepararNuevoMes = async () => {
        const fijos = presupuestoItems.filter(esFijo);
        const noFijos = presupuestoItems.filter(item => !esFijo(item));
        let mensaje = `¿Iniciar el mes de ${nombreMesActual}?\n\n• Se desmarcarán los pagos de tus ${fijos.length} ítem(s) fijo(s) para volver a usarlos.`;
        if (noFijos.length > 0) {
            mensaje += `\n• Se eliminarán ${noFijos.length} ítem(s) marcado(s) como de un solo mes.`;
        }
        if (!confirm(mensaje)) return;
        const operaciones = [
            ...fijos.map(item => genericUpdate('presupuesto', item.id, { lastPaid: '' })),
            ...noFijos.map(item => genericDelete('presupuesto', item.id)),
        ];
        await Promise.all(operaciones);
    };

    return (
        <div className="space-y-6">
            <div className="flex p-1 bg-slate-200 rounded-lg w-full md:w-fit mx-auto md:mx-0">
                <button
                    onClick={() => setViewMode('lista')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex-1 md:flex-none ${viewMode === 'lista' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    📋 Lista Fija
                </button>
                <button
                    onClick={() => setViewMode('topes')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex-1 md:flex-none ${viewMode === 'topes' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    🚧 Topes de Gastos
                </button>
            </div>

            {viewMode === 'topes' ? (
                <CategoryLimits limites={limites} transacciones={transacciones} genericAdd={genericAdd} genericDelete={genericDelete} notifPermiso={notifPermiso} onActivarNotif={onActivarNotif} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-right duration-500">
                    <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                        <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-indigo-600">
                            <ClipboardList className="w-6 h-6" /> Nuevo Ítem Fijo
                        </h3>
                        <form onSubmit={agregarObligacion} className="space-y-4">
                            <input placeholder="Obligación (Ej: Arriendo)" value={concepto} onChange={e => setConcepto(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-indigo-500" required />
                            <input type="number" placeholder="Monto Estimado" value={monto} onChange={e => setMonto(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-indigo-500" required />
                            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none bg-white">{CATEGORIAS_GASTOS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            <div>
                                <input type="number" min="1" max="31" placeholder="Día de pago (1-31, opcional)" value={diaPago} onChange={e => setDiaPago(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-indigo-500" />
                                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><CalendarClock size={12} /> Te recordaré en "Mi Día" cuando se acerque.</p>
                            </div>
                            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer select-none">
                                <input type="checkbox" checked={recurrente} onChange={e => setRecurrente(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                <div className="flex-1">
                                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-1"><Pin size={14} className="text-indigo-500" /> Fijo todos los meses</span>
                                    <p className="text-xs text-slate-400">Se queda y se reutiliza cada mes (ej: Arriendo). Desactívalo si es un gasto de un solo mes.</p>
                                </div>
                            </label>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">Agregar al Presupuesto</button>
                        </form>

                        <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <h4 className="font-bold text-indigo-800 mb-2 text-sm">💡 Tip para nuevo mes</h4>
                            <p className="text-xs text-indigo-600 mb-3">Al iniciar un mes, los ítems <strong>fijos</strong> se conservan (se les quita el "pagado") y los de un solo mes se eliminan.</p>
                            <button onClick={prepararNuevoMes} className="w-full flex items-center justify-center gap-2 text-sm bg-white border border-indigo-200 text-indigo-700 py-2 rounded-lg hover:bg-indigo-100 transition-colors font-semibold"><RotateCcw size={16} /> Preparar {nombreMesActual}</button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg text-slate-800">Mi Lista Mensual</h3>
                            <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-500">{presupuestoItems.length} ítems</span>
                        </div>
                        {presupuestoItems.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300"><p className="text-slate-500">Agrega tus gastos fijos aquí.</p></div> :
                            presupuestoItems.map(item => {
                                const isPaid = item.lastPaid && item.lastPaid.startsWith(currentMonth);
                                return (
                                    <div key={item.id} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${isPaid ? 'bg-emerald-50 border-emerald-200 opacity-70' : 'bg-white border-slate-100 shadow-sm'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isPaid ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>{isPaid && <CheckCircle2 size={16} />}</div>
                                            <div>
                                                <h4 className={`font-bold flex items-center gap-1.5 ${isPaid ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                                                    {item.concepto}
                                                    {esFijo(item)
                                                        ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full"><Pin size={10} /> Fijo</span>
                                                        : <span className="inline-flex items-center text-[10px] font-semibold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">1 mes</span>}
                                                </h4>
                                                <p className="text-xs text-slate-500">{item.categoria}{item.diaPago ? ` • paga el ${item.diaPago}` : ''}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {editandoId === item.id ? (
                                                <div className="flex items-center gap-1">
                                                    <input type="number" value={montoEdit} onChange={e => setMontoEdit(e.target.value)} className="w-24 px-2 py-1 border rounded text-sm" autoFocus />
                                                    <button onClick={() => guardarEdicion(item.id)} className="bg-emerald-500 text-white p-1 rounded hover:bg-emerald-600"><CheckCircle2 size={14} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group">
                                                    <span className="font-semibold text-slate-600">{formatCurrency(item.monto)}</span>
                                                    {!isPaid && <button onClick={() => iniciarEdicion(item)} className="text-slate-400 hover:text-blue-500 transition-colors" title="Editar monto"><Edit2 size={14} /></button>}
                                                </div>
                                            )}

                                            {!isPaid ? (
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => onEjecutarPago(item)} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all">
                                                        Pagar <ArrowRightCircle size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => genericUpdate('presupuesto', item.id, { lastPaid: currentMonth })}
                                                        className="flex items-center gap-1 text-emerald-600 px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-50 border border-emerald-200 transition-all"
                                                        title="Marcar como pagado sin registrar gasto"
                                                    >
                                                        <CheckCircle2 size={12} /> ✓
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => genericUpdate('presupuesto', item.id, { lastPaid: '' })}
                                                    className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-200 transition-all cursor-pointer"
                                                    title="Clic para desmarcar"
                                                >
                                                    Pagado <CheckCircle2 size={14} />
                                                </button>
                                            )}

                                            <button onClick={() => toggleRecurrente(item)} className={`ml-2 transition-colors ${esFijo(item) ? 'text-indigo-500 hover:text-slate-400' : 'text-slate-300 hover:text-indigo-500'}`} title={esFijo(item) ? 'Quitar de fijos (será de un solo mes)' : 'Marcar como fijo todos los meses'}>
                                                {esFijo(item) ? <Pin size={16} /> : <PinOff size={16} />}
                                            </button>
                                            <button onClick={() => genericDelete('presupuesto', item.id)} className="text-slate-300 hover:text-rose-500 ml-1"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                );
                            })
                        }

                        {/* TOTALIZADOR DE PRESUPUESTO */}
                        {presupuestoItems.length > 0 && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                                        <Calculator size={20} />
                                    </div>
                                    <span className="font-bold text-slate-600">Total Presupuestado:</span>
                                </div>
                                <span className="font-bold text-xl text-indigo-700">{formatCurrency(totalPresupuesto)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const TransactionManager = ({ tipo, transacciones, genericAdd, genericUpdate, genericDelete, prefillData, setPrefillData, activeTab, pendingBudgetId, setPendingBudgetId, setActiveTab }) => {
    const [monto, setMonto] = useState('');
    const [concepto, setConcepto] = useState('');
    const [categoria, setCategoria] = useState(tipo === 'ingreso' ? CATEGORIAS_INGRESOS[0] : CATEGORIAS_GASTOS[0]);
    const [fecha, setFecha] = useState(dateKey());

    useEffect(() => {
        // Auto-rellenar solo si estamos en la pestaña correcta
        const esTargetTab = (activeTab === 'gastos' && tipo === 'gasto') || (activeTab === 'ingresos' && tipo === 'ingreso');

        if (prefillData && esTargetTab) {
            setConcepto(prefillData.concepto);
            setMonto(prefillData.monto);
            setCategoria(prefillData.categoria);
            setPrefillData(null);
        }
    }, [prefillData, activeTab, tipo, setPrefillData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!monto || !concepto) return;

        // Guardar el ID antes de cualquier operación async para evitar que se pierda
        const budgetIdToUpdate = pendingBudgetId;
        const currentMonth = new Date().toISOString().slice(0, 7);

        console.log('=== DEBUG: Guardando transacción ===');
        console.log('budgetIdToUpdate:', budgetIdToUpdate);

        await genericAdd('transacciones', {
            tipo,
            monto: parseFloat(monto),
            concepto,
            categoria,
            fecha,
            createdAt: new Date().toISOString()
        });

        console.log('=== DEBUG: Transacción guardada ===');

        // Marcar como pagado en presupuesto si viene de ahí
        if (budgetIdToUpdate) {
            console.log('=== DEBUG: Actualizando presupuesto ===');
            console.log('ID:', budgetIdToUpdate, 'Mes:', currentMonth);
            try {
                await genericUpdate('presupuesto', budgetIdToUpdate, { lastPaid: currentMonth });
                console.log('=== DEBUG: Presupuesto actualizado exitosamente ===');
            } catch (error) {
                console.error('=== DEBUG: Error al actualizar presupuesto ===', error);
            }
            setPendingBudgetId(null);
            setActiveTab('presupuesto'); // Volver a presupuesto
        } else {
            console.log('=== DEBUG: No hay budgetIdToUpdate ===');
        }
        setMonto(''); setConcepto('');
    };




    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-right duration-500">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h3 className={`font-bold text-xl mb-4 flex items-center gap-2 ${tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tipo === 'ingreso' ? <Plus className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    {pendingBudgetId ? 'Confirmar Pago' : `Registrar ${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}`}
                </h3>
                {pendingBudgetId && <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg mb-4 text-sm flex gap-2 items-center"><CheckCircle2 size={16} /> Registrando ítem del presupuesto</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Monto</label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-indigo-500" required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label><input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-indigo-500" required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label><select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none bg-white">{(tipo === 'ingreso' ? CATEGORIAS_INGRESOS : CATEGORIAS_GASTOS).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-indigo-500" required />
                    <button type="submit" className={`w-full py-3 rounded-lg font-bold text-white transition-transform active:scale-95 ${tipo === 'ingreso' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>Guardar {tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</button>
                </form>
            </div>
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-lg text-slate-800">Historial</h3>
                {transacciones.filter(t => t.tipo === tipo).map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div><h4 className="font-bold text-slate-700">{t.concepto}</h4><p className="text-sm text-slate-500">{t.categoria} • {t.fecha}</p></div>
                        <div className="flex items-center gap-4"><span className={`font-bold ${tipo === 'ingreso' ? 'text-emerald-600' : 'text-slate-700'}`}>{formatCurrency(t.monto)}</span><button onClick={() => genericDelete('transacciones', t.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={18} /></button></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Iconos y colores por tipo de inversión ---
const INVERSION_CONFIG = {
    'CDT / Renta Fija': { icon: Shield, color: 'blue', gradient: 'from-blue-500 to-blue-700', label: 'Renta Fija' },
    'Acciones / Bolsa': { icon: LineChart, color: 'indigo', gradient: 'from-indigo-500 to-violet-700', label: 'Bolsa' },
    'Criptomonedas': { icon: Zap, color: 'amber', gradient: 'from-amber-500 to-orange-600', label: 'Crypto' },
    'Finca Raíz': { icon: Building2, color: 'emerald', gradient: 'from-emerald-600 to-teal-700', label: 'Inmueble' },
    'Negocio Propio': { icon: Briefcase, color: 'rose', gradient: 'from-rose-500 to-pink-700', label: 'Negocio' },
    'Fondo de Emergencia': { icon: Shield, color: 'cyan', gradient: 'from-cyan-500 to-sky-600', label: 'Emergencia' },
};

// --- Gráfica de precios mejorada (acciones / ETF) ---
// data: array de { t: timestampSeg, v: precio }
const PriceChart = ({ data, ticker }) => {
    if (!data || data.length < 2) return null;

    const prices = data.map(d => d.v);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const W = 320;   // viewBox width
    const H = 120;   // viewBox height
    const padTop = 8;
    const padBottom = 18;
    const plotH = H - padTop - padBottom;

    const first = prices[0];
    const last = prices[prices.length - 1];
    const periodChange = first > 0 ? ((last / first) - 1) * 100 : 0;
    const sube = last >= first;
    const stroke = sube ? '#10b981' : '#f43f5e';
    const gradId = `grad-${ticker || 'x'}-${sube ? 'up' : 'down'}`;

    const xOf = (i) => (i / (prices.length - 1)) * W;
    const yOf = (val) => padTop + (plotH - ((val - min) / range) * plotH);

    const linePoints = prices.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
    const areaPoints = `0,${padTop + plotH} ${linePoints} ${W},${padTop + plotH}`;

    // Etiquetas de fecha (primera y última)
    const fmtFecha = (ts) => {
        if (!ts) return '';
        const d = new Date(ts * 1000);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    };
    const fechaIni = fmtFecha(data[0].t);
    const fechaFin = fmtFecha(data[data.length - 1].t);

    const fmtPrecio = (p) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {ticker || 'Índice'} · últimos {data.length} días
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${sube ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {sube ? '▲' : '▼'} {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)}%
                </span>
            </div>
            <div className="relative w-full">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-28">
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {/* línea de máximo y mínimo */}
                    <line x1="0" y1={yOf(max)} x2={W} y2={yOf(max)} stroke="#e2e8f0" strokeWidth="0.7" strokeDasharray="3 3" />
                    <line x1="0" y1={yOf(min)} x2={W} y2={yOf(min)} stroke="#e2e8f0" strokeWidth="0.7" strokeDasharray="3 3" />
                    <polygon fill={`url(#${gradId})`} points={areaPoints} />
                    <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={linePoints} vectorEffect="non-scaling-stroke" />
                    {/* punto final */}
                    <circle cx={xOf(prices.length - 1)} cy={yOf(last)} r="2.5" fill={stroke} />
                </svg>
                {/* Etiquetas de precio máx / mín */}
                <span className="absolute top-0 left-1 text-[10px] font-semibold text-slate-400">${fmtPrecio(max)}</span>
                <span className="absolute bottom-4 left-1 text-[10px] font-semibold text-slate-400">${fmtPrecio(min)}</span>
            </div>
            {/* Eje de fechas */}
            <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
                <span>{fechaIni}</span>
                <span>{fechaFin}</span>
            </div>
        </div>
    );
};

// Traduce lo que el usuario escribe (en Ticker o nombre) al símbolo real de Yahoo.
// Ej: "syp500", "SP500", "S&P 500", "índice syp500", "SPX", "GSPC" → "SPY" (ETF con histórico fiable).
// Para cripto añade el sufijo -USD si falta (BTC → BTC-USD).
const normalizarTicker = (raw, subTipo) => {
    const original = (raw || '').toUpperCase().trim();
    if (!original) return null;
    // Forma compacta: solo letras y números (sin espacios, &, guiones, ^).
    const compact = original.replace(/[^A-Z0-9]/g, '');
    // Variantes del S&P 500 (incluyendo errores comunes) → SPY
    if (['SP500', 'SYP500', 'SANDP500', 'SPX', 'GSPC', 'SP', 'SYP', 'SANDP'].includes(compact)
        || compact.includes('SP500') || compact.includes('SYP500')) return 'SPY';
    // Otros índices comunes
    if (['NASDAQ', 'NDX', 'NASDAQ100'].includes(compact)) return 'QQQ';
    if (['DOWJONES', 'DOW', 'DJIA'].includes(compact)) return 'DIA';
    // Símbolo normal: conservamos punto, guion y ^ (válidos en Yahoo).
    const t = original.replace(/\s+/g, '').replace(/[^A-Z0-9.^\-]/g, '');
    if (!t) return null;
    // Cripto en Yahoo usa el formato MONEDA-USD
    if (subTipo === 'Criptomonedas' && !t.includes('-')) return t + '-USD';
    return t;
};

// --- Tarjeta individual de inversión ---
const InvestmentCard = ({ inv, onRegistrarUtilidad, onDelete, onToggleBalance, genericUpdate, totalGastosMensuales }) => {
    const [editingUtilidad, setEditingUtilidad] = useState(false);
    const [utilidadInput, setUtilidadInput] = useState('');
    const [editingMonto, setEditingMonto] = useState(false);
    const [montoEditInput, setMontoEditInput] = useState('');
    const [editingValor, setEditingValor] = useState(false);
    const [valorEditInput, setValorEditInput] = useState('');
    const [historyData, setHistoryData] = useState([]);
    const [currentTickerPrice, setCurrentTickerPrice] = useState(null);

    const prevUtilidadRef = useRef(Number(inv.utilidad) || 0);
    useEffect(() => { prevUtilidadRef.current = Number(inv.utilidad) || 0; }, [inv.utilidad]);

    useEffect(() => {
        let isMounted = true;
        
        const updateUtilidadIfChanged = (nuevaUtilidad) => {
            // Si el usuario fijó el valor a mano, el auto-sync no lo sobrescribe
            if (inv.valorManual) return;
            const currentUtilidad = prevUtilidadRef.current;
            if (isMounted && Math.abs(nuevaUtilidad - currentUtilidad) > 0.01) {
                setTimeout(() => {
                    genericUpdate('transacciones', inv.id, { utilidad: nuevaUtilidad });
                }, 500);
            }
        };

        if ((inv.subTipo === 'Fondo de Emergencia' || inv.subTipo === 'CDT / Renta Fija') && inv.fecha) {
            const startDate = new Date(`${inv.fecha}T00:00:00`);
            const today = new Date();
            const diffTime = today - startDate;
            const diffDays = Math.max(0, diffTime / (1000 * 60 * 60 * 24));
            
            const montoInv = Number(inv.monto) || 0;
            const tasa = Number(inv.tasaInteres) || 9; // 9% fallback
            const nuevaUtilidad = montoInv * (Math.pow(1 + (tasa / 100), diffDays / 365) - 1);
            
            updateUtilidadIfChanged(nuevaUtilidad);
            
        } else if (inv.subTipo === 'Acciones / Bolsa' || inv.subTipo === 'Criptomonedas') {
            // Detección amplia del S&P 500 por el nombre (S&P 500, SP500, SYP500, SPY, VOO, IVV…).
            const concUp = (inv.concepto || '').toUpperCase();
            const esSP500 = /S\s*&?\s*Y?\s*P\s*-?\s*500|SP\s*500|SYP\s*500|SPX|\bSPY\b|\bVOO\b|\bIVV\b/.test(concUp);
            // El ticker que escribió el usuario manda; si no hay, lo deducimos del nombre.
            // En ambos casos lo normalizamos al símbolo real de Yahoo (p. ej. SYP500 → SPY).
            const tickerToUse = normalizarTicker(inv.ticker || (esSP500 ? 'SPY' : null), inv.subTipo);
            if (tickerToUse) {
                const fetchTickerData = async () => {
                    try {
                        const montoInv = Number(inv.monto) || 0;
                        // Datos de mercado a través de nuestro propio Worker (sin CORS ni proxies de terceros).
                        const res = await fetch(`${API_BASE}/api/market?ticker=${encodeURIComponent(tickerToUse)}&range=5y&interval=1d`);

                        if (!res.ok) throw new Error('Fetch failed');
                        const data = await res.json();

                        const timestamps = data.timestamps;
                        const closePrices = data.closes;

                        if (!timestamps || !closePrices || timestamps.length === 0) return;

                        let currentPrice = closePrices[closePrices.length - 1];
                        if (currentPrice === null && closePrices.length > 2) {
                            currentPrice = closePrices[closePrices.length - 2];
                        }

                        let originalPrice = currentPrice;
                        if (inv.fecha) {
                            const purchaseTimestamp = new Date(`${inv.fecha}T00:00:00Z`).getTime() / 1000;
                            let purchaseIdx = -1;
                            for (let i = 0; i < timestamps.length; i++) {
                                if (timestamps[i] >= purchaseTimestamp - 172800) {
                                    if (closePrices[i] !== null && closePrices[i] !== undefined) {
                                        purchaseIdx = i; break;
                                    }
                                }
                            }
                            if (purchaseIdx !== -1) originalPrice = closePrices[purchaseIdx];
                            else originalPrice = closePrices[0];
                        }

                        const historyBuffer = [];
                        for (let i = Math.max(0, closePrices.length - 120); i < closePrices.length; i++) {
                            if (closePrices[i] !== null && closePrices[i] !== undefined) {
                                historyBuffer.push({ t: timestamps[i], v: closePrices[i] });
                            }
                        }

                        if (isMounted) {
                            setHistoryData(historyBuffer.slice(-90));
                            setCurrentTickerPrice(currentPrice);
                        }

                        const percentChange = (currentPrice / originalPrice) - 1;
                        if (percentChange !== undefined) {
                            const nuevaUtilidad = montoInv * percentChange;
                            updateUtilidadIfChanged(nuevaUtilidad);
                        }
                    } catch (error) {
                        console.error('Error fetching market data', error);
                    }
                };
                fetchTickerData();
            }
        }
        
        return () => { isMounted = false; };
    }, [inv.subTipo, inv.fecha, inv.monto, inv.concepto, inv.ticker, inv.tasaInteres, inv.id, inv.valorManual, genericUpdate]);

    const utilidad = Number(inv.utilidad) || 0;
    const montoInv = Number(inv.monto) || 0;
    const valorActual = montoInv + utilidad;
    const rentabilidad = montoInv > 0 ? ((utilidad / montoInv) * 100) : 0;
    const config = INVERSION_CONFIG[inv.subTipo] || INVERSION_CONFIG['CDT / Renta Fija'];
    const IconComp = config.icon;
    const afectaBalance = inv.afectaBalance !== false; // default true for backwards compatibility

    const handleUtilidad = () => {
        if (!utilidadInput) return;
        onRegistrarUtilidad(inv, utilidadInput);
        setEditingUtilidad(false);
        setUtilidadInput('');
    };

    const handleEditMonto = async () => {
        if (!montoEditInput) return;
        await genericUpdate('transacciones', inv.id, { monto: parseFloat(montoEditInput) });
        setEditingMonto(false);
        setMontoEditInput('');
    };

    // Editar el valor actual directamente: la utilidad se recalcula como (nuevo valor - invertido)
    // y se marca valorManual para que el auto-sync (tasa E.A. / mercado) no lo sobrescriba.
    const handleEditValor = async () => {
        const nuevoValor = parseFloat(valorEditInput);
        if (valorEditInput === '' || isNaN(nuevoValor)) return;
        await genericUpdate('transacciones', inv.id, { utilidad: nuevoValor - montoInv, valorManual: true });
        setEditingValor(false);
        setValorEditInput('');
    };

    const handleReactivarAuto = async () => {
        await genericUpdate('transacciones', inv.id, { valorManual: false });
    };

    // Cálculo dinámico de renta fija (Fondo de Emergencia / CDT)
    const renderRentaFijaDetalle = () => {
        const tasa = Number(inv.tasaInteres) || 9;
        const startDate = inv.fecha ? new Date(`${inv.fecha}T00:00:00`) : new Date();
        const diffDays = Math.max(0, Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)));
        const dailyRate = Math.pow(1 + tasa / 100, 1 / 365) - 1;
        const interesDiarioHoy = valorActual * dailyRate;          // lo que rinde hoy (aprox)
        const interesMensual = valorActual * (Math.pow(1 + tasa / 100, 30 / 365) - 1);
        const valor30dias = valorActual * Math.pow(1 + tasa / 100, 30 / 365);
        const valor1anio = valorActual * (1 + tasa / 100);

        return (
            <div className="mt-3 bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp size={13} /> Rentabilidad en vivo · {tasa}% E.A.
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{diffDays} día{diffDays !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Ganado hasta hoy</p>
                        <p className="font-bold text-emerald-600 text-base mt-0.5">+{formatMoney(utilidad, inv.moneda)}</p>
                        <p className="text-[10px] text-slate-400">{rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Rinde por día</p>
                        <p className="font-bold text-cyan-600 text-base mt-0.5">≈ {formatMoney(interesDiarioHoy, inv.moneda)}</p>
                        <p className="text-[10px] text-slate-400">{formatMoney(interesMensual, inv.moneda)} / mes</p>
                    </div>
                </div>
                <div className="flex justify-between text-xs border-t border-cyan-100 pt-2">
                    <span className="text-slate-500">En 30 días: <span className="font-bold text-slate-700">{formatMoney(valor30dias, inv.moneda)}</span></span>
                    <span className="text-slate-500">En 1 año: <span className="font-bold text-slate-700">{formatMoney(valor1anio, inv.moneda)}</span></span>
                </div>
            </div>
        );
    };

    // Métricas especializadas por tipo
    const renderTypeMetrics = () => {
        switch (inv.subTipo) {
            case 'Fondo de Emergencia': {
                // Meta: 3-6 meses de gastos
                const metaEmergencia = totalGastosMensuales * 6;
                const progresoEmergencia = metaEmergencia > 0 ? Math.min((valorActual / metaEmergencia) * 100, 100) : 0;
                const mesesCubiertos = totalGastosMensuales > 0 ? (valorActual / totalGastosMensuales) : 0;
                return (
                    <div className="mt-3 space-y-2">
                        {renderRentaFijaDetalle()}
                        <div className="flex justify-between text-xs text-slate-500 pt-1">
                            <span>Progreso hacia meta (6 meses gastos)</span>
                            <span className="font-bold">{progresoEmergencia.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${progresoEmergencia >= 100 ? 'bg-emerald-500' : progresoEmergencia >= 50 ? 'bg-cyan-500' : 'bg-amber-500'}`}
                                style={{ width: `${progresoEmergencia}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Cubre <span className="font-bold text-cyan-600">{mesesCubiertos.toFixed(1)} meses</span> de gastos</span>
                            <span className="text-slate-400">Meta: {formatCurrency(metaEmergencia)}</span>
                        </div>
                    </div>
                );
            }
            case 'CDT / Renta Fija': {
                return renderRentaFijaDetalle();
            }
            case 'Acciones / Bolsa':
            case 'Criptomonedas': {
                return (
                    <div className="mt-3 flex flex-col gap-2">
                        {currentTickerPrice && (
                            <div className="flex justify-between items-center text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                <span>Mercado ({inv.ticker || 'ETF'})</span>
                                <span className="text-slate-800 text-sm">${currentTickerPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${rentabilidad >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                {rentabilidad >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(2)}% Rentabilidad
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${utilidad >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                <DollarSign size={12} />
                                P&L: {utilidad >= 0 ? '+' : ''}{formatMoney(utilidad, inv.moneda)}
                            </div>
                        </div>
                    </div>
                );
            }
            case 'Finca Raíz': {
                const valorizacion = montoInv > 0 ? ((utilidad / montoInv) * 100) : 0;
                return (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${valorizacion >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            <Building2 size={12} />
                            Valorización: {valorizacion >= 0 ? '+' : ''}{valorizacion.toFixed(1)}%
                        </div>
                        <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                            <DollarSign size={12} /> Valor Propiedad: {formatMoney(valorActual, inv.moneda)}
                        </div>
                    </div>
                );
            }
            case 'Negocio Propio': {
                const roi = montoInv > 0 ? ((utilidad / montoInv) * 100) : 0;
                return (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${roi >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            <Briefcase size={12} />
                            ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${utilidad >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            <DollarSign size={12} />
                            Retorno: {utilidad >= 0 ? '+' : ''}{formatMoney(utilidad, inv.moneda)}
                        </div>
                    </div>
                );
            }
            default: {
                return utilidad !== 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${rentabilidad >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(1)}% Rentabilidad
                        </span>
                    </div>
                ) : null;
            }
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
            {/* Header de la tarjeta con gradiente */}
            <div className={`bg-gradient-to-r ${config.gradient} p-4 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <IconComp size={20} className="text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-lg">{inv.concepto}</h4>
                        <p className="text-white/70 text-xs">{inv.subTipo || 'Inversión'} • {inv.fecha}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-white/60 text-xs uppercase tracking-wider">Valor Actual</p>
                    {editingValor ? (
                        <div className="flex items-center gap-1 mt-1 justify-end">
                            <input
                                type="number" value={valorEditInput}
                                onChange={e => setValorEditInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleEditValor(); if (e.key === 'Escape') { setEditingValor(false); setValorEditInput(''); } }}
                                className="w-28 px-2 py-1 rounded-lg text-sm text-right font-bold bg-white/90 text-slate-800 outline-none border-2 border-white/50 focus:border-white" autoFocus
                            />
                            <button onClick={handleEditValor} className="bg-white/25 hover:bg-white/40 text-white p-1 rounded-lg transition-all"><CheckCircle2 size={14} /></button>
                            <button onClick={() => { setEditingValor(false); setValorEditInput(''); }} className="bg-white/15 hover:bg-white/30 text-white p-1 rounded-lg transition-all"><X size={14} /></button>
                        </div>
                    ) : (
                        <>
                            <p className="font-bold text-xl text-white cursor-pointer hover:text-white/80 flex items-center justify-end gap-1.5 group"
                                onClick={() => { setEditingValor(true); setValorEditInput(valorActual.toFixed(2)); }}
                                title="Toca para editar el valor actual">
                                {formatMoney(valorActual, inv.moneda)} <Edit2 size={12} className="text-white/50 group-hover:text-white/90" />
                            </p>
                            {inv.valorManual && (
                                <button onClick={handleReactivarAuto}
                                    className="mt-0.5 text-[10px] font-semibold text-white/70 hover:text-white bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-full transition-all"
                                    title="El valor fue fijado manualmente. Toca para volver al cálculo automático.">
                                    ✎ Manual · reactivar auto
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Cuerpo de la tarjeta */}
            <div className="p-5">
                {/* Métricas principales */}
                <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Invertido</p>
                        {editingMonto ? (
                            <div className="flex items-center gap-1 mt-1 justify-center">
                                <input type="number" value={montoEditInput} onChange={e => setMontoEditInput(e.target.value)}
                                    className="w-20 px-1 py-0.5 border rounded text-sm text-center outline-none focus:border-purple-500" autoFocus />
                                <button onClick={handleEditMonto} className="bg-purple-500 text-white p-0.5 rounded"><CheckCircle2 size={12} /></button>
                            </div>
                        ) : (
                            <p className="font-bold text-purple-700 text-sm mt-1 cursor-pointer hover:text-purple-500 flex items-center justify-center gap-1"
                                onClick={() => { setEditingMonto(true); setMontoEditInput(montoInv); }}>
                                {formatMoney(montoInv, inv.moneda)} <Edit2 size={10} className="text-slate-300" />
                            </p>
                        )}
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Utilidad</p>
                        <p className={`font-bold text-sm mt-1 ${utilidad >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {utilidad >= 0 ? '+' : ''}{formatMoney(utilidad, inv.moneda)}
                        </p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Rentabilidad</p>
                        <p className={`font-bold text-sm mt-1 ${rentabilidad >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(1)}%
                        </p>
                    </div>
                </div>

                {/* Métricas especializadas por tipo */}
                {renderTypeMetrics()}

                {historyData.length > 0 && <PriceChart data={historyData} ticker={inv.ticker} />}

                {/* Badge: afecta balance */}
                <div className="mt-3 flex justify-between items-center">
                    <button
                        onClick={() => onToggleBalance(inv)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all border ${afectaBalance
                            ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                        title={afectaBalance ? 'Esta inversión se descuenta de tu saldo' : 'Esta inversión NO se descuenta de tu saldo'}
                    >
                        {afectaBalance ? <Eye size={12} /> : <EyeOff size={12} />}
                        {afectaBalance ? 'Afecta balance' : 'No afecta balance'}
                    </button>

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                        {editingUtilidad ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="number" placeholder="+/- $"
                                    value={utilidadInput} onChange={(e) => setUtilidadInput(e.target.value)}
                                    className="w-24 px-2 py-1 border rounded text-sm outline-none focus:border-emerald-500" autoFocus
                                />
                                <button onClick={handleUtilidad} className="bg-emerald-500 text-white p-1.5 rounded hover:bg-emerald-600"><CheckCircle2 size={14} /></button>
                                <button onClick={() => { setEditingUtilidad(false); setUtilidadInput(''); }} className="bg-slate-200 text-slate-600 p-1.5 rounded hover:bg-slate-300"><X size={14} /></button>
                            </div>
                        ) : (
                            <button onClick={() => setEditingUtilidad(true)}
                                className="flex items-center gap-1 text-emerald-600 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-all font-medium">
                                <DollarSign size={13} /> Utilidad
                            </button>
                        )}
                        <button onClick={() => onDelete(inv.id)} className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-all">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InvestmentPortfolio = ({ transacciones, totalInvertido, genericAdd, genericUpdate, genericDelete, prefillData, setPrefillData, activeTab, pendingBudgetId, setPendingBudgetId, setActiveTab }) => {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [tipoInv, setTipoInv] = useState(TIPOS_INVERSION[0]);
    const [afectaBalance, setAfectaBalance] = useState(true);
    const [tasaInteres, setTasaInteres] = useState('');
    const [ticker, setTicker] = useState('');
    const [moneda, setMoneda] = useState('COP');
    const esBolsaOCripto = (tipoInv === 'Acciones / Bolsa' || tipoInv === 'Criptomonedas');

    useEffect(() => {
        if (prefillData && activeTab === 'inversiones') {
            setConcepto(prefillData.concepto);
            setMonto(prefillData.monto);
            setPrefillData(null);
        }
    }, [prefillData, activeTab, setPrefillData]);

    const registrarInversion = async (e) => {
        e.preventDefault();
        
        // Si la inversión es en USD, NO debe afectar el saldo en COP (evita mezclar monedas)
        const monedaFinal = esBolsaOCripto ? moneda : 'COP';
        const afectaFinal = monedaFinal === 'USD' ? false : afectaBalance;

        const dataInversion = {
            tipo: afectaFinal ? 'gasto' : 'inversion_patrimonio',
            esInversion: true,
            afectaBalance: afectaFinal,
            moneda: monedaFinal,
            monto: parseFloat(monto),
            concepto,
            categoria: 'Aporte Inversión',
            subTipo: tipoInv,
            fecha: dateKey(),
            createdAt: new Date().toISOString(),
            utilidad: 0
        };

        if (tipoInv === 'Fondo de Emergencia' || tipoInv === 'CDT / Renta Fija') {
            dataInversion.tasaInteres = parseFloat(tasaInteres) || 9;
        } else if (tipoInv === 'Acciones / Bolsa' || tipoInv === 'Criptomonedas') {
            dataInversion.ticker = ticker.toUpperCase().trim();
        }

        await genericAdd('transacciones', dataInversion);

        if (pendingBudgetId) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            await genericUpdate('presupuesto', pendingBudgetId, { lastPaid: currentMonth });
            setPendingBudgetId(null);
            setActiveTab('presupuesto');
        }
        setConcepto(''); setMonto(''); setAfectaBalance(true); setTasaInteres(''); setTicker(''); setMoneda('COP');
    };

    const registrarUtilidad = async (inv, utilidadInput) => {
        if (!utilidadInput) return;
        const nuevaUtilidad = (Number(inv.utilidad) || 0) + parseFloat(utilidadInput);
        await genericUpdate('transacciones', inv.id, { utilidad: nuevaUtilidad });
    };

    const toggleBalance = async (inv) => {
        const nuevoAfecta = inv.afectaBalance === false ? true : false;
        const nuevoTipo = nuevoAfecta ? 'gasto' : 'inversion_patrimonio';
        await genericUpdate('transacciones', inv.id, { afectaBalance: nuevoAfecta, tipo: nuevoTipo });
    };

    const inversionesList = transacciones.filter(t => t.categoria === 'Aporte Inversión' || t.esInversion === true);

    // Calcular totales
    const totalUtilidad = inversionesList.reduce((acc, inv) => acc + (Number(inv.utilidad) || 0), 0);
    const totalEnBalance = inversionesList.filter(i => i.afectaBalance !== false).reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const totalPatrimonio = inversionesList.reduce((a, c) => a + (Number(c.monto) || 0) + (Number(c.utilidad) || 0), 0);

    // Calcular gastos mensuales promedio (para fondo de emergencia)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const gastosDelMes = transacciones
        .filter(t => t.tipo === 'gasto' && !t.esInversion && t.fecha && t.fecha.startsWith(currentMonth))
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const totalGastosMensuales = gastosDelMes || 0;

    // Agrupar por tipo
    const grouped = {};
    inversionesList.forEach(inv => {
        const tipo = inv.subTipo || 'Otro';
        if (!grouped[tipo]) grouped[tipo] = [];
        grouped[tipo].push(inv);
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header con métricas */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white p-8 rounded-3xl shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">Portafolio de Inversiones</h2>
                        <p className="text-purple-200">Construyendo tu patrimonio.</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div className="text-center md:text-right">
                            <p className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">Invertido Total</p>
                            <h3 className="text-xl font-bold">{formatCurrency(totalInvertido)}</h3>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">En Balance</p>
                            <h3 className="text-xl font-bold text-blue-300">{formatCurrency(totalEnBalance)}</h3>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">Utilidad</p>
                            <h3 className={`text-xl font-bold ${totalUtilidad >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {totalUtilidad >= 0 ? '+' : ''}{formatCurrency(totalUtilidad)}
                            </h3>
                        </div>
                        <div className="text-center md:text-right bg-white/10 px-5 py-2 rounded-xl">
                            <p className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">Patrimonio</p>
                            <h3 className="text-2xl font-extrabold">{formatCurrency(totalPatrimonio)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Formulario */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-xl text-purple-700 mb-4 flex items-center gap-2"><PieChart className="w-6 h-6" /> Nueva Inversión</h3>
                {pendingBudgetId && <div className="bg-purple-50 text-purple-700 p-2 rounded-lg mb-3 text-sm font-medium">✓ Desde Presupuesto</div>}
                <form onSubmit={registrarInversion} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                        <input placeholder="Ej: Bitcoin, Apartamento" value={concepto} onChange={e => setConcepto(e.target.value)}
                            className="w-full px-4 py-2.5 border rounded-xl focus:border-purple-500 outline-none transition-colors" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto</label>
                        <input type="number" placeholder="$ 0" value={monto} onChange={e => setMonto(e.target.value)}
                            className="w-full px-4 py-2.5 border rounded-xl focus:border-purple-500 outline-none transition-colors" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                        <select value={tipoInv} onChange={e => setTipoInv(e.target.value)}
                            className="w-full px-4 py-2.5 border rounded-xl focus:border-purple-500 outline-none bg-white transition-colors">
                            {TIPOS_INVERSION.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {(tipoInv === 'Fondo de Emergencia' || tipoInv === 'CDT / Renta Fija') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">EA (%)</label>
                            <input type="number" placeholder="Ej: 9" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)}
                                className="w-full px-4 py-2.5 border rounded-xl focus:border-purple-500 outline-none transition-colors" required />
                        </div>
                    )}
                    {esBolsaOCripto && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ticker</label>
                            <input placeholder="Ej: SPY, TSLA" value={ticker} onChange={e => setTicker(e.target.value)}
                                className="w-full px-4 py-2.5 border rounded-xl focus:border-purple-500 outline-none transition-colors" required />
                        </div>
                    )}
                    {esBolsaOCripto && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Moneda</label>
                            <div className="flex rounded-xl border overflow-hidden">
                                <button type="button" onClick={() => setMoneda('USD')}
                                    className={`flex-1 py-2.5 text-sm font-bold transition-colors ${moneda === 'USD' ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                    USD
                                </button>
                                <button type="button" onClick={() => setMoneda('COP')}
                                    className={`flex-1 py-2.5 text-sm font-bold transition-colors border-l ${moneda === 'COP' ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                    COP
                                </button>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">¿Afecta saldo?</label>
                        {esBolsaOCripto && moneda === 'USD' ? (
                            <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-sm font-medium">
                                <ToggleLeft size={20} /> Patrimonio (USD)
                            </div>
                        ) : (
                            <button type="button" onClick={() => setAfectaBalance(!afectaBalance)}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium transition-all ${afectaBalance
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                    : 'bg-slate-50 border-slate-300 text-slate-500 hover:bg-slate-100'
                                    }`}>
                                {afectaBalance ? <ToggleRight size={20} className="text-blue-600" /> : <ToggleLeft size={20} />}
                                {afectaBalance ? 'Sí, descuenta' : 'No, es patrimonio'}
                            </button>
                        )}
                    </div>
                    <button type="submit" className="bg-purple-600 text-white py-2.5 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-sm hover:shadow-md">
                        Registrar
                    </button>
                </form>
                {!afectaBalance && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-start gap-2">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>Esta inversión <strong>no se restará</strong> de tu saldo disponible. Ideal para propiedades, inversiones a largo plazo o activos que ya no representan efectivo.</span>
                    </div>
                )}
            </div>

            {/* Inversiones agrupadas por tipo */}
            {inversionesList.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                    <PieChart size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Aún no tienes inversiones registradas.</p>
                    <p className="text-slate-400 text-sm mt-1">Usa el formulario de arriba para agregar tu primera inversión.</p>
                </div>
            ) : (
                Object.entries(grouped).map(([tipo, inversiones]) => {
                    const tipoConfig = INVERSION_CONFIG[tipo] || INVERSION_CONFIG['CDT / Renta Fija'];
                    const TipoIcon = tipoConfig.icon;
                    const totalTipo = inversiones.reduce((a, c) => a + (Number(c.monto) || 0), 0);
                    const utilTipo = inversiones.reduce((a, c) => a + (Number(c.utilidad) || 0), 0);

                    return (
                        <div key={tipo} className="space-y-4">
                            {/* Header de categoría */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl bg-gradient-to-r ${tipoConfig.gradient} text-white`}>
                                        <TipoIcon size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{tipo}</h3>
                                        <p className="text-xs text-slate-400">{inversiones.length} inversión{inversiones.length > 1 ? 'es' : ''}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 text-right">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">Capital</p>
                                        <p className="font-bold text-sm text-slate-700">{formatCurrency(totalTipo)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">Utilidad</p>
                                        <p className={`font-bold text-sm ${utilTipo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {utilTipo >= 0 ? '+' : ''}{formatCurrency(utilTipo)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Cards de inversiones */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {inversiones.map(inv => (
                                    <InvestmentCard
                                        key={inv.id}
                                        inv={inv}
                                        onRegistrarUtilidad={registrarUtilidad}
                                        onDelete={(id) => genericDelete('transacciones', id)}
                                        onToggleBalance={toggleBalance}
                                        genericUpdate={genericUpdate}
                                        totalGastosMensuales={totalGastosMensuales}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};


const DebtManager = ({ deudas, genericAdd, genericUpdate }) => {
    const [nombre, setNombre] = useState('');
    const [montoTotal, setMontoTotal] = useState('');
    const [cuotas, setCuotas] = useState('');

    const agregarDeudaHandler = async (e) => {
        e.preventDefault();
        if (!nombre || !montoTotal) return;
        await genericAdd('deudas', { nombre, montoTotal: parseFloat(montoTotal), montoPagado: 0, cuotas });
        setNombre(''); setMontoTotal(''); setCuotas('');
    };

    const registrarPagoDeuda = async (deuda, montoPago) => {
        if (!montoPago || montoPago <= 0) return;
        await genericUpdate('deudas', deuda.id, { montoPagado: deuda.montoPagado + parseFloat(montoPago) });
        await genericAdd('transacciones', { tipo: 'gasto', monto: parseFloat(montoPago), concepto: `Abono Deuda: ${deuda.nombre}`, categoria: 'Pago de Deudas', fecha: dateKey(), createdAt: new Date().toISOString() });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h3 className="font-bold text-xl text-rose-600 mb-4 flex items-center gap-2"><CreditCard className="w-6 h-6" /> Nueva Deuda</h3>
                <form onSubmit={agregarDeudaHandler} className="space-y-4">
                    <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-rose-500" required />
                    <input type="number" placeholder="Monto Total" value={montoTotal} onChange={e => setMontoTotal(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-rose-500" required />
                    <input type="text" placeholder="Cuotas (Opcional)" value={cuotas} onChange={e => setCuotas(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:border-rose-500" />
                    <button type="submit" className="w-full bg-rose-600 text-white py-2 rounded-lg font-bold hover:bg-rose-700">Registrar Deuda</button>
                </form>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 gap-4">
                {deudas.map(deuda => <DeudaItem key={deuda.id} deuda={deuda} onAbonar={registrarPagoDeuda} />)}
                {deudas.length === 0 && <p className="text-center text-slate-400 mt-10">No tienes deudas. ¡Excelente!</p>}
            </div>
        </div>
    );
};

const GoalTracker = ({ metas, genericAdd, genericUpdate, genericDelete }) => {
    const [viewMode, setViewMode] = useState('financieras'); // 'financieras' | 'personales'

    // Estados Financieras
    const [nombre, setNombre] = useState('');
    const [montoObjetivo, setMontoObjetivo] = useState('');
    const [plazo, setPlazo] = useState('corto');
    const [ahorroActual, setAhorroActual] = useState('');
    // Vincular meta personal a una meta financiera (opcional)
    const [metaFinancieraId, setMetaFinancieraId] = useState('');

    // Lista de metas financieras (para el selector de vínculo)
    const metasFinancieras = metas.filter(m => m.tipo === 'financiera' || !m.tipo);

    const agregarMetaHandler = async (e) => {
        e.preventDefault();
        // Si es meta personal, no requiere monto
        const isPersonal = viewMode === 'personales';

        await genericAdd('metas', {
            nombre,
            plazo,
            tipo: isPersonal ? 'personal' : 'financiera',
            // Campos exclusivos financieras
            montoObjetivo: isPersonal ? 0 : parseFloat(montoObjetivo),
            ahorroActual: isPersonal ? 0 : parseFloat(ahorroActual || 0),
            // Campos exclusivos personales
            completada: false,
            checklist: [],
            metaFinancieraId: isPersonal ? (metaFinancieraId || null) : null
        });

        setNombre(''); setMontoObjetivo(''); setAhorroActual(''); setMetaFinancieraId('');
    };

    // --- Checklist (avances) de una meta ---
    const addChecklistItem = async (meta, texto) => {
        if (!texto.trim()) return;
        const lista = meta.checklist || [];
        await genericUpdate('metas', meta.id, { checklist: [...lista, { texto: texto.trim(), completado: false }] });
    };

    const toggleChecklistItem = async (meta, index) => {
        const lista = (meta.checklist || []).slice();
        if (!lista[index]) return;
        lista[index] = { ...lista[index], completado: !lista[index].completado };
        await genericUpdate('metas', meta.id, { checklist: lista });
    };

    const deleteChecklistItem = async (meta, index) => {
        const lista = (meta.checklist || []).filter((_, i) => i !== index);
        await genericUpdate('metas', meta.id, { checklist: lista });
    };

    // Marca / desmarca un día como cumplido en el registro diario de la meta.
    const toggleDiaCumplido = async (meta, fechaKey) => {
        const dias = meta.registroDias || [];
        const nuevos = dias.includes(fechaKey)
            ? dias.filter(d => d !== fechaKey)
            : [...dias, fechaKey].sort();
        await genericUpdate('metas', meta.id, { registroDias: nuevos });
    };

    // Activa / desactiva el seguimiento diario para esa meta (no borra el historial).
    const toggleSeguimientoDiario = async (meta) => {
        const activo = meta.seguimientoDiario === true
            || (meta.seguimientoDiario === undefined && (meta.registroDias || []).length > 0);
        await genericUpdate('metas', meta.id, { seguimientoDiario: !activo });
    };

    // Vincular / desvincular una meta financiera a una meta personal
    const linkMetaFinanciera = async (meta, id) => {
        await genericUpdate('metas', meta.id, { metaFinancieraId: id || null });
    };

    const actualizarAhorro = async (meta, monto) => {
        if (!monto) return;
        const actual = Number(meta.ahorroActual) || 0;
        await genericUpdate('metas', meta.id, { ahorroActual: actual + parseFloat(monto) });
    };

    const toggleCompletada = async (meta) => {
        await genericUpdate('metas', meta.id, { completada: !meta.completada });
    };

    // Funciones para manejar notas
    const addNote = async (meta, texto) => {
        const nuevaNota = {
            texto,
            fecha: new Date().toISOString()
        };
        const notasActuales = meta.notas || [];
        await genericUpdate('metas', meta.id, { notas: [...notasActuales, nuevaNota] });
    };

    const deleteNote = async (meta, index) => {
        const notasActuales = meta.notas || [];
        const nuevasNotas = notasActuales.filter((_, i) => i !== index);
        await genericUpdate('metas', meta.id, { notas: nuevasNotas });
    };

    // Filtrar metas según la pestaña activa
    // Nota: Las metas antiguas (sin tipo) se asumen como financieras
    const metasFiltradas = metas.filter(m => {
        if (viewMode === 'financieras') return m.tipo === 'financiera' || !m.tipo;
        return m.tipo === 'personal';
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Toggle de Vistas */}
            <div className="flex p-1 bg-slate-200 rounded-lg w-full md:w-fit mx-auto md:mx-0 mb-6">
                <button
                    onClick={() => setViewMode('financieras')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex-1 md:flex-none flex items-center justify-center gap-2 ${viewMode === 'financieras' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Coins size={16} /> Financieras
                </button>
                <button
                    onClick={() => setViewMode('personales')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex-1 md:flex-none flex items-center justify-center gap-2 ${viewMode === 'personales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Sparkles size={16} /> Personales
                </button>
            </div>

            <div className={`p-8 rounded-3xl text-white shadow-lg transition-colors duration-500 ${viewMode === 'financieras' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-indigo-600 to-purple-700'}`}>
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">
                            {viewMode === 'financieras' ? 'Metas de Ahorro' : 'Propósitos de Vida'}
                        </h2>
                        <p className="text-blue-100 opacity-90">
                            {viewMode === 'financieras' ? 'Ahorra para lo que realmente importa.' : 'Aprender, viajar, crecer. ¡Tú puedes!'}
                        </p>
                    </div>
                    <form onSubmit={agregarMetaHandler} className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 w-full md:w-auto min-w-[300px]">
                        <h4 className="font-bold mb-3 flex items-center gap-2">
                            <Target className="w-5 h-5" /> Nueva Meta {viewMode === 'personales' ? 'Personal' : ''}
                        </h4>
                        <div className="space-y-3">
                            <input required placeholder="Nombre (Ej: Viaje a Europa)" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-black/20 border-0 rounded-lg px-3 py-2 text-white placeholder:text-blue-200 focus:ring-1 focus:ring-white" />

                            {viewMode === 'financieras' && (
                                <div className="flex gap-2">
                                    <input required type="number" placeholder="Objetivo ($)" value={montoObjetivo} onChange={e => setMontoObjetivo(e.target.value)} className="w-1/2 bg-black/20 border-0 rounded-lg px-3 py-2 text-white placeholder:text-blue-200" />
                                    <input type="number" placeholder="Inicio ($)" value={ahorroActual} onChange={e => setAhorroActual(e.target.value)} className="w-1/2 bg-black/20 border-0 rounded-lg px-3 py-2 text-white placeholder:text-blue-200" />
                                </div>
                            )}

                            {viewMode === 'personales' && metasFinancieras.length > 0 && (
                                <select value={metaFinancieraId} onChange={e => setMetaFinancieraId(e.target.value)} className="w-full bg-black/20 border-0 rounded-lg px-3 py-2 text-white">
                                    <option value="" className="text-slate-800">Vincular ahorro (opcional)…</option>
                                    {metasFinancieras.map(mf => <option key={mf.id} value={mf.id} className="text-slate-800">💰 {mf.nombre}</option>)}
                                </select>
                            )}

                            <select value={plazo} onChange={e => setPlazo(e.target.value)} className="w-full bg-black/20 border-0 rounded-lg px-3 py-2 text-white">
                                {PLAZOS_METAS.map(p => <option key={p.value} value={p.value} className="text-slate-800">{p.label}</option>)}
                            </select>

                            <button type="submit" className="w-full bg-white text-blue-900 font-bold py-2 rounded-lg hover:bg-blue-50 transition-colors">
                                {viewMode === 'financieras' ? 'Crear Plan de Ahorro' : 'Guardar Propósito'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metasFiltradas.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        No hay metas {viewMode} registradas aún.
                    </div>
                ) : (
                    metasFiltradas.map(meta => (
                        <MetaItem
                            key={meta.id}
                            meta={meta}
                            metasFinancieras={metasFinancieras}
                            onAhorrar={actualizarAhorro}
                            onToggleCompletada={toggleCompletada}
                            onDelete={(id) => genericDelete('metas', id)}
                            onAddNote={addNote}
                            onDeleteNote={deleteNote}
                            onAddChecklistItem={addChecklistItem}
                            onToggleChecklistItem={toggleChecklistItem}
                            onDeleteChecklistItem={deleteChecklistItem}
                            onLinkMetaFinanciera={linkMetaFinanciera}
                            onToggleDia={toggleDiaCumplido}
                            onToggleSeguimiento={toggleSeguimientoDiario}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// =============================================
// === HELPERS: FECHAS / HÁBITOS / PAGOS ===
// =============================================

// Clave de fecha local YYYY-MM-DD (sin desfase de zona horaria).
const dateKey = (d = new Date()) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Racha de días consecutivos cumplidos (incluye hoy o, si hoy aún no, desde ayer).
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

// Próxima fecha de pago a partir de un día del mes (1-31). Devuelve {fecha, dias}.
const proximaFechaPago = (diaPago) => {
    const dia = Number(diaPago);
    if (!dia || dia < 1 || dia > 31) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    let candidato = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
    if (candidato < hoy) candidato = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);
    const dias = Math.round((candidato - hoy) / (1000 * 60 * 60 * 24));
    return { fecha: candidato, dias };
};

const HABIT_GRADIENTS = {
    cyan: 'from-cyan-500 to-sky-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    indigo: 'from-indigo-500 to-violet-600',
    rose: 'from-rose-500 to-pink-600',
};
const HABIT_EMOJIS = ['💧', '🏃', '🧘', '📚', '💪', '🚭', '🥗', '😴', '🙏', '✍️', '☀️', '🧠'];
const MOODS = [
    { v: 1, e: '😣', label: 'Muy mal' },
    { v: 2, e: '😕', label: 'Mal' },
    { v: 3, e: '😐', label: 'Normal' },
    { v: 4, e: '🙂', label: 'Bien' },
    { v: 5, e: '😄', label: 'Genial' },
];

// =============================================
// === COMPONENTE: HÁBITOS (RASTREADOR) ===
// =============================================
const HabitTracker = ({ habitos, genericAdd, genericUpdate, genericDelete }) => {
    const [nombre, setNombre] = useState('');
    const [emoji, setEmoji] = useState(HABIT_EMOJIS[0]);
    const [color, setColor] = useState('cyan');

    const hoy = dateKey();

    const agregarHabito = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await genericAdd('habitos', {
            nombre: nombre.trim(),
            emoji,
            color,
            historial: [],
            createdAt: new Date().toISOString(),
        });
        setNombre(''); setEmoji(HABIT_EMOJIS[0]); setColor('cyan');
    };

    const toggleHoy = async (h) => {
        const set = new Set(h.historial || []);
        if (set.has(hoy)) set.delete(hoy); else set.add(hoy);
        await genericUpdate('habitos', h.id, { historial: Array.from(set) });
    };

    // Últimos 7 días (de más antiguo a hoy)
    const ultimos7 = () => {
        const arr = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            arr.push(dateKey(d));
        }
        return arr;
    };
    const dias7 = ultimos7();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white p-8 rounded-3xl shadow-lg">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-2"><Flame /> Mis Hábitos</h2>
                <p className="text-cyan-100">Pequeñas acciones diarias construyen grandes cambios. Marca cada día. 🔥</p>
            </div>

            {/* Formulario */}
            <form onSubmit={agregarHabito} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-bold text-lg text-slate-700">Nuevo hábito</h3>
                <div className="flex flex-col md:flex-row gap-3">
                    <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Tomar 2L de agua, Leer 20 min"
                        className="flex-1 px-4 py-2.5 border rounded-xl outline-none focus:border-cyan-500" required />
                    <button type="submit" className="bg-cyan-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-cyan-700">Crear</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {HABIT_EMOJIS.map(em => (
                        <button type="button" key={em} onClick={() => setEmoji(em)}
                            className={`w-9 h-9 rounded-lg text-lg transition-all ${emoji === em ? 'bg-cyan-100 ring-2 ring-cyan-400 scale-110' : 'bg-slate-50 hover:bg-slate-100'}`}>
                            {em}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    {Object.keys(HABIT_GRADIENTS).map(c => (
                        <button type="button" key={c} onClick={() => setColor(c)}
                            className={`w-8 h-8 rounded-full bg-gradient-to-r ${HABIT_GRADIENTS[c]} transition-all ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`} />
                    ))}
                </div>
            </form>

            {/* Lista de hábitos */}
            {habitos.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Flame size={42} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Aún no tienes hábitos. ¡Crea el primero!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {habitos.map(h => {
                        const set = new Set(h.historial || []);
                        const hechoHoy = set.has(hoy);
                        const streak = calcStreak(h.historial);
                        const grad = HABIT_GRADIENTS[h.color] || HABIT_GRADIENTS.cyan;
                        return (
                            <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${grad} flex items-center justify-center text-xl shadow-sm`}>{h.emoji || '⭐'}</div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{h.nombre}</h4>
                                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                                <Flame size={12} className="text-orange-500" /> {streak} día{streak !== 1 ? 's' : ''} de racha
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => genericDelete('habitos', h.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={16} /></button>
                                </div>
                                {/* Mini grid 7 días */}
                                <div className="flex items-center justify-between gap-1 mb-3">
                                    {dias7.map(dk => {
                                        const done = set.has(dk);
                                        const esHoy = dk === hoy;
                                        const dow = new Date(`${dk}T00:00:00`).toLocaleDateString('es-CO', { weekday: 'narrow' });
                                        return (
                                            <div key={dk} className="flex flex-col items-center gap-1 flex-1">
                                                <span className="text-[9px] text-slate-400 uppercase">{dow}</span>
                                                <div className={`w-full h-7 rounded-md flex items-center justify-center text-xs ${done ? `bg-gradient-to-r ${grad} text-white` : 'bg-slate-100 text-slate-300'} ${esHoy ? 'ring-2 ring-offset-1 ring-cyan-400' : ''}`}>
                                                    {done ? '✓' : ''}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button onClick={() => toggleHoy(h)}
                                    className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${hechoHoy
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                        : `bg-gradient-to-r ${grad} text-white shadow-sm hover:opacity-90`}`}>
                                    {hechoHoy ? <><CheckCircle2 size={18} /> Hecho hoy</> : <>Marcar hoy</>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// =============================================
// === COMPONENTE: MI DÍA (DASHBOARD DIARIO) ===
// =============================================
const MiDia = ({ user, habitos, diario, transacciones, presupuestoItems, saldoActual, googleToken, genericAdd, genericUpdate, setActiveTab }) => {
    const [eventos, setEventos] = useState([]);
    const [gtareas, setGtareas] = useState([]);
    const [moodTexto, setMoodTexto] = useState('');

    const hoy = dateKey();
    const ahora = new Date();
    const hora = ahora.getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    const nombre = (user?.displayName || '').split(' ')[0] || '';
    const fechaLarga = ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

    // Eventos de Google de hoy
    useEffect(() => {
        if (!googleToken) return;
        const fetchHoy = async () => {
            try {
                const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
                const fin = new Date(); fin.setHours(23, 59, 59, 999);
                const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${inicio.toISOString()}&timeMax=${fin.toISOString()}&singleEvents=true&orderBy=startTime`, {
                    headers: { Authorization: `Bearer ${googleToken}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                setEventos(data.items || []);
            } catch (e) { /* sin conexión */ }
        };
        const fetchTareas = async () => {
            try {
                const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=10', {
                    headers: { Authorization: `Bearer ${googleToken}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                setGtareas((data.items || []).slice(0, 5));
            } catch (e) { /* sin conexión */ }
        };
        fetchHoy();
        fetchTareas();
    }, [googleToken]);

    // Marca una tarea de Google como completada.
    const completarGtarea = async (t) => {
        if (!googleToken) return;
        setGtareas(prev => prev.filter(x => x.id !== t.id));
        try {
            await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${t.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
            });
        } catch (e) { /* sin conexión */ }
    };

    // Pagos próximos (≤7 días, no pagados este ciclo)
    const cicloActual = new Date().toISOString().slice(0, 7);
    const pagosProximos = presupuestoItems
        .map(i => ({ ...i, prox: proximaFechaPago(i.diaPago) }))
        .filter(i => i.prox && i.prox.dias <= 7 && i.lastPaid !== cicloActual)
        .sort((a, b) => a.prox.dias - b.prox.dias);

    // Finanzas de hoy
    const gastoHoy = transacciones
        .filter(t => t.tipo === 'gasto' && !t.esInversion && t.fecha === hoy)
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);

    // Hábitos de hoy
    const toggleHabitoHoy = async (h) => {
        const set = new Set(h.historial || []);
        if (set.has(hoy)) set.delete(hoy); else set.add(hoy);
        await genericUpdate('habitos', h.id, { historial: Array.from(set) });
    };
    const habitosHechos = habitos.filter(h => (h.historial || []).includes(hoy)).length;

    // Diario de hoy
    const entradaHoy = diario.find(d => d.fecha === hoy);
    const guardarMood = async (v) => {
        if (entradaHoy) {
            await genericUpdate('diario', entradaHoy.id, { animo: v, texto: moodTexto || entradaHoy.texto || '' });
        } else {
            await genericAdd('diario', { fecha: hoy, animo: v, texto: moodTexto, createdAt: new Date().toISOString() });
        }
    };
    const guardarTextoDiario = async () => {
        if (!moodTexto.trim() && !entradaHoy) return;
        if (entradaHoy) {
            await genericUpdate('diario', entradaHoy.id, { texto: moodTexto });
        } else {
            await genericAdd('diario', { fecha: hoy, animo: 3, texto: moodTexto, createdAt: new Date().toISOString() });
        }
        setMoodTexto('');
    };

    const fmtHoraEvento = (ev) => {
        const dt = ev.start?.dateTime;
        if (!dt) return 'Todo el día';
        return new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Saludo */}
            <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white p-8 rounded-3xl shadow-lg">
                <div className="flex items-center gap-2 text-blue-100 text-sm font-medium mb-1"><Sun size={16} /> {fechaLarga}</div>
                <h2 className="text-3xl font-bold">{saludo}{nombre ? `, ${nombre}` : ''} 👋</h2>
                <div className="flex flex-wrap gap-3 mt-4">
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                        <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Saldo</p>
                        <p className="font-bold text-lg">{formatCurrency(saldoActual)}</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                        <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Gastado hoy</p>
                        <p className="font-bold text-lg">{formatCurrency(gastoHoy)}</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                        <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Hábitos</p>
                        <p className="font-bold text-lg">{habitosHechos}/{habitos.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pagos próximos */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><CalendarClock size={18} className="text-rose-500" /> Pagos próximos</h3>
                    {pagosProximos.length === 0 ? (
                        <p className="text-sm text-slate-400">Nada por pagar en los próximos 7 días. 🎉</p>
                    ) : (
                        <div className="space-y-2">
                            {pagosProximos.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50">
                                    <div>
                                        <p className="font-semibold text-sm text-slate-700">{p.concepto}</p>
                                        <p className={`text-xs font-medium ${p.prox.dias === 0 ? 'text-rose-600' : p.prox.dias <= 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {p.prox.dias === 0 ? '¡Vence hoy!' : p.prox.dias === 1 ? 'Mañana' : `En ${p.prox.dias} días`}
                                        </p>
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(p.monto)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Agenda de hoy: eventos + tareas */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Calendar size={18} className="text-indigo-500" /> Tu día</h3>
                    {!googleToken ? (
                        <p className="text-sm text-slate-400">Conecta Google en la pestaña Agenda para ver tus eventos y tareas aquí.</p>
                    ) : eventos.length === 0 && gtareas.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin eventos ni tareas pendientes.</p>
                    ) : (
                        <div className="space-y-2">
                            {eventos.map(ev => (
                                <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50">
                                    <span className="text-xs font-bold text-indigo-600 w-14 flex-shrink-0">{fmtHoraEvento(ev)}</span>
                                    <span className="text-sm text-slate-700 truncate">{ev.summary || '(sin título)'}</span>
                                </div>
                            ))}
                            {gtareas.map(t => (
                                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                                    <button onClick={() => completarGtarea(t)} className="text-slate-300 hover:text-emerald-500"><Circle size={16} /></button>
                                    <span className="text-sm text-slate-700 truncate flex-1">{t.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={() => setActiveTab('agenda')} className="text-xs text-indigo-600 font-bold mt-3 hover:underline">Ver agenda completa →</button>
                </div>
            </div>

            {/* Hábitos rápidos */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Flame size={18} className="text-orange-500" /> Hábitos de hoy</h3>
                    <button onClick={() => setActiveTab('habitos')} className="text-xs text-cyan-600 font-bold hover:underline">Gestionar →</button>
                </div>
                {habitos.length === 0 ? (
                    <p className="text-sm text-slate-400">Crea hábitos para llevar tus rutinas. <button onClick={() => setActiveTab('habitos')} className="text-cyan-600 font-bold">Empezar</button></p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {habitos.map(h => {
                            const done = (h.historial || []).includes(hoy);
                            const grad = HABIT_GRADIENTS[h.color] || HABIT_GRADIENTS.cyan;
                            return (
                                <button key={h.id} onClick={() => toggleHabitoHoy(h)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${done ? `bg-gradient-to-r ${grad} text-white border-transparent` : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                    <span>{h.emoji || '⭐'}</span> {h.nombre} {done && <CheckCircle2 size={14} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Diario / estado de ánimo */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><BookOpen size={18} className="text-purple-500" /> ¿Cómo te sientes hoy?</h3>
                <div className="flex gap-2 mb-3">
                    {MOODS.map(m => (
                        <button key={m.v} onClick={() => guardarMood(m.v)} title={m.label}
                            className={`flex-1 py-3 rounded-xl text-2xl transition-all ${entradaHoy?.animo === m.v ? 'bg-purple-100 ring-2 ring-purple-400 scale-105' : 'bg-slate-50 hover:bg-slate-100'}`}>
                            {m.e}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input value={moodTexto} onChange={e => setMoodTexto(e.target.value)} placeholder={entradaHoy?.texto || 'Una nota del día (opcional)…'}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarTextoDiario(); } }}
                        className="flex-1 px-3 py-2 border rounded-xl text-sm outline-none focus:border-purple-500" />
                    <button onClick={guardarTextoDiario} className="bg-purple-600 text-white px-4 rounded-xl hover:bg-purple-700"><Save size={16} /></button>
                </div>
                {/* Últimas entradas */}
                {diario.length > 0 && (
                    <div className="mt-4 flex gap-1.5 flex-wrap">
                        {diario.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 14).map(d => {
                            const mood = MOODS.find(m => m.v === d.animo);
                            return <span key={d.id} title={`${d.fecha}${d.texto ? ': ' + d.texto : ''}`} className="text-lg">{mood?.e || '😐'}</span>;
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// =============================================
// === RUTINA SEMANAL (calendario de rutinas) ===
// =============================================

// Días en orden visual Lun→Dom; id sigue la convención de Date.getDay() (0=Dom).
const DIAS_SEMANA = [
    { id: 1, label: 'Lunes', corto: 'L' },
    { id: 2, label: 'Martes', corto: 'M' },
    { id: 3, label: 'Miércoles', corto: 'X' },
    { id: 4, label: 'Jueves', corto: 'J' },
    { id: 5, label: 'Viernes', corto: 'V' },
    { id: 6, label: 'Sábado', corto: 'S' },
    { id: 0, label: 'Domingo', corto: 'D' },
];

// Clases completas (no interpolar: el JIT de Tailwind necesita verlas literales).
const RUTINA_COLORS = {
    amarillo: { bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-400' },
    verde: { bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-400' },
    azul: { bg: 'bg-sky-100', border: 'border-sky-200', text: 'text-sky-800', dot: 'bg-sky-400' },
    morado: { bg: 'bg-violet-100', border: 'border-violet-200', text: 'text-violet-800', dot: 'bg-violet-400' },
    rosa: { bg: 'bg-pink-100', border: 'border-pink-200', text: 'text-pink-800', dot: 'bg-pink-400' },
    naranja: { bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400' },
    gris: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const RUTINA_EMOJIS = ['🌅', '💧', '🏋️', '🧘', '🏃', '🍳', '💻', '🥗', '🚶', '📊', '📚', '🎓', '🎸', '☕', '💪', '🍽️', '📝', '📖', '✅', '🌙', '😴', '📌'];

const horaToMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// La grilla cubre 05:00–23:00 en pasos de 30 min: fila 1 = header, filas 2..37 = slots.
const RUTINA_MIN_INICIO = 5 * 60;
const RUTINA_MIN_FIN = 23 * 60;
const rowFromHora = (hhmm) => {
    const min = Math.min(Math.max(horaToMin(hhmm), RUTINA_MIN_INICIO), RUTINA_MIN_FIN);
    return (min - RUTINA_MIN_INICIO) / 30 + 2;
};

// Opciones de hora en pasos de 30 min para los selects del editor.
const HORAS_RUTINA = [];
for (let m = RUTINA_MIN_INICIO; m <= RUTINA_MIN_FIN; m += 30) {
    HORAS_RUTINA.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}

// Plantilla inicial basada en el "Plan Semanal de Alto Rendimiento" del usuario.
const PLANTILLA_RUTINA = [
    { titulo: 'Levantarse + Agua', emoji: '🌅', color: 'amarillo', dias: [1, 2, 3, 4, 5], horaInicio: '05:30', horaFin: '06:30' },
    { titulo: 'Gimnasio (Fuerza)', emoji: '🏋️', color: 'verde', dias: [1, 3, 5], horaInicio: '06:30', horaFin: '07:30' },
    { titulo: 'Movilidad + Caminata', emoji: '🧘', color: 'verde', dias: [2], horaInicio: '06:30', horaFin: '07:30' },
    { titulo: 'Cardio (Correr/Bici)', emoji: '🏃', color: 'verde', dias: [4], horaInicio: '06:30', horaFin: '07:30' },
    { titulo: 'Desayuno saludable', emoji: '🍳', color: 'naranja', dias: [1, 2, 3, 4, 5], horaInicio: '07:30', horaFin: '08:00' },
    { titulo: 'Trabajo Profundo', emoji: '💻', color: 'azul', dias: [1, 2, 3, 4, 5], horaInicio: '08:00', horaFin: '12:00' },
    { titulo: 'Almuerzo + Caminata', emoji: '🥗', color: 'naranja', dias: [1, 2, 3, 4, 5], horaInicio: '12:00', horaFin: '13:00' },
    { titulo: 'Trabajo / Reuniones', emoji: '📊', color: 'azul', dias: [1, 2, 3, 4, 5], horaInicio: '13:00', horaFin: '17:30' },
    { titulo: 'Lectura Técnica', emoji: '📚', color: 'morado', dias: [1, 3, 5], horaInicio: '17:30', horaFin: '18:30' },
    { titulo: 'Estudio / Aprender', emoji: '🎓', color: 'morado', dias: [2, 4], horaInicio: '17:30', horaFin: '18:30' },
    { titulo: 'Instrumento musical', emoji: '🎸', color: 'rosa', dias: [1, 4], horaInicio: '18:30', horaFin: '20:00' },
    { titulo: 'Tiempo personal', emoji: '☕', color: 'rosa', dias: [2, 5], horaInicio: '18:30', horaFin: '20:00' },
    { titulo: 'Gimnasio ligero', emoji: '💪', color: 'rosa', dias: [3], horaInicio: '18:30', horaFin: '20:00' },
    { titulo: 'Cena + Desconectar', emoji: '🍽️', color: 'naranja', dias: [1, 2, 3, 4, 5], horaInicio: '20:00', horaFin: '21:00' },
    { titulo: 'Planificación + Notas', emoji: '📝', color: 'gris', dias: [1], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Lectura personal', emoji: '📖', color: 'gris', dias: [2], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Revisión de lo aprendido', emoji: '✅', color: 'gris', dias: [3], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Meditación + Relajación', emoji: '🧘', color: 'gris', dias: [4], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Revisión semanal', emoji: '✅', color: 'gris', dias: [5], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Rutina de sueño', emoji: '🌙', color: 'gris', dias: [1, 2, 3, 4, 5], horaInicio: '22:00', horaFin: '22:30' },
    { titulo: 'Dormir', emoji: '😴', color: 'gris', dias: [1, 2, 3, 4, 5], horaInicio: '22:30', horaFin: '23:00' },
];

const BloqueEditorModal = ({ editor, onClose, onSave, onDelete, googleToken, onCalendar, onTask, gFeedback }) => {
    const esNuevo = editor.mode === 'new';
    const base = esNuevo ? editor.defaults : editor.bloque;
    const [titulo, setTitulo] = useState(base.titulo || '');
    const [emoji, setEmoji] = useState(base.emoji || '📌');
    const [color, setColor] = useState(base.color || 'azul');
    const [dias, setDias] = useState([base.dia ?? 1]);
    const [horaInicio, setHoraInicio] = useState(base.horaInicio || '08:00');
    const [horaFin, setHoraFin] = useState(base.horaFin || '09:00');
    const [notas, setNotas] = useState(base.notas || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const toggleDia = (id) => {
        setDias(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!titulo.trim()) { setError('Ponle un nombre a la actividad.'); return; }
        if (horaToMin(horaFin) <= horaToMin(horaInicio)) { setError('La hora de fin debe ser mayor que la de inicio.'); return; }
        if (esNuevo && dias.length === 0) { setError('Elige al menos un día.'); return; }
        setSaving(true);
        await onSave({ titulo: titulo.trim(), emoji, color, horaInicio, horaFin, notas }, esNuevo ? dias : [dias[0]]);
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CalendarClock className="text-blue-600" size={20} />
                        {esNuevo ? 'Nuevo bloque' : 'Editar bloque'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Actividad (Ej: Gimnasio, Lectura...)"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
                        autoFocus
                    />

                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Emoji</p>
                        <div className="grid grid-cols-8 gap-1">
                            {RUTINA_EMOJIS.map(em => (
                                <button
                                    type="button"
                                    key={em}
                                    onClick={() => setEmoji(em)}
                                    className={`text-xl p-1.5 rounded-lg transition-all ${emoji === em ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'hover:bg-slate-100'}`}
                                >{em}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Color</p>
                        <div className="flex gap-2">
                            {Object.entries(RUTINA_COLORS).map(([key, c]) => (
                                <button
                                    type="button"
                                    key={key}
                                    onClick={() => setColor(key)}
                                    className={`w-8 h-8 rounded-full ${c.dot} transition-all ${color === key ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : 'hover:scale-105'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{esNuevo ? 'Días (elige varios)' : 'Día'}</p>
                        <div className="flex gap-1.5">
                            {DIAS_SEMANA.map(d => (
                                <button
                                    type="button"
                                    key={d.id}
                                    onClick={() => esNuevo ? toggleDia(d.id) : setDias([d.id])}
                                    className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${dias.includes(d.id) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >{d.corto}</button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Inicio</p>
                            <select value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white">
                                {HORAS_RUTINA.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Fin</p>
                            <select value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white">
                                {HORAS_RUTINA.slice(1).map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>

                    <textarea
                        placeholder="Notas (opcional)"
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors resize-none"
                    />

                    {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

                    <div className="flex gap-2">
                        <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        {!esNuevo && (
                            <button type="button" onClick={() => { if (window.confirm('¿Eliminar este bloque?')) { onDelete(editor.bloque); onClose(); } }} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {!esNuevo && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                            {!googleToken ? (
                                <p className="text-xs text-slate-400 text-center">Conecta Google en la pestaña Agenda para enviar este bloque a Calendar o Tasks.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => onCalendar(editor.bloque)} disabled={gFeedback.calendar === 'loading'} className="text-sm font-semibold py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50">
                                        {gFeedback.calendar === 'ok' ? '✓ Enviado' : gFeedback.calendar === 'loading' ? 'Enviando...' : '📅 A Calendar'}
                                    </button>
                                    <button type="button" onClick={() => onTask(editor.bloque)} disabled={gFeedback.task === 'loading'} className="text-sm font-semibold py-2.5 rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors disabled:opacity-50">
                                        {gFeedback.task === 'ok' ? '✓ Creada' : gFeedback.task === 'loading' ? 'Creando...' : '✔️ A Tasks'}
                                    </button>
                                </div>
                            )}
                            {gFeedback.error && <p className="text-xs text-rose-600 text-center">{gFeedback.error}</p>}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

const RutinaSemanal = ({ rutina, genericAdd, genericUpdate, genericDelete, googleToken }) => {
    const [editorState, setEditorState] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const [diaMovil, setDiaMovil] = useState(new Date().getDay());
    const [gFeedback, setGFeedback] = useState({});
    const hoy = new Date().getDay();

    const colDeDia = (dia) => DIAS_SEMANA.findIndex(d => d.id === dia) + 2;

    // Orden estable para la cascada de entrada (por columna y hora).
    const bloquesOrdenados = [...rutina].sort((a, b) =>
        (colDeDia(a.dia) - colDeDia(b.dia)) || (horaToMin(a.horaInicio) - horaToMin(b.horaInicio))
    );

    const handleSave = async (datos, dias) => {
        if (editorState?.mode === 'edit') {
            await genericUpdate('rutina', editorState.bloque.id, { ...datos, dia: dias[0] });
        } else {
            for (const dia of dias) {
                await genericAdd('rutina', { ...datos, dia, createdAt: new Date().toISOString() });
            }
        }
    };

    const handleDelete = (bloque) => genericDelete('rutina', bloque.id);

    const usarPlantilla = async () => {
        setSeeding(true);
        try {
            for (const b of PLANTILLA_RUTINA) {
                for (const dia of b.dias) {
                    await genericAdd('rutina', {
                        titulo: b.titulo, emoji: b.emoji, color: b.color, dia,
                        horaInicio: b.horaInicio, horaFin: b.horaFin, notas: '',
                        createdAt: new Date().toISOString()
                    });
                }
            }
        } finally {
            setSeeding(false);
        }
    };

    // Próxima fecha real en la que cae este día/hora (si ya pasó, la semana que viene).
    const proximaOcurrencia = (dia, hhmm) => {
        const [h, m] = hhmm.split(':').map(Number);
        const d = new Date();
        d.setDate(d.getDate() + ((dia - d.getDay() + 7) % 7));
        d.setHours(h, m, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 7);
        return d;
    };

    const enviarACalendar = async (bloque) => {
        setGFeedback({ calendar: 'loading' });
        try {
            const inicio = proximaOcurrencia(bloque.dia, bloque.horaInicio);
            const fin = new Date(inicio.getTime() + (horaToMin(bloque.horaFin) - horaToMin(bloque.horaInicio)) * 60000);
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: `${bloque.emoji} ${bloque.titulo}`,
                    description: bloque.notas || 'Bloque de mi rutina semanal (Finanzas 360)',
                    start: { dateTime: inicio.toISOString(), timeZone },
                    end: { dateTime: fin.toISOString(), timeZone },
                })
            });
            if (!res.ok) throw new Error(res.status === 401 ? 'Reconecta Google en la pestaña Agenda.' : 'Google rechazó el evento.');
            setGFeedback({ calendar: 'ok' });
        } catch (e) {
            setGFeedback({ error: e.message });
        }
    };

    const crearGoogleTask = async (bloque) => {
        setGFeedback({ task: 'loading' });
        try {
            const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
                method: 'POST',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `${bloque.emoji} ${bloque.titulo}`,
                    notes: bloque.notas || 'Bloque de mi rutina semanal',
                    due: proximaOcurrencia(bloque.dia, bloque.horaInicio).toISOString(),
                })
            });
            if (!res.ok) throw new Error(res.status === 401 ? 'Reconecta Google en la pestaña Agenda.' : 'Google rechazó la tarea.');
            setGFeedback({ task: 'ok' });
        } catch (e) {
            setGFeedback({ error: e.message });
        }
    };

    const abrirNuevo = (defaults = {}) => {
        setGFeedback({});
        setEditorState({ mode: 'new', defaults: { dia: hoy, horaInicio: '08:00', horaFin: '09:00', ...defaults } });
    };
    const abrirEdicion = (bloque) => {
        setGFeedback({});
        setEditorState({ mode: 'edit', bloque });
    };

    const bloquesDelDia = (dia) => rutina.filter(b => b.dia === dia).sort((a, b) => horaToMin(a.horaInicio) - horaToMin(b.horaInicio));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white p-8 rounded-3xl shadow-lg animate-in slide-in-from-bottom duration-500">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3"><CalendarClock size={28} /> Mi Rutina Semanal</h2>
                        <p className="text-blue-100 mt-1 text-sm">Diseña tu semana ideal. Toca cualquier bloque para editarlo.</p>
                    </div>
                    <div className="flex gap-2">
                        {rutina.length === 0 && (
                            <button onClick={usarPlantilla} disabled={seeding} className="bg-white/20 backdrop-blur text-white font-bold px-4 py-2.5 rounded-xl hover:bg-white/30 transition-colors disabled:opacity-60">
                                {seeding ? 'Creando rutina...' : '✨ Usar plantilla'}
                            </button>
                        )}
                        <button onClick={() => abrirNuevo()} className="bg-white text-blue-900 font-bold px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors">
                            + Bloque
                        </button>
                    </div>
                </div>
            </div>

            {rutina.length === 0 && !seeding && (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 text-center animate-in zoom-in-95 duration-500">
                    <p className="text-5xl mb-3">🗓️</p>
                    <h3 className="text-lg font-bold text-slate-800">Tu semana está en blanco</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Empieza con la plantilla de alto rendimiento (gimnasio, trabajo profundo, lectura, sueño...) o crea tus propios bloques desde cero.</p>
                </div>
            )}

            {rutina.length > 0 && (
                <>
                    {/* ===== Grilla semanal (desktop) ===== */}
                    <div className="hidden md:block bg-white p-5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
                        <div className="min-w-[860px]" style={{ display: 'grid', gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(36, 1.35rem)', gap: '2px' }}>
                            <div style={{ gridColumn: 1, gridRow: 1 }} />
                            {DIAS_SEMANA.map(d => (
                                <div key={d.id} style={{ gridColumn: colDeDia(d.id), gridRow: 1 }} className={`text-center text-xs font-bold uppercase tracking-wider pb-2 ${d.id === hoy ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {d.label}
                                </div>
                            ))}

                            {HORAS_RUTINA.filter(h => h.endsWith(':00')).map(h => (
                                <div key={`t-${h}`} style={{ gridColumn: 1, gridRow: `${rowFromHora(h)} / span 2` }} className="text-[10px] text-slate-400 font-medium text-right pr-2 border-t border-slate-100">
                                    {h}
                                </div>
                            ))}

                            {DIAS_SEMANA.map(d => HORAS_RUTINA.filter(h => h.endsWith(':00')).map(h => (
                                <button
                                    key={`empty-${d.id}-${h}`}
                                    onClick={() => abrirNuevo({ dia: d.id, horaInicio: h, horaFin: HORAS_RUTINA[HORAS_RUTINA.indexOf(h) + 2] || '23:00' })}
                                    style={{ gridColumn: colDeDia(d.id), gridRow: `${rowFromHora(h)} / span 2`, zIndex: 0 }}
                                    className={`rounded-lg border-t border-slate-50 transition-colors hover:bg-blue-50/60 ${d.id === hoy ? 'bg-blue-50/40' : ''}`}
                                />
                            )))}

                            {bloquesOrdenados.map((b, i) => {
                                const c = RUTINA_COLORS[b.color] || RUTINA_COLORS.gris;
                                const filas = rowFromHora(b.horaFin) - rowFromHora(b.horaInicio);
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => abrirEdicion(b)}
                                        style={{ gridColumn: colDeDia(b.dia), gridRow: `${rowFromHora(b.horaInicio)} / ${rowFromHora(b.horaFin)}`, zIndex: 10, animationDelay: `${i * 20}ms` }}
                                        className={`rounded-xl border ${c.bg} ${c.border} ${c.text} px-1.5 py-1 text-left overflow-hidden hover:scale-[1.03] hover:shadow-md transition-all animate-in zoom-in-95 duration-500`}
                                    >
                                        <span className="block text-[11px] font-bold leading-tight truncate">{b.emoji} {b.titulo}</span>
                                        {filas >= 3 && <span className="block text-[10px] opacity-70 mt-0.5">{b.horaInicio} – {b.horaFin}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ===== Vista por día (móvil) ===== */}
                    <div className="md:hidden space-y-4">
                        <div className="flex gap-1.5 justify-between">
                            {DIAS_SEMANA.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setDiaMovil(d.id)}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${diaMovil === d.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : d.id === hoy ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 border border-slate-100'}`}
                                >{d.corto}</button>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {bloquesDelDia(diaMovil).length === 0 && (
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                                    Sin bloques este día. ¡Añade uno!
                                </div>
                            )}
                            {bloquesDelDia(diaMovil).map((b, i) => {
                                const c = RUTINA_COLORS[b.color] || RUTINA_COLORS.gris;
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => abrirEdicion(b)}
                                        style={{ animationDelay: `${i * 40}ms` }}
                                        className={`w-full flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 text-left hover:shadow-md transition-all animate-in slide-in-from-bottom duration-300 ${c.border.replace('border-', 'border-l-')}`}
                                    >
                                        <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl ${c.bg}`}>{b.emoji}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-bold text-slate-800 text-sm truncate">{b.titulo}</span>
                                            <span className="block text-xs text-slate-400">{b.horaInicio} – {b.horaFin}</span>
                                        </span>
                                    </button>
                                );
                            })}
                            <button onClick={() => abrirNuevo({ dia: diaMovil })} className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-sm font-semibold hover:border-blue-300 hover:text-blue-500 transition-colors">
                                + Añadir bloque
                            </button>
                        </div>
                    </div>
                </>
            )}

            {editorState && (
                <BloqueEditorModal
                    key={editorState.mode === 'edit' ? editorState.bloque.id : 'nuevo'}
                    editor={editorState}
                    onClose={() => setEditorState(null)}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    googleToken={googleToken}
                    onCalendar={enviarACalendar}
                    onTask={crearGoogleTask}
                    gFeedback={gFeedback}
                />
            )}
        </div>
    );
};

// =============================================
// === PROYECTOS (trabajo laboral por proyectos) ===
// =============================================

const PROYECTO_EMOJIS = ['💼', '📊', '🚀', '💡', '🔧', '🖥️', '📱', '🌐', '📈', '🤝', '✍️', '🎯', '🧪', '🎨', '📦', '🔐'];

const KANBAN_COLS = [
    { id: 'pendiente', label: 'Pendiente', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
    { id: 'en_curso', label: 'En curso', dot: 'bg-sky-400', chip: 'bg-sky-100 text-sky-700' },
    { id: 'hecha', label: 'Hecho', dot: 'bg-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
];

const PRIORIDAD_DOT = { alta: 'bg-rose-500', media: 'bg-amber-400', baja: 'bg-slate-300' };

const tiempoRelativo = (iso) => {
    if (!iso) return '';
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} días`;
    return `hace ${Math.floor(dias / 30)} mes${dias >= 60 ? 'es' : ''}`;
};

const ProyectoEditorModal = ({ proyecto, onClose, onSave }) => {
    const esNuevo = !proyecto?.id;
    const [nombre, setNombre] = useState(proyecto?.nombre || '');
    const [emoji, setEmoji] = useState(proyecto?.emoji || '💼');
    const [color, setColor] = useState(proyecto?.color || 'azul');
    const [descripcion, setDescripcion] = useState(proyecto?.descripcion || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setSaving(true);
        await onSave({ nombre: nombre.trim(), emoji, color, descripcion: descripcion.trim() });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FolderKanban className="text-slate-700" size={20} />
                        {esNuevo ? 'Nuevo proyecto' : 'Editar proyecto'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Nombre del proyecto"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors"
                        autoFocus
                        required
                    />
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Emoji</p>
                        <div className="grid grid-cols-8 gap-1">
                            {PROYECTO_EMOJIS.map(em => (
                                <button type="button" key={em} onClick={() => setEmoji(em)}
                                    className={`text-xl p-1.5 rounded-lg transition-all ${emoji === em ? 'bg-slate-200 ring-2 ring-slate-500 scale-110' : 'hover:bg-slate-100'}`}
                                >{em}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Color</p>
                        <div className="flex gap-2">
                            {Object.entries(RUTINA_COLORS).map(([key, c]) => (
                                <button type="button" key={key} onClick={() => setColor(key)}
                                    className={`w-8 h-8 rounded-full ${c.dot} transition-all ${color === key ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : 'hover:scale-105'}`}
                                />
                            ))}
                        </div>
                    </div>
                    <textarea
                        placeholder="Descripción (opcional)"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors resize-none"
                    />
                    <button type="submit" disabled={saving} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-300 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const ProyectoDetail = ({ proyecto, items, onBack, onEdit, genericAdd, genericUpdate, genericDelete }) => {
    const [vista, setVista] = useState('tareas');
    const [nuevaTarea, setNuevaTarea] = useState('');
    const [nuevaPrioridad, setNuevaPrioridad] = useState('media');
    const [nuevoAvance, setNuevoAvance] = useState('');
    const [nuevaNota, setNuevaNota] = useState('');
    const [nuevaMeta, setNuevaMeta] = useState('');
    const [nuevaMetaFecha, setNuevaMetaFecha] = useState('');

    const c = RUTINA_COLORS[proyecto.color] || RUTINA_COLORS.gris;
    const tareas = items.filter(i => i.tipo === 'tarea');
    const avances = items.filter(i => i.tipo === 'avance').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const notas = items.filter(i => i.tipo === 'nota').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const metas = items.filter(i => i.tipo === 'meta').sort((a, b) => (a.completada ? 1 : 0) - (b.completada ? 1 : 0));
    const hechas = tareas.filter(t => t.estado === 'hecha').length;
    const pct = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0;

    const addItem = (datos) => genericAdd('proyecto_items', { proyectoId: proyecto.id, createdAt: new Date().toISOString(), ...datos });

    const moverTarea = (tarea, dir) => {
        const orden = ['pendiente', 'en_curso', 'hecha'];
        const idx = orden.indexOf(tarea.estado) + dir;
        if (idx < 0 || idx >= orden.length) return;
        genericUpdate('proyecto_items', tarea.id, { estado: orden[idx], movedAt: new Date().toISOString() });
    };

    const TABS = [
        { id: 'tareas', label: `Tareas${tareas.length ? ` (${tareas.length})` : ''}` },
        { id: 'avances', label: `Avances${avances.length ? ` (${avances.length})` : ''}` },
        { id: 'notas', label: `Notas${notas.length ? ` (${notas.length})` : ''}` },
        { id: 'metas', label: `Metas${metas.length ? ` (${metas.length})` : ''}` },
    ];

    const NOTA_COLORES = ['amarillo', 'verde', 'azul', 'rosa', 'naranja'];

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-start gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0 mt-1">
                        <ArrowLeft size={20} className="text-slate-500" />
                    </button>
                    <span className={`w-12 h-12 flex items-center justify-center rounded-2xl text-2xl shrink-0 ${c.bg}`}>{proyecto.emoji}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-slate-800 truncate">{proyecto.nombre}</h2>
                            {proyecto.estado === 'archivado' && <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Archivado</span>}
                        </div>
                        {proyecto.descripcion && <p className="text-sm text-slate-500 mt-0.5">{proyecto.descripcion}</p>}
                        {tareas.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-500">{hechas}/{tareas.length}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Editar">
                            <Edit2 size={17} className="text-slate-400" />
                        </button>
                        <button
                            onClick={() => genericUpdate('proyectos', proyecto.id, { estado: proyecto.estado === 'archivado' ? 'activo' : 'archivado' })}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            title={proyecto.estado === 'archivado' ? 'Desarchivar' : 'Archivar'}
                        >
                            <Archive size={17} className="text-slate-400" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setVista(t.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${vista === t.id ? 'bg-slate-800 text-white shadow-lg shadow-slate-300' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                    >{t.label}</button>
                ))}
            </div>

            {vista === 'tareas' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevaTarea.trim()) return; addItem({ tipo: 'tarea', titulo: nuevaTarea.trim(), estado: 'pendiente', prioridad: nuevaPrioridad, movedAt: new Date().toISOString() }); setNuevaTarea(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2 items-center"
                    >
                        <input type="text" placeholder="Nueva tarea..." value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm min-w-0" />
                        <div className="flex gap-1 shrink-0">
                            {['alta', 'media', 'baja'].map(p => (
                                <button type="button" key={p} onClick={() => setNuevaPrioridad(p)} title={`Prioridad ${p}`}
                                    className={`w-6 h-6 rounded-full ${PRIORIDAD_DOT[p]} transition-all ${nuevaPrioridad === p ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'opacity-40 hover:opacity-70'}`} />
                            ))}
                        </div>
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0"><Plus size={18} /></button>
                    </form>

                    <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 md:grid md:grid-cols-3 md:overflow-visible">
                        {KANBAN_COLS.map(col => {
                            const colTareas = tareas.filter(t => t.estado === col.id).sort((a, b) => ({ alta: 0, media: 1, baja: 2 }[a.prioridad] ?? 1) - ({ alta: 0, media: 1, baja: 2 }[b.prioridad] ?? 1));
                            return (
                                <div key={col.id} className="min-w-[85%] snap-center md:min-w-0 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${col.chip}`}>
                                        <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                        {col.label} · {colTareas.length}
                                    </div>
                                    <div className="space-y-2 min-h-[3rem]">
                                        {colTareas.length === 0 && <p className="text-xs text-slate-300 text-center py-4">Vacío</p>}
                                        {colTareas.map((t, i) => (
                                            <div key={t.id} style={{ animationDelay: `${i * 30}ms` }} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 animate-in zoom-in-95 duration-300">
                                                <div className="flex items-start gap-2">
                                                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORIDAD_DOT[t.prioridad] || PRIORIDAD_DOT.media}`} />
                                                    <p className={`flex-1 text-sm font-medium leading-snug ${t.estado === 'hecha' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.titulo}</p>
                                                </div>
                                                <div className="flex justify-end gap-1 mt-2">
                                                    {col.id !== 'pendiente' && (
                                                        <button onClick={() => moverTarea(t, -1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="Retroceder">
                                                            <RotateCcw size={15} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => { if (window.confirm('¿Eliminar tarea?')) genericDelete('proyecto_items', t.id); }} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors">
                                                        <Trash2 size={15} />
                                                    </button>
                                                    {col.id !== 'hecha' && (
                                                        <button onClick={() => moverTarea(t, 1)} className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors" title="Avanzar">
                                                            <ArrowRightCircle size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {vista === 'avances' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevoAvance.trim()) return; addItem({ tipo: 'avance', texto: nuevoAvance.trim(), fecha: dateKey() }); setNuevoAvance(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2"
                    >
                        <input type="text" placeholder="Hoy logré..." value={nuevoAvance} onChange={(e) => setNuevoAvance(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm min-w-0" />
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0"><Plus size={18} /></button>
                    </form>
                    {avances.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                            Registra tu primer avance: pequeños logros diarios cuentan la historia del proyecto.
                        </div>
                    )}
                    <div className="space-y-2">
                        {avances.map((a, i) => (
                            <div key={a.id} style={{ animationDelay: `${i * 25}ms` }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-300 flex items-start gap-3 animate-in slide-in-from-bottom duration-300 group">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700">{a.texto}</p>
                                    <p className="text-xs text-slate-400 mt-1">{a.fecha} · {tiempoRelativo(a.createdAt)}</p>
                                </div>
                                <button onClick={() => { if (window.confirm('¿Eliminar avance?')) genericDelete('proyecto_items', a.id); }} className="p-1.5 rounded-lg text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {vista === 'notas' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevaNota.trim()) return; addItem({ tipo: 'nota', texto: nuevaNota.trim(), color: NOTA_COLORES[notas.length % NOTA_COLORES.length] }); setNuevaNota(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2"
                    >
                        <textarea placeholder="Idea, enlace, decisión, apunte..." value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} rows={2}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm resize-none min-w-0" />
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0 self-end"><Plus size={18} /></button>
                    </form>
                    {notas.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                            Sin notas aún. Guarda aquí ideas, enlaces y decisiones del proyecto.
                        </div>
                    )}
                    <div className="columns-2 gap-3 [column-fill:_balance]">
                        {notas.map((n, i) => {
                            const nc = RUTINA_COLORS[n.color] || RUTINA_COLORS.amarillo;
                            return (
                                <div key={n.id} style={{ animationDelay: `${i * 30}ms` }} className={`break-inside-avoid mb-3 p-4 rounded-2xl border ${nc.bg} ${nc.border} ${nc.text} animate-in zoom-in-95 duration-300 group relative`}>
                                    <p className="text-sm whitespace-pre-wrap break-words">{n.texto}</p>
                                    <p className="text-[10px] opacity-60 mt-2">{tiempoRelativo(n.createdAt)}</p>
                                    <button onClick={() => { if (window.confirm('¿Eliminar nota?')) genericDelete('proyecto_items', n.id); }} className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/50 transition-all">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {vista === 'metas' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevaMeta.trim()) return; addItem({ tipo: 'meta', titulo: nuevaMeta.trim(), fechaLimite: nuevaMetaFecha || null, completada: false }); setNuevaMeta(''); setNuevaMetaFecha(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-2"
                    >
                        <input type="text" placeholder="Objetivo del proyecto..." value={nuevaMeta} onChange={(e) => setNuevaMeta(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm min-w-[10rem]" />
                        <input type="date" value={nuevaMetaFecha} onChange={(e) => setNuevaMetaFecha(e.target.value)}
                            className="px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm text-slate-500" />
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0"><Plus size={18} /></button>
                    </form>
                    {metas.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                            Define los objetivos grandes del proyecto, separados del día a día.
                        </div>
                    )}
                    <div className="space-y-2">
                        {metas.map((m, i) => {
                            const vencida = m.fechaLimite && !m.completada && m.fechaLimite < dateKey();
                            return (
                                <div key={m.id} style={{ animationDelay: `${i * 25}ms` }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 group">
                                    <button onClick={() => genericUpdate('proyecto_items', m.id, { completada: !m.completada })} className="shrink-0">
                                        {m.completada
                                            ? <CheckCircle2 size={22} className="text-emerald-500" />
                                            : <Circle size={22} className="text-slate-300 hover:text-slate-400 transition-colors" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${m.completada ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.titulo}</p>
                                        {m.fechaLimite && (
                                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${vencida ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {vencida ? '⚠ ' : '📅 '}{m.fechaLimite}
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => { if (window.confirm('¿Eliminar meta?')) genericDelete('proyecto_items', m.id); }} className="p-1.5 rounded-lg text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const ProyectosSection = ({ proyectos, proyectoItems, genericAdd, genericUpdate, genericDelete }) => {
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [editorProyecto, setEditorProyecto] = useState(null); // null | 'nuevo' | proyecto
    const [showArchived, setShowArchived] = useState(false);

    const activos = proyectos.filter(p => p.estado !== 'archivado');
    const archivados = proyectos.filter(p => p.estado === 'archivado');
    const proyectoActual = proyectos.find(p => p.id === selectedProjectId);

    const handleSaveProyecto = async (datos) => {
        if (editorProyecto && editorProyecto !== 'nuevo') {
            await genericUpdate('proyectos', editorProyecto.id, datos);
        } else {
            await genericAdd('proyectos', { ...datos, estado: 'activo', createdAt: new Date().toISOString() });
        }
    };

    if (proyectoActual) {
        return (
            <>
                <ProyectoDetail
                    proyecto={proyectoActual}
                    items={proyectoItems.filter(i => i.proyectoId === proyectoActual.id)}
                    onBack={() => setSelectedProjectId(null)}
                    onEdit={() => setEditorProyecto(proyectoActual)}
                    genericAdd={genericAdd}
                    genericUpdate={genericUpdate}
                    genericDelete={genericDelete}
                />
                {editorProyecto && (
                    <ProyectoEditorModal
                        proyecto={editorProyecto === 'nuevo' ? null : editorProyecto}
                        onClose={() => setEditorProyecto(null)}
                        onSave={handleSaveProyecto}
                    />
                )}
            </>
        );
    }

    const CardProyecto = ({ p, index }) => {
        const c = RUTINA_COLORS[p.color] || RUTINA_COLORS.gris;
        const items = proyectoItems.filter(i => i.proyectoId === p.id);
        const tareas = items.filter(i => i.tipo === 'tarea');
        const hechas = tareas.filter(t => t.estado === 'hecha').length;
        const pct = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0;
        const ultima = items.reduce((max, i) => {
            const t = i.movedAt || i.createdAt || '';
            return t > max ? t : max;
        }, p.createdAt || '');
        return (
            <button
                onClick={() => setSelectedProjectId(p.id)}
                style={{ animationDelay: `${index * 40}ms` }}
                className="text-left bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all animate-in zoom-in-95 duration-500"
            >
                <div className="flex items-center gap-3">
                    <span className={`w-11 h-11 flex items-center justify-center rounded-2xl text-xl shrink-0 ${c.bg}`}>{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{p.nombre}</h3>
                        <p className="text-xs text-slate-400">Actividad: {tiempoRelativo(ultima)}</p>
                    </div>
                </div>
                {p.descripcion && <p className="text-xs text-slate-500 mt-3 line-clamp-2">{p.descripcion}</p>}
                <div className="flex items-center gap-2 mt-4">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">{tareas.length ? `${hechas}/${tareas.length}` : 'Sin tareas'}</span>
                </div>
            </button>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white p-8 rounded-3xl shadow-lg animate-in slide-in-from-bottom duration-500">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3"><FolderKanban size={28} /> Proyectos</h2>
                        <p className="text-slate-300 mt-1 text-sm">{activos.length === 0 ? 'Organiza tu trabajo por proyectos.' : `${activos.length} proyecto${activos.length !== 1 ? 's' : ''} activo${activos.length !== 1 ? 's' : ''}`}</p>
                    </div>
                    <button onClick={() => setEditorProyecto('nuevo')} className="bg-white text-slate-900 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">
                        + Proyecto
                    </button>
                </div>
            </div>

            {activos.length === 0 && (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 text-center animate-in zoom-in-95 duration-500">
                    <p className="text-5xl mb-3">🗂️</p>
                    <h3 className="text-lg font-bold text-slate-800">Aún no tienes proyectos</h3>
                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Crea tu primer proyecto laboral: tendrá su propio tablero de tareas, bitácora de avances, notas y metas.</p>
                </div>
            )}

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activos.map((p, i) => <CardProyecto key={p.id} p={p} index={i} />)}
            </div>

            {archivados.length > 0 && (
                <div>
                    <button onClick={() => setShowArchived(!showArchived)} className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                        {showArchived ? '▾' : '▸'} Ver archivados ({archivados.length})
                    </button>
                    {showArchived && (
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3 opacity-70">
                            {archivados.map((p, i) => <CardProyecto key={p.id} p={p} index={i} />)}
                        </div>
                    )}
                </div>
            )}

            {editorProyecto && (
                <ProyectoEditorModal
                    proyecto={editorProyecto === 'nuevo' ? null : editorProyecto}
                    onClose={() => setEditorProyecto(null)}
                    onSave={handleSaveProyecto}
                />
            )}
        </div>
    );
};

// =============================================
// === CRYPTO HELPERS (AES-256-GCM + PBKDF2) ===
// =============================================

// Nº de iteraciones PBKDF2 para bóvedas NUEVAS. Recomendación OWASP 2023
// para PBKDF2-HMAC-SHA256 es 600.000. Las bóvedas antiguas (creadas con
// 100.000) guardan su propio valor en vault_config para seguir funcionando.
const PBKDF2_ITERATIONS = 600000;
const LEGACY_PBKDF2_ITERATIONS = 100000;
// Texto fijo que ciframos con la clave maestra para verificar el desbloqueo
// SIN almacenar ningún hash rápido de la clave (que sería atacable offline).
const VAULT_VERIFIER_TEXT = 'FINANZAS_360_VAULT_VERIFIER_V1';

const getKeyMaterial = async (password) => {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
};

const deriveEncryptionKey = async (password, salt, iterations = PBKDF2_ITERATIONS) => {
    const keyMaterial = await getKeyMaterial(password);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const encryptText = async (plaintext, masterPassword, salt, iterations = PBKDF2_ITERATIONS) => {
    const key = await deriveEncryptionKey(masterPassword, salt, iterations);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return {
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    };
};

const decryptText = async (encryptedData, masterPassword, salt, iterations = PBKDF2_ITERATIONS) => {
    try {
        const key = await deriveEncryptionKey(masterPassword, salt, iterations);
        const iv = new Uint8Array(atob(encryptedData.iv).split('').map(c => c.charCodeAt(0)));
        const ciphertext = new Uint8Array(atob(encryptedData.ciphertext).split('').map(c => c.charCodeAt(0)));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
};

const hashText = async (text) => {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
};

// Entero aleatorio seguro en [0, max) usando crypto.getRandomValues sin sesgo.
const secureRandomInt = (max) => {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
};

const generateStrongPassword = (length = 20) => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const all = upper + lower + digits + symbols;
    let pw = [
        upper[secureRandomInt(upper.length)],
        lower[secureRandomInt(lower.length)],
        digits[secureRandomInt(digits.length)],
        symbols[secureRandomInt(symbols.length)],
    ];
    for (let i = pw.length; i < length; i++) pw.push(all[secureRandomInt(all.length)]);
    // Mezcla Fisher-Yates con aleatoriedad criptográfica.
    for (let i = pw.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [pw[i], pw[j]] = [pw[j], pw[i]];
    }
    return pw.join('');
};

const CATEGORIAS_PASSWORDS = ['Correo', 'Red Social', 'Banco / Finanzas', 'Trabajo', 'Entretenimiento', 'Compras', 'Otro'];

const CAT_COLORS = {
    'Correo': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '📧' },
    'Red Social': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '👥' },
    'Banco / Finanzas': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '🏦' },
    'Trabajo': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '💼' },
    'Entretenimiento': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', icon: '🎮' },
    'Compras': { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', icon: '🛒' },
    'Otro': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: '🔑' },
};

// =============================================
// === COMPONENTE: PASSWORD VAULT ===
// =============================================

const PasswordVault = ({ passwords, vaultConfig, genericAdd, genericUpdate, genericDelete, user, db, activeTab }) => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [masterPassword, setMasterPassword] = useState('');
    const [masterInput, setMasterInput] = useState('');
    const [confirmInput, setConfirmInput] = useState('');
    const [isCreatingMaster, setIsCreatingMaster] = useState(false);
    const [error, setError] = useState('');
    const [salt, setSalt] = useState(null);
    const [iterations, setIterations] = useState(PBKDF2_ITERATIONS);

    // Form states
    const [servicio, setServicio] = useState('');
    const [usuario, setUsuario] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [categoria, setCategoria] = useState(CATEGORIAS_PASSWORDS[0]);
    const [url, setUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPasswords, setShowPasswords] = useState({});
    const [decryptedCache, setDecryptedCache] = useState({});
    const [copiedId, setCopiedId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Auto-lock on tab change
    useEffect(() => {
        if (activeTab !== 'passwords') {
            setIsUnlocked(false);
            setMasterPassword('');
            setDecryptedCache({});
            setShowPasswords({});
        }
    }, [activeTab]);

    // Check if vault already has a master password
    useEffect(() => {
        if (vaultConfig && vaultConfig.length > 0) {
            setIsCreatingMaster(false);
            const config = vaultConfig[0];
            if (config.salt) {
                setSalt(new Uint8Array(atob(config.salt).split('').map(c => c.charCodeAt(0))));
            }
            // Bóvedas antiguas no guardan iterations -> usaban 100.000.
            setIterations(config.iterations || LEGACY_PBKDF2_ITERATIONS);
        } else {
            setIsCreatingMaster(true);
            setIterations(PBKDF2_ITERATIONS);
        }
    }, [vaultConfig]);

    const handleCreateMaster = async (e) => {
        e.preventDefault();
        if (masterInput.length < 10) { setError('Usa al menos 10 caracteres (mejor una frase larga)'); return; }
        if (masterInput !== confirmInput) { setError('Las claves no coinciden'); return; }

        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const saltB64 = btoa(String.fromCharCode(...newSalt));
        // Verificador: ciframos un texto fijo con la clave maestra. Para
        // desbloquear hay que poder descifrarlo (no se guarda ningún hash
        // rápido que pueda atacarse offline).
        const verifier = await encryptText(VAULT_VERIFIER_TEXT, masterInput, newSalt, PBKDF2_ITERATIONS);

        await genericAdd('vault_config', { salt: saltB64, iterations: PBKDF2_ITERATIONS, verifier });
        setSalt(newSalt);
        setIterations(PBKDF2_ITERATIONS);
        setMasterPassword(masterInput);
        setIsUnlocked(true);
        setMasterInput('');
        setConfirmInput('');
        setError('');
    };

    const handleUnlock = async (e) => {
        e.preventDefault();
        if (!vaultConfig || vaultConfig.length === 0) return;
        const config = vaultConfig[0];
        const saltBytes = new Uint8Array(atob(config.salt).split('').map(c => c.charCodeAt(0)));
        const iters = config.iterations || LEGACY_PBKDF2_ITERATIONS;

        let ok = false;
        if (config.verifier) {
            // Esquema nuevo: desbloqueo = poder descifrar el verificador.
            const dec = await decryptText(config.verifier, masterInput, saltBytes, iters);
            ok = dec === VAULT_VERIFIER_TEXT;
        } else if (config.masterHash) {
            // Esquema antiguo: hash rápido. Si coincide, MIGRAMOS a verificador
            // y eliminamos el hash para cerrar el ataque offline.
            const inputHash = await hashText(masterInput + config.salt);
            ok = inputHash === config.masterHash;
            if (ok) {
                try {
                    const verifier = await encryptText(VAULT_VERIFIER_TEXT, masterInput, saltBytes, iters);
                    await genericUpdate('vault_config', config.id, {
                        verifier, iterations: iters, masterHash: null
                    });
                } catch (_) { /* si falla, seguimos desbloqueando igual */ }
            }
        }

        if (ok) {
            setMasterPassword(masterInput);
            setSalt(saltBytes);
            setIterations(iters);
            setIsUnlocked(true);
            setMasterInput('');
            setError('');
        } else {
            setError('Clave maestra incorrecta');
        }
    };

    const handleAddPassword = async (e) => {
        e.preventDefault();
        if (!salt) return;
        const encrypted = await encryptText(passwordInput, masterPassword, salt, iterations);
        await genericAdd('passwords', {
            servicio,
            usuario,
            passwordEncrypted: encrypted.ciphertext,
            iv: encrypted.iv,
            categoria,
            url,
            createdAt: new Date().toISOString()
        });
        setServicio(''); setUsuario(''); setPasswordInput(''); setUrl('');
    };

    const handleShowPassword = async (item) => {
        if (showPasswords[item.id]) {
            setShowPasswords(prev => ({ ...prev, [item.id]: false }));
            return;
        }
        if (decryptedCache[item.id]) {
            setShowPasswords(prev => ({ ...prev, [item.id]: true }));
            return;
        }
        const decrypted = await decryptText({ ciphertext: item.passwordEncrypted, iv: item.iv }, masterPassword, salt, iterations);
        if (decrypted) {
            setDecryptedCache(prev => ({ ...prev, [item.id]: decrypted }));
            setShowPasswords(prev => ({ ...prev, [item.id]: true }));
        } else {
            setError('Error al descifrar. Verifica tu clave maestra.');
        }
    };

    const handleCopy = async (item) => {
        let text = decryptedCache[item.id];
        if (!text) {
            text = await decryptText({ ciphertext: item.passwordEncrypted, iv: item.iv }, masterPassword, salt, iterations);
        }
        if (text) {
            navigator.clipboard.writeText(text);
            setCopiedId(item.id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const handleUpdatePassword = async (item) => {
        if (!salt) return;
        const updates = { ...editForm };
        if (editForm.newPassword) {
            const encrypted = await encryptText(editForm.newPassword, masterPassword, salt, iterations);
            updates.passwordEncrypted = encrypted.ciphertext;
            updates.iv = encrypted.iv;
            delete updates.newPassword;
        }
        delete updates.newPassword;
        await genericUpdate('passwords', item.id, updates);
        setEditingId(null);
        setEditForm({});
        setDecryptedCache(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        setShowPasswords(prev => ({ ...prev, [item.id]: false }));
    };

    const filteredPasswords = passwords.filter(p =>
        p.servicio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.usuario?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- LOCK SCREEN ---
    if (!isUnlocked) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 w-full max-w-md text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Lock size={36} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        {isCreatingMaster ? 'Crear Clave Maestra' : 'Bóveda de Contraseñas'}
                    </h2>
                    <p className="text-slate-400 text-sm mb-6">
                        {isCreatingMaster
                            ? 'Crea una clave maestra fuerte (mínimo 10 caracteres; ideal una frase larga). No la olvides — no se puede recuperar y de ella depende toda la seguridad.'
                            : 'Ingresa tu clave maestra para acceder'
                        }
                    </p>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm p-3 rounded-xl mb-4 flex items-center gap-2">
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}

                    <form onSubmit={isCreatingMaster ? handleCreateMaster : handleUnlock} className="space-y-4">
                        <input
                            type="password" placeholder="Clave Maestra" value={masterInput}
                            onChange={e => { setMasterInput(e.target.value); setError(''); }}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-700 text-center text-lg tracking-widest transition-colors"
                            required autoFocus
                        />
                        {isCreatingMaster && (
                            <input
                                type="password" placeholder="Confirmar Clave" value={confirmInput}
                                onChange={e => { setConfirmInput(e.target.value); setError(''); }}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-700 text-center text-lg tracking-widest transition-colors"
                                required
                            />
                        )}
                        <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg">
                            {isCreatingMaster ? '🔐 Crear Bóveda' : '🔓 Desbloquear'}
                        </button>
                    </form>

                    {isCreatingMaster && (
                        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                            <strong>⚠️ Importante:</strong> Si olvidas tu clave maestra, no podrás recuperar tus contraseñas.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- VAULT UNLOCKED ---
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8 rounded-3xl shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <KeyRound size={28} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold">Bóveda de Contraseñas</h2>
                            <p className="text-slate-400 text-sm">{passwords.length} credencial{passwords.length !== 1 ? 'es' : ''} guardada{passwords.length !== 1 ? 's' : ''} • Cifrado AES-256</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsUnlocked(false); setMasterPassword(''); setDecryptedCache({}); setShowPasswords({}); }}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-white/10">
                        <Lock size={16} /> Bloquear Bóveda
                    </button>
                </div>
            </div>

            {/* Formulario + Búsqueda */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-slate-600" /> Nueva Credencial
                </h3>
                <form onSubmit={handleAddPassword} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Servicio</label>
                        <input placeholder="Ej: Gmail" value={servicio} onChange={e => setServicio(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:border-slate-700 transition-colors text-sm" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuario / Email</label>
                        <input placeholder="correo@email.com" value={usuario} onChange={e => setUsuario(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:border-slate-700 transition-colors text-sm" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contraseña</label>
                        <div className="flex gap-1">
                            <input type="text" placeholder="••••••" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-l-xl outline-none focus:border-slate-700 transition-colors text-sm font-mono" required />
                            <button type="button" onClick={() => setPasswordInput(generateStrongPassword())}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 rounded-r-xl border transition-colors" title="Generar contraseña segura">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
                        <select value={categoria} onChange={e => setCategoria(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-xl outline-none bg-white text-sm transition-colors">
                            {CATEGORIAS_PASSWORDS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">URL (opcional)</label>
                        <input placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-xl outline-none focus:border-slate-700 transition-colors text-sm" />
                    </div>
                    <button type="submit" className="bg-slate-800 text-white py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-colors text-sm">
                        Guardar
                    </button>
                </form>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    placeholder="Buscar por servicio, usuario o categoría..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-400 text-sm transition-colors shadow-sm"
                />
            </div>

            {/* Lista de credenciales */}
            {filteredPasswords.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Lock size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">{passwords.length === 0 ? 'Tu bóveda está vacía' : 'Sin resultados'}</p>
                    <p className="text-slate-400 text-sm mt-1">{passwords.length === 0 ? 'Agrega tu primera credencial arriba.' : 'Intenta con otra búsqueda.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredPasswords.map(item => {
                        const catStyle = CAT_COLORS[item.categoria] || CAT_COLORS['Otro'];
                        const isEditing = editingId === item.id;

                        return (
                            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${catStyle.border}`}>
                                {/* Card header */}
                                <div className={`${catStyle.bg} px-5 py-3 flex justify-between items-center border-b ${catStyle.border}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{catStyle.icon}</span>
                                        <div>
                                            {isEditing ? (
                                                <input value={editForm.servicio ?? item.servicio}
                                                    onChange={e => setEditForm(prev => ({ ...prev, servicio: e.target.value }))}
                                                    className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border outline-none text-sm" />
                                            ) : (
                                                <h4 className="font-bold text-slate-800">{item.servicio}</h4>
                                            )}
                                            <p className={`text-xs font-medium ${catStyle.text}`}>{item.categoria}</p>
                                        </div>
                                    </div>
                                    {item.url && !isEditing && (
                                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                                            className="text-slate-400 hover:text-slate-600 transition-colors" title="Abrir sitio">
                                            <Globe size={16} />
                                        </a>
                                    )}
                                </div>

                                {/* Card body */}
                                <div className="p-5 space-y-3">
                                    {/* Usuario */}
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Usuario</p>
                                        {isEditing ? (
                                            <input value={editForm.usuario ?? item.usuario}
                                                onChange={e => setEditForm(prev => ({ ...prev, usuario: e.target.value }))}
                                                className="w-full px-2 py-1 border rounded text-sm outline-none" />
                                        ) : (
                                            <p className="text-sm font-medium text-slate-700 font-mono">{item.usuario}</p>
                                        )}
                                    </div>

                                    {/* Contraseña */}
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Contraseña</p>
                                        {isEditing ? (
                                            <div className="flex gap-1">
                                                <input type="text" placeholder="Dejar vacío para mantener"
                                                    value={editForm.newPassword || ''}
                                                    onChange={e => setEditForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                                    className="w-full px-2 py-1 border rounded-l text-sm outline-none font-mono" />
                                                <button type="button" onClick={() => setEditForm(prev => ({ ...prev, newPassword: generateStrongPassword() }))}
                                                    className="bg-slate-100 hover:bg-slate-200 px-2 rounded-r border text-slate-600"><RefreshCw size={12} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono text-slate-700 flex-1 truncate">
                                                    {showPasswords[item.id] && decryptedCache[item.id]
                                                        ? decryptedCache[item.id]
                                                        : '••••••••••••••'
                                                    }
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleShowPassword(item)}
                                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                                                        title={showPasswords[item.id] ? 'Ocultar' : 'Mostrar'}>
                                                        {showPasswords[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                    <button onClick={() => handleCopy(item)}
                                                        className={`p-1.5 rounded-lg transition-all ${copiedId === item.id ? 'bg-emerald-100 text-emerald-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                                        title="Copiar contraseña">
                                                        {copiedId === item.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* URL en edición */}
                                    {isEditing && (
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">URL</p>
                                            <input value={editForm.url ?? item.url ?? ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                                                className="w-full px-2 py-1 border rounded text-sm outline-none" />
                                        </div>
                                    )}

                                    {/* Acciones */}
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                        <span className="text-[10px] text-slate-300">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CO') : ''}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={() => handleUpdatePassword(item)}
                                                        className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-emerald-600">Guardar</button>
                                                    <button onClick={() => { setEditingId(null); setEditForm({}); }}
                                                        className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-slate-300">Cancelar</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => { setEditingId(item.id); setEditForm({ servicio: item.servicio, usuario: item.usuario, url: item.url || '' }); }}
                                                        className="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-all" title="Editar">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => { genericDelete('passwords', item.id); setDecryptedCache(prev => { const n = { ...prev }; delete n[item.id]; return n; }); }}
                                                        className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-all" title="Eliminar">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
// =============================================
// === COMPONENTE: AI COACH (CLAUDE OPUS 4.8) ===
// =============================================
const AICoach = ({ transacciones, deudas, metas, presupuestoItems, limites, habitos = [], diario = [], googleToken = null, coachMensajes = [], coachPerfil = [], genericAdd, genericUpdate, genericDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
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
    // Coach proactivo: aviso emergente al abrir la app.
    const [showProactivo, setShowProactivo] = useState(false);
    const [proactivoMensaje, setProactivoMensaje] = useState('');
    const [proactivoCargando, setProactivoCargando] = useState(false);
    const [alertasLocales, setAlertasLocales] = useState([]);
    const proactivoHechoRef = useRef(false);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const nativeSRRef = useRef(null); // módulo del plugin nativo de voz (solo iOS)

    // ¿El navegador soporta reconocimiento de voz? (Safari iOS usa el prefijo webkit)
    const SpeechRecognition = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;
    // En la app nativa usamos el dictado de iOS (la Web Speech API no funciona en WKWebView).
    const vozDisponible = Capacitor.isNativePlatform() || !!SpeechRecognition;

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
            .map(m => ({ id: m.id, role: m.role, content: m.content }));
        setMessages(ordenados);
    }, [coachMensajes, isTyping]);

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
        const gastosMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && esEsteMes(t.fecha)).reduce((acc, t) => acc + t.monto, 0);
        const deudasPendientes = deudas.reduce((acc, d) => acc + (Number(d.montoTotal || 0) - Number(d.montoPagado || 0)), 0);
        const inversiones = transacciones.filter(t => t.esInversion || t.categoria === 'Aporte Inversión');
        const inversionesTotales = inversiones.reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

        // --- Gastos del mes por categoría ---
        const gastosPorCat = {};
        transacciones
            .filter(t => t.tipo === 'gasto' && !t.esInversion && esEsteMes(t.fecha))
            .forEach(t => { gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });
        const gastosCatTxt = Object.entries(gastosPorCat)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, val]) => `- ${cat}: ${fmt(val)}`)
            .join('\n');

        // --- Movimientos de HOY (clave para preguntas tipo "gastos de hoy") ---
        const gastosHoy = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && esHoy(t.fecha));
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
            return `- ${m.nombre} (financiera, plazo: ${m.plazo || 'sin definir'}): ${fmt(actual)} de ${fmt(objetivo)} (${pct}%)`;
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
            return `- ${h.emoji || ''} ${h.nombre}: racha de ${streak} día(s)${hoy ? ' (✅ hecho hoy)' : ' (⬜ pendiente hoy)'}, ${ultimos7}/7 últimos días`;
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

        // --- Google Tasks (lista @default) ---
        let googleTasksTxt = '';
        if (googleToken) {
            try {
                const gres = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=50', {
                    headers: { Authorization: `Bearer ${googleToken}` }
                });
                if (gres.ok) {
                    const gdata = await gres.json();
                    googleTasksTxt = (gdata.items || [])
                        .filter(t => t.status !== 'completed')
                        .map(t => `- ${t.title}${t.due ? ` (vence ${t.due.split('T')[0]})` : ''}`)
                        .join('\n');
                }
            } catch (_) { /* ignorar errores de Google Tasks */ }
        }

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

TAREAS DE GOOGLE TASKS:
${googleTasksTxt || (googleToken ? 'No hay tareas pendientes en Google Tasks.' : 'Google Tasks no está conectado.')}

HÁBITOS Y RACHAS:
${habitosTxt || 'No hay hábitos registrados.'}

DIARIO / ESTADO DE ÁNIMO (últimas entradas)${promedioAnimo ? ` — promedio reciente: ${promedioAnimo}/5` : ''}:
${diarioTxt || 'No hay entradas en el diario.'}`;
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
            default:
                return { icon: '⚙️', titulo: tu.name, detalle: '' };
        }
    };

    // Ejecuta UNA herramienta solicitada por el coach. Devuelve texto de resultado
    // que se le reenvía a Claude como tool_result para que confirme en lenguaje natural.
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
                        completada: false,
                        checklist: [],
                        metaFinancieraId: null
                    });
                    return `OK: meta "${input.nombre}" creada.`;
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
                default:
                    return 'Error: herramienta desconocida.';
            }
        } catch (e) {
            console.error('Error ejecutando herramienta', tu.name, e);
            return 'Error al ejecutar la acción: ' + (e?.message || 'desconocido');
        }
    };

    // Llama al backend en modo agéntico. Devuelve { reply, content, stop_reason }.
    const llamarCoach = async (msgs) => {
        const baseCtx = await buildFinancialContext();
        const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });
        const context = `FECHA Y HORA ACTUAL: ${ahora} (hoy = ${dateKey()}).\n\n${baseCtx}`;
        const res = await fetch(`${API_BASE}/api/ai-coach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, messages: msgs, enableTools: true })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error en la API del Coach');
        }
        return res.json();
    };

    // Un paso del agente: si Claude pide herramientas, muestra la confirmación;
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

    // El usuario aprobó la acción: ejecutar herramientas y dejar que Claude confirme.
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

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        if (pendingConfirm) return; // hay una acción esperando confirmación

        if (isListening) { try { recognitionRef.current?.stop(); } catch (_) {} }
        const userMsg = input.trim();
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
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Lo siento, hubo un error de conexión con el Coach IA. Intenta de nuevo en unos segundos.' }]);
            setIsTyping(false);
        }
    };

    // --- COACH PROACTIVO ---
    // Alertas locales (sin costo de IA): se calculan al instante con los datos ya cargados.
    const calcularAlertas = () => {
        const alertas = [];
        const hoyKey = dateKey();
        const mesKey = hoyKey.slice(0, 7);
        const cicloActual = hoyKey.slice(0, 7);
        const esEsteMes = (f) => typeof f === 'string' && f.slice(0, 7) === mesKey;
        const esHoy = (f) => f === hoyKey;

        // Gastos del mes por categoría (para límites)
        const gastosPorCat = {};
        transacciones
            .filter(t => t.tipo === 'gasto' && !t.esInversion && esEsteMes(t.fecha))
            .forEach(t => { gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });

        // Límites excedidos
        limites.forEach(l => {
            const g = gastosPorCat[l.categoria] || 0;
            if (Number(l.limite) > 0 && g > Number(l.limite)) {
                alertas.push({ tipo: 'limite', texto: `Pasaste tu límite de ${l.categoria}: llevas ${formatCurrency(g)} de ${formatCurrency(l.limite)} este mes.` });
            }
        });

        // Gastos del mes superan los ingresos del mes
        const ingMes = transacciones.filter(t => t.tipo === 'ingreso' && esEsteMes(t.fecha)).reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const gasMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && esEsteMes(t.fecha)).reduce((a, c) => a + (Number(c.monto) || 0), 0);
        if (ingMes > 0 && gasMes > ingMes) {
            alertas.push({ tipo: 'balance', texto: `Este mes has gastado más de lo que ingresaste: ${formatCurrency(gasMes)} vs ${formatCurrency(ingMes)}.` });
        }

        // Gasto hormiga de hoy
        const hormigaHoy = transacciones
            .filter(t => t.tipo === 'gasto' && esHoy(t.fecha) && t.categoria === 'Gastos Hormiga')
            .reduce((a, c) => a + (Number(c.monto) || 0), 0);
        if (hormigaHoy > 0) {
            alertas.push({ tipo: 'hormiga', texto: `Hoy llevas ${formatCurrency(hormigaHoy)} en gastos hormiga. Los pequeños gastos suman al final del mes.` });
        }

        // Pagos próximos (≤3 días, no pagados este ciclo)
        presupuestoItems.forEach(i => {
            const prox = proximaFechaPago(i.diaPago);
            if (prox && prox.dias <= 3 && i.lastPaid !== cicloActual) {
                const cuando = prox.dias === 0 ? 'vence hoy' : prox.dias === 1 ? 'vence mañana' : `en ${prox.dias} días`;
                alertas.push({ tipo: 'pago', texto: `Pago próximo: ${i.concepto} ${cuando} (${formatCurrency(i.monto)}).` });
            }
        });

        return alertas;
    };

    const generarProactivo = async () => {
        const hoy = dateKey();

        // El análisis del coach se genera y se muestra UNA SOLA VEZ AL DÍA.
        // Si ya se generó hoy (en esta o en cualquier apertura anterior), no hacemos nada:
        // ni se vuelve a llamar a la IA (ahorro de tokens) ni se vuelve a mostrar el aviso.
        let cache = null;
        try { cache = JSON.parse(localStorage.getItem('coach_proactivo') || 'null'); } catch (e) { /* */ }
        if (cache && cache.fecha === hoy) {
            return;
        }

        // Reclamamos el día de INMEDIATO (antes de llamar a la IA). Así, si abres la app
        // otra vez mientras este análisis aún se está generando, la segunda apertura ve
        // que el día ya está tomado y no dispara un segundo análisis.
        try { localStorage.setItem('coach_proactivo', JSON.stringify({ fecha: hoy, mensaje: '' })); } catch (e) { /* */ }

        const alertas = calcularAlertas();
        setAlertasLocales(alertas);
        setShowProactivo(true);
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
                headers: { 'Content-Type': 'application/json' },
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

        // Si no hay nada que decir (ni alertas ni mensaje), no molestamos.
        if (!mensaje && alertas.length === 0) setShowProactivo(false);
    };

    // Dispara el coach proactivo una sola vez por sesión, cuando ya hay datos cargados.
    useEffect(() => {
        if (proactivoHechoRef.current) return;
        if (transacciones.length === 0 && metas.length === 0) return; // espera a que carguen los datos
        proactivoHechoRef.current = true;
        generarProactivo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transacciones, metas]);

    const estiloAlerta = (tipo) => {
        switch (tipo) {
            case 'limite': return { clase: 'bg-rose-50 text-rose-700 border border-rose-100', icono: '🚨' };
            case 'balance': return { clase: 'bg-rose-50 text-rose-700 border border-rose-100', icono: '📉' };
            case 'hormiga': return { clase: 'bg-amber-50 text-amber-700 border border-amber-100', icono: '🐜' };
            case 'pago': return { clase: 'bg-indigo-50 text-indigo-700 border border-indigo-100', icono: '📅' };
            default: return { clase: 'bg-slate-50 text-slate-700 border border-slate-100', icono: '💡' };
        }
    };

    return (
      <>
        {/* === AVISO EMERGENTE DEL COACH (al abrir la app) === */}
        {showProactivo && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowProactivo(false)}>
                <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <Sparkles size={22} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg leading-tight">Tu coach hoy</h3>
                            <p className="text-[11px] text-indigo-100 font-medium">Un vistazo a tus finanzas al abrir la app</p>
                        </div>
                        <button onClick={() => setShowProactivo(false)} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    {/* Body */}
                    <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
                        {alertasLocales.length > 0 && (
                            <div className="space-y-2">
                                {alertasLocales.map((a, i) => {
                                    const est = estiloAlerta(a.tipo);
                                    return (
                                        <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl text-[13px] leading-snug font-medium ${est.clase}`}>
                                            <span className="shrink-0 text-base leading-none">{est.icono}</span>
                                            <span>{a.texto}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {proactivoCargando ? (
                            <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                                <span className="ml-1">Analizando tus finanzas…</span>
                            </div>
                        ) : proactivoMensaje ? (
                            <div className="prose prose-sm max-w-none text-slate-700 prose-p:my-1 prose-strong:text-indigo-700 marker:text-indigo-400"
                                dangerouslySetInnerHTML={{ __html: proactivoMensaje.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                        ) : null}
                    </div>
                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 flex gap-2">
                        <button onClick={() => setShowProactivo(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Entendido</button>
                        <button onClick={() => { setShowProactivo(false); setIsOpen(true); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5">
                            <Sparkles size={15} /> Hablar con el coach
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="fixed bottom-40 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Panel */}
            <div className={`pointer-events-auto transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100 mb-4 visible' : 'scale-0 opacity-0 invisible'} bg-white rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden flex flex-col w-[90vw] md:w-[400px] h-[600px] max-h-[75vh]`}>
                
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex justify-between items-center shadow-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-tight">Coach IA</h3>
                            <p className="text-[11px] text-indigo-100 font-medium">Finanzas 360 · Claude Opus</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setPerfilDraft(perfilNotas); setShowPerfil(v => !v); }} title="Sobre mí (lo que el coach siempre recordará)" className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showPerfil ? 'bg-white/30' : 'hover:bg-white/20'}`}>
                            <UserCog size={18} />
                        </button>
                        <button onClick={handleNuevaConversacion} title="Nueva conversación (borra el historial)" className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                            <Trash2 size={18} />
                        </button>
                        <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Panel "Sobre mí" (memoria de largo plazo) */}
                {showPerfil && (
                    <div className="bg-indigo-50 border-b border-indigo-100 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <UserCog size={16} className="text-indigo-600" />
                            <h4 className="font-bold text-sm text-indigo-800">Sobre mí</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">Escribe lo que quieras que el coach recuerde siempre: tu situación, prioridades, compromisos, lo que te cuesta, etc. Esto viaja en cada conversación.</p>
                        <textarea
                            value={perfilDraft}
                            onChange={e => setPerfilDraft(e.target.value)}
                            rows={4}
                            placeholder="Ej: Tengo 2 hijos, mi prioridad es comprar casa en 2027. Me cuesta controlar gastos en restaurantes. Quiero crear un fondo de emergencia de 6 meses."
                            className="w-full text-xs p-2 border border-indigo-200 rounded-xl outline-none focus:border-indigo-400 resize-none bg-white"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setShowPerfil(false)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancelar</button>
                            <button onClick={handleGuardarPerfil} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-1">
                                <Save size={13} /> Guardar
                            </button>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 bg-slate-50 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
                    {perfilGuardado && (
                        <div className="text-center text-[11px] text-emerald-600 font-medium">✓ Perfil guardado</div>
                    )}
                    {messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-60">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                                <Sparkles size={30} className="text-indigo-600" />
                            </div>
                            <h4 className="font-bold text-slate-700 text-lg">Pregúntame o pídeme algo</h4>
                            <p className="text-xs text-slate-500">Analizo tus finanzas y también ejecuto acciones: "anota 50 mil de mercado", "agenda reunión mañana 3pm", "recuérdame pagar el arriendo el viernes".</p>
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-[13px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'}`}>
                                    {m.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-headings:text-indigo-700 marker:text-indigo-400" dangerouslySetInnerHTML={{__html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}} />
                                    ) : (
                                        m.content
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-sm flex gap-1 items-center shadow-sm">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{animationDelay: '0ms'}}></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{animationDelay: '150ms'}}></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{animationDelay: '300ms'}}></span>
                            </div>
                        </div>
                    )}
                    {pendingConfirm && (
                        <div className="flex justify-start">
                            <div className="w-full max-w-[92%] bg-white border border-indigo-200 rounded-2xl rounded-tl-sm p-3 shadow-sm">
                                {pendingConfirm.intro && (
                                    <p className="text-[13px] text-slate-700 mb-2 leading-relaxed">{pendingConfirm.intro}</p>
                                )}
                                <div className="space-y-2">
                                    {pendingConfirm.toolUses.map((tu, idx) => {
                                        const d = describirAccion(tu);
                                        return (
                                            <div key={idx} className="flex items-start gap-2 bg-indigo-50 rounded-xl p-2.5">
                                                <span className="text-lg leading-none">{d.icon}</span>
                                                <div className="min-w-0">
                                                    <p className="text-[12px] font-bold text-indigo-800">{d.titulo}</p>
                                                    <p className="text-[12px] text-slate-600 break-words">{d.detalle}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <button onClick={cancelarAccion} className="flex-1 text-[13px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl py-2 transition-colors">Cancelar</button>
                                    <button onClick={confirmarAccion} className="flex-1 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl py-2 transition-colors flex items-center justify-center gap-1.5">
                                        <CheckCircle2 size={15} /> Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-slate-100">
                    {vozError && (
                        <p className="text-[11px] text-rose-500 mb-1.5 px-2">{vozError}</p>
                    )}
                    {isListening && (
                        <p className="text-[11px] text-indigo-600 font-medium mb-1.5 px-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                            Escuchando… habla y luego envía.
                        </p>
                    )}
                    <form onSubmit={handleSend} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-inner">
                        {vozDisponible && (
                            <button
                                type="button" onClick={toggleVoz} disabled={isTyping || !!pendingConfirm}
                                title={isListening ? 'Detener dictado' : 'Dictar por voz'}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}
                            >
                                <Mic size={18} />
                            </button>
                        )}
                        <input
                            value={input} onChange={e => setInput(e.target.value)} placeholder={pendingConfirm ? 'Confirma o cancela la acción de arriba…' : (isListening ? 'Habla ahora…' : 'Pide consejo o una acción…')}
                            className="flex-1 bg-transparent px-3 py-2 outline-none text-sm text-slate-700"
                            disabled={isTyping || !!pendingConfirm}
                        />
                        <button type="submit" disabled={!input.trim() || isTyping || !!pendingConfirm} className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center transition-colors shrink-0 shadow-md">
                            <ArrowRightCircle size={18} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Floating FAB Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-800 text-white rotate-90 scale-90' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-indigo-500/50'}`}
            >
                {isOpen ? <X size={24} /> : <Sparkles size={24} />}
            </button>
        </div>
      </>
    );
};

// =============================================
// === GOOGLE OAUTH (flujo implícito) ===
// =============================================
const GOOGLE_CLIENT_ID = '871176559846-qctr4g2s05te327su654gpg91oq85gfd.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

// Pide un token de acceso de Google.
// interactive=true muestra el selector de cuenta; interactive=false intenta una renovación silenciosa
// (prompt:'' reutiliza la sesión y el consentimiento ya dados, sin volver a pedir permisos).
const GOOGLE_API_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/tasks'];

const requestGoogleToken = (interactive) => {
    // App nativa (iOS) o escritorio (Electron): flujo OAuth del lado del servidor
    // (conexión permanente). interactive=true abre el navegador para autorizar
    // una vez; interactive=false pide un token fresco al servidor en silencio
    // (renovación sin UI).
    if (Capacitor.isNativePlatform() || window.desktop?.isElectron) {
        return interactive ? conectarGoogle() : obtenerTokenGoogle();
    }

    return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services no está cargado aún.'));
        return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
            if (response.error) { reject(response); return; }
            const expiresAt = Date.now() + ((Number(response.expires_in) || 3600) * 1000);
            try {
                localStorage.setItem('google_calendar_token', JSON.stringify({ token: response.access_token, expiresAt }));
                localStorage.setItem('google_connected', '1');
            } catch (e) { /* almacenamiento lleno o bloqueado */ }
            resolve({ token: response.access_token, expiresAt });
        },
        error_callback: (err) => reject(err),
    });
    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
    });
};

// Borra el token y la marca de "conectado" (detiene la renovación silenciosa).
const disconnectGoogle = () => {
    if (Capacitor.isNativePlatform()) {
        // En nativo también revoca el refresh token guardado en el servidor.
        desconectarGoogle().catch(() => {});
        return;
    }
    try {
        localStorage.removeItem('google_calendar_token');
        localStorage.removeItem('google_connected');
    } catch (e) { /* ignora */ }
};

// =============================================
// === COMPONENTE: PRODUCTIVITY HUB ===
// =============================================
const ProductivityHub = ({ genericAdd, genericUpdate, genericDelete, googleToken, setGoogleToken }) => {
    const [activeView, setActiveView] = useState('calendar'); // 'calendar' | 'gtasks'

    // Calendar
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [eventError, setEventError] = useState('');

    // Google Tasks
    const [gtasks, setGtasks] = useState([]);
    const [loadingGtasks, setLoadingGtasks] = useState(false);
    const [gtaskError, setGtaskError] = useState('');
    const [newGtaskTitle, setNewGtaskTitle] = useState('');
    const [newGtaskDue, setNewGtaskDue] = useState('');
    
    // Formulario Evento
    const [eventTitle, setEventTitle] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventDuration, setEventDuration] = useState('60');

    // Inicializar Google Client (conexión interactiva)
    const handleGoogleLogin = async () => {
        try {
            // Nativo: login de Google dentro de la app (sin Safari). conectarGoogle
            // hace el login nativo, canjea el serverAuthCode en el servidor y
            // devuelve el primer token.
            const { token } = await requestGoogleToken(true);
            setGoogleToken(token);
            fetchEvents(token);
        } catch (e) {
            console.error('Error Google Auth:', e);
            alert('No se pudo conectar con Google. Intenta de nuevo en unos segundos.');
        }
    };

    const fetchEvents = async (token) => {
        if (!token) return;
        setLoadingEvents(true);
        setEventError('');
        try {
            const timeMin = new Date().toISOString();
            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&orderBy=startTime&singleEvents=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401) {
                // Token caducado o revocado: limpiar para volver a "Conectar".
                localStorage.removeItem('google_calendar_token');
                setGoogleToken(null);
                setEvents([]);
                return;
            }
            if (res.status === 403) {
                let detalle = '';
                try { detalle = (await res.json())?.error?.message || ''; } catch (e) { /* sin cuerpo */ }
                if (/has not been used|is disabled|disabled/i.test(detalle)) {
                    setEventError('La API de Google Calendar no está habilitada en tu proyecto de Google Cloud. Actívala en console.cloud.google.com (APIs y servicios → habilitar "Google Calendar API") y vuelve a intentar.');
                } else {
                    setEventError('Reconecta tu cuenta de Google para activar el permiso de Calendar.' + (detalle ? ` (${detalle})` : ''));
                }
                setEvents([]);
                return;
            }
            const data = await res.json();
            setEvents(data.items || []);
        } catch (error) {
            console.error('Error fetching events:', error);
            setEventError('No se pudieron cargar los eventos de Calendar.');
        } finally {
            setLoadingEvents(false);
        }
    };

    useEffect(() => {
        if (googleToken && activeView === 'calendar') fetchEvents(googleToken);
    }, [googleToken, activeView]);

    // --- Google Tasks (API REST) ---
    const GTASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

    const fetchGoogleTasks = async (token) => {
        if (!token) return;
        setLoadingGtasks(true);
        setGtaskError('');
        try {
            const res = await fetch(`${GTASKS_BASE}?showCompleted=false&maxResults=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                // 401 = token sin permiso de Tasks (reconectar). 403 = puede ser API deshabilitada.
                let detalle = '';
                try {
                    const err = await res.json();
                    detalle = err?.error?.message || '';
                } catch (e) { /* sin cuerpo */ }
                if (res.status === 403 && /has not been used|is disabled|disabled/i.test(detalle)) {
                    setGtaskError('La API de Google Tasks no está habilitada en tu proyecto de Google Cloud. Actívala en console.cloud.google.com (APIs y servicios → habilitar "Tasks API") y vuelve a intentar.');
                } else {
                    setGtaskError('Reconecta tu cuenta de Google para activar el permiso de Tasks.' + (detalle ? ` (${detalle})` : ''));
                }
                setGtasks([]);
                return;
            }
            const data = await res.json();
            // Ordenar: las que tienen fecha primero, por fecha; luego el resto.
            const items = (data.items || []).slice().sort((a, b) => {
                if (a.due && b.due) return new Date(a.due) - new Date(b.due);
                if (a.due) return -1;
                if (b.due) return 1;
                return 0;
            });
            setGtasks(items);
        } catch (error) {
            console.error('Error fetching Google Tasks:', error);
            setGtaskError('No se pudieron cargar las tareas de Google.');
        } finally {
            setLoadingGtasks(false);
        }
    };

    useEffect(() => {
        if (googleToken && activeView === 'gtasks') fetchGoogleTasks(googleToken);
    }, [googleToken, activeView]);

    const handleAddGoogleTask = async (e) => {
        e.preventDefault();
        if (!googleToken) return alert('Conecta tu cuenta de Google primero.');
        if (!newGtaskTitle.trim()) return;

        const body = { title: newGtaskTitle.trim() };
        // Google Tasks usa due en formato RFC3339 (solo se respeta la fecha, no la hora).
        if (newGtaskDue) body.due = new Date(`${newGtaskDue}T00:00:00`).toISOString();

        try {
            const res = await fetch(GTASKS_BASE, {
                method: 'POST',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.status === 401 || res.status === 403) {
                let detalle = '';
                try {
                    const err = await res.json();
                    detalle = err?.error?.message || '';
                } catch (e) { /* sin cuerpo */ }
                if (res.status === 403 && /has not been used|is disabled|disabled/i.test(detalle)) {
                    setGtaskError('La API de Google Tasks no está habilitada en tu proyecto de Google Cloud. Actívala en console.cloud.google.com (APIs y servicios → habilitar "Tasks API") y vuelve a intentar.');
                } else {
                    setGtaskError('Reconecta tu cuenta de Google para activar el permiso de Tasks.' + (detalle ? ` (${detalle})` : ''));
                }
                return;
            }
            if (res.ok) {
                setNewGtaskTitle('');
                setNewGtaskDue('');
                setGtaskError('');
                fetchGoogleTasks(googleToken);
            } else {
                alert('No se pudo crear la tarea en Google Tasks.');
            }
        } catch (error) {
            console.error('Error creando Google Task:', error);
        }
    };

    const toggleGoogleTask = async (task) => {
        if (!googleToken) return;
        const nuevoEstado = task.status === 'completed' ? 'needsAction' : 'completed';
        try {
            const res = await fetch(`${GTASKS_BASE}/${task.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nuevoEstado })
            });
            if (res.ok) fetchGoogleTasks(googleToken);
        } catch (error) {
            console.error('Error actualizando Google Task:', error);
        }
    };

    const deleteGoogleTask = async (task) => {
        if (!googleToken) return;
        try {
            const res = await fetch(`${GTASKS_BASE}/${task.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${googleToken}` }
            });
            if (res.ok || res.status === 204) fetchGoogleTasks(googleToken);
        } catch (error) {
            console.error('Error eliminando Google Task:', error);
        }
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        if (!googleToken) return alert('Por favor conecta tu cuenta de Google primero.');
        
        const startDateTime = new Date(`${eventDate}T${eventTime}`);
        const endDateTime = new Date(startDateTime.getTime() + parseInt(eventDuration) * 60000);

        const eventParams = {
            summary: eventTitle,
            start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        };

        try {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventParams)
            });
            if (res.ok) {
                setEventTitle(''); setEventDate(''); setEventTime('');
                fetchEvents(googleToken);
                alert('¡Evento creado en Google Calendar!');
            } else {
                const err = await res.json();
                console.error('Error creando evento', err);
                alert('No se pudo crear el evento.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 rounded-3xl shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <ListTodo size={28} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold">Agenda & Tareas</h2>
                            <p className="text-blue-100 text-sm">Tu Google Calendar y Google Tasks en un solo lugar</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-full md:max-w-md">
                <button onClick={() => setActiveView('calendar')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <CalendarDays size={16} /> Calendar
                </button>
                <button onClick={() => setActiveView('gtasks')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === 'gtasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <ListTodo size={16} /> Google Tasks
                </button>
            </div>

            {/* CALENDAR VIEW */}
            {activeView === 'calendar' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-200">
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.08,22 21.67,18.52 21.67,12.29C21.67,11.9 21.5,11.1 21.5,11.1"></path></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Google Calendar</h3>
                                <p className="text-xs text-slate-500">{googleToken ? 'Conectado. Sincronización activa.' : 'Conecta tu cuenta para agendar y ver citas'}</p>
                            </div>
                        </div>
                        {!googleToken ? (
                            <button onClick={handleGoogleLogin} className="bg-white border text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                                <Globe size={16} /> Conectar Google
                            </button>
                        ) : (
                            <button onClick={() => {disconnectGoogle(); setGoogleToken(null); setEvents([]);}} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Desconectar</button>
                        )}
                    </div>

                    {googleToken && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                            {/* Formulario Evento */}
                            <div className="p-6 lg:col-span-1 bg-slate-50/50">
                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Plus size={16}/> Agendar Evento</h4>
                                <form onSubmit={handleAddEvent} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Título / Motivo</label>
                                        <input placeholder="Ej: Cita Odontólogo" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required
                                            className="w-full px-3 py-2 border rounded-lg outline-none focus:border-indigo-500 text-sm" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Fecha</label>
                                            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required min={dateKey()}
                                                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-indigo-500 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Hora Inicio</label>
                                            <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} required
                                                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-indigo-500 text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Duración (minutos)</label>
                                        <select value={eventDuration} onChange={e => setEventDuration(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg outline-none focus:border-indigo-500 text-sm">
                                            <option value="15">15 min (Cita Rápida)</option>
                                            <option value="30">30 min (Reunión Corta)</option>
                                            <option value="60">1 Hora (Estándar)</option>
                                            <option value="120">2 Horas (Extensa)</option>
                                        </select>
                                    </div>
                                    <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm mt-2 text-sm">
                                        Agendar y Sincronizar
                                    </button>
                                </form>
                            </div>

                            {/* Lista Eventos */}
                            <div className="p-6 lg:col-span-2">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><CalendarDays size={18} className="text-indigo-500"/> Próximos Eventos</h4>
                                    <button onClick={() => fetchEvents(googleToken)} className="text-slate-400 hover:text-indigo-600"><RefreshCw size={14}/></button>
                                </div>
                                
                                {loadingEvents ? (
                                    <div className="flex flex-col justify-center items-center py-10 opacity-50">
                                        <Loader2 size={24} className="animate-spin text-indigo-500 mb-2" />
                                        <span className="text-sm font-medium">Sincronizando...</span>
                                    </div>
                                ) : eventError ? (
                                    <div className="text-center py-6 px-4 bg-amber-50 rounded-xl border border-dashed border-amber-300">
                                        <p className="text-amber-700 text-sm">{eventError}</p>
                                    </div>
                                ) : events.length === 0 ? (
                                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-500 text-sm">No tienes eventos próximos en tu calendario principal.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {events.map((ev, i) => {
                                            const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date);
                                            const isToday = new Date().toDateString() === start.toDateString();
                                            return (
                                                <div key={ev.id || i} className="flex gap-4 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                                                    <div className="flex flex-col items-center justify-center min-w-[50px] bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                                                        <span className="text-xs font-bold text-slate-400 uppercase">{start.toLocaleString('es', {weekday: 'short'})}</span>
                                                        <span className={`text-lg font-bold -mt-1 ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{start.getDate()}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h5 className="font-bold text-slate-800 text-sm mb-0.5">{ev.summary || '(Sin título)'}</h5>
                                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Clock size={12} /> 
                                                            {ev.start.dateTime 
                                                                ? `${start.toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'})} - ${new Date(ev.end.dateTime).toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'})}` 
                                                                : 'Todo el día'}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* GOOGLE TASKS VIEW */}
            {activeView === 'gtasks' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-200">
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.08,22 21.67,18.52 21.67,12.29C21.67,11.9 21.5,11.1 21.5,11.1"></path></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Google Tasks</h3>
                                <p className="text-xs text-slate-500">{googleToken ? 'Conectado. Estas son tus tareas de Google.' : 'Conecta tu cuenta para ver y crear tareas'}</p>
                            </div>
                        </div>
                        {!googleToken ? (
                            <button onClick={handleGoogleLogin} className="bg-white border text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                                <Globe size={16} /> Conectar Google
                            </button>
                        ) : (
                            <button onClick={() => {disconnectGoogle(); setGoogleToken(null); setGtasks([]);}} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Desconectar</button>
                        )}
                    </div>

                    {googleToken && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                            {/* Formulario Nueva Tarea Google */}
                            <div className="p-6 lg:col-span-1 bg-slate-50/50">
                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Plus size={16}/> Nueva Tarea en Google</h4>
                                <form onSubmit={handleAddGoogleTask} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">¿Qué necesitas hacer?</label>
                                        <input placeholder="Ej: Pagar arriendo" value={newGtaskTitle} onChange={e => setNewGtaskTitle(e.target.value)} required
                                            className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Fecha límite (opcional)</label>
                                        <input type="date" value={newGtaskDue} onChange={e => setNewGtaskDue(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm" />
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm mt-2 text-sm">
                                        Crear en Google Tasks
                                    </button>
                                </form>
                            </div>

                            {/* Lista Google Tasks */}
                            <div className="p-6 lg:col-span-2">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><ListTodo size={18} className="text-blue-500"/> Mis Tareas de Google ({gtasks.length})</h4>
                                    <button onClick={() => fetchGoogleTasks(googleToken)} className="text-slate-400 hover:text-blue-600"><RefreshCw size={14}/></button>
                                </div>

                                {gtaskError ? (
                                    <div className="text-center py-8 bg-amber-50 rounded-xl border border-dashed border-amber-200">
                                        <p className="text-amber-700 text-sm mb-3">{gtaskError}</p>
                                        <button onClick={handleGoogleLogin} className="bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors inline-flex items-center gap-2">
                                            <Globe size={16} /> Reconectar Google
                                        </button>
                                    </div>
                                ) : loadingGtasks ? (
                                    <div className="flex flex-col justify-center items-center py-10 opacity-50">
                                        <Loader2 size={24} className="animate-spin text-blue-500 mb-2" />
                                        <span className="text-sm font-medium">Cargando...</span>
                                    </div>
                                ) : gtasks.length === 0 ? (
                                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-500 text-sm">No tienes tareas pendientes en Google Tasks.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {gtasks.map(task => {
                                            const due = task.due ? new Date(task.due) : null;
                                            return (
                                                <div key={task.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 transition-all hover:shadow-sm group">
                                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                                        <button onClick={() => toggleGoogleTask(task)} className="shrink-0 text-slate-300 hover:text-emerald-500 transition-colors">
                                                            <div className="w-[22px] h-[22px] rounded-full border-2 border-current" />
                                                        </button>
                                                        <div className="flex-1 overflow-hidden">
                                                            <span className="text-slate-700 font-medium block truncate">{task.title || '(Sin título)'}</span>
                                                            {due && (
                                                                <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                                    <CalendarDays size={12} /> {due.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => deleteGoogleTask(task)} className="text-slate-300 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-50">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('midia');
    const [loading, setLoading] = useState(true);
    const [prefillData, setPrefillData] = useState(null);
    const [pendingBudgetId, setPendingBudgetId] = useState(null);
    const [showQuickExpense, setShowQuickExpense] = useState(false);

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
    const [coachMensajes, setCoachMensajes] = useState([]);
    const [coachPerfil, setCoachPerfil] = useState([]);
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

    // Notificaciones (avisos de límite de gastos)
    const [notifPermiso, setNotifPermiso] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

    const activarNotificaciones = async () => {
        if (typeof Notification === 'undefined') {
            alert('Tu navegador no soporta notificaciones. En iPhone, agrega la app a la pantalla de inicio y ábrela desde ahí.');
            return;
        }
        try {
            const permiso = await Notification.requestPermission();
            setNotifPermiso(permiso);
            if (permiso === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification('Avisos activados', {
                    body: 'Te avisaré cuando te pases de un límite de gastos.',
                    icon: '/icon-192.png',
                    badge: '/icon-192.png'
                });
            } else if (permiso === 'denied') {
                alert('Bloqueaste las notificaciones. Actívalas desde los ajustes del navegador para recibir avisos.');
            }
        } catch (e) {
            console.error('Error pidiendo permiso de notificaciones:', e);
        }
    };

    // Dispara aviso de "límite excedido" una sola vez por categoría cada mes.
    useEffect(() => {
        if (notifPermiso !== 'granted' || !limites.length) return;

        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();
        const mesKey = `${anioActual}-${mesActual}`;

        const gastosPorCat = transacciones
            .filter(t => t.tipo === 'gasto' && !t.esInversion && t.fecha
                && new Date(t.fecha).getMonth() === mesActual
                && new Date(t.fecha).getFullYear() === anioActual)
            .reduce((acc, t) => {
                acc[t.categoria] = (acc[t.categoria] || 0) + (Number(t.monto) || 0);
                return acc;
            }, {});

        let notificados;
        try { notificados = JSON.parse(localStorage.getItem('limites_notificados') || '{}'); } catch (e) { notificados = {}; }
        if (notificados.mes !== mesKey) notificados = { mes: mesKey, cats: [] };

        navigator.serviceWorker.ready.then(reg => {
            limites.forEach(l => {
                const gastado = gastosPorCat[l.categoria] || 0;
                const tope = Number(l.limite) || 0;
                if (tope > 0 && gastado > tope && !notificados.cats.includes(l.categoria)) {
                    const exceso = gastado - tope;
                    reg.showNotification(`Límite excedido: ${l.categoria}`, {
                        body: `Llevas ${formatCurrency(gastado)} de ${formatCurrency(tope)} este mes (${formatCurrency(exceso)} de más).`,
                        icon: '/icon-192.png',
                        badge: '/icon-192.png',
                        tag: `limite-${l.categoria}`
                    });
                    notificados.cats.push(l.categoria);
                }
            });
            localStorage.setItem('limites_notificados', JSON.stringify(notificados));
        }).catch(e => console.error('SW no listo para notificar:', e));
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

        const unsubCoach = onSnapshot(collection(db, `${basePath}/coach_mensajes`), (snap) =>
            setCoachMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const unsubCoachPerfil = onSnapshot(collection(db, `${basePath}/coach_perfil`), (snap) =>
            setCoachPerfil(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubTrans(); unsubDeudas(); unsubMetas(); unsubPresupuesto(); unsubLimites(); unsubPasswords(); unsubVaultConfig(); unsubHabitos(); unsubDiario(); unsubRutina(); unsubProyectos(); unsubProyectoItems(); unsubCoach(); unsubCoachPerfil(); };
    }, [user]);

    // --- ACTIONS FIREBASE ---
    const genericAdd = async (coll, data) => {
        if (!user) {
            console.error('genericAdd: No hay usuario autenticado');
            return null;
        }
        return addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/${coll}`), data);
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
            await updateDoc(docRef, data);
            console.log('Documento actualizado exitosamente');
            return true;
        } catch (error) {
            console.error('Error en genericUpdate:', error);
            throw error;
        }
    };

    const genericDelete = async (coll, id) => {
        if (!user) return null;
        return deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/${coll}`, id));
    };


    // --- HANDLER PARA PRESUPUESTO ---
    const handleEjecutarPago = (item) => {
        setPrefillData({
            concepto: item.concepto,
            monto: item.monto,
            categoria: item.categoria,
        });
        setPendingBudgetId(item.id);
        if (item.categoria === 'Aporte Inversión') setActiveTab('inversiones');
        else setActiveTab('gastos');
    };

    // --- DISEÑO: COMPONENTES DE NAVEGACIÓN ---

    const NavItem = ({ id, icon: Icon, label }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-medium text-sm
          ${isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-2'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:translate-x-1'
                    }`}
            >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
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
    const totalInvertido = transacciones
        .filter(t => t.categoria === 'Aporte Inversión' || t.esInversion === true)
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);

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
            const collections = ['transacciones', 'deudas', 'metas', 'presupuesto', 'limites', 'passwords', 'vault_config', 'habitos', 'diario', 'rutina', 'proyectos', 'proyecto_items', 'coach_mensajes', 'coach_perfil'];
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

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

    if (!user) return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] font-sans px-6">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-blue-200 mb-5">F</div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Finanzas 360</h1>
                <p className="text-slate-500 text-sm mt-2 mb-8">Inicia sesión para acceder a tus datos desde cualquier dispositivo.</p>
                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm active:scale-95"
                >
                    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                    </svg>
                    Continuar con Google
                </button>
                {authError && <p className="text-rose-500 text-sm mt-4">{authError}</p>}
            </div>
            <p className="text-slate-400 text-xs mt-6">Tus datos se guardan de forma segura y privada.</p>
        </div>
    );

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">

            {/* SIDEBAR DESKTOP */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 h-full p-6 fixed z-10 transition-all shadow-sm">
                <div className="flex items-center gap-3 px-2 mb-10 pt-2 cursor-pointer" onClick={runMigration} title="Click para Migrar Datos">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">F</div>
                    <span className="text-2xl font-bold text-slate-800 tracking-tight">Finanzas 360</span>
                </div>
                <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar pb-safe">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-2 mt-2">Mi Vida</div>
                    <NavItem id="midia" icon={Sun} label="Mi Día" />
                    <NavItem id="habitos" icon={Flame} label="Hábitos" />
                    <NavItem id="rutina" icon={CalendarClock} label="Rutina" />

                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-2 mt-8">Principal</div>
                    <NavItem id="dashboard" icon={LayoutDashboard} label="Resumen" />
                    <NavItem id="analisis" icon={BarChart3} label="Análisis Mensual" />
                    <NavItem id="presupuesto" icon={ClipboardList} label="Presupuesto" />

                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-2 mt-8">Gestión</div>
                    <NavItem id="inversiones" icon={PieChart} label="Inversiones" />
                    <NavItem id="gastos" icon={TrendingDown} label="Gastos" />
                    <NavItem id="ingresos" icon={TrendingUp} label="Ingresos" />
                    <NavItem id="deudas" icon={CreditCard} label="Deudas" />
                    <NavItem id="metas" icon={Target} label="Metas" />

                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-2 mt-8">Herramientas</div>
                    <NavItem id="agenda" icon={ListTodo} label="Agenda & Tareas" />
                    <NavItem id="proyectos" icon={FolderKanban} label="Proyectos" />
                    <NavItem id="passwords" icon={Lock} label="Contraseñas" />
                </nav>
                <div className="border-t border-slate-100 pt-4 mt-4">
                    <div className="flex items-center gap-3 px-2 mb-3">
                        {user.photoURL
                            ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
                            : <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</div>}
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{user.displayName || 'Mi cuenta'}</p>
                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            try { await navigator.clipboard.writeText(user.uid); alert('Tu ID se copió. Pégalo en el Atajo de Siri.'); }
                            catch { prompt('Copia tu ID para el Atajo de Siri:', user.uid); }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-medium text-sm"
                    >
                        <Copy size={20} />
                        <span>Copiar mi ID (para Siri)</span>
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all font-medium text-sm">
                        <LogOut size={20} />
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </aside>

            {/* MOBILE HEADER (Minimalista) */}
            <div className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-md z-30 border-b border-slate-100 px-4 py-3 flex justify-between items-center pt-safe shadow-sm transition-all">
                <div className="flex items-center gap-2 cursor-pointer min-w-0 shrink-0" onClick={runMigration}>
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">F</div>
                    <span className="font-bold text-lg text-slate-800 tracking-tight hidden min-[430px]:inline">Finanzas 360</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setActiveTab('ingresos')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'ingresos' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <TrendingUp size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('inversiones')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'inversiones' ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <PieChart size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('deudas')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'deudas' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <CreditCard size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('agenda')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'agenda' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <ListTodo size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('rutina')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'rutina' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <CalendarClock size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('proyectos')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'proyectos' ? 'bg-slate-700 text-white shadow-lg shadow-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <FolderKanban size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('passwords')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'passwords' ? 'bg-slate-800 text-white shadow-lg shadow-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <Lock size={20} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                        title="Cerrar sesión"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            <main className="flex-1 min-h-0 md:ml-72 p-4 md:p-10 mt-16 md:mt-0 overflow-y-auto pb-32 md:pb-10 no-scrollbar scroll-smooth">
                <div className="max-w-7xl mx-auto space-y-8">
                    {activeTab === 'midia' && <MiDia user={user} habitos={habitos} diario={diario} transacciones={transacciones} presupuestoItems={presupuestoItems} saldoActual={saldoActual} googleToken={googleToken} genericAdd={genericAdd} genericUpdate={genericUpdate} setActiveTab={setActiveTab} />}
                    {activeTab === 'habitos' && <HabitTracker habitos={habitos} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />}
                    {activeTab === 'rutina' && <RutinaSemanal rutina={rutina} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} googleToken={googleToken} />}
                    {activeTab === 'proyectos' && <ProyectosSection proyectos={proyectos} proyectoItems={proyectoItems} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />}
                    {activeTab === 'dashboard' && <DashboardView saldoActual={saldoActual} totalIngresos={totalIngresos} totalGastos={totalGastos} totalDeudaPendiente={totalDeudaPendiente} transacciones={transacciones} />}
                    {activeTab === 'analisis' && <FinancialAnalysis transacciones={transacciones} />}
                    {activeTab === 'presupuesto' && <BudgetPlanner presupuestoItems={presupuestoItems} limites={limites} transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onEjecutarPago={handleEjecutarPago} notifPermiso={notifPermiso} onActivarNotif={activarNotificaciones} />}
                    {activeTab === 'inversiones' && <InvestmentPortfolio transacciones={transacciones} totalInvertido={totalInvertido} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} />}
                    {activeTab === 'ingresos' && <TransactionManager tipo="ingreso" transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} />}
                    {activeTab === 'gastos' && <TransactionManager tipo="gasto" transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} />}
                    {activeTab === 'deudas' && <DebtManager deudas={deudas} genericAdd={genericAdd} genericUpdate={genericUpdate} />}
                    {activeTab === 'metas' && <GoalTracker metas={metas} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />}
                    {activeTab === 'passwords' && <PasswordVault passwords={passwords} vaultConfig={vaultConfig} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} user={user} db={db} activeTab={activeTab} />}
                    {activeTab === 'agenda' && <ProductivityHub genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} googleToken={googleToken} setGoogleToken={setGoogleToken} />}
                </div>
            </main>

            {/* MOBILE BOTTOM NAV (Glassmorphism & Safe Area) */}
            <div className="md:hidden fixed bottom-0 w-full z-30 pb-safe bg-white/80 backdrop-blur-xl border-t border-slate-200">
                <div className="flex justify-around items-center px-2 py-3">
                    <button onClick={() => setActiveTab('presupuesto')} className={`flex-1 p-2 flex flex-col items-center gap-1 transition-all ${activeTab === 'presupuesto' ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                        <ClipboardList size={22} strokeWidth={activeTab === 'presupuesto' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Lista</span>
                    </button>

                    <button onClick={() => setActiveTab('gastos')} className={`flex-1 p-2 flex flex-col items-center gap-1 transition-all ${activeTab === 'gastos' ? 'text-rose-500 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                        <TrendingDown size={22} strokeWidth={activeTab === 'gastos' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Gastos</span>
                    </button>

                    <div className="relative -top-8">
                        <button onClick={() => setActiveTab('midia')} className="w-16 h-16 bg-blue-600 rounded-full text-white shadow-xl shadow-blue-300 flex items-center justify-center transition-transform active:scale-95 border-4 border-[#F8FAFC]">
                            <Sun size={28} />
                        </button>
                    </div>

                    <button onClick={() => setActiveTab('analisis')} className={`flex-1 p-2 flex flex-col items-center gap-1 transition-all ${activeTab === 'analisis' ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                        <BarChart3 size={22} strokeWidth={activeTab === 'analisis' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Análisis</span>
                    </button>

                    <button onClick={() => setActiveTab('metas')} className={`flex-1 p-2 flex flex-col items-center gap-1 transition-all ${activeTab === 'metas' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Target size={22} strokeWidth={activeTab === 'metas' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Metas</span>
                    </button>
                </div>
            </div>

            {/* BOTÓN FLOTANTE GASTOS RÁPIDOS - SOLO MÓVIL */}
            <button
                onClick={() => setShowQuickExpense(true)}
                className="md:hidden fixed right-4 bottom-24 z-40 w-14 h-14 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white shadow-lg shadow-amber-300 flex items-center justify-center transition-all active:scale-95 hover:shadow-xl"
                title="Gasto Rápido"
            >
                <Zap size={24} />
            </button>

            {/* MODAL GASTOS RÁPIDOS */}
            <QuickExpenseModal
                isOpen={showQuickExpense}
                onClose={() => setShowQuickExpense(false)}
                genericAdd={genericAdd}
                uid={user.uid}
            />

            {/* AI Coach Floating Widget - Injected Globally */}
            <AICoach transacciones={transacciones} deudas={deudas} metas={metas} presupuestoItems={presupuestoItems} limites={limites} habitos={habitos} diario={diario} googleToken={googleToken} coachMensajes={coachMensajes} coachPerfil={coachPerfil} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />
        </div>
    );
}