import { useState } from 'react';
import { Trash2, CheckCircle2, RotateCcw, AlertTriangle, SlidersHorizontal, Bell, X, Pin, PinOff, CalendarClock, ArrowRight, Check } from 'lucide-react';
import { ScreenHeader, CountUp, Ring, fmtCOP } from '../ui/f360.jsx';
import { MontoInput, PlusToggle, Switch } from '../components/comunes';
import { CATEGORIAS_GASTOS } from '../lib/finanzas';

export const CategoryLimits = ({ limites, transacciones, genericAdd, genericDelete, notifPermiso, onActivarNotif, formOpen, setFormOpen }) => {
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
            alert(`Ya existe un tope para ${categoria}. Bórralo primero.`);
            return;
        }
        await genericAdd('limites', { categoria, limite: Number(limite) });
        setLimite('');
        setFormOpen(false);
    };

    const ordenados = [...limites].sort((a, b) => ((gastosMes[b.categoria] || 0) / (Number(b.limite) || 1)) - ((gastosMes[a.categoria] || 0) / (Number(a.limite) || 1)));

    return (
        <div>
            {formOpen && (
                <form onSubmit={agregarLimite} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nuevo tope mensual</h2>
                    <label className="field"><span className="field-label">Categoría</span>
                        <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
                            {CATEGORIAS_GASTOS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select></label>
                    <label className="field"><span className="field-label">Límite mensual</span><MontoInput value={limite} onChange={setLimite} required /></label>
                    <button type="submit" className="btn btn-primary">Guardar tope</button>
                </form>
            )}

            <div className="rise d3" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Topes de este mes</h2>
                {notifPermiso === 'granted' ? (
                    <span className="chip" style={{ cursor: 'default', color: 'var(--income)' }}><Bell size={14} aria-hidden="true" /> Avisos activos</span>
                ) : (
                    <button type="button" className="chip" onClick={onActivarNotif} style={{ color: 'var(--primary)' }}><Bell size={14} aria-hidden="true" /> Activar avisos</button>
                )}
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {limites.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 16, fontSize: 14 }}>No has configurado topes. Toca + para crear uno.</p>}
                {ordenados.map((item, i) => {
                    const gastado = gastosMes[item.categoria] || 0;
                    const tope = Number(item.limite) || 1;
                    const pct = (gastado / tope) * 100;
                    const exceso = gastado > tope;
                    const color = pct >= 100 ? 'var(--expense)' : pct > 70 ? 'var(--warn)' : 'var(--income)';
                    return (
                        <article key={item.id} className="card rise" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: `${0.2 + i * 0.06}s` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className="tile" style={{ width: 40, height: 40, background: exceso ? 'var(--expense-soft)' : pct > 70 ? 'var(--warn-soft)' : 'var(--income-soft)', color }}>
                                    {exceso ? <AlertTriangle size={18} aria-hidden="true" /> : <SlidersHorizontal size={18} aria-hidden="true" />}
                                </span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.categoria}</span>
                                    <span className="num" style={{ fontSize: 13, color: exceso ? 'var(--expense)' : 'var(--text-3)', letterSpacing: 0, fontWeight: exceso ? 700 : 500 }}>{fmtCOP(gastado)} de {fmtCOP(tope)}</span>
                                </div>
                                <span className="num" style={{ fontSize: 15, fontWeight: 700, color }}>{Math.round(pct)}%</span>
                                <button type="button" onClick={() => { if (window.confirm(`¿Eliminar el tope de ${item.categoria}?`)) genericDelete('limites', item.id); }} aria-label={`Eliminar tope de ${item.categoria}`}
                                    style={{ width: 36, height: 44, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer', marginRight: -6 }}>
                                    <Trash2 size={16} aria-hidden="true" />
                                </button>
                            </div>
                            <div className="bar"><i style={{ width: `${Math.min(pct, 100)}%`, background: exceso ? 'linear-gradient(90deg, var(--warn), var(--expense))' : color }} /></div>
                            {exceso && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--expense)' }}>Te pasaste por {fmtCOP(gastado - tope)}</span>}
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

export const BudgetPlanner = ({ presupuestoItems, limites, transacciones, genericAdd, genericUpdate, genericDelete, onEjecutarPago, notifPermiso, onActivarNotif, onBack }) => {
    const [viewMode, setViewMode] = useState('lista');
    const [formOpen, setFormOpen] = useState(false);
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [categoria, setCategoria] = useState(CATEGORIAS_GASTOS[0]);
    const [recurrente, setRecurrente] = useState(true);
    const [diaPago, setDiaPago] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [montoEdit, setMontoEdit] = useState('');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const nombreMesActual = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    const totalPresupuesto = presupuestoItems.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
    // Un ítem es fijo si recurrente === true. Los ítems antiguos (sin el campo) se tratan como fijos.
    const esFijo = (item) => item.recurrente !== false;
    const estaPagado = (item) => !!(item.lastPaid && item.lastPaid.startsWith(currentMonth));
    const totalPagado = presupuestoItems.filter(estaPagado).reduce((a, i) => a + (Number(i.monto) || 0), 0);
    const pagados = presupuestoItems.filter(estaPagado).length;

    const agregarObligacion = async (e) => {
        e.preventDefault();
        const dp = parseInt(diaPago);
        await genericAdd('presupuesto', { concepto, monto: Number(monto), categoria, lastPaid: '', recurrente, diaPago: (dp >= 1 && dp <= 31) ? dp : null });
        setConcepto(''); setMonto(''); setRecurrente(true); setDiaPago(''); setFormOpen(false);
    };

    const toggleRecurrente = async (item) => {
        await genericUpdate('presupuesto', item.id, { recurrente: !esFijo(item) });
    };

    const guardarEdicion = async (id) => {
        if (!montoEdit) return;
        await genericUpdate('presupuesto', id, { monto: Number(montoEdit) });
        setEditandoId(null);
    };

    const prepararNuevoMes = async () => {
        const fijos = presupuestoItems.filter(esFijo);
        const noFijos = presupuestoItems.filter(item => !esFijo(item));
        let mensaje = `¿Iniciar el mes de ${nombreMesActual}?\n\n• Se desmarcarán los pagos de tus ${fijos.length} ítem(s) fijo(s) para volver a usarlos.`;
        if (noFijos.length > 0) {
            mensaje += `\n• Se eliminarán ${noFijos.length} ítem(s) marcado(s) como de un solo mes.`;
        }
        if (!confirm(mensaje)) return;
        await Promise.all([
            ...fijos.map(item => genericUpdate('presupuesto', item.id, { lastPaid: '' })),
            ...noFijos.map(item => genericDelete('presupuesto', item.id)),
        ]);
    };

    // Pendientes primero (por día de pago), pagados al final.
    const ordenados = [...presupuestoItems].sort((a, b) => (estaPagado(a) - estaPagado(b)) || ((a.diaPago || 99) - (b.diaPago || 99)));
    const esTopes = viewMode === 'topes';
    const accionIcono = { width: 40, height: 40, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-3)' };

    return (
        <div>
            <ScreenHeader title="Presupuesto" onBack={onBack} right={<PlusToggle open={formOpen} onClick={() => setFormOpen(v => !v)} label={esTopes ? 'Nuevo tope' : 'Nuevo ítem'} />} />

            <div className="seg rise d2" style={{ marginTop: 18 }} role="tablist" aria-label="Vista de presupuesto">
                <span className="thumb" style={{ transform: esTopes ? 'translateX(100%)' : 'translateX(0)' }} />
                <button type="button" role="tab" aria-selected={!esTopes} className={!esTopes ? 'on' : ''} onClick={() => { setViewMode('lista'); setFormOpen(false); }}>Lista fija</button>
                <button type="button" role="tab" aria-selected={esTopes} className={esTopes ? 'on' : ''} onClick={() => { setViewMode('topes'); setFormOpen(false); }}>Topes</button>
            </div>

            {esTopes ? (
                <CategoryLimits limites={limites} transacciones={transacciones} genericAdd={genericAdd} genericDelete={genericDelete} notifPermiso={notifPermiso} onActivarNotif={onActivarNotif} formOpen={formOpen} setFormOpen={setFormOpen} />
            ) : (
                <>
                    <section className="card rise d3" style={{ marginTop: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Ring pct={totalPresupuesto > 0 ? totalPagado / totalPresupuesto : 0} size={84} stroke={10} color="var(--income)">
                            <span className="num" style={{ fontSize: 16, fontWeight: 700 }}>{pagados}/{presupuestoItems.length}</span>
                        </Ring>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Total del mes</span>
                            <span className="num" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}><CountUp value={totalPresupuesto} /></span>
                            <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0 }}>Falta {fmtCOP(totalPresupuesto - totalPagado)}</span>
                        </div>
                    </section>

                    {formOpen && (
                        <form onSubmit={agregarObligacion} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nuevo ítem</h2>
                            <label className="field"><span className="field-label">Obligación</span>
                                <input className="input" placeholder="Ej: Arriendo" value={concepto} onChange={e => setConcepto(e.target.value)} required /></label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                                <label className="field"><span className="field-label">Monto</span><MontoInput value={monto} onChange={setMonto} required /></label>
                                <label className="field"><span className="field-label">Día de pago</span>
                                    <input className="input num" type="number" inputMode="numeric" min="1" max="31" placeholder="1–31" value={diaPago} onChange={e => setDiaPago(e.target.value)} /></label>
                            </div>
                            <label className="field"><span className="field-label">Categoría</span>
                                <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>{CATEGORIAS_GASTOS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                            <button type="button" onClick={() => setRecurrente(v => !v)} aria-pressed={recurrente}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                                <Switch on={recurrente} />
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 14, fontWeight: 800 }}>{recurrente ? 'Fijo todos los meses' : 'Solo este mes'}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{recurrente ? 'Se reutiliza cada mes (ej: arriendo).' : 'Se elimina al preparar el próximo mes.'}</span>
                                </span>
                            </button>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock size={14} aria-hidden="true" /> Con día de pago te aviso en Inicio cuando se acerque.</p>
                            <button type="submit" className="btn btn-primary">Agregar al presupuesto</button>
                        </form>
                    )}

                    <div className="rise d4" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Mi lista mensual</h2>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>{presupuestoItems.length} ítems</span>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {presupuestoItems.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 16, fontSize: 14 }}>Agrega tus gastos fijos con el botón +.</p>}
                        {ordenados.map((item, i) => {
                            const isPaid = estaPagado(item);
                            const fijo = esFijo(item);
                            const editando = editandoId === item.id;
                            return (
                                <article key={item.id} className="card rise" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${0.25 + i * 0.05}s`, opacity: isPaid ? .75 : 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span className="tile" style={{ width: 40, height: 40, background: isPaid ? 'var(--income-soft)' : 'var(--warn-soft)', color: isPaid ? 'var(--income)' : 'var(--warn)' }}>
                                            {isPaid ? <Check size={20} strokeWidth={2.2} aria-hidden="true" /> : <CalendarClock size={18} strokeWidth={1.9} aria-hidden="true" />}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isPaid ? 'line-through' : 'none' }}>{item.concepto}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {fijo ? 'Fijo' : '1 mes'} · {item.categoria}{item.diaPago ? ` · día ${item.diaPago}` : ''}
                                            </span>
                                        </div>
                                        {editando ? null : (
                                            <button type="button" className="num" onClick={() => { if (!isPaid) { setEditandoId(item.id); setMontoEdit(String(Math.round(Number(item.monto) || 0))); } }} aria-label={`Editar monto de ${item.concepto}`}
                                                style={{ fontSize: 15, fontWeight: 700, background: 'none', border: 0, padding: '6px 0', color: 'var(--text)', cursor: isPaid ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                                                {fmtCOP(item.monto)}
                                            </button>
                                        )}
                                    </div>
                                    {editando && (
                                        <form onSubmit={(e) => { e.preventDefault(); guardarEdicion(item.id); }} style={{ display: 'flex', gap: 8 }}>
                                            <MontoInput value={montoEdit} onChange={setMontoEdit} aria-label="Nuevo monto" autoFocus style={{ height: 44, flex: 1, minWidth: 0 }} />
                                            <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
                                            <button type="button" className="icon-btn" onClick={() => setEditandoId(null)} aria-label="Cancelar"><X size={16} aria-hidden="true" /></button>
                                        </form>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {!isPaid ? (
                                            <>
                                                <button type="button" className="btn btn-primary btn-sm" onClick={() => onEjecutarPago(item)} style={{ flex: 1 }}>Pagar <ArrowRight size={16} aria-hidden="true" /></button>
                                                <button type="button" className="btn btn-outline btn-sm" onClick={() => genericUpdate('presupuesto', item.id, { lastPaid: currentMonth })} aria-label="Marcar como pagado sin registrar gasto" style={{ color: 'var(--income)' }}>
                                                    <Check size={16} aria-hidden="true" /> Ya pagué
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => genericUpdate('presupuesto', item.id, { lastPaid: '' })} style={{ flex: 1, color: 'var(--income)' }}>
                                                <CheckCircle2 size={16} aria-hidden="true" /> Pagado · desmarcar
                                            </button>
                                        )}
                                        <button type="button" className="icon-btn" onClick={() => toggleRecurrente(item)} aria-label={fijo ? 'Quitar de fijos' : 'Marcar como fijo'} aria-pressed={fijo} style={{ ...accionIcono, color: fijo ? 'var(--primary)' : 'var(--text-3)' }}>
                                            {fijo ? <Pin size={17} aria-hidden="true" /> : <PinOff size={17} aria-hidden="true" />}
                                        </button>
                                        <button type="button" className="icon-btn" onClick={() => { if (window.confirm(`¿Eliminar "${item.concepto}"?`)) genericDelete('presupuesto', item.id); }} aria-label={`Eliminar ${item.concepto}`} style={accionIcono}>
                                            <Trash2 size={17} aria-hidden="true" />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <section className="card rise" style={{ marginTop: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="tile" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><RotateCcw size={18} aria-hidden="true" /></span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 15, fontWeight: 800 }}>Nuevo mes</span>
                                <span style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.4 }}>Los fijos se conservan sin el "pagado"; los de un solo mes se eliminan.</span>
                            </div>
                        </div>
                        <button type="button" className="btn btn-outline" onClick={prepararNuevoMes} style={{ textTransform: 'none' }}>Preparar {nombreMesActual}</button>
                    </section>
                </>
            )}
        </div>
    );
};
