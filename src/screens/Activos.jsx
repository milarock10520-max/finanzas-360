// Activos: bienes que no dan utilidad pero son patrimonio (carro, computador, casa propia…).
// No tocan el saldo; suman al patrimonio neto a su valor actual (colección `activos`).
import { useState } from 'react';
import { Car, Laptop, Home, Sofa, Gem, Package, Plus, Trash2, Edit2, Check, X, ArrowDown, ArrowUp } from 'lucide-react';
import { CountUp, fmtCOP } from '../ui/f360.jsx';
import { MontoInput } from '../components/comunes';
import { dateKey } from '../lib/finanzas';
import { valorActivo } from '../lib/patrimonio';

export const TIPOS_ACTIVO = {
    'Vehículo': { Icon: Car, color: 'var(--primary)', soft: 'var(--primary-soft)' },
    'Tecnología': { Icon: Laptop, color: 'var(--violet)', soft: 'var(--violet-soft)' },
    'Inmueble': { Icon: Home, color: 'var(--income)', soft: 'var(--income-soft)' },
    'Hogar y muebles': { Icon: Sofa, color: 'var(--warn)', soft: 'var(--warn-soft)' },
    'Joyas y arte': { Icon: Gem, color: 'var(--cyan)', soft: 'var(--income-soft)' },
    'Otro': { Icon: Package, color: 'var(--text-2)', soft: 'var(--surface-2)' },
};
const confTipo = (t) => TIPOS_ACTIVO[t] || TIPOS_ACTIVO.Otro;

const millones = (n) => {
    const v = Number(n) || 0;
    return Math.abs(v) >= 1e6 ? `$ ${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : fmtCOP(v);
};
const fechaCorta = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : '');

const ActivoCard = ({ activo, onActualizar, onBorrar }) => {
    const { Icon, color, soft } = confTipo(activo.tipo);
    const valor = valorActivo(activo);
    const compra = Number(activo.valorCompra) || 0;
    const cambio = compra > 0 ? valor - compra : null;
    const [editandoValor, setEditandoValor] = useState(false);
    const [valorInput, setValorInput] = useState('');
    const [editando, setEditando] = useState(false);
    const [nombre, setNombre] = useState(activo.nombre || '');
    const [notas, setNotas] = useState(activo.notas || '');

    const guardarValor = async () => {
        const v = Number(valorInput);
        if (!(v >= 0)) return;
        await onActualizar(activo.id, { valorActual: v, valorActualizado: dateKey() });
        setEditandoValor(false);
    };
    const guardarDatos = async () => {
        if (!nombre.trim()) return;
        await onActualizar(activo.id, { nombre: nombre.trim(), notas: notas.trim() });
        setEditando(false);
    };
    const mini = { padding: 12, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 };

    return (
        <article className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="tile" style={{ background: soft, color }}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {editando
                        ? <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} aria-label="Nombre del activo" style={{ height: 40 }} autoFocus />
                        : <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activo.nombre}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{activo.tipo || 'Otro'}{activo.fechaCompra ? ` · desde ${fechaCorta(activo.fechaCompra)}` : ''}</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>Valor actual</span>
                    {editandoValor ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <MontoInput value={valorInput} onChange={setValorInput} aria-label="Nuevo valor actual" style={{ width: 130, height: 40, textAlign: 'right', padding: '0 10px' }}
                                onKeyDown={e => { if (e.key === 'Enter') guardarValor(); if (e.key === 'Escape') setEditandoValor(false); }} autoFocus />
                            <button type="button" className="icon-btn" onClick={guardarValor} aria-label="Guardar valor" style={{ width: 40, height: 40, background: 'var(--income)', color: 'var(--on-accent)', borderColor: 'transparent' }}><Check size={16} aria-hidden="true" /></button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => { setEditandoValor(true); setValorInput(String(Math.round(valor))); }} aria-label="Actualizar valor actual"
                            className="num" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: 17, fontWeight: 700, background: 'none', border: 0, padding: '4px 0', color: 'var(--text)', cursor: 'pointer' }}>
                            {fmtCOP(valor)} <Edit2 size={12} color="var(--text-3)" aria-hidden="true" />
                        </button>
                    )}
                    {activo.valorActualizado && !editandoValor && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Actualizado {fechaCorta(activo.valorActualizado)}</span>}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <div style={mini}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>Lo compraste en</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{compra ? fmtCOP(compra) : '—'}</span>
                </div>
                <div style={mini}>
                    <span className="eyebrow" style={{ fontSize: 10 }}>{cambio === null ? 'Cambio' : cambio >= 0 ? 'Valorización' : 'Desvalorización'}</span>
                    {cambio === null ? <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>—</span> : (
                        <span className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0, color: cambio >= 0 ? 'var(--income)' : 'var(--expense)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            {cambio >= 0 ? <ArrowUp size={12} strokeWidth={2.4} aria-hidden="true" /> : <ArrowDown size={12} strokeWidth={2.4} aria-hidden="true" />}
                            {fmtCOP(Math.abs(cambio))} · {Math.abs(Math.round((cambio / compra) * 100))}%
                        </span>
                    )}
                </div>
            </div>

            {editando ? (
                <label className="field"><span className="field-label">Notas</span>
                    <input className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Placa, serial, ubicación…" /></label>
            ) : activo.notas ? <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{activo.notas}</span> : null}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {editando ? (
                    <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditando(false); setNombre(activo.nombre || ''); setNotas(activo.notas || ''); }}><X size={16} aria-hidden="true" /> Cancelar</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={guardarDatos}><Check size={16} aria-hidden="true" /> Guardar</button>
                    </>
                ) : (
                    <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(true)}><Edit2 size={14} aria-hidden="true" /> Editar</button>
                        <button type="button" className="icon-btn" onClick={() => { if (window.confirm(`¿Eliminar el activo "${activo.nombre}"?`)) onBorrar(activo.id); }} aria-label={`Eliminar ${activo.nombre}`}
                            style={{ width: 40, height: 40, border: 0, background: 'transparent', color: 'var(--text-3)' }}>
                            <Trash2 size={16} aria-hidden="true" />
                        </button>
                    </>
                )}
            </div>
        </article>
    );
};

export const ActivosView = ({ activos = [], genericAdd, genericUpdate, genericDelete }) => {
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState('Vehículo');
    const [valorCompra, setValorCompra] = useState('');
    const [valorActual, setValorActual] = useState('');
    const [fechaCompra, setFechaCompra] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const registrar = async (e) => {
        e.preventDefault();
        const compra = Number(valorCompra) || 0;
        const actual = valorActual === '' ? compra : Number(valorActual) || 0;
        if (!nombre.trim()) return;
        if (!(actual > 0)) { setError('Escribe el valor de compra o el valor actual.'); return; }
        setError('');
        setGuardando(true);
        try {
            await genericAdd('activos', {
                nombre: nombre.trim(), tipo, valorCompra: compra || null, valorActual: actual, valorActualizado: dateKey(),
                fechaCompra: fechaCompra || null, notas: '', createdAt: new Date().toISOString(),
            });
            setNombre(''); setValorCompra(''); setValorActual(''); setFechaCompra('');
        } finally {
            setGuardando(false);
        }
    };

    const total = activos.reduce((a, x) => a + valorActivo(x), 0);
    const pagado = activos.reduce((a, x) => a + (Number(x.valorCompra) || 0), 0);
    const conCompra = activos.filter(x => Number(x.valorCompra) > 0);
    const cambio = conCompra.reduce((a, x) => a + valorActivo(x) - Number(x.valorCompra), 0);
    const grupos = Object.keys(TIPOS_ACTIVO).map(t => [t, activos.filter(x => (TIPOS_ACTIVO[x.tipo] ? x.tipo : 'Otro') === t)]).filter(([, l]) => l.length);
    const pill = { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 };
    const pillLbl = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' };

    return (
        <div>
            <section className="hero rise d2" style={{ marginTop: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="orb" style={{ width: 240, height: 240, right: -90, top: -100, background: '#10B981', opacity: .55 }} />
                <div className="orb" style={{ width: 160, height: 160, left: -50, bottom: -70, background: '#3355FF', opacity: .55, animationDuration: '17s' }} />
                <div className="grid-lines" />
                <div className="sheen" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Tus activos</span>
                    <span className="num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}><CountUp value={total} /></span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Suman a tu patrimonio. No afectan tu saldo disponible.</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <div className="glass-pill" style={pill}><span style={pillLbl}>Bienes</span><span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{activos.length}</span></div>
                    <div className="glass-pill" style={pill}><span style={pillLbl}>Pagaste</span><span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{millones(pagado)}</span></div>
                    <div className="glass-pill" style={pill}><span style={pillLbl}>Cambio</span><span className="num" style={{ fontSize: 13, fontWeight: 700, color: cambio >= 0 ? '#6EE7B7' : '#FDA4AF' }}>{conCompra.length ? `${cambio >= 0 ? '+ ' : '− '}${millones(Math.abs(cambio))}` : '—'}</span></div>
                </div>
            </section>

            <form onSubmit={registrar} className="card rise d3" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tile" style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--income-soft)', color: 'var(--income)' }}><Plus size={18} strokeWidth={2.2} aria-hidden="true" /></span>
                    Nuevo activo
                </h2>
                <label className="field"><span className="field-label">Nombre</span>
                    <input className="input" placeholder="Ej: Mazda 3, MacBook Pro" value={nombre} onChange={e => setNombre(e.target.value)} required /></label>
                <div className="field">
                    <span className="field-label">Tipo</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {Object.keys(TIPOS_ACTIVO).map(t => (
                            <button key={t} type="button" className={`chip ${tipo === t ? 'on' : ''}`} aria-pressed={tipo === t} onClick={() => setTipo(t)}>{t}</button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <label className="field"><span className="field-label">Valor de compra</span>
                        <MontoInput value={valorCompra} onChange={setValorCompra} /></label>
                    <label className="field"><span className="field-label">Valor actual</span>
                        <MontoInput value={valorActual} onChange={setValorActual} placeholder={valorCompra ? fmtCOP(valorCompra) : '$ 0'} /></label>
                </div>
                <label className="field"><span className="field-label">Fecha de compra (opcional)</span>
                    <input className="input" type="date" value={fechaCompra} max={dateKey()} onChange={e => setFechaCompra(e.target.value)} /></label>
                <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45, marginTop: -4 }}>
                    Si dejas vacío el valor actual se usa el de compra. Actualízalo cuando quieras (por ejemplo, con el precio de mercado de tu carro).
                </span>
                {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--expense)' }}>{error}</span>}
                <button type="submit" className="btn" disabled={guardando} style={{ background: 'var(--income)', color: 'var(--on-accent)', boxShadow: '0 12px 28px -12px var(--income)' }}>
                    {guardando ? 'Guardando…' : 'Agregar a mis activos'}
                </button>
            </form>

            {activos.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 24, fontSize: 14 }}>Aún no tienes activos registrados.</p>
            ) : grupos.map(([t, lista]) => (
                <section key={t} className="rise d4" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t}</h2>
                        <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0 }}>{millones(lista.reduce((a, x) => a + valorActivo(x), 0))}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                        {lista.map(a => <ActivoCard key={a.id} activo={a} onActualizar={(id, p) => genericUpdate('activos', id, p)} onBorrar={(id) => genericDelete('activos', id)} />)}
                    </div>
                </section>
            ))}
        </div>
    );
};
