import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { formatCurrency } from '../lib/finanzas';

// Botón [+] de cabecera que rota 45° al abrir un formulario colapsable.
export const PlusToggle = ({ open, onClick, label }) => (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} aria-expanded={open}
        style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'transparent' }}>
        <Plus size={20} strokeWidth={2.4} aria-hidden="true" style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .45s var(--spring)' }} />
    </button>
);

// Monto con separadores es-CO mientras se escribe (guarda solo dígitos).
export const MontoInput = ({ value, onChange, placeholder = '$ 0', ...rest }) => (
    <input className="input num" inputMode="numeric" placeholder={placeholder}
        value={value ? '$ ' + Number(value).toLocaleString('es-CO') : ''}
        onChange={e => onChange(String(e.target.value).replace(/\D/g, '').slice(0, 13))} {...rest} />
);

export const CardResumen = ({ titulo, monto, icono: Icon, color }) => (
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

// Etiqueta de variación porcentual. "subirEsMalo" invierte los colores (gastos).
export const Variacion = ({ actual, anterior, subirEsMalo = false }) => {
    if (!anterior) return <span className="text-xs text-slate-400">sin datos del mes anterior</span>;
    const pct = ((actual - anterior) / anterior) * 100;
    if (Math.abs(pct) < 0.5) return <span className="text-xs text-slate-400">igual que el mes anterior</span>;
    const sube = pct > 0;
    const malo = subirEsMalo ? sube : !sube;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${malo ? 'text-rose-600' : 'text-emerald-600'}`}>
            {sube ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {sube ? '+' : ''}{pct.toFixed(1)}% vs mes anterior
        </span>
    );
};

// Interruptor con resorte (on/off accesible como botón).
export const Switch = ({ on }) => (
    <span aria-hidden="true" style={{ width: 46, height: 28, borderRadius: 99, padding: 3, flexShrink: 0, background: on ? 'var(--primary)' : 'var(--line)', transition: 'background .3s var(--ease)' }}>
        <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow)', transform: on ? 'translateX(18px)' : 'none', transition: 'transform .35s var(--spring)' }} />
    </span>
);
