import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, DollarSign, Edit2, Zap, X, Building2, Shield, LineChart, Briefcase, Eye, EyeOff, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { ScreenHeader, CountUp, fmtCOP } from '../ui/f360.jsx';
import { MontoInput } from '../components/comunes';
import { TIPOS_INVERSION, dateKey, formatCurrency, formatMoney } from '../lib/finanzas';
import { API_BASE } from '../lib/firebase';
import { useTasaUSD, aCOP } from '../lib/moneda';

// --- Iconos y colores por tipo de inversión ---
export const INVERSION_CONFIG = {
    'CDT / Renta Fija': { icon: Shield, color: 'blue', gradient: 'from-blue-500 to-blue-700', label: 'Renta Fija' },
    'Acciones / Bolsa': { icon: LineChart, color: 'indigo', gradient: 'from-indigo-500 to-violet-700', label: 'Bolsa' },
    'Criptomonedas': { icon: Zap, color: 'amber', gradient: 'from-amber-500 to-orange-600', label: 'Crypto' },
    'Finca Raíz': { icon: Building2, color: 'emerald', gradient: 'from-emerald-600 to-teal-700', label: 'Inmueble' },
    'Negocio Propio': { icon: Briefcase, color: 'rose', gradient: 'from-rose-500 to-pink-700', label: 'Negocio' },
    'Fondo de Emergencia': { icon: Shield, color: 'cyan', gradient: 'from-cyan-500 to-sky-600', label: 'Emergencia' },
};

// --- Gráfica de precios mejorada (acciones / ETF) ---
// data: array de { t: timestampSeg, v: precio }
export const PriceChart = ({ data, ticker }) => {
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
export const normalizarTicker = (raw, subTipo) => {
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
export const InvestmentCard = ({ inv, onRegistrarUtilidad, onDelete, onToggleBalance, genericUpdate, totalGastosMensuales }) => {
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

    // Color semántico por tipo (tokens del sistema).
    const TONO_TIPO = { blue: 'primary', indigo: 'violet', amber: 'warn', emerald: 'income', rose: 'expense', cyan: 'cyan' };
    const tono = TONO_TIPO[config.color] || 'violet';
    const tColor = tono === 'cyan' ? 'var(--cyan)' : `var(--${tono})`;
    const tSoft = tono === 'cyan' ? 'var(--income-soft)' : `var(--${tono}-soft)`;
    const mini = { padding: 12, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 };
    const accionMini = { height: 40, padding: '0 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' };

    return (
        <article className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="tile" style={{ background: tSoft, color: tColor }}><IconComp size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.concepto}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{inv.subTipo || 'Inversión'}{inv.ticker ? ` · ${inv.ticker}` : ''} · {inv.fecha}</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>Valor actual</span>
                    {editingValor ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <input className="input num" type="number" inputMode="decimal" value={valorEditInput} onChange={e => setValorEditInput(e.target.value)} aria-label="Nuevo valor actual"
                                onKeyDown={e => { if (e.key === 'Enter') handleEditValor(); if (e.key === 'Escape') { setEditingValor(false); setValorEditInput(''); } }}
                                style={{ width: 120, height: 40, textAlign: 'right', padding: '0 10px' }} autoFocus />
                            <button type="button" className="icon-btn" onClick={handleEditValor} aria-label="Guardar valor" style={{ width: 40, height: 40, background: 'var(--income)', color: 'var(--on-accent)', borderColor: 'transparent' }}><Check size={16} aria-hidden="true" /></button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => { setEditingValor(true); setValorEditInput(valorActual.toFixed(2)); }} aria-label="Editar valor actual"
                            className="num" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: 17, fontWeight: 700, background: 'none', border: 0, padding: '4px 0', color: 'var(--text)', cursor: 'pointer' }}>
                            {formatMoney(valorActual, inv.moneda)} <Edit2 size={12} color="var(--text-3)" aria-hidden="true" />
                        </button>
                    )}
                    {inv.valorManual && !editingValor && (
                        <button type="button" onClick={handleReactivarAuto} style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                            Manual · reactivar auto
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <div style={mini}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>Invertido</span>
                    {editingMonto ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                            <input className="input num" type="number" inputMode="decimal" value={montoEditInput} onChange={e => setMontoEditInput(e.target.value)} aria-label="Monto invertido" style={{ width: 80, height: 34, padding: '0 6px', fontSize: 13, textAlign: 'center' }} autoFocus />
                            <button type="button" onClick={handleEditMonto} aria-label="Guardar monto" style={{ width: 34, height: 34, borderRadius: 10, border: 0, background: 'var(--violet)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center' }}><Check size={14} aria-hidden="true" /></button>
                        </div>
                    ) : (
                        <button type="button" className="num" onClick={() => { setEditingMonto(true); setMontoEditInput(montoInv); }} aria-label="Editar monto invertido"
                            style={{ fontSize: 13, fontWeight: 700, color: 'var(--violet)', background: 'none', border: 0, padding: 0, cursor: 'pointer', letterSpacing: 0 }}>
                            {formatMoney(montoInv, inv.moneda)}
                        </button>
                    )}
                </div>
                <div style={mini}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>Utilidad</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: utilidad >= 0 ? 'var(--income)' : 'var(--expense)', letterSpacing: 0 }}>{utilidad >= 0 ? '+' : '−'}{formatMoney(Math.abs(utilidad), inv.moneda)}</span>
                </div>
                <div style={mini}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>Rentab.</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: rentabilidad >= 0 ? 'var(--income)' : 'var(--expense)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {rentabilidad >= 0 ? <ArrowUp size={12} strokeWidth={2.4} aria-hidden="true" /> : <ArrowDown size={12} strokeWidth={2.4} aria-hidden="true" />}{Math.abs(rentabilidad).toFixed(1)}%
                    </span>
                </div>
            </div>

            {renderTypeMetrics()}

            {historyData.length > 0 && <PriceChart data={historyData} ticker={inv.ticker} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onToggleBalance(inv)} aria-pressed={afectaBalance}
                    style={{ ...accionMini, color: afectaBalance ? 'var(--primary)' : 'var(--text-3)', background: afectaBalance ? 'var(--primary-soft)' : 'var(--surface)', borderColor: afectaBalance ? 'transparent' : 'var(--line)' }}>
                    {afectaBalance ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                    {afectaBalance ? 'Afecta saldo' : 'Solo patrimonio'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {editingUtilidad ? (
                        <>
                            <input className="input num" type="number" inputMode="decimal" placeholder="+/− $" value={utilidadInput} onChange={(e) => setUtilidadInput(e.target.value)} aria-label="Utilidad a registrar" style={{ width: 110, height: 40 }} autoFocus />
                            <button type="button" className="icon-btn" onClick={handleUtilidad} aria-label="Guardar utilidad" style={{ width: 40, height: 40, background: 'var(--income)', color: 'var(--on-accent)', borderColor: 'transparent' }}><Check size={16} aria-hidden="true" /></button>
                            <button type="button" className="icon-btn" onClick={() => { setEditingUtilidad(false); setUtilidadInput(''); }} aria-label="Cancelar" style={{ width: 40, height: 40 }}><X size={16} aria-hidden="true" /></button>
                        </>
                    ) : (
                        <button type="button" onClick={() => setEditingUtilidad(true)} style={{ ...accionMini, color: 'var(--income)' }}>
                            <DollarSign size={14} aria-hidden="true" /> Utilidad
                        </button>
                    )}
                    <button type="button" className="icon-btn" onClick={() => { if (window.confirm(`¿Eliminar la inversión "${inv.concepto}"?`)) onDelete(inv.id); }} aria-label={`Eliminar ${inv.concepto}`}
                        style={{ width: 40, height: 40, border: 0, background: 'transparent', color: 'var(--text-3)' }}>
                        <Trash2 size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </article>
    );
};


export const InvestmentPortfolio = ({ transacciones, totalInvertido, genericAdd, genericUpdate, genericDelete, prefillData, setPrefillData, activeTab, pendingBudgetId, setPendingBudgetId, setActiveTab, onBack }) => {
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
            setMonto(String(Math.round(Number(prefillData.monto) || 0)));
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
    // Totales en pesos: las inversiones en USD se convierten con la tasa del día.
    const tasaUSD = useTasaUSD();
    const tasa = tasaUSD?.tasa || null;
    const hayUSD = inversionesList.some(i => i.moneda === 'USD');
    const cop = (valor, inv) => aCOP(valor, inv.moneda, tasa) ?? 0;
    const totalUtilidad = inversionesList.reduce((acc, inv) => acc + cop(Number(inv.utilidad) || 0, inv), 0);
    const totalEnBalance = inversionesList.filter(i => i.afectaBalance !== false).reduce((a, c) => a + cop(Number(c.monto) || 0, c), 0);
    const totalPatrimonio = inversionesList.reduce((a, c) => a + cop((Number(c.monto) || 0) + (Number(c.utilidad) || 0), c), 0);

    // Calcular gastos mensuales promedio (para fondo de emergencia)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const gastosDelMes = transacciones
        .filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && t.fecha && t.fecha.startsWith(currentMonth))
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const totalGastosMensuales = gastosDelMes || 0;

    // Agrupar por tipo
    const grouped = {};
    inversionesList.forEach(inv => {
        const tipo = inv.subTipo || 'Otro';
        if (!grouped[tipo]) grouped[tipo] = [];
        grouped[tipo].push(inv);
    });

    const totalInvertidoReal = inversionesList.reduce((a, c) => a + cop(Number(c.monto) || 0, c), 0);
    const millones = (n) => {
        const v = Number(n) || 0;
        return Math.abs(v) >= 1e6 ? `$ ${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : fmtCOP(v);
    };
    const pill = { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 };
    const pillLbl = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' };
    const conTasa = tipoInv === 'Fondo de Emergencia' || tipoInv === 'CDT / Renta Fija';
    const soloPatrimonio = esBolsaOCripto && moneda === 'USD';

    return (
        <div>
            <ScreenHeader title="Inversiones" onBack={onBack} />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="orb" style={{ width: 240, height: 240, right: -90, top: -100, background: '#7C3AED', opacity: .7 }} />
                <div className="orb" style={{ width: 160, height: 160, left: -50, bottom: -70, background: '#3355FF', opacity: .55, animationDuration: '17s' }} />
                <div className="grid-lines" />
                <div className="sheen" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Patrimonio</span>
                    <span className="num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}><CountUp value={totalPatrimonio} /></span>
                    {hayUSD && (
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
                            {tasa ? `Dólares convertidos a ${fmtCOP(tasa)} por US$1` : 'Sin la tasa del dólar: las inversiones en USD no se suman todavía'}
                        </span>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <div className="glass-pill" style={pill}><span style={pillLbl}>Invertido</span><span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{millones(totalInvertidoReal)}</span></div>
                    <div className="glass-pill" style={pill}><span style={pillLbl}>En saldo</span><span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{millones(totalEnBalance)}</span></div>
                    <div className="glass-pill" style={pill}><span style={pillLbl}>Utilidad</span><span className="num" style={{ fontSize: 13, fontWeight: 700, color: totalUtilidad >= 0 ? '#6EE7B7' : '#FDA4AF' }}>{totalUtilidad >= 0 ? '+ ' : '− '}{millones(Math.abs(totalUtilidad))}</span></div>
                </div>
            </section>

            <form onSubmit={registrarInversion} className="card rise d3" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tile" style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--violet-soft)', color: 'var(--violet)' }}><Plus size={18} strokeWidth={2.2} aria-hidden="true" /></span>
                    Nueva inversión
                </h2>
                {pendingBudgetId && (
                    <div style={{ padding: '10px 14px', borderRadius: 14, background: 'var(--violet-soft)', color: 'var(--violet)', fontSize: 13, fontWeight: 700 }}>Registrando un aporte de tu presupuesto</div>
                )}
                <label className="field"><span className="field-label">Nombre</span>
                    <input className="input" placeholder="Ej: CDT Bancolombia, Bitcoin" value={concepto} onChange={e => setConcepto(e.target.value)} required /></label>
                <label className="field"><span className="field-label">Monto{soloPatrimonio ? ' (USD)' : ''}</span>
                    {soloPatrimonio
                        ? <input className="input num" type="number" inputMode="decimal" step="any" min="0" placeholder="US$ 0" value={monto} onChange={e => setMonto(e.target.value)} required />
                        : <MontoInput value={monto} onChange={setMonto} required />}
                </label>
                <div className="field">
                    <span className="field-label">Tipo</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {TIPOS_INVERSION.map(t => (
                            <button key={t} type="button" className={`chip ${tipoInv === t ? 'on' : ''}`} aria-pressed={tipoInv === t} onClick={() => setTipoInv(t)}>{t}</button>
                        ))}
                    </div>
                </div>
                {conTasa && (
                    <label className="field"><span className="field-label">Tasa EA (%)</span>
                        <input className="input num" type="number" inputMode="decimal" placeholder="Ej: 9" value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} required /></label>
                )}
                {esBolsaOCripto && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <label className="field"><span className="field-label">Ticker</span>
                            <input className="input" placeholder="Ej: SPY, BTC" value={ticker} onChange={e => setTicker(e.target.value)} autoCapitalize="characters" required /></label>
                        <div className="field">
                            <span className="field-label">Moneda</span>
                            <div className="seg">
                                <span className="thumb" style={{ transform: moneda === 'USD' ? 'translateX(0)' : 'translateX(100%)' }} />
                                <button type="button" className={moneda === 'USD' ? 'on' : ''} onClick={() => setMoneda('USD')}>USD</button>
                                <button type="button" className={moneda === 'COP' ? 'on' : ''} onClick={() => setMoneda('COP')}>COP</button>
                            </div>
                        </div>
                    </div>
                )}
                <button type="button" onClick={() => !soloPatrimonio && setAfectaBalance(!afectaBalance)} aria-pressed={!soloPatrimonio && afectaBalance} disabled={soloPatrimonio}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--text)', textAlign: 'left', cursor: soloPatrimonio ? 'default' : 'pointer' }}>
                    <span style={{ width: 46, height: 28, borderRadius: 99, padding: 3, flexShrink: 0, background: !soloPatrimonio && afectaBalance ? 'var(--primary)' : 'var(--line)', transition: 'background .3s var(--ease)' }}>
                        <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow)', transform: !soloPatrimonio && afectaBalance ? 'translateX(18px)' : 'none', transition: 'transform .35s var(--spring)' }} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{soloPatrimonio ? 'Solo patrimonio (USD)' : afectaBalance ? 'Descontar de mi saldo' : 'Solo patrimonio'}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{soloPatrimonio ? 'Las inversiones en USD no mezclan tu saldo en pesos.' : afectaBalance ? 'Sale de tu saldo disponible.' : 'No se resta de tu saldo (propiedades, largo plazo).'}</span>
                    </span>
                </button>
                <button type="submit" className="btn" style={{ background: 'var(--violet)', color: 'var(--on-accent)', boxShadow: '0 12px 28px -12px var(--violet)' }}>Agregar al portafolio</button>
            </form>

            {inversionesList.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 24, fontSize: 14 }}>Aún no tienes inversiones registradas.</p>
            ) : (
                Object.entries(grouped).map(([tipo, inversiones]) => {
                    const totalTipo = inversiones.reduce((a, c) => a + cop(Number(c.monto) || 0, c), 0);
                    const utilTipo = inversiones.reduce((a, c) => a + cop(Number(c.utilidad) || 0, c), 0);
                    return (
                        <section key={tipo} className="rise d4" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{tipo}</h2>
                                <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0 }}>
                                    {millones(totalTipo)} · <span style={{ color: utilTipo >= 0 ? 'var(--income)' : 'var(--expense)' }}>{utilTipo >= 0 ? '+' : '−'}{millones(Math.abs(utilTipo))}</span>
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                                {inversiones.map(inv => (
                                    <InvestmentCard key={inv.id} inv={inv} onRegistrarUtilidad={registrarUtilidad} onDelete={(id) => genericDelete('transacciones', id)}
                                        onToggleBalance={toggleBalance} genericUpdate={genericUpdate} totalGastosMensuales={totalGastosMensuales} />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}
        </div>
    );
};
