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
    LogOut
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot
} from 'firebase/firestore';

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
const auth = getAuth(app);
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
const QuickExpenseModal = ({ isOpen, onClose, genericAdd }) => {
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
            fecha: new Date().toISOString().split('T')[0],
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

const MetaItem = ({ meta, onAhorrar, onToggleCompletada, onDelete, onAddNote, onDeleteNote }) => {
    const [aporte, setAporte] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [newNote, setNewNote] = useState('');

    const notas = meta.notas || [];

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        onAddNote(meta, newNote);
        setNewNote('');
    };

    // Panel de notas compartido
    const NotesPanel = () => (
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
        return (
            <div className={`p-6 rounded-2xl shadow-sm border flex flex-col justify-between h-full transition-all ${meta.completada ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <span className={`px-2 py-1 text-xs rounded-md font-bold uppercase tracking-wider
              ${meta.plazo === 'corto' ? 'bg-indigo-100 text-indigo-700' :
                                meta.plazo === 'mediano' ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'}`}>
                            {meta.plazo}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowNotes(!showNotes)}
                                className={`p-1.5 rounded-full transition-all ${showNotes ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-500 hover:bg-slate-50'}`}
                                title="Ver notas"
                            >
                                <StickyNote size={14} />
                                {notas.length > 0 && (
                                    <span className="absolute -mt-6 ml-2 bg-indigo-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{notas.length}</span>
                                )}
                            </button>
                            <button onClick={() => onDelete(meta.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                        </div>
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${meta.completada ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                        {meta.nombre}
                    </h3>
                    <p className="text-sm text-slate-500">{meta.completada ? '¡Meta alcanzada! 🌟' : 'Propósito personal'}</p>
                </div>

                {showNotes ? (
                    <NotesPanel />
                ) : (
                    <button
                        onClick={() => onToggleCompletada(meta)}
                        className={`mt-6 w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all
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
                )}
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
                <NotesPanel />
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
    const gastosMes = transaccionesMes.filter(t => t.tipo === 'gasto').reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
    const balanceMes = ingresosMes - gastosMes;

    const gastosPorCategoria = transaccionesMes
        .filter(t => t.tipo === 'gasto')
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

const CategoryLimits = ({ limites, transacciones, genericAdd, genericDelete }) => {
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
                <h3 className="font-bold text-lg text-slate-800">Estado de Topes (Mes Actual)</h3>
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

const BudgetPlanner = ({ presupuestoItems, limites, transacciones, genericAdd, genericUpdate, genericDelete, onEjecutarPago }) => {
    const [viewMode, setViewMode] = useState('lista');
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [categoria, setCategoria] = useState(CATEGORIAS_GASTOS[0]);
    const [editandoId, setEditandoId] = useState(null);
    const [montoEdit, setMontoEdit] = useState('');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const nombreMesActual = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    // Calcular total presupuesto
    const totalPresupuesto = presupuestoItems.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);

    const agregarObligacion = async (e) => {
        e.preventDefault();
        await genericAdd('presupuesto', { concepto, monto: parseFloat(monto), categoria, lastPaid: '' });
        setConcepto(''); setMonto('');
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
        if (!confirm(`¿Estás listo para iniciar el mes de ${nombreMesActual}? \n\nEsta acción desmarcará todos los pagos.`)) return;
        const batchUpdates = presupuestoItems.map(item => genericUpdate('presupuesto', item.id, { lastPaid: '' }));
        await Promise.all(batchUpdates);
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
                <CategoryLimits limites={limites} transacciones={transacciones} genericAdd={genericAdd} genericDelete={genericDelete} />
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
                            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">Agregar al Presupuesto</button>
                        </form>

                        <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <h4 className="font-bold text-indigo-800 mb-2 text-sm">💡 Tip para nuevo mes</h4>
                            <p className="text-xs text-indigo-600 mb-3">¿Empieza un nuevo mes? Usa este botón para reciclar tu lista.</p>
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
                                            <div><h4 className={`font-bold ${isPaid ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>{item.concepto}</h4><p className="text-xs text-slate-500">{item.categoria}</p></div>
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

                                            <button onClick={() => genericDelete('presupuesto', item.id)} className="text-slate-300 hover:text-rose-500 ml-2"><Trash2 size={16} /></button>
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
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

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

// --- Sparkline Graph Component ---
const SparklineGraph = ({ data, color = "#10b981" }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 200;
    const height = 40;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-10 mt-4 flex justify-end items-end opacity-80 border-t border-slate-100 pt-2">
             <svg viewBox={`0 -5 ${width} ${height + 10}`} preserveAspectRatio="none" className="w-[80%] h-full">
                  <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
             </svg>
        </div>
    );
};

// --- Tarjeta individual de inversión ---
const InvestmentCard = ({ inv, onRegistrarUtilidad, onDelete, onToggleBalance, genericUpdate, totalGastosMensuales }) => {
    const [editingUtilidad, setEditingUtilidad] = useState(false);
    const [utilidadInput, setUtilidadInput] = useState('');
    const [editingMonto, setEditingMonto] = useState(false);
    const [montoEditInput, setMontoEditInput] = useState('');
    const [historyData, setHistoryData] = useState([]);
    const [currentTickerPrice, setCurrentTickerPrice] = useState(null);

    const prevUtilidadRef = useRef(Number(inv.utilidad) || 0);
    useEffect(() => { prevUtilidadRef.current = Number(inv.utilidad) || 0; }, [inv.utilidad]);

    useEffect(() => {
        let isMounted = true;
        
        const updateUtilidadIfChanged = (nuevaUtilidad) => {
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
            const tickerToUse = inv.ticker || (inv.concepto?.toUpperCase().includes('S&P') || inv.concepto?.toUpperCase().includes('SPY') || inv.concepto?.toUpperCase().includes('VOO') ? 'SPY' : null);
            if (tickerToUse) {
                const fetchTickerData = async () => {
                    try {
                        const montoInv = Number(inv.monto) || 0;
                        const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${tickerToUse}?range=5y&interval=1d`);
                        const res = await fetch(`https://api.allorigins.win/raw?url=${targetUrl}`);
                        
                        if (!res.ok) throw new Error('Fetch failed');
                        const data = await res.json();
                        
                        const result = data.chart?.result?.[0];
                        if (!result) return;
                        
                        const timestamps = result.timestamp;
                        const closePrices = result.indicators.quote[0].close;

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
                                historyBuffer.push(closePrices[i]);
                            }
                        }
                        
                        if (isMounted) {
                            setHistoryData(historyBuffer.slice(-60));
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
    }, [inv.subTipo, inv.fecha, inv.monto, inv.concepto, inv.ticker, inv.tasaInteres, inv.id, genericUpdate]);

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
                        <div className="flex justify-between text-xs text-slate-500">
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
                                P&L: {utilidad >= 0 ? '+' : ''}{formatCurrency(utilidad)}
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
                            <DollarSign size={12} /> Valor Propiedad: {formatCurrency(valorActual)}
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
                            Retorno: {utilidad >= 0 ? '+' : ''}{formatCurrency(utilidad)}
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
                    <p className="font-bold text-xl text-white">{formatCurrency(valorActual)}</p>
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
                                {formatCurrency(montoInv)} <Edit2 size={10} className="text-slate-300" />
                            </p>
                        )}
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Utilidad</p>
                        <p className={`font-bold text-sm mt-1 ${utilidad >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {utilidad >= 0 ? '+' : ''}{formatCurrency(utilidad)}
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

                {historyData.length > 0 && <SparklineGraph data={historyData} color={rentabilidad >= 0 ? '#10b981' : '#f43f5e'} />}

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

    useEffect(() => {
        if (prefillData && activeTab === 'inversiones') {
            setConcepto(prefillData.concepto);
            setMonto(prefillData.monto);
            setPrefillData(null);
        }
    }, [prefillData, activeTab, setPrefillData]);

    const registrarInversion = async (e) => {
        e.preventDefault();
        
        const dataInversion = {
            tipo: afectaBalance ? 'gasto' : 'inversion_patrimonio',
            esInversion: true,
            afectaBalance: afectaBalance,
            monto: parseFloat(monto),
            concepto,
            categoria: 'Aporte Inversión',
            subTipo: tipoInv,
            fecha: new Date().toISOString().split('T')[0],
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
        setConcepto(''); setMonto(''); setAfectaBalance(true); setTasaInteres(''); setTicker('');
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
                    {(tipoInv === 'Acciones / Bolsa' || tipoInv === 'Criptomonedas') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ticker</label>
                            <input placeholder="Ej: SPY, TSLA" value={ticker} onChange={e => setTicker(e.target.value)}
                                className="w-full px-4 py-2.5 border rounded-xl focus:border-purple-500 outline-none transition-colors" required />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">¿Afecta saldo?</label>
                        <button type="button" onClick={() => setAfectaBalance(!afectaBalance)}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium transition-all ${afectaBalance
                                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                : 'bg-slate-50 border-slate-300 text-slate-500 hover:bg-slate-100'
                                }`}>
                            {afectaBalance ? <ToggleRight size={20} className="text-blue-600" /> : <ToggleLeft size={20} />}
                            {afectaBalance ? 'Sí, descuenta' : 'No, es patrimonio'}
                        </button>
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
        await genericAdd('transacciones', { tipo: 'gasto', monto: parseFloat(montoPago), concepto: `Abono Deuda: ${deuda.nombre}`, categoria: 'Pago de Deudas', fecha: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
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
            completada: false
        });

        setNombre(''); setMontoObjetivo(''); setAhorroActual('');
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
                            onAhorrar={actualizarAhorro}
                            onToggleCompletada={toggleCompletada}
                            onDelete={(id) => genericDelete('metas', id)}
                            onAddNote={addNote}
                            onDeleteNote={deleteNote}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// =============================================
// === CRYPTO HELPERS (AES-256-GCM + PBKDF2) ===
// =============================================

const PBKDF2_ITERATIONS = 100000;

const getKeyMaterial = async (password) => {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
};

const deriveEncryptionKey = async (password, salt) => {
    const keyMaterial = await getKeyMaterial(password);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const encryptText = async (plaintext, masterPassword, salt) => {
    const key = await deriveEncryptionKey(masterPassword, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return {
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    };
};

const decryptText = async (encryptedData, masterPassword, salt) => {
    try {
        const key = await deriveEncryptionKey(masterPassword, salt);
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

const generateStrongPassword = (length = 20) => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const all = upper + lower + digits + symbols;
    let pw = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = pw.length; i < length; i++) pw.push(all[Math.floor(Math.random() * all.length)]);
    return pw.sort(() => Math.random() - 0.5).join('');
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
        } else {
            setIsCreatingMaster(true);
        }
    }, [vaultConfig]);

    const handleCreateMaster = async (e) => {
        e.preventDefault();
        if (masterInput.length < 6) { setError('La clave debe tener al menos 6 caracteres'); return; }
        if (masterInput !== confirmInput) { setError('Las claves no coinciden'); return; }

        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const saltB64 = btoa(String.fromCharCode(...newSalt));
        const masterHash = await hashText(masterInput + saltB64);

        await genericAdd('vault_config', { masterHash, salt: saltB64 });
        setSalt(newSalt);
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
        const inputHash = await hashText(masterInput + config.salt);
        if (inputHash === config.masterHash) {
            setMasterPassword(masterInput);
            setSalt(new Uint8Array(atob(config.salt).split('').map(c => c.charCodeAt(0))));
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
        const encrypted = await encryptText(passwordInput, masterPassword, salt);
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
        const decrypted = await decryptText({ ciphertext: item.passwordEncrypted, iv: item.iv }, masterPassword, salt);
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
            text = await decryptText({ ciphertext: item.passwordEncrypted, iv: item.iv }, masterPassword, salt);
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
            const encrypted = await encryptText(editForm.newPassword, masterPassword, salt);
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
                            ? 'Crea una clave maestra para proteger tus contraseñas. No la olvides — no se puede recuperar.'
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
const AICoach = ({ transacciones, deudas, metas, presupuestoItems, limites, tasks }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const buildFinancialContext = () => {
        // Build context from props
        const saldo = transacciones.reduce((acc, t) => acc + (t.tipo === 'ingreso' ? t.monto : (t.esInversion && t.inversionPatrimonio ? 0 : -t.monto)), 0);
        const ingresosMes = transacciones.filter(t => t.tipo === 'ingreso' && new Date(t.fecha).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.monto, 0);
        const gastosMes = transacciones.filter(t => t.tipo === 'gasto' && !t.esInversion && new Date(t.fecha).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.monto, 0);
        const deudasPendientes = deudas.reduce((acc, d) => acc + (Number(d.montoTotal || 0) - Number(d.montoPagado || 0)), 0);
        const inversionesTotales = transacciones.filter(t => t.esInversion).reduce((acc, t) => acc + t.monto, 0);
        const metasProgreso = metas.map(m => `- ${m.nombre}: $${m.ahorrado} de $${m.montoObjetivo} (${Math.round((m.ahorrado/m.montoObjetivo)*100)}%)`).join('\n');
        const tareasPendientes = tasks.filter(t => !t.completada).map(t => `- ${t.texto} (Prioridad ${t.prioridad})`).join('\n');

        return `- Saldo Disponible Actual: $${saldo}
- Ingresos de este mes: $${ingresosMes}
- Gastos de este mes: $${gastosMes}
- Total invertido en portafolio: $${inversionesTotales}
- Total de Deudas Pendientes: $${deudasPendientes}

METAS ACTUALES DEL USUARIO:
${metasProgreso || 'No hay metas definidas.'}

TAREAS PENDIENTES DE LA AGENDA:
${tareasPendientes || 'No hay tareas pendientes importantes.'}`;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input.trim();
        setInput('');
        const newMessages = [...messages, { role: 'user', content: userMsg }];
        setMessages(newMessages);
        setIsTyping(true);

        try {
            const context = buildFinancialContext();

            const res = await fetch('/api/ai-coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    context,
                    messages: newMessages.map(m => ({ role: m.role, content: m.content }))
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Error en la API del Coach');
            }

            const data = await res.json();
            const botResponse = data.reply || 'No recibí respuesta. Intenta de nuevo.';

            setMessages([...newMessages, { role: 'assistant', content: botResponse }]);

        } catch (error) {
            console.error('Coach IA Error:', error);
            setMessages([...newMessages, { role: 'assistant', content: '❌ Lo siento, hubo un error de conexión con el Coach IA. Intenta de nuevo en unos segundos.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
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
                        <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 bg-slate-50 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
                    {messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-60">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                                <Sparkles size={30} className="text-indigo-600" />
                            </div>
                            <h4 className="font-bold text-slate-700 text-lg">Pregúntame lo que sea</h4>
                            <p className="text-xs text-slate-500">¿Debería invertir este mes? ¿Cómo estructurar mis deudas? Analizo tus finanzas en tiempo real.</p>
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
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-slate-100">
                    <form onSubmit={handleSend} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-inner">
                        <input
                            value={input} onChange={e => setInput(e.target.value)} placeholder="Pide un consejo financiero..."
                            className="flex-1 bg-transparent px-3 py-2 outline-none text-sm text-slate-700"
                            disabled={isTyping}
                        />
                        <button type="submit" disabled={!input.trim() || isTyping} className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center transition-colors shrink-0 shadow-md">
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
    );
};

// =============================================
// === COMPONENTE: PRODUCTIVITY HUB ===
// =============================================
const ProductivityHub = ({ tasks, genericAdd, genericUpdate, genericDelete, googleToken, setGoogleToken }) => {
    const [activeView, setActiveView] = useState('tasks'); // 'tasks' | 'calendar'
    
    // Tareas
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('Media');

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;
        await genericAdd('tasks', {
            texto: newTaskText,
            prioridad: newTaskPriority,
            completada: false,
            createdAt: new Date().toISOString()
        });
        setNewTaskText('');
    };

    const toggleTask = (task) => genericUpdate('tasks', task.id, { completada: !task.completada });
    
    // Calendar
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    
    // Formulario Evento
    const [eventTitle, setEventTitle] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventDuration, setEventDuration] = useState('60');

    // Inicializar Google Client
    const handleGoogleLogin = () => {
        if (!window.google) {
            alert('Google Identity Services no está cargado aún. Intenta de nuevo en unos segundos.');
            return;
        }
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: '871176559846-qctr4g2s05te327su654gpg91oq85gfd.apps.googleusercontent.com', // Configuracion manual posterior
            scope: 'https://www.googleapis.com/auth/calendar.events',
            callback: (response) => {
                if (response.error) {
                    console.error('Error Google Auth:', response);
                    return;
                }
                const expiresAt = Date.now() + ((Number(response.expires_in) || 3600) * 1000);
                try {
                    localStorage.setItem('google_calendar_token', JSON.stringify({ token: response.access_token, expiresAt }));
                } catch (e) { /* almacenamiento lleno o bloqueado */ }
                setGoogleToken(response.access_token);
                fetchEvents(response.access_token);
            },
        });
        client.requestAccessToken();
    };

    const fetchEvents = async (token) => {
        if (!token) return;
        setLoadingEvents(true);
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
            const data = await res.json();
            setEvents(data.items || []);
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setLoadingEvents(false);
        }
    };

    useEffect(() => {
        if (googleToken && activeView === 'calendar') fetchEvents(googleToken);
    }, [googleToken, activeView]);

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
                            <p className="text-blue-100 text-sm">Gestiona tu tiempo y obligaciones personales</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-full md:max-w-md">
                <button onClick={() => setActiveView('tasks')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <CheckCircle2 size={16} /> Tareas Pendientes
                </button>
                <button onClick={() => setActiveView('calendar')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <CalendarDays size={16} /> Google Calendar
                </button>
            </div>

            {/* TASKS VIEW */}
            {activeView === 'tasks' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24">
                            <h3 className="font-bold text-lg text-slate-800 mb-4">Nueva Tarea</h3>
                            <form onSubmit={handleAddTask} className="space-y-4">
                                <div>
                                    <input placeholder="¿Qué necesitas hacer?" value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors bg-slate-50" required />
                                </div>
                                <div className="flex gap-2">
                                    {['Alta', 'Media', 'Baja'].map(p => (
                                        <button key={p} type="button" onClick={() => setNewTaskPriority(p)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${newTaskPriority === p ? (p === 'Alta' ? 'bg-rose-100 text-rose-700 border-rose-200' : p === 'Media' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200') : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
                                    Agregar Tarea
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-3">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                            <ListTodo size={18} className="text-slate-400" /> Pendientes ({tasks.filter(t => !t.completada).length})
                        </h3>
                        {tasks.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                                <ListTodo size={40} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">No tienes tareas registradas</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {tasks.sort((a,b) => a.completada - b.completada || new Date(b.createdAt) - new Date(a.createdAt)).map(task => (
                                    <div key={task.id} className={`bg-white p-4 rounded-xl border flex items-center justify-between gap-4 transition-all hover:shadow-sm ${task.completada ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200'} group`}>
                                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                            <button onClick={() => toggleTask(task)} className={`shrink-0 transition-colors ${task.completada ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}>
                                                {task.completada ? <CheckCircle2 size={22} className="fill-emerald-100" /> : <div className="w-[22px] h-[22px] rounded-full border-2 border-current" />}
                                            </button>
                                            <span className={`text-slate-700 truncate ${task.completada ? 'line-through text-slate-400' : 'font-medium'}`}>
                                                {task.texto}
                                            </span>
                                            {!task.completada && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${task.prioridad === 'Alta' ? 'bg-rose-100 text-rose-700' : task.prioridad === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {task.prioridad}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={() => genericDelete('tasks', task.id)} className="text-slate-300 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                            <button onClick={() => {localStorage.removeItem('google_calendar_token'); setGoogleToken(null); setEvents([]);}} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Desconectar</button>
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
                                            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required min={new Date().toISOString().split('T')[0]}
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
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
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
    
    // Tareas & Settings
    const [tasks, setTasks] = useState([]);
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
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error de autenticación:", error);
            setAuthError('No se pudo iniciar sesión. Intenta de nuevo.');
        }
    };

    const handleLogout = async () => {
        try {
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

        const unsubTasks = onSnapshot(collection(db, `${basePath}/tasks`), (snap) =>
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubTrans(); unsubDeudas(); unsubMetas(); unsubPresupuesto(); unsubLimites(); unsubPasswords(); unsubVaultConfig(); unsubTasks(); };
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
            const collections = ['transacciones', 'deudas', 'metas', 'presupuesto', 'limites', 'passwords', 'vault_config', 'tasks'];
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
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-2 mt-2">Principal</div>
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
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all font-medium text-sm">
                        <LogOut size={20} />
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </aside>

            {/* MOBILE HEADER (Minimalista) */}
            <div className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-md z-30 border-b border-slate-100 px-4 py-3 flex justify-between items-center pt-safe shadow-sm transition-all">
                <div className="flex items-center gap-2 cursor-pointer" onClick={runMigration}>
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">F</div>
                    <span className="font-bold text-lg text-slate-800 tracking-tight">Finanzas 360</span>
                </div>
                <div className="flex items-center gap-2">
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
                        onClick={() => setActiveTab('agenda')}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'agenda' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <ListTodo size={20} />
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

            <main className="flex-1 md:ml-72 p-4 md:p-10 mt-16 md:mt-0 overflow-y-auto h-screen pb-32 md:pb-10 no-scrollbar scroll-smooth">
                <div className="max-w-7xl mx-auto space-y-8">
                    {activeTab === 'dashboard' && <DashboardView saldoActual={saldoActual} totalIngresos={totalIngresos} totalGastos={totalGastos} totalDeudaPendiente={totalDeudaPendiente} transacciones={transacciones} />}
                    {activeTab === 'analisis' && <FinancialAnalysis transacciones={transacciones} />}
                    {activeTab === 'presupuesto' && <BudgetPlanner presupuestoItems={presupuestoItems} limites={limites} transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} onEjecutarPago={handleEjecutarPago} />}
                    {activeTab === 'inversiones' && <InvestmentPortfolio transacciones={transacciones} totalInvertido={totalInvertido} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} />}
                    {activeTab === 'ingresos' && <TransactionManager tipo="ingreso" transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} />}
                    {activeTab === 'gastos' && <TransactionManager tipo="gasto" transacciones={transacciones} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} prefillData={prefillData} setPrefillData={setPrefillData} activeTab={activeTab} pendingBudgetId={pendingBudgetId} setPendingBudgetId={setPendingBudgetId} setActiveTab={setActiveTab} />}
                    {activeTab === 'deudas' && <DebtManager deudas={deudas} genericAdd={genericAdd} genericUpdate={genericUpdate} />}
                    {activeTab === 'metas' && <GoalTracker metas={metas} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />}
                    {activeTab === 'passwords' && <PasswordVault passwords={passwords} vaultConfig={vaultConfig} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} user={user} db={db} activeTab={activeTab} />}
                    {activeTab === 'agenda' && <ProductivityHub tasks={tasks} genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} googleToken={googleToken} setGoogleToken={setGoogleToken} />}
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
                        <button onClick={() => setActiveTab('dashboard')} className="w-16 h-16 bg-blue-600 rounded-full text-white shadow-xl shadow-blue-300 flex items-center justify-center transition-transform active:scale-95 border-4 border-[#F8FAFC]">
                            <LayoutDashboard size={28} />
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
            />

            {/* AI Coach Floating Widget - Injected Globally */}
            <AICoach transacciones={transacciones} deudas={deudas} metas={metas} presupuestoItems={presupuestoItems} limites={limites} tasks={tasks} />
        </div>
    );
}