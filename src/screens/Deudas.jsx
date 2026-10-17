import { useState } from 'react';
import { proyectarDeuda, simularPlan, mesesATexto, saldoDeuda } from '../lib/deudas';
import { CreditCard, Trash2, Edit2, Check } from 'lucide-react';
import { ScreenHeader, CountUp, Ring, fmtCOP } from '../ui/f360.jsx';
import { MontoInput, PlusToggle } from '../components/comunes';
import { dateKey } from '../lib/finanzas';

export const DeudaItem = ({ deuda, onAbonar, onEditar, onEliminar, delay = 0 }) => {
    const [pagoInput, setPagoInput] = useState('');
    const [editando, setEditando] = useState(false);
    const [editNombre, setEditNombre] = useState('');
    const [editTotal, setEditTotal] = useState('');
    const [editPagado, setEditPagado] = useState('');
    const [editCuotas, setEditCuotas] = useState('');
    const [editTasa, setEditTasa] = useState('');
    const [editCuota, setEditCuota] = useState('');
    const [editDia, setEditDia] = useState('');
    const [guardando, setGuardando] = useState(false);
    const montoTotal = Number(deuda.montoTotal) || 0;
    const montoPagado = Number(deuda.montoPagado) || 0;
    const restante = montoTotal - montoPagado;
    const progreso = montoTotal > 0 ? Math.min((montoPagado / montoTotal) * 100, 100) : 0;
    const pagada = restante <= 0;

    const abrirEdicion = () => {
        setEditNombre(deuda.nombre || '');
        setEditTotal(String(Math.round(montoTotal)));
        setEditPagado(String(Math.round(montoPagado)));
        setEditCuotas(deuda.cuotas || '');
        setEditTasa(deuda.tasaInteres ? String(deuda.tasaInteres) : '');
        setEditCuota(deuda.cuotaMensual ? String(Math.round(deuda.cuotaMensual)) : '');
        setEditDia(deuda.diaPago ? String(deuda.diaPago) : '');
        setEditando(true);
    };

    const guardarEdicion = async (e) => {
        e.preventDefault();
        const nombre = editNombre.trim();
        const total = Number(editTotal);
        const pagado = Number(editPagado || 0);
        if (!nombre || !(total > 0) || !(pagado >= 0)) return;
        setGuardando(true);
        try {
            const dia = parseInt(editDia, 10);
            await onEditar(deuda, {
                nombre, montoTotal: total, montoPagado: pagado, cuotas: editCuotas,
                tasaInteres: Number(String(editTasa).replace(',', '.')) || 0,
                cuotaMensual: Number(editCuota) || 0,
                diaPago: dia >= 1 && dia <= 31 ? dia : null,
            });
            setEditando(false);
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = () => {
        if (window.confirm(`¿Eliminar la deuda "${deuda.nombre}"? Los abonos ya registrados en Gastos se conservan. No se puede deshacer.`)) onEliminar(deuda);
    };

    if (editando) {
        return (
            <form onSubmit={guardarEdicion} className="card rise" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Editar deuda</h3>
                <label className="field"><span className="field-label">Nombre</span>
                    <input className="input" value={editNombre} onChange={e => setEditNombre(e.target.value)} required /></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <label className="field"><span className="field-label">Monto total</span><MontoInput value={editTotal} onChange={setEditTotal} required /></label>
                    <label className="field"><span className="field-label">Ya pagado</span><MontoInput value={editPagado} onChange={setEditPagado} /></label>
                </div>
                <CamposPago tasa={editTasa} setTasa={setEditTasa} cuota={editCuota} setCuota={setEditCuota} dia={editDia} setDia={setEditDia} />
                <label className="field"><span className="field-label">Número de cuotas (opcional)</span>
                    <input className="input" value={editCuotas} onChange={e => setEditCuotas(e.target.value)} /></label>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45 }}>Cambiar "Ya pagado" corrige el saldo de la deuda, pero no crea ni borra movimientos en Gastos.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </form>
        );
    }

    return (
        <article className="card rise" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${delay}s` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tile" style={{ width: 40, height: 40, background: pagada ? 'var(--income-soft)' : 'var(--expense-soft)', color: pagada ? 'var(--income)' : 'var(--expense)' }}>
                    {pagada ? <Check size={20} strokeWidth={2.2} aria-hidden="true" /> : <CreditCard size={20} strokeWidth={1.8} aria-hidden="true" />}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deuda.nombre}</span>
                    <span className="num" style={{ fontSize: 13, letterSpacing: 0, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtCOP(montoPagado)} de {fmtCOP(montoTotal)}{deuda.cuotas ? ` · ${deuda.cuotas} cuotas` : ''}</span>
                </div>
                <span style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', background: pagada ? 'var(--income-soft)' : 'var(--expense-soft)', color: pagada ? 'var(--income)' : 'var(--expense)' }}>
                    {pagada ? 'Pagada' : `Debes ${fmtCOP(restante)}`}
                </span>
            </div>
            <div className="bar"><i style={{ width: `${progreso}%`, background: pagada ? 'var(--income)' : 'linear-gradient(90deg, var(--primary), var(--income))' }} /></div>
            {!pagada && (deuda.tasaInteres || deuda.cuotaMensual || deuda.diaPago) && (() => {
                const proy = proyectarDeuda(deuda);
                const detalles = [
                    deuda.tasaInteres ? `${deuda.tasaInteres}% EA` : null,
                    deuda.cuotaMensual ? `cuota ${fmtCOP(deuda.cuotaMensual)}` : null,
                    deuda.diaPago ? `paga el día ${deuda.diaPago}` : null,
                ].filter(Boolean).join(' · ');
                return (
                    <div style={{ padding: '10px 12px', borderRadius: 14, background: proy === null && deuda.cuotaMensual ? 'var(--expense-soft)' : 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="num" style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: 0 }}>{detalles}</span>
                        {proy && proy.meses > 0 && (
                            <span style={{ fontSize: 13, fontWeight: 700 }}>
                                Terminas en {proy.meses} {proy.meses === 1 ? 'mes' : 'meses'} ({mesesATexto(proy.meses)}){proy.intereses > 1 ? ` · pagarás ${fmtCOP(proy.intereses)} en intereses` : ''}
                            </span>
                        )}
                        {proy === null && deuda.cuotaMensual > 0 && (
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--expense)' }}>La cuota no alcanza a cubrir los intereses: la deuda no baja.</span>
                        )}
                    </div>
                );
            })()}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!pagada && (
                    <form onSubmit={(e) => { e.preventDefault(); if (!pagoInput) return; onAbonar(deuda, pagoInput); setPagoInput(''); }}
                        style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0 }}>
                        <MontoInput value={pagoInput} onChange={setPagoInput} placeholder="Abono" aria-label={`Monto del abono a ${deuda.nombre}`} style={{ height: 44, flex: 1, minWidth: 0 }} />
                        <button type="submit" className="btn btn-sm" disabled={!pagoInput} style={{ background: 'var(--income)', color: 'var(--on-accent)' }}>Abonar</button>
                    </form>
                )}
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    <button type="button" className="icon-btn" onClick={abrirEdicion} aria-label={`Editar ${deuda.nombre}`} style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-3)' }}>
                        <Edit2 size={17} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-btn" onClick={eliminar} aria-label={`Eliminar ${deuda.nombre}`} style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-3)' }}>
                        <Trash2 size={17} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </article>
    );
};


export const DebtManager = ({ deudas, genericAdd, genericUpdate, genericDelete, onBack }) => {
    const [nombre, setNombre] = useState('');
    const [montoTotal, setMontoTotal] = useState('');
    const [cuotas, setCuotas] = useState('');
    const [tasa, setTasa] = useState('');
    const [cuotaMensual, setCuotaMensual] = useState('');
    const [diaPago, setDiaPago] = useState('');
    const [formOpen, setFormOpen] = useState(false);

    const agregarDeudaHandler = async (e) => {
        e.preventDefault();
        if (!nombre.trim() || !montoTotal) return;
        const dia = parseInt(diaPago, 10);
        await genericAdd('deudas', {
            nombre: nombre.trim(), montoTotal: Number(montoTotal), montoPagado: 0, cuotas,
            tasaInteres: Number(String(tasa).replace(',', '.')) || 0,
            cuotaMensual: Number(cuotaMensual) || 0,
            diaPago: dia >= 1 && dia <= 31 ? dia : null,
            createdAt: new Date().toISOString(),
        });
        setNombre(''); setMontoTotal(''); setCuotas(''); setTasa(''); setCuotaMensual(''); setDiaPago(''); setFormOpen(false);
    };

    const registrarPagoDeuda = async (deuda, montoPago) => {
        const monto = Number(montoPago);
        if (!(monto > 0)) return;
        await genericUpdate('deudas', deuda.id, { montoPagado: (Number(deuda.montoPagado) || 0) + monto });
        await genericAdd('transacciones', { tipo: 'gasto', monto, concepto: `Abono Deuda: ${deuda.nombre}`, categoria: 'Pago de Deudas', fecha: dateKey(), createdAt: new Date().toISOString() });
    };

    const editarDeuda = (deuda, cambios) => genericUpdate('deudas', deuda.id, cambios);
    const eliminarDeuda = (deuda) => genericDelete('deudas', deuda.id);

    const total = deudas.reduce((a, d) => a + (Number(d.montoTotal) || 0), 0);
    const pagado = deudas.reduce((a, d) => a + Math.min(Number(d.montoPagado) || 0, Number(d.montoTotal) || 0), 0);
    const pendiente = Math.max(total - pagado, 0);
    const pct = total > 0 ? pagado / total : 1;
    const pagadas = deudas.filter(d => (Number(d.montoTotal) || 0) - (Number(d.montoPagado) || 0) <= 0).length;
    // Pendientes primero; las pagadas al final.
    const ordenadas = [...deudas].sort((a, b) => {
        const ra = (Number(a.montoTotal) || 0) - (Number(a.montoPagado) || 0);
        const rb = (Number(b.montoTotal) || 0) - (Number(b.montoPagado) || 0);
        return (rb > 0) - (ra > 0) || rb - ra;
    });

    return (
        <div>
            <ScreenHeader title="Deudas" onBack={onBack} right={<PlusToggle open={formOpen} onClick={() => setFormOpen(v => !v)} label="Nueva deuda" />} />

            <section className="card rise d2" style={{ marginTop: 18, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <Ring pct={pct} size={84} stroke={10} color={pendiente > 0 ? 'var(--primary)' : 'var(--income)'}>
                    {pendiente > 0
                        ? <span className="num" style={{ fontSize: 16, fontWeight: 700 }}>{Math.round(pct * 100)}%</span>
                        : <Check size={28} strokeWidth={2.4} color="var(--income)" aria-hidden="true" />}
                </Ring>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Pendiente total</span>
                    <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}><CountUp value={pendiente} /></span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: pendiente > 0 ? 'var(--text-3)' : 'var(--income)' }}>
                        {pendiente > 0 ? `Llevas ${fmtCOP(pagado)} pagados` : 'Libre de deudas'}
                    </span>
                </div>
            </section>

            {formOpen && (
                <form onSubmit={agregarDeudaHandler} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nueva deuda</h2>
                    <label className="field"><span className="field-label">Nombre</span>
                        <input className="input" placeholder="Ej: Tarjeta de crédito" value={nombre} onChange={e => setNombre(e.target.value)} required autoFocus /></label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <label className="field"><span className="field-label">Monto total</span><MontoInput value={montoTotal} onChange={setMontoTotal} required /></label>
                        <label className="field"><span className="field-label">Nº de cuotas</span>
                            <input className="input num" inputMode="numeric" placeholder="Opcional" value={cuotas} onChange={e => setCuotas(e.target.value)} /></label>
                    </div>
                    <CamposPago tasa={tasa} setTasa={setTasa} cuota={cuotaMensual} setCuota={setCuotaMensual} dia={diaPago} setDia={setDiaPago} />
                    <button type="submit" className="btn btn-primary">Registrar deuda</button>
                </form>
            )}

            {deudas.filter(d => saldoDeuda(d) > 0).length >= 2 && <PlanDeudas deudas={deudas.filter(d => saldoDeuda(d) > 0)} />}

            <div className="rise d3" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Historial</h2>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>{pagadas} {pagadas === 1 ? 'pagada' : 'pagadas'}</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ordenadas.map((deuda, i) => <DeudaItem key={deuda.id} deuda={deuda} delay={0.25 + i * 0.08} onAbonar={registrarPagoDeuda} onEditar={editarDeuda} onEliminar={eliminarDeuda} />)}
                {deudas.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 24, fontSize: 14 }}>No tienes deudas registradas.</p>}
            </div>
        </div>
    );
};

// Tasa, cuota y día de pago (compartido por crear y editar).
const CamposPago = ({ tasa, setTasa, cuota, setCuota, dia, setDia }) => (
    <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <label className="field"><span className="field-label">Cuota mensual</span><MontoInput value={cuota} onChange={setCuota} placeholder="Opcional" /></label>
            <label className="field"><span className="field-label">Día de pago</span>
                <input className="input num" type="number" inputMode="numeric" min="1" max="31" placeholder="1–31" value={dia} onChange={e => setDia(e.target.value)} /></label>
        </div>
        <label className="field"><span className="field-label">Tasa de interés (% efectivo anual)</span>
            <input className="input num" inputMode="decimal" placeholder="Ej: 28 (déjalo vacío si no cobra intereses)" value={tasa} onChange={e => setTasa(e.target.value.replace(/[^0-9.,]/g, ''))} /></label>
    </>
);

// Plan para salir de deudas: compara bola de nieve vs avalancha con un presupuesto mensual.
const PlanDeudas = ({ deudas }) => {
    const minimos = deudas.reduce((a, d) => a + Math.min(Number(d.cuotaMensual) || 0, saldoDeuda(d)), 0);
    const [presupuesto, setPresupuesto] = useState(minimos ? String(Math.round(minimos * 1.2)) : '');
    const [estrategia, setEstrategia] = useState('avalancha');
    const bola = simularPlan(deudas, presupuesto, 'bola');
    const avalancha = simularPlan(deudas, presupuesto, 'avalancha');
    const actual = estrategia === 'bola' ? bola : avalancha;
    const otra = estrategia === 'bola' ? avalancha : bola;
    const sinTasas = deudas.every(d => !Number(d.tasaInteres));
    return (
        <section className="card rise d3" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Plan para salir de deudas</h2>
                <span style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45 }}>Pagas las cuotas mínimas de todas y lo que sobre va a una sola, en orden.</span>
            </div>
            <label className="field"><span className="field-label">¿Cuánto puedes pagar al mes en total?</span>
                <MontoInput value={presupuesto} onChange={setPresupuesto} />
                {minimos > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Las cuotas mínimas suman {fmtCOP(minimos)}.</span>}
            </label>
            <div className="seg">
                <span className="thumb" style={{ transform: estrategia === 'bola' ? 'translateX(0)' : 'translateX(100%)' }} />
                <button type="button" className={estrategia === 'bola' ? 'on' : ''} onClick={() => setEstrategia('bola')}>Bola de nieve</button>
                <button type="button" className={estrategia === 'avalancha' ? 'on' : ''} onClick={() => setEstrategia('avalancha')}>Avalancha</button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {estrategia === 'bola' ? 'Primero la de menor saldo: ves resultados rápido y te motiva.' : 'Primero la de mayor interés: pagas menos intereses en total.'}
            </span>
            {!actual.ok ? (
                <p style={{ margin: 0, padding: '10px 14px', borderRadius: 14, background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 13, fontWeight: 700 }}>{actual.motivo}</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface-2)' }}>
                            <span className="eyebrow" style={{ fontSize: 10 }}>Libre de deudas</span>
                            <p className="num" style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700 }}>{mesesATexto(actual.meses)}</p>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{actual.meses} meses</span>
                        </div>
                        <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface-2)' }}>
                            <span className="eyebrow" style={{ fontSize: 10 }}>Intereses totales</span>
                            <p className="num" style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700 }}>{fmtCOP(actual.intereses)}</p>
                            {sinTasas && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Agrega las tasas para calcularlos</span>}
                        </div>
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {actual.orden.map((d, i) => (
                            <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                                <span className="num" style={{ width: 26, height: 26, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                                <span style={{ flex: 1, fontWeight: 700 }}>{d.nombre}{d.tasa ? <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · {d.tasa}% EA</span> : null}</span>
                                <span className="num" style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 0 }}>{mesesATexto(d.mes)}</span>
                            </li>
                        ))}
                    </ol>
                    {otra.ok && Math.abs(otra.intereses - actual.intereses) > 1000 && (
                        <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                            {otra.intereses < actual.intereses
                                ? `Con ${estrategia === 'bola' ? 'avalancha' : 'bola de nieve'} pagarías ${fmtCOP(actual.intereses - otra.intereses)} menos en intereses.`
                                : `Esta estrategia te ahorra ${fmtCOP(otra.intereses - actual.intereses)} en intereses frente a la otra.`}
                        </span>
                    )}
                </>
            )}
        </section>
    );
};
