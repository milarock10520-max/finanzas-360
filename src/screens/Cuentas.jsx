import { useState, useMemo } from 'react';
import { ArrowRight, ArrowLeftRight, Trash2, X, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { ScreenHeader, BottomSheet, CountUp, fmtCOP } from '../ui/f360.jsx';
import { PlusToggle, MontoInput } from '../components/comunes';
import { dateKey } from '../lib/finanzas';
import { TIPOS_CUENTA, estadoCuentas } from '../lib/cuentas';

const TONO = {
    income: ['var(--income-soft)', 'var(--income)'],
    primary: ['var(--primary-soft)', 'var(--primary)'],
    violet: ['var(--violet-soft)', 'var(--violet)'],
    expense: ['var(--expense-soft)', 'var(--expense)'],
};
const fFecha = (d) => d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';
const fClave = (k) => {
    const [y, m, d] = String(k || '').split('-').map(Number);
    return y ? new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';
};

// =============================================
// === CUENTAS Y MEDIOS DE PAGO ===
// =============================================
export const CuentasView = ({ cuentas, transacciones, genericAdd, genericUpdate, genericDelete, onBack }) => {
    const [editor, setEditor] = useState(null);       // null | 'nueva' | cuenta
    const [transferencia, setTransferencia] = useState(null); // null | { origenId, destinoId, monto, concepto }
    const [detalle, setDetalle] = useState(null);     // id de cuenta abierta

    const estado = useMemo(() => estadoCuentas(cuentas, transacciones), [cuentas, transacciones]);
    const tarjetas = estado.cuentas.filter(c => c.tipo === 'credito');
    const otras = estado.cuentas.filter(c => c.tipo !== 'credito');
    const cuentaDetalle = estado.cuentas.find(c => c.id === detalle);

    const pagarTarjeta = (t) => setTransferencia({
        origenId: otras[0]?.id || '', destinoId: t.id,
        monto: String(Math.round(t.montoPago || t.deuda || 0)), concepto: `Pago ${t.nombre}`,
    });

    return (
        <div>
            <ScreenHeader title="Cuentas" onBack={onBack} right={<PlusToggle open={editor === 'nueva'} onClick={() => setEditor(e => (e === 'nueva' ? null : 'nueva'))} label="Nueva cuenta" />} />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="orb" style={{ width: 220, height: 220, right: -80, top: -100, background: '#10B981', opacity: .45 }} />
                <div className="orb" style={{ width: 160, height: 160, left: -60, bottom: -80, background: '#3355FF', opacity: .5, animationDuration: '17s' }} />
                <div className="grid-lines" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>En efectivo y bancos</span>
                    <span className="num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}><CountUp value={estado.efectivoYBancos} /></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    <div className="glass-pill" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>Deuda tarjetas</span>
                        <span className="num" style={{ fontSize: 15, fontWeight: 700, color: estado.deudaTarjetas ? '#FDA4AF' : '#fff' }}>{fmtCOP(estado.deudaTarjetas)}</span>
                    </div>
                    <div className="glass-pill" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>Sin cuenta</span>
                        <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{estado.sinCuenta < 0 ? '− ' : ''}{fmtCOP(Math.abs(estado.sinCuenta))}</span>
                    </div>
                </div>
            </section>

            {cuentas.length === 0 && editor !== 'nueva' && (
                <section className="card rise d3" style={{ marginTop: 14, padding: '26px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <h2 className="display" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Organiza tu dinero por cuentas</h2>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
                        Crea tu efectivo, tus cuentas de banco y tus tarjetas de crédito. Al registrar un gasto eliges con qué pagaste y la app te dice cuánto tienes en cada lado, cuánto debes a cada tarjeta y cuándo pagarla.
                    </p>
                    <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setEditor('nueva')}>Crear mi primera cuenta</button>
                </section>
            )}

            {(otras.length > 1 || (otras.length > 0 && tarjetas.length > 0)) && (
                <button type="button" className="btn btn-outline rise d3" style={{ marginTop: 14, width: '100%' }}
                    onClick={() => setTransferencia({ origenId: otras[0]?.id || '', destinoId: (otras[1] || tarjetas[0])?.id || '', monto: '', concepto: '' })}>
                    <ArrowLeftRight size={18} aria-hidden="true" /> Mover dinero entre cuentas
                </button>
            )}

            {tarjetas.length > 0 && (
                <>
                    <h2 className="rise d4" style={{ margin: '24px 0 0', fontSize: 17, fontWeight: 800 }}>Tarjetas de crédito</h2>
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                        {tarjetas.map((t, i) => {
                            const [soft, color] = TONO.expense;
                            return (
                                <article key={t.id} className="card rise" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${0.25 + i * 0.06}s` }}>
                                    <button type="button" onClick={() => setDetalle(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                                        <span className="tile" style={{ background: soft, color }}><t.Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.cupo ? `Disponible ${fmtCOP(t.disponible)}` : 'Sin cupo registrado'}</span>
                                        </span>
                                        <span style={{ textAlign: 'right' }}>
                                            <span className="eyebrow" style={{ fontSize: 10, display: 'block' }}>Debes</span>
                                            <span className="num" style={{ fontSize: 17, fontWeight: 700, color: t.deuda ? 'var(--expense)' : 'var(--text)' }}>{fmtCOP(t.deuda)}</span>
                                        </span>
                                    </button>
                                    {t.cupo > 0 && (
                                        <div className="bar"><i style={{ width: `${Math.min(100, (t.usoPct || 0) * 100)}%`, background: (t.usoPct || 0) > 0.7 ? 'linear-gradient(90deg, var(--warn), var(--expense))' : 'var(--primary)' }} /></div>
                                    )}
                                    {t.fechaPago && (
                                        <div style={{ padding: 12, borderRadius: 14, background: t.vencido ? 'var(--expense-soft)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {t.vencido && <AlertTriangle size={18} color="var(--expense)" aria-hidden="true" />}
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span style={{ fontSize: 13, fontWeight: 800, color: t.vencido ? 'var(--expense)' : 'var(--text)' }}>
                                                    {t.vencido ? `Pago vencido (${fFecha(t.fechaPago)})` : `Pagar antes del ${fFecha(t.fechaPago)}`}
                                                </span>
                                                <span className="num" style={{ fontSize: 13, color: 'var(--text-2)', letterSpacing: 0 }}>
                                                    {t.estimado ? 'Aprox. ' : ''}{fmtCOP(t.montoPago)} · corta el {fFecha(t.proximoCorte)} (ciclo actual {fmtCOP(t.comprasCiclo)})
                                                </span>
                                            </div>
                                            {(t.montoPago > 0 || t.deuda > 0) && otras.length > 0 && (
                                                <button type="button" className="chip" style={{ color: 'var(--primary)' }} onClick={() => pagarTarjeta(t)}>Pagar</button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </>
            )}

            {otras.length > 0 && (
                <>
                    <h2 className="rise d4" style={{ margin: '24px 0 0', fontSize: 17, fontWeight: 800 }}>Efectivo y bancos</h2>
                    <div className="card rise d5" style={{ marginTop: 12, padding: '4px 16px' }}>
                        {otras.map((c, i) => {
                            const [soft, color] = TONO[c.tono] || TONO.primary;
                            return (
                                <button key={c.id} type="button" onClick={() => setDetalle(c.id)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'none', border: 0, borderBottom: i < otras.length - 1 ? '1px solid var(--line)' : 0, color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                                    <span className="tile" style={{ width: 40, height: 40, background: soft, color }}><c.Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
                                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{(TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.debito).label}</span>
                                    </span>
                                    <span className="num" style={{ fontSize: 16, fontWeight: 700, color: c.saldo < 0 ? 'var(--expense)' : 'var(--text)' }}>{c.saldo < 0 ? '− ' : ''}{fmtCOP(Math.abs(c.saldo))}</span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {estado.sinCuenta !== 0 && cuentas.length > 0 && (
                <p style={{ margin: '14px 4px 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    "Sin cuenta" son los movimientos registrados antes de crear tus cuentas o sin cuenta asignada. Puedes asignarles una editándolos en Flujo.
                </p>
            )}

            {editor && (
                <EditorCuenta cuenta={editor === 'nueva' ? null : editor} onClose={() => setEditor(null)}
                    onGuardar={async (datos) => {
                        if (editor === 'nueva') await genericAdd('cuentas', { ...datos, createdAt: new Date().toISOString() });
                        else await genericUpdate('cuentas', editor.id, datos);
                        setEditor(null);
                    }} />
            )}

            {transferencia && (
                <SheetTransferencia inicial={transferencia} cuentas={estado.cuentas} onClose={() => setTransferencia(null)}
                    onGuardar={async (datos) => { await genericAdd('transacciones', { ...datos, tipo: 'transferencia', createdAt: new Date().toISOString() }); setTransferencia(null); }} />
            )}

            {cuentaDetalle && (
                <DetalleCuenta cuenta={cuentaDetalle} onClose={() => setDetalle(null)}
                    onEditar={() => { setEditor(cuentaDetalle); setDetalle(null); }}
                    onPagar={cuentaDetalle.tipo === 'credito' && otras.length ? () => { pagarTarjeta(cuentaDetalle); setDetalle(null); } : null}
                    onEliminarMovimiento={(t) => { if (window.confirm('¿Eliminar este movimiento entre cuentas?')) genericDelete('transacciones', t.id); }}
                    onEliminar={async () => {
                        if (!window.confirm(`¿Eliminar la cuenta "${cuentaDetalle.nombre}"? Sus movimientos se conservan y quedan como "sin cuenta".`)) return;
                        await genericDelete('cuentas', cuentaDetalle.id);
                        setDetalle(null);
                    }} />
            )}
        </div>
    );
};

// --- Crear / editar cuenta ---
const EditorCuenta = ({ cuenta, onClose, onGuardar }) => {
    const [nombre, setNombre] = useState(cuenta?.nombre || '');
    const [tipo, setTipo] = useState(cuenta?.tipo || 'debito');
    const [saldoInicial, setSaldoInicial] = useState(cuenta ? String(Math.round(Number(cuenta.saldoInicial) || 0)) : '');
    const [cupo, setCupo] = useState(cuenta?.cupo ? String(cuenta.cupo) : '');
    const [diaCorte, setDiaCorte] = useState(cuenta?.diaCorte ? String(cuenta.diaCorte) : '');
    const [diaPago, setDiaPago] = useState(cuenta?.diaPago ? String(cuenta.diaPago) : '');
    const esCredito = tipo === 'credito';
    const dia = (v) => { const n = parseInt(v, 10); return n >= 1 && n <= 31 ? n : null; };

    const guardar = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await onGuardar({
            nombre: nombre.trim(), tipo,
            saldoInicial: Number(saldoInicial) || 0,
            cupo: esCredito ? (Number(cupo) || 0) : null,
            diaCorte: esCredito ? dia(diaCorte) : null,
            diaPago: esCredito ? dia(diaPago) : null,
        });
    };

    return (
        <BottomSheet open onClose={onClose} label={cuenta ? 'Editar cuenta' : 'Nueva cuenta'}>
            <form onSubmit={guardar} style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{cuenta ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
                </header>
                <div className="field">
                    <span className="field-label">Tipo</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {Object.entries(TIPOS_CUENTA).map(([k, t]) => (
                            <button key={k} type="button" className={`chip ${tipo === k ? 'on' : ''}`} aria-pressed={tipo === k} onClick={() => setTipo(k)} style={{ justifyContent: 'center', height: 48 }}>
                                <t.Icon size={16} aria-hidden="true" /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>
                <label className="field"><span className="field-label">Nombre</span>
                    <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder={esCredito ? 'Ej: Visa Bancolombia' : 'Ej: Nequi, Bancolombia, Billetera'} required /></label>
                <label className="field"><span className="field-label">{esCredito ? 'Deuda actual de la tarjeta' : 'Saldo actual'}</span>
                    <MontoInput value={saldoInicial} onChange={setSaldoInicial} /></label>
                {esCredito && (
                    <>
                        <label className="field"><span className="field-label">Cupo total</span><MontoInput value={cupo} onChange={setCupo} /></label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <label className="field"><span className="field-label">Día de corte</span>
                                <input className="input num" type="number" inputMode="numeric" min="1" max="31" placeholder="1–31" value={diaCorte} onChange={e => setDiaCorte(e.target.value)} /></label>
                            <label className="field"><span className="field-label">Día límite de pago</span>
                                <input className="input num" type="number" inputMode="numeric" min="1" max="31" placeholder="1–31" value={diaPago} onChange={e => setDiaPago(e.target.value)} /></label>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>Con estas fechas te digo cuánto pagar y te recuerdo antes del límite.</p>
                    </>
                )}
                <button type="submit" className="btn btn-primary">{cuenta ? 'Guardar cambios' : 'Crear cuenta'}</button>
            </form>
        </BottomSheet>
    );
};

// --- Transferencia entre cuentas (incluye pagar la tarjeta) ---
const SheetTransferencia = ({ inicial, cuentas, onClose, onGuardar }) => {
    const [origenId, setOrigenId] = useState(inicial.origenId);
    const [destinoId, setDestinoId] = useState(inicial.destinoId);
    const [monto, setMonto] = useState(inicial.monto || '');
    const [concepto, setConcepto] = useState(inicial.concepto || '');
    const [fecha, setFecha] = useState(dateKey());
    const origenes = cuentas.filter(c => c.tipo !== 'credito');
    const destino = cuentas.find(c => c.id === destinoId);
    const valido = origenId && destinoId && origenId !== destinoId && Number(monto) > 0;

    const guardar = async (e) => {
        e.preventDefault();
        if (!valido) return;
        await onGuardar({ origenId, destinoId, monto: Number(monto), fecha, concepto: concepto.trim() || (destino?.tipo === 'credito' ? `Pago ${destino.nombre}` : 'Transferencia') });
    };

    return (
        <BottomSheet open onClose={onClose} label="Mover dinero">
            <form onSubmit={guardar} style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{destino?.tipo === 'credito' ? 'Pagar tarjeta' : 'Mover dinero'}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
                </header>
                <div className="field">
                    <span className="field-label">Desde</span>
                    <div className="hscroll">{origenes.map(c => <button key={c.id} type="button" className={`chip ${origenId === c.id ? 'on' : ''}`} onClick={() => setOrigenId(c.id)}>{c.nombre} · {fmtCOP(c.saldo)}</button>)}</div>
                </div>
                <div className="field">
                    <span className="field-label">Hacia</span>
                    <div className="hscroll">{cuentas.filter(c => c.id !== origenId).map(c => <button key={c.id} type="button" className={`chip ${destinoId === c.id ? 'on' : ''}`} onClick={() => setDestinoId(c.id)}>{c.nombre}</button>)}</div>
                </div>
                <label className="field"><span className="field-label">Monto</span><MontoInput value={monto} onChange={setMonto} /></label>
                {destino?.tipo === 'credito' && (
                    <div className="hscroll">
                        {destino.montoPago > 0 && <button type="button" className="chip" onClick={() => setMonto(String(Math.round(destino.montoPago)))}>Lo del corte · {fmtCOP(destino.montoPago)}</button>}
                        {destino.deuda > 0 && <button type="button" className="chip" onClick={() => setMonto(String(Math.round(destino.deuda)))}>Toda la deuda · {fmtCOP(destino.deuda)}</button>}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></label>
                    <label className="field"><span className="field-label">Nota</span><input className="input" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Opcional" /></label>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>Mover dinero entre tus cuentas no cuenta como gasto ni cambia tu saldo total.</p>
                <button type="submit" className="btn btn-primary" disabled={!valido}>Registrar <ArrowRight size={18} aria-hidden="true" /></button>
            </form>
        </BottomSheet>
    );
};

// --- Detalle de una cuenta: últimos movimientos ---
const DetalleCuenta = ({ cuenta, onClose, onEditar, onPagar, onEliminar, onEliminarMovimiento }) => {
    const movs = cuenta.movimientos.slice(0, 40);
    const signo = (t) => {
        if (t.tipo === 'ingreso') return 1;
        if (t.tipo === 'gasto') return -1;
        return t.destinoId === cuenta.id ? 1 : -1;
    };
    return (
        <BottomSheet open onClose={onClose} label={cuenta.nombre}>
            <div style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="tile" style={{ background: (TONO[cuenta.tono] || TONO.primary)[0], color: (TONO[cuenta.tono] || TONO.primary)[1] }}><cuenta.Icon size={20} aria-hidden="true" /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{cuenta.nombre}</h2>
                        <span className="num" style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 0 }}>
                            {cuenta.tipo === 'credito' ? `Debes ${fmtCOP(cuenta.deuda)}` : `Saldo ${fmtCOP(cuenta.saldo)}`}
                        </span>
                    </div>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
                </header>
                <div style={{ display: 'flex', gap: 8 }}>
                    {onPagar && <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={onPagar}>Pagar tarjeta</button>}
                    <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={onEditar}>Editar</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onEliminar} aria-label="Eliminar cuenta" style={{ color: 'var(--expense)', width: 44, padding: 0 }}><Trash2 size={17} aria-hidden="true" /></button>
                </div>
                <span className="eyebrow">Últimos movimientos</span>
                {movs.length === 0 && <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)' }}>Aún no hay movimientos en esta cuenta.</p>}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {movs.map((t, i) => {
                        const s = signo(t);
                        const esTransf = t.tipo === 'transferencia';
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                                <span className="tile" style={{ width: 34, height: 34, borderRadius: 11, background: esTransf ? 'var(--surface-2)' : s > 0 ? 'var(--income-soft)' : 'var(--expense-soft)', color: esTransf ? 'var(--text-2)' : s > 0 ? 'var(--income)' : 'var(--expense)' }}>
                                    {esTransf ? <ArrowLeftRight size={15} aria-hidden="true" /> : s > 0 ? <ArrowUp size={15} aria-hidden="true" /> : <ArrowDown size={15} aria-hidden="true" />}
                                </span>
                                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.concepto || (esTransf ? 'Transferencia' : t.categoria)}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{esTransf ? 'Entre cuentas' : t.categoria} · {fClave(t.fecha)}</span>
                                </span>
                                <span className="num" style={{ fontSize: 14, fontWeight: 700, color: s > 0 ? 'var(--income)' : 'var(--text)', whiteSpace: 'nowrap' }}>{s > 0 ? '+ ' : '− '}{fmtCOP(t.monto)}</span>
                                {esTransf && (
                                    <button type="button" onClick={() => onEliminarMovimiento(t)} aria-label="Eliminar transferencia" style={{ width: 32, height: 36, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}>
                                        <Trash2 size={14} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </BottomSheet>
    );
};
