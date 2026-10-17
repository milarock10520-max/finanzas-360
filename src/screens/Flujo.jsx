import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, Calendar, CheckCircle2, ArrowUp, ArrowDown, Check, Search, X } from 'lucide-react';
import { ScreenHeader, BottomSheet, fmtCOP } from '../ui/f360.jsx';
import { CATEGORIAS_GASTOS, CATEGORIAS_INGRESOS, dateKey } from '../lib/finanzas';

// =============================================
// === FLUJO: ingresos y gastos en una sola pantalla ===
// =============================================
export const Flujo = ({ modo, setModo, transacciones, cuentas = [], genericAdd, genericUpdate, genericDelete, prefillData, setPrefillData, pendingBudgetId, setPendingBudgetId, setActiveTab, focusToken }) => {
    const esGasto = modo === 'gasto';
    const tipo = esGasto ? 'gasto' : 'ingreso';
    const [digitos, setDigitos] = useState('');
    const [concepto, setConcepto] = useState('');
    const [categoria, setCategoria] = useState(null);
    const [fecha, setFecha] = useState(dateKey());
    const [creando, setCreando] = useState(false);
    const [nuevaCategoria, setNuevaCategoria] = useState('');
    const [guardado, setGuardado] = useState(false);
    // Historial: búsqueda, filtros y edición
    const [busqueda, setBusqueda] = useState('');
    const [filtroCat, setFiltroCat] = useState('');
    const [rango, setRango] = useState('mes');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [limite, setLimite] = useState(60);
    const [editando, setEditando] = useState(null);
    // Cuenta / medio de pago (se recuerda la última usada en este dispositivo)
    const [cuentaId, setCuentaId] = useState(() => { try { return localStorage.getItem('f360-ultima-cuenta') || ''; } catch { return ''; } });
    const cuentaValida = cuentas.some(c => c.id === cuentaId) ? cuentaId : '';
    const nombreCuenta = (id) => cuentas.find(c => c.id === id)?.nombre || '';
    const montoRef = useRef(null);

    // Categorías base + personalizadas usadas antes (persisten sin guardado extra).
    const opciones = useMemo(() => {
        const base = esGasto ? CATEGORIAS_GASTOS : CATEGORIAS_INGRESOS;
        const delSistema = ['Pago de Deudas', 'Ahorro Metas'];
        const extras = new Set();
        transacciones.forEach(t => {
            if (t.tipo === tipo && t.categoria && !base.includes(t.categoria) && !delSistema.includes(t.categoria)) extras.add(t.categoria);
        });
        return [...base, ...[...extras].sort((a, b) => a.localeCompare(b))];
    }, [esGasto, tipo, transacciones]);
    const cat = opciones.includes(categoria) ? categoria : opciones[0];

    // Al cambiar de modo se limpia la categoría elegida.
    useEffect(() => { setCategoria(null); setCreando(false); }, [modo]);

    // El botón [+] de la barra pide foco en el monto.
    useEffect(() => {
        if (focusToken) setTimeout(() => montoRef.current?.focus(), 350);
    }, [focusToken]);

    // Prefill desde Presupuesto ("Ejecutar pago").
    useEffect(() => {
        if (!prefillData) return;
        setDigitos(String(Math.round(Number(prefillData.monto) || 0)));
        setConcepto(prefillData.concepto || '');
        setCategoria(prefillData.categoria || null);
        setPrefillData(null);
    }, [prefillData, setPrefillData]);

    const guardar = async (e) => {
        e.preventDefault();
        if (!digitos) { montoRef.current?.focus(); return; }
        let categoriaFinal = cat;
        if (creando) {
            const nueva = nuevaCategoria.trim();
            if (!nueva) return;
            // Si coincide (sin importar mayúsculas) con una existente, se reutiliza.
            categoriaFinal = opciones.find(c => c.toLowerCase() === nueva.toLowerCase()) || nueva;
        }
        const budgetIdToUpdate = pendingBudgetId;
        await genericAdd('transacciones', {
            tipo,
            monto: Number(digitos),
            concepto: concepto.trim() || categoriaFinal,
            categoria: categoriaFinal,
            fecha,
            cuentaId: cuentaValida || null,
            createdAt: new Date().toISOString()
        });
        try { localStorage.setItem('f360-ultima-cuenta', cuentaValida); } catch { /* */ }
        // Marcar como pagado en presupuesto si viene de ahí.
        if (budgetIdToUpdate) {
            try { await genericUpdate('presupuesto', budgetIdToUpdate, { lastPaid: new Date().toISOString().slice(0, 7) }); }
            catch (error) { console.error('Error al actualizar presupuesto:', error); }
            setPendingBudgetId(null);
            setActiveTab('presupuesto');
            return;
        }
        setDigitos(''); setConcepto('');
        if (creando) { setCategoria(categoriaFinal); setCreando(false); setNuevaCategoria(''); }
        setGuardado(true);
        setTimeout(() => setGuardado(false), 1400);
    };

    const accent = esGasto ? 'var(--expense)' : 'var(--income)';
    const hoyKey = dateKey();
    const mesKey = hoyKey.slice(0, 7);
    const fmtFecha = (f) => {
        if (f === hoyKey) return 'Hoy';
        const [y, m, d] = String(f || '').split('-').map(Number);
        if (!y) return '';
        return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: f.slice(0, 4) === hoyKey.slice(0, 4) ? undefined : 'numeric' });
    };

    // --- Búsqueda y filtros del historial ---
    const desdeRango = (() => {
        if (rango === 'mes') return `${mesKey}-01`;
        if (rango === '3m') { const d = new Date(); d.setMonth(d.getMonth() - 2, 1); return dateKey(d); }
        if (rango === 'custom') return desde || '0000-00-00';
        return '0000-00-00';
    })();
    const hastaRango = rango === 'custom' && hasta ? hasta : '9999-99-99';
    const texto = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = transacciones.filter(t => t.tipo === tipo);
    const filtrados = lista.filter(t => {
        const f = typeof t.fecha === 'string' ? t.fecha : '';
        if (f < desdeRango || f > hastaRango) return false;
        if (filtroCat && t.categoria !== filtroCat) return false;
        if (!texto) return true;
        const hay = `${t.concepto || ''} ${t.categoria || ''} ${t.monto || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return hay.includes(texto);
    });
    const visibles = filtrados.slice(0, limite);
    const totalFiltrado = filtrados.reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const categoriasUsadas = [...new Set(lista.map(t => t.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const hayFiltros = !!(texto || filtroCat || rango !== 'mes');
    const RANGOS = [['mes', 'Este mes'], ['3m', '3 meses'], ['todo', 'Todo'], ['custom', 'Fechas']];
    const cuentasSelector = cuentas.length > 0 && (
        <div className="field">
            <span className="field-label">{esGasto ? 'Pagado con' : 'Recibido en'}</span>
            <div className="hscroll">
                <button type="button" className={`chip ${!cuentaValida ? 'on' : ''}`} aria-pressed={!cuentaValida} onClick={() => setCuentaId('')}>Sin cuenta</button>
                {cuentas.filter(c => esGasto || c.tipo !== 'credito').map(c => (
                    <button key={c.id} type="button" className={`chip ${cuentaValida === c.id ? 'on' : ''}`} aria-pressed={cuentaValida === c.id} onClick={() => setCuentaId(c.id)}>{c.nombre}</button>
                ))}
            </div>
        </div>
    );

    return (
        <div>
            <ScreenHeader title="Flujo" />

            <div className="seg rise d2" style={{ marginTop: 18 }} role="tablist" aria-label="Tipo de movimiento">
                <span className="thumb" style={{ transform: esGasto ? 'translateX(0)' : 'translateX(100%)' }} />
                <button type="button" role="tab" aria-selected={esGasto} className={esGasto ? 'on' : ''} onClick={() => setModo('gasto')}>
                    <ArrowDown size={16} strokeWidth={2.2} aria-hidden="true" style={{ color: esGasto ? 'var(--expense)' : undefined }} />Gasto
                </button>
                <button type="button" role="tab" aria-selected={!esGasto} className={!esGasto ? 'on' : ''} onClick={() => setModo('ingreso')}>
                    <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" style={{ color: !esGasto ? 'var(--income)' : undefined }} />Ingreso
                </button>
            </div>

            <form onSubmit={guardar} className="card rise d3" style={{ marginTop: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {pendingBudgetId && (
                    <div style={{ padding: '10px 14px', borderRadius: 14, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} aria-hidden="true" /> Registrando un pago de tu presupuesto
                    </div>
                )}
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span className="eyebrow">Monto</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, width: '100%' }}>
                        <span className="num" style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-3)' }}>$</span>
                        <input ref={montoRef} className="num" inputMode="numeric" enterKeyHint="next" placeholder="0" aria-label="Monto"
                            value={digitos ? Number(digitos).toLocaleString('es-CO') : ''}
                            onChange={e => setDigitos(String(e.target.value).replace(/\D/g, '').slice(0, 12))}
                            style={{ width: `calc(${Math.max(1, (digitos ? Number(digitos).toLocaleString('es-CO') : '0').length)}ch + 12px)`, maxWidth: '85%', padding: 0, border: 0, background: 'transparent', outline: 'none', textAlign: 'center', fontSize: 46, fontWeight: 700, color: accent, caretColor: 'var(--primary)', transition: 'color .4s var(--ease)' }} />
                    </span>
                </label>

                <div className="field">
                    <span className="field-label">Categoría</span>
                    <div className="hscroll">
                        {opciones.map(c => (
                            <button key={c} type="button" className={`chip ${!creando && c === cat ? 'on' : ''}`} aria-pressed={!creando && c === cat}
                                onClick={() => { setCategoria(c); setCreando(false); }}>{c}</button>
                        ))}
                        <button type="button" className={`chip ${creando ? 'on' : ''}`} aria-pressed={creando} onClick={() => setCreando(v => !v)}>
                            <Plus size={14} strokeWidth={2.4} aria-hidden="true" /> Nueva
                        </button>
                    </div>
                    {creando && (
                        <input className="input" value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} maxLength={40}
                            placeholder="Nombre de la nueva categoría" aria-label="Nueva categoría" autoFocus />
                    )}
                </div>

                {cuentasSelector}

                <label className="field">
                    <span className="field-label">Concepto</span>
                    <input className="input" value={concepto} onChange={e => setConcepto(e.target.value)}
                        placeholder={esGasto ? 'Ej: Mercado, Uber, Café' : 'Ej: Quincena, Admob'} enterKeyHint="done" />
                </label>

                <div style={{ display: 'flex', gap: 10 }}>
                    <label className="chip" style={{ height: 54, borderRadius: 16, padding: '0 16px', position: 'relative' }}>
                        <Calendar size={18} strokeWidth={1.8} aria-hidden="true" />
                        {fmtFecha(fecha)}
                        <input type="date" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Fecha"
                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </label>
                    <button type="submit" className="btn" style={{ flex: 1, color: 'var(--on-accent)', background: guardado ? 'var(--income)' : accent, boxShadow: `0 12px 28px -12px ${accent}` }}>
                        {guardado ? <><Check size={18} strokeWidth={2.4} aria-hidden="true" /> Guardado</> : (pendingBudgetId ? 'Confirmar pago' : (esGasto ? 'Guardar gasto' : 'Guardar ingreso'))}
                    </button>
                </div>
            </form>

            <div className="rise d4" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Historial</h2>
                <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0 }}>
                    {filtrados.length} · {esGasto ? '− ' : '+ '}{fmtCOP(totalFiltrado)}
                </span>
            </div>

            {/* Búsqueda y filtros */}
            <div className="rise d4" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 14px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                    <Search size={17} strokeWidth={2} color="var(--text-3)" aria-hidden="true" />
                    <input type="search" value={busqueda} onChange={e => { setBusqueda(e.target.value); setLimite(60); }} placeholder="Buscar concepto, categoría o monto…" aria-label="Buscar movimientos"
                        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
                    {hayFiltros && (
                        <button type="button" onClick={() => { setBusqueda(''); setFiltroCat(''); setRango('mes'); setDesde(''); setHasta(''); }} aria-label="Limpiar filtros"
                            style={{ border: 0, background: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '8px 0' }}>Limpiar</button>
                    )}
                </label>
                <div className="hscroll">
                    {RANGOS.map(([id, label]) => (
                        <button key={id} type="button" className={`chip ${rango === id ? 'on' : ''}`} aria-pressed={rango === id} onClick={() => { setRango(id); setLimite(60); }}>{label}</button>
                    ))}
                    <select value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setLimite(60); }} aria-label="Filtrar por categoría" className="chip"
                        style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 14, ...(filtroCat ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' } : {}) }}>
                        <option value="">Todas las categorías</option>
                        {categoriasUsadas.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                {rango === 'custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label className="field"><span className="field-label">Desde</span><input className="input" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
                        <label className="field"><span className="field-label">Hasta</span><input className="input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
                    </div>
                )}
            </div>

            <div className="card rise d5" style={{ marginTop: 12, padding: '4px 16px' }}>
                {visibles.length === 0 && (
                    <p style={{ margin: 0, padding: '18px 0', fontSize: 14, color: 'var(--text-3)', textAlign: 'center' }}>
                        {hayFiltros ? 'Ningún movimiento coincide con la búsqueda' : `Sin ${esGasto ? 'gastos' : 'ingresos'} este mes`}
                    </p>
                )}
                {visibles.map((t, i) => (
                    <button key={t.id} type="button" onClick={() => setEditando(t)} aria-label={`Editar ${t.concepto}`}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'none', border: 0, borderBottom: i < visibles.length - 1 ? '1px solid var(--line)' : 0, color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                        <span className="tile" style={{ width: 40, height: 40, background: esGasto ? 'var(--expense-soft)' : 'var(--income-soft)', color: accent }}>
                            {esGasto ? <ArrowDown size={18} strokeWidth={2} aria-hidden="true" /> : <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.concepto}</span>
                            <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.categoria} · {fmtFecha(t.fecha)}{nombreCuenta(t.cuentaId) ? ` · ${nombreCuenta(t.cuentaId)}` : ''}
                            </span>
                        </span>
                        <span className="num" style={{ fontSize: 15, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{esGasto ? '− ' : '+ '}{fmtCOP(t.monto)}</span>
                    </button>
                ))}
            </div>
            {filtrados.length > visibles.length && (
                <button type="button" className="btn btn-outline" style={{ marginTop: 12, width: '100%' }} onClick={() => setLimite(l => l + 60)}>
                    Ver más ({filtrados.length - visibles.length})
                </button>
            )}

            {editando && (
                <EditorMovimiento t={editando} opciones={opciones} cuentas={cuentas} onClose={() => setEditando(null)}
                    onGuardar={async (cambios) => { await genericUpdate('transacciones', editando.id, cambios); setEditando(null); }}
                    onEliminar={async () => { if (window.confirm(`¿Eliminar "${editando.concepto}"?`)) { await genericDelete('transacciones', editando.id); setEditando(null); } }} />
            )}
        </div>
    );
};

// Hoja para editar un movimiento ya registrado.
const EditorMovimiento = ({ t, opciones, cuentas = [], onClose, onGuardar, onEliminar }) => {
    const esGasto = t.tipo === 'gasto';
    const especial = !!(t.esInversion || t.esAhorro || t.categoria === 'Pago de Deudas');
    const [digitos, setDigitos] = useState(String(Math.round(Number(t.monto) || 0)));
    const [concepto, setConcepto] = useState(t.concepto || '');
    const [categoria, setCategoria] = useState(t.categoria || opciones[0]);
    const [fecha, setFecha] = useState(t.fecha || dateKey());
    const [cuentaId, setCuentaId] = useState(t.cuentaId || '');
    const [guardando, setGuardando] = useState(false);
    // La categoría original va primero para que se vea al abrir sin desplazar los chips.
    const [original] = useState(t.categoria || '');
    const lista = useMemo(() => {
        const base = original ? [original, ...opciones.filter(c => c !== original)] : opciones;
        return base.includes(categoria) ? base : [categoria, ...base];
    }, [opciones, original, categoria]);

    const guardar = async (e) => {
        e.preventDefault();
        if (!digitos) return;
        setGuardando(true);
        try {
            const cambios = { concepto: concepto.trim() || categoria, fecha, cuentaId: cuentaId || null };
            if (!especial) { cambios.monto = Number(digitos); cambios.categoria = categoria; }
            await onGuardar(cambios);
        } finally { setGuardando(false); }
    };

    return (
        <BottomSheet open onClose={onClose} label="Editar movimiento">
            <form onSubmit={guardar} style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Editar {esGasto ? 'gasto' : 'ingreso'}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
                </header>
                {especial && (
                    <p style={{ margin: 0, padding: '10px 14px', borderRadius: 14, background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 13, fontWeight: 700 }}>
                        Este movimiento viene de {t.esInversion ? 'Inversiones' : t.esAhorro ? 'una meta de ahorro' : 'un abono a deuda'}: el monto y la categoría se cambian allá.
                    </p>
                )}
                <label className="field"><span className="field-label">Monto</span>
                    <input className="input num" inputMode="numeric" disabled={especial} value={digitos ? '$ ' + Number(digitos).toLocaleString('es-CO') : ''}
                        onChange={e => setDigitos(String(e.target.value).replace(/\D/g, '').slice(0, 12))} style={{ fontSize: 20, fontWeight: 700 }} /></label>
                {!especial && (
                    <div className="field">
                        <span className="field-label">Categoría</span>
                        <div className="hscroll">
                            {lista.map(c => <button key={c} type="button" className={`chip ${c === categoria ? 'on' : ''}`} aria-pressed={c === categoria} onClick={() => setCategoria(c)}>{c}</button>)}
                        </div>
                    </div>
                )}
                {cuentas.length > 0 && (
                    <div className="field">
                        <span className="field-label">Cuenta</span>
                        <div className="hscroll">
                            <button type="button" className={`chip ${!cuentaId ? 'on' : ''}`} onClick={() => setCuentaId('')}>Sin cuenta</button>
                            {cuentas.map(c => <button key={c.id} type="button" className={`chip ${cuentaId === c.id ? 'on' : ''}`} onClick={() => setCuentaId(c.id)}>{c.nombre}</button>)}
                        </div>
                    </div>
                )}
                <label className="field"><span className="field-label">Concepto</span>
                    <input className="input" value={concepto} onChange={e => setConcepto(e.target.value)} /></label>
                <label className="field"><span className="field-label">Fecha</span>
                    <input className="input" type="date" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></label>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-ghost" onClick={onEliminar} aria-label="Eliminar movimiento" style={{ color: 'var(--expense)', width: 54, padding: 0 }}><Trash2 size={18} aria-hidden="true" /></button>
                    <button type="submit" className="btn btn-primary" disabled={guardando} style={{ flex: 1 }}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
                </div>
            </form>
        </BottomSheet>
    );
};
