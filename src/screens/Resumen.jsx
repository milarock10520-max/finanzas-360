import { TrendingUp, TrendingDown, CreditCard, Wallet, Calendar } from 'lucide-react';
import { CardResumen } from '../components/comunes';
import { formatCurrency } from '../lib/finanzas';

// --- COMPONENTES PRINCIPALES ---

export const DashboardView = ({ saldoActual, totalIngresos, totalGastos, totalDeudaPendiente, transacciones }) => (
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
                    {transacciones.filter(t => t.tipo === 'ingreso' || t.tipo === 'gasto').slice(0, 5).map(t => (
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
