import { useState } from 'react';
import { CreditCard, Calendar, PieChart, Lock, Copy, Search, Clock, ListChecks, Flame, LogOut, FolderKanban, Wallet, TrendingUp, Bell } from 'lucide-react';
import { ScreenHeader, fmtCOP } from '../ui/f360.jsx';
import { dateKey } from '../lib/finanzas';
import { estadoCuentas } from '../lib/cuentas';

// =============================================
// === TODO: cuadrícula de módulos ===
// =============================================
export const ModulosView = ({ onOpen, onBack, onLogout, user, totalInvertido, totalDeudaPendiente, googleToken, rutina, proyectos, habitos, vault, cuentas = [], recordatorios = [], transacciones = [], patrimonioNeto = null }) => {
    const resumenCuentas = cuentas.length ? estadoCuentas(cuentas, transacciones) : null;
    const [q, setQ] = useState('');
    const hoy = dateKey();
    const diaHoy = new Date().getDay();
    const bloquesHoy = rutina.filter(b => b.dia === diaHoy).length;
    const nombreDia = new Date().toLocaleDateString('es-CO', { weekday: 'long' });
    const activos = proyectos.filter(p => p.estado !== 'archivado').length;
    const hechos = habitos.filter(h => (h.historial || []).includes(hoy)).length;

    const todos = [
        { id: 'patrimonio', title: 'Patrimonio', sub: patrimonioNeto === null ? 'Tu valor neto' : `${patrimonioNeto < 0 ? '− ' : ''}${fmtCOP(Math.abs(patrimonioNeto))}`, Icon: TrendingUp, color: 'var(--primary)', soft: 'var(--primary-soft)' },
        { id: 'cuentas', title: 'Cuentas', sub: resumenCuentas ? `${fmtCOP(resumenCuentas.efectivoYBancos)}${resumenCuentas.deudaTarjetas ? ` · TC ${fmtCOP(resumenCuentas.deudaTarjetas)}` : ''}` : 'Efectivo, bancos y tarjetas', Icon: Wallet, color: 'var(--income)', soft: 'var(--income-soft)' },
        { id: 'inversiones', title: 'Inversiones', sub: fmtCOP(totalInvertido), Icon: PieChart, color: 'var(--violet)', soft: 'var(--violet-soft)' },
        { id: 'deudas', title: 'Deudas', sub: totalDeudaPendiente > 0 ? `Debes ${fmtCOP(totalDeudaPendiente)}` : 'Todo pagado', Icon: CreditCard, color: 'var(--expense)', soft: 'var(--expense-soft)' },
        { id: 'recordatorios', title: 'Asistente', sub: (() => { const n = recordatorios.filter(r => !r.sistema && r.activo !== false).length; return n ? `${n} ${n === 1 ? 'activo' : 'activos'} · asistente` : 'Agua, pausas, lectura…'; })(), Icon: Bell, color: 'var(--violet)', soft: 'var(--violet-soft)' },
        { id: 'agenda', title: 'Agenda', sub: googleToken ? 'Google conectado' : 'Conectar Google', Icon: Calendar, color: 'var(--primary)', soft: 'var(--primary-soft)' },
        { id: 'rutina', title: 'Rutina semanal', sub: `${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)} · ${bloquesHoy} bloques`, Icon: Clock, color: 'var(--cyan)', soft: 'var(--income-soft)' },
        { id: 'proyectos', title: 'Proyectos', sub: `${activos} ${activos === 1 ? 'activo' : 'activos'}`, Icon: FolderKanban, color: 'var(--text)', soft: 'var(--surface-2)' },
        { id: 'passwords', title: 'Bóveda', sub: vault?.isUnlocked ? 'Desbloqueada' : 'Bloqueada', Icon: Lock, color: 'var(--text)', soft: 'var(--surface-2)' },
        { id: 'presupuesto', title: 'Presupuesto', sub: 'Lista fija y topes', Icon: ListChecks, color: 'var(--warn)', soft: 'var(--warn-soft)' },
        { id: 'habitos', title: 'Hábitos', sub: `${hechos} de ${habitos.length} hoy`, Icon: Flame, color: 'var(--income)', soft: 'var(--income-soft)' },
    ];
    const filtro = q.trim().toLowerCase();
    const lista = todos.filter(m => !filtro || m.title.toLowerCase().includes(filtro));

    const copiarId = async () => {
        try { await navigator.clipboard.writeText(user.uid); alert('Tu ID se copió. Pégalo en el Atajo de Siri.'); }
        catch { prompt('Copia tu ID para el Atajo de Siri:', user.uid); }
    };

    return (
        <div>
            <ScreenHeader title="Todo" onBack={onBack} />

            <label className="rise d2" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <Search size={18} strokeWidth={2} color="var(--text-3)" aria-hidden="true" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar módulo…" aria-label="Buscar módulo" type="search"
                    style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
            </label>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {lista.map((m, i) => (
                    <button key={m.id} type="button" onClick={() => onOpen(m.id)} className="card lift rise"
                        style={{ padding: 16, minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, textAlign: 'left', color: 'var(--text)', cursor: 'pointer', animationDelay: `${0.12 + i * 0.05}s` }}>
                        <span className="tile" style={{ background: m.soft, color: m.color }}><m.Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 800 }}>{m.title}</span>
                            <span className="num" style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sub}</span>
                        </span>
                    </button>
                ))}
            </div>
            {lista.length === 0 && <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: 14, color: 'var(--text-3)' }}>Sin resultados</p>}

            <button type="button" className="btn btn-outline rise d8" style={{ marginTop: 20, width: '100%' }} onClick={copiarId}>
                <Copy size={18} strokeWidth={1.9} aria-hidden="true" /> Copiar mi ID (para Siri)
            </button>
            <button type="button" className="btn btn-outline rise d8" style={{ marginTop: 10, width: '100%', color: 'var(--expense)' }}
                onClick={() => { if (window.confirm('¿Cerrar sesión?')) onLogout(); }}>
                <LogOut size={18} strokeWidth={2} aria-hidden="true" /> Cerrar sesión
            </button>
        </div>
    );
};
