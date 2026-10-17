

// Utilidad para formatear moneda
export const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatUSD = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return 'US$0';
    return 'US' + new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

// Formatea según la moneda de la inversión ('USD' o 'COP' por defecto).
export const formatMoney = (amount, moneda) => (moneda === 'USD' ? formatUSD(amount) : formatCurrency(amount));

// --- CONSTANTES ---
export const CATEGORIAS_INGRESOS = [
    "Salario", "Freelance", "Retorno Inversión", "Regalos", "Venta", "Otros"
];

export const CATEGORIAS_GASTOS = [
    "Vivienda (Arriendo/Hipoteca)", "Servicios Públicos", "Mercado",
    "Transporte", "Entretenimiento", "Salud", "Educación",
    "Ropa", "Deudas", "Aporte Inversión", "Mascotas", "Gastos Hormiga", "Otros"
];

// Valor especial del select de categoría para crear una categoría personalizada.
export const NUEVA_CATEGORIA = '__nueva__';

export const TIPOS_INVERSION = [
    "CDT / Renta Fija", "Acciones / Bolsa", "Criptomonedas", "Finca Raíz", "Negocio Propio", "Fondo de Emergencia"
];

export const PLAZOS_METAS = [
    { value: 'corto', label: 'Corto Plazo (< 1 año)' },
    { value: 'mediano', label: 'Mediano Plazo (1-5 años)' },
    { value: 'largo', label: 'Largo Plazo (> 5 años)' },
];

// --- ANÁLISIS MENSUAL: INFORME COMPLETO DE EN QUÉ SE VA EL DINERO ---
export const COLORES_ANALISIS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#64748b'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_SEMANA_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Desplaza un mes 'YYYY-MM' n meses (n negativo = hacia atrás)
export const desplazarMes = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const etiquetaMesLarga = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return `${MESES_LARGOS[m - 1]} de ${y}`;
};

export const esGastoConsumo = (t) => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro;
export const sumaMonto = (lista) => lista.reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

// =============================================
// === HELPERS: PLAN DE AHORRO (metas financieras) ===
// =============================================
// Las metas nuevas llevan fechaObjetivo + frecuencia; con eso se calcula el
// aporte sugerido y el estado (al día / atrasada / adelantada). Las legacy
// (sin fechaObjetivo) muestran la tarjeta clásica con CTA para ponerle fecha.

export const diasHasta = (fechaYmd) => Math.ceil((new Date(fechaYmd + 'T23:59:59') - new Date()) / 86400000);

export const periodosRestantesMeta = (meta) => {
    if (!meta.fechaObjetivo) return 0;
    const dias = Math.max(diasHasta(meta.fechaObjetivo), 0);
    return Math.max(1, Math.ceil(dias / (meta.frecuencia === 'mensual' ? 30 : 15)));
};

export const aporteSugeridoMeta = (meta) => {
    const faltante = Math.max((Number(meta.montoObjetivo) || 0) - (Number(meta.ahorroActual) || 0), 0);
    return faltante / periodosRestantesMeta(meta);
};

// Estado del plan: compara lo ahorrado contra el ritmo esperado según el tiempo
// transcurrido entre el inicio del plan y la fecha objetivo.
export const estadoMeta = (meta) => {
    const actual = Number(meta.ahorroActual) || 0;
    const objetivo = Number(meta.montoObjetivo) || 0;
    if (objetivo > 0 && actual >= objetivo) return { id: 'completada' };
    if (!meta.fechaObjetivo || !objetivo) return { id: 'sinplan' };

    const inicio = meta.createdAt ? new Date(meta.createdAt) : new Date();
    const fin = new Date(meta.fechaObjetivo + 'T23:59:59');
    const total = Math.max(fin - inicio, 1);
    const transcurrido = Math.min(Math.max(Date.now() - inicio.getTime(), 0), total);
    const esperado = objetivo * (transcurrido / total);

    if (actual >= esperado * 1.1) return { id: 'adelantada' };
    if (actual >= esperado * 0.9) return { id: 'aldia' };
    return { id: 'atrasada', atraso: Math.max(esperado - actual, 0) };
};

// Capacidad de ahorro: promedio de lo que quedó libre (ingresos - gastos de
// consumo) en los últimos 3 meses calendario CERRADOS con movimientos.
export const capacidadAhorroMensual = (transacciones) => {
    const mesActual = dateKey().slice(0, 7);
    const porMes = {};
    transacciones.forEach(t => {
        const mes = (t.fecha || '').slice(0, 7);
        if (!mes || mes >= mesActual) return;
        porMes[mes] = porMes[mes] || { ing: 0, gas: 0 };
        if (t.tipo === 'ingreso') porMes[mes].ing += Number(t.monto) || 0;
        else if (t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && !t.esAhorro) porMes[mes].gas += Number(t.monto) || 0;
    });
    const meses = Object.keys(porMes).sort().slice(-3);
    if (!meses.length) return null;
    return meses.reduce((a, m) => a + (porMes[m].ing - porMes[m].gas), 0) / meses.length;
};

// =============================================
// === HELPERS: FECHAS / HÁBITOS / PAGOS ===
// =============================================

// Clave de fecha local YYYY-MM-DD (sin desfase de zona horaria).
export const dateKey = (d = new Date()) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Racha de días consecutivos cumplidos (incluye hoy o, si hoy aún no, desde ayer).
export const calcStreak = (historial) => {
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
export const proximaFechaPago = (diaPago) => {
    const dia = Number(diaPago);
    if (!dia || dia < 1 || dia > 31) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    // Si el mes es más corto (día 31 en un mes de 30), se usa su último día.
    const conDia = (y, m) => new Date(y, m, Math.min(dia, new Date(y, m + 1, 0).getDate()));
    let candidato = conDia(hoy.getFullYear(), hoy.getMonth());
    if (candidato < hoy) candidato = conDia(hoy.getFullYear(), hoy.getMonth() + 1);
    const dias = Math.round((candidato - hoy) / (1000 * 60 * 60 * 24));
    return { fecha: candidato, dias };
};

export const HABIT_EMOJIS = ['💧', '🏃', '🧘', '📚', '💪', '🚭', '🥗', '😴', '🙏', '✍️', '☀️', '🧠'];
export const MOODS = [
    { v: 1, e: '😣', label: 'Muy mal' },
    { v: 2, e: '😕', label: 'Mal' },
    { v: 3, e: '😐', label: 'Normal' },
    { v: 4, e: '🙂', label: 'Bien' },
    { v: 5, e: '😄', label: 'Genial' },
];
