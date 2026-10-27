import { useState } from 'react';
import { CreditCard, Calendar, PieChart, Lock, Copy, Search, Clock, ListChecks, Flame, LogOut, FolderKanban, Wallet, TrendingUp, Bell, FileSpreadsheet, RefreshCw, ExternalLink } from 'lucide-react';
import { ScreenHeader, fmtCOP } from '../ui/f360.jsx';
import { Capacitor } from '@capacitor/core';
import { dateKey } from '../lib/finanzas';
import { estadoCuentas } from '../lib/cuentas';

// =============================================
// === TODO: cuadrícula de módulos ===
// =============================================
// Hoja de Google para Gemini: la sincronizan el escritorio y el iPhone mientras están abiertos.
const abrirEnlace = (url) => {
    if (Capacitor.isNativePlatform()) import('@capacitor/browser').then(({ Browser }) => Browser.open({ url })).catch(() => window.open(url, '_blank'));
    else window.open(url, '_blank', 'noopener');
};
const TarjetaHoja = ({ hoja, permiso, puede, info = {}, onActivar, onSincronizar, onQuitar }) => {
    const hora = info.ultima ? new Date(info.ultima).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : null;
    const activa = !!(hoja && permiso && puede);
    const estado = !hoja ? 'Tus datos en una hoja de Google que Gemini puede leer y editar (sin la bóveda).'
        : info.error ? <span style={{ color: 'var(--expense)' }}>{info.error}</span>
        : !puede ? 'Activa · la sincronizan tus apps de iPhone y escritorio'
        : !permiso ? 'La hoja ya existe. Activa la sincronización también en este dispositivo.'
        : info.sincronizando ? 'Sincronizando…'
        : info.otro && !hora ? 'Otro dispositivo está sincronizando'
        : hora ? `Al día · ${hora}${info.aplicados ? ` · ${info.aplicados} cambio(s) de la hoja aplicados` : ''}`
        : 'Activa · esperando la primera sincronización';
    return (
        <div className="card rise d7" style={{ marginTop: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tile" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}><FileSpreadsheet size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Hoja para Gemini</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{estado}</div>
                </div>
            </div>
            {!hoja && !puede && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Se activa desde la app del iPhone o del escritorio.</p>}
            {puede && !activa && (
                <button type="button" className="btn btn-primary btn-sm" onClick={onActivar} disabled={info.sincronizando}>
                    <FileSpreadsheet size={18} aria-hidden="true" /> {info.sincronizando ? 'Esperando a Google…' : hoja ? 'Activar en este dispositivo' : 'Activar hoja'}
                </button>
            )}
            {hoja && (
                <div style={{ display: 'grid', gridTemplateColumns: activa ? '1fr 1fr' : '1fr', gap: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirEnlace(hoja.url)}><ExternalLink size={16} aria-hidden="true" /> Abrir hoja</button>
                    {activa && <button type="button" className="btn btn-ghost btn-sm" onClick={onSincronizar} disabled={info.sincronizando}><RefreshCw size={16} aria-hidden="true" /> Sincronizar</button>}
                </div>
            )}
            {activa && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)' }} onClick={onQuitar}>Dejar de sincronizar en este dispositivo</button>}
        </div>
    );
};

export const ModulosView = ({ onOpen, onBack, onLogout, user, totalInvertido, totalDeudaPendiente, googleToken, rutina, proyectos, habitos, vault, cuentas = [], recordatorios = [], transacciones = [], patrimonioNeto = null, hoja = null, hojaPermiso = false, hojaPuede = false, hojaInfo, onActivarHoja, onSincronizarHoja, onQuitarHoja }) => {
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

            <TarjetaHoja hoja={hoja} permiso={hojaPermiso} puede={hojaPuede} info={hojaInfo} onActivar={onActivarHoja} onSincronizar={onSincronizarHoja} onQuitar={onQuitarHoja} />

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
