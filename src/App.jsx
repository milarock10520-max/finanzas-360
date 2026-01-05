import React, { useState, useEffect } from 'react';
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
    Calculator // Nuevo icono para el total
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signInWithCustomToken
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
    "Ropa", "Deudas", "Aporte Inversión", "Mascotas", "Otros"
];

const TIPOS_INVERSION = [
    "CDT / Renta Fija", "Acciones / Bolsa", "Criptomonedas", "Finca Raíz", "Negocio Propio", "Fondo de Emergencia"
];

const PLAZOS_METAS = [
    { value: 'corto', label: 'Corto Plazo (< 1 año)' },
    { value: 'mediano', label: 'Mediano Plazo (1-5 años)' },
    { value: 'largo', label: 'Largo Plazo (> 5 años)' },
];

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

const MetaItem = ({ meta, onAhorrar, onToggleCompletada, onDelete }) => {
    const [aporte, setAporte] = useState('');

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
                        <button onClick={() => onDelete(meta.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${meta.completada ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                        {meta.nombre}
                    </h3>
                    <p className="text-sm text-slate-500">{meta.completada ? '¡Meta alcanzada! 🌟' : 'Propósito personal'}</p>
                </div>

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
                    <button onClick={() => onDelete(meta.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
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
                                                    {!isPaid && <button onClick={() => iniciarEdicion(item)} className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={14} /></button>}
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

const InvestmentPortfolio = ({ transacciones, totalInvertido, genericAdd, genericUpdate, genericDelete, prefillData, setPrefillData, activeTab, pendingBudgetId, setPendingBudgetId, setActiveTab }) => {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [tipoInv, setTipoInv] = useState(TIPOS_INVERSION[0]);

    useEffect(() => {
        if (prefillData && activeTab === 'inversiones') {
            setConcepto(prefillData.concepto);
            setMonto(prefillData.monto);
            setPrefillData(null);
        }
    }, [prefillData, activeTab, setPrefillData]);

    const registrarInversion = async (e) => {
        e.preventDefault();
        await genericAdd('transacciones', { tipo: 'gasto', esInversion: true, monto: parseFloat(monto), concepto, categoria: 'Aporte Inversión', subTipo: tipoInv, fecha: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
        if (pendingBudgetId) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            await genericUpdate('presupuesto', pendingBudgetId, { lastPaid: currentMonth });
            setPendingBudgetId(null);
            setActiveTab('presupuesto'); // Volver a presupuesto
        }
        setConcepto(''); setMonto('');
    };


    const inversionesList = transacciones.filter(t => t.categoria === 'Aporte Inversión' || t.esInversion === true);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-purple-700 text-white p-8 rounded-3xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                <div><h2 className="text-3xl font-bold mb-2">Portafolio de Inversiones</h2><p className="text-purple-200">Construyendo tu patrimonio.</p></div>
                <div className="text-right"><p className="text-sm text-purple-200 uppercase tracking-wider">Total Invertido</p><h3 className="text-4xl font-bold">{formatCurrency(totalInvertido)}</h3></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-xl text-purple-700 mb-4 flex items-center gap-2"><PieChart className="w-6 h-6" /> Nueva Inversión</h3>
                    {pendingBudgetId && <div className="bg-purple-50 text-purple-700 p-2 rounded mb-2 text-sm">✓ Desde Presupuesto</div>}
                    <form onSubmit={registrarInversion} className="space-y-4">
                        <input placeholder="Nombre (Ej: Bitcoin, Apple)" value={concepto} onChange={e => setConcepto(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:border-purple-500 outline-none" required />
                        <input type="number" placeholder="Monto Invertido" value={monto} onChange={e => setMonto(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:border-purple-500 outline-none" required />
                        <select value={tipoInv} onChange={e => setTipoInv(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:border-purple-500 outline-none bg-white">{TIPOS_INVERSION.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700">Registrar Inversión</button>
                    </form>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-lg text-slate-800">Historial de Aportes</h3>
                    {inversionesList.length === 0 ? <p className="text-slate-400">Sin inversiones registradas.</p> : inversionesList.map(inv => (
                        <div key={inv.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                            <div><h4 className="font-bold text-slate-700">{inv.concepto}</h4><p className="text-sm text-slate-500">{inv.subTipo || 'Inversión'} • {inv.fecha}</p></div>
                            <div className="flex items-center gap-4"><span className="font-bold text-purple-600">{formatCurrency(inv.monto)}</span><button onClick={() => genericDelete('transacciones', inv.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={18} /></button></div>
                        </div>
                    ))
                    }
                </div>
            </div>
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
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [prefillData, setPrefillData] = useState(null);
    const [pendingBudgetId, setPendingBudgetId] = useState(null);

    // Datos
    const [transacciones, setTransacciones] = useState([]);
    const [deudas, setDeudas] = useState([]);
    const [metas, setMetas] = useState([]);
    const [presupuestoItems, setPresupuestoItems] = useState([]);
    const [limites, setLimites] = useState([]);

    // 1. AUTENTICACIÓN
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Error de autenticación:", error);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

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

        return () => { unsubTrans(); unsubDeudas(); unsubMetas(); unsubPresupuesto(); unsubLimites(); };
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
    const saldoActual = totalIngresos - totalGastos;
    const totalDeudaPendiente = deudas.reduce((acc, curr) => acc + (Number(curr.montoTotal || 0) - Number(curr.montoPagado || 0)), 0);
    const totalInvertido = transacciones
        .filter(t => t.categoria === 'Aporte Inversión' || t.esInversion === true)
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">

            {/* SIDEBAR DESKTOP */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 h-full p-6 fixed z-10 transition-all shadow-sm">
                <div className="flex items-center gap-3 px-2 mb-10 pt-2">
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
                </nav>
            </aside>

            {/* MOBILE HEADER (Minimalista) */}
            <div className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-md z-30 border-b border-slate-100 px-4 py-3 flex justify-between items-center pt-safe shadow-sm transition-all">
                <div className="flex items-center gap-2">
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
        </div>
    );
}