import { useState } from 'react';
import { TrendingUp, Target, Plus, Trash2, Calendar, CheckCircle2, Edit2, AlertTriangle, Sparkles, Coins, X, StickyNote, MessageSquarePlus, Link2, Flame, CalendarClock, ChevronLeft, ChevronRight, Check, Zap } from 'lucide-react';
import { ScreenHeader, fmtCOP } from '../ui/f360.jsx';
import { MontoInput, PlusToggle, Switch } from '../components/comunes';
import { PLAZOS_METAS, aporteSugeridoMeta, capacidadAhorroMensual, dateKey, diasHasta, estadoMeta, periodosRestantesMeta, CATEGORIAS_INGRESOS, formatMoney } from '../lib/finanzas';
import { describirRegla } from '../lib/reglas';
import { aportesDe } from '../lib/inversiones';

export const MetaItem = ({ meta, metasFinancieras = [], inversiones = [], onVincularInversion, onAportarInversion, onAhorrar, onEditarPlan, onToggleCompletada, onDelete, onAddNote, onDeleteNote, onAddChecklistItem, onToggleChecklistItem, onDeleteChecklistItem, onLinkMetaFinanciera, onToggleDia, onToggleSeguimiento, delay = 0 }) => {
    const [aporte, setAporte] = useState('');
    const [aportando, setAportando] = useState(false);
    const [descontarSaldo, setDescontarSaldo] = useState(true);
    const [editandoPlan, setEditandoPlan] = useState(false);
    const [planFecha, setPlanFecha] = useState(meta.fechaObjetivo || '');
    const [planFrecuencia, setPlanFrecuencia] = useState(meta.frecuencia || 'quincenal');
    const [showNotes, setShowNotes] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [showLinkSelect, setShowLinkSelect] = useState(false);
    const [invElegida, setInvElegida] = useState(meta.inversionId || '');
    const [weekOffset, setWeekOffset] = useState(0); // 0 = semana actual; -1 = anterior...

    const notas = meta.notas || [];
    const checklist = meta.checklist || [];
    const checklistDone = checklist.filter(c => c.completado).length;
    const checklistPct = checklist.length > 0 ? Math.round((checklistDone / checklist.length) * 100) : 0;

    // --- Registro diario (días en que se cumplió la meta) ---
    const registroDias = meta.registroDias || [];
    // Activo solo si la meta lo habilitó. Las metas viejas con días ya marcados
    // se muestran activas para no perder su historial.
    const seguimientoActivo = meta.seguimientoDiario === true
        || (meta.seguimientoDiario === undefined && registroDias.length > 0);
    const registroSet = new Set(registroDias);
    const hoyKey = dateKey();
    const mesActual = hoyKey.slice(0, 7);
    const diasEsteMes = registroDias.filter(d => typeof d === 'string' && d.slice(0, 7) === mesActual).length;

    // Racha actual: días consecutivos cumplidos hasta hoy (o ayer si hoy aún no).
    const racha = (() => {
        let n = 0;
        const d = new Date();
        if (!registroSet.has(dateKey(d))) d.setDate(d.getDate() - 1);
        while (registroSet.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
        return n;
    })();

    // Días de la semana visible (lunes a domingo) según weekOffset.
    const DIAS_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const baseLunes = (() => {
        const d = new Date();
        const dow = (d.getDay() + 6) % 7; // 0 = lunes
        d.setDate(d.getDate() - dow + weekOffset * 7);
        d.setHours(0, 0, 0, 0);
        return d;
    })();
    const semana = DIAS_LETRA.map((letra, i) => {
        const d = new Date(baseLunes);
        d.setDate(baseLunes.getDate() + i);
        const key = dateKey(d);
        return { letra, num: d.getDate(), key, done: registroSet.has(key), isToday: key === hoyKey, isFuture: key > hoyKey };
    });
    const etiquetaSemana = weekOffset === 0 ? 'Esta semana'
        : weekOffset === -1 ? 'Semana pasada'
        : `${baseLunes.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;

    // Meta financiera vinculada (si existe)
    const metaVinculada = meta.metaFinancieraId
        ? metasFinancieras.find(mf => mf.id === meta.metaFinancieraId)
        : null;

    const handleAddChecklist = (e) => {
        e?.preventDefault();
        if (!newChecklistItem.trim()) return;
        onAddChecklistItem(meta, newChecklistItem);
        setNewChecklistItem('');
    };

    const handleAddNote = (e) => {
        e?.preventDefault();
        if (!newNote.trim()) return;
        onAddNote(meta, newNote);
        setNewNote('');
    };

    const eliminar = () => { if (window.confirm(`¿Eliminar la meta "${meta.nombre}"?`)) onDelete(meta.id); };

    const accionBtn = (activo) => ({ width: 40, height: 40, borderRadius: 12, border: 0, background: activo ? 'var(--primary-soft)' : 'transparent', color: activo ? 'var(--primary)' : 'var(--text-3)' });

    const BotonNotas = () => (
        <button type="button" className="icon-btn" onClick={() => setShowNotes(v => !v)} aria-label={`Notas (${notas.length})`} aria-expanded={showNotes} style={accionBtn(showNotes)}>
            <StickyNote size={17} strokeWidth={1.9} aria-hidden="true" />
            {notas.length > 0 && <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{notas.length}</span>}
        </button>
    );

    // Panel de notas compartido (elemento JSX, NO un componente anidado:
    // si fuera componente se re-montaría en cada tecla y el input perdería el foco).
    const notesPanel = (
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="eyebrow">Notas y avances</span>
            <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder="Escribe una nota…" value={newNote} onChange={(e) => setNewNote(e.target.value)} aria-label="Nueva nota" style={{ height: 44, flex: 1, minWidth: 0 }} />
                <button type="submit" className="icon-btn" aria-label="Agregar nota" style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'transparent' }}><MessageSquarePlus size={18} aria-hidden="true" /></button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {notas.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 6 }}>Sin notas aún</p>
                ) : notas.slice().reverse().map((nota, idx) => (
                    <div key={idx} style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--surface-2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{nota.texto}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-3)' }}>{new Date(nota.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button type="button" onClick={() => onDeleteNote(meta, notas.length - 1 - idx)} aria-label="Eliminar nota" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}>
                            <Trash2 size={14} aria-hidden="true" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    // ---------- Metas personales ----------
    if (meta.tipo === 'personal') {
        const objVinc = metaVinculada ? (Number(metaVinculada.montoObjetivo) || 1) : 1;
        const actVinc = metaVinculada ? (Number(metaVinculada.ahorroActual) || 0) : 0;
        const pctVinc = metaVinculada ? Math.min((actVinc / objVinc) * 100, 100) : 0;
        const plazoTxt = { corto: 'Corto plazo', mediano: 'Mediano plazo', largo: 'Largo plazo' }[meta.plazo] || 'Propósito';

        return (
            <article className="card rise" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${delay}s`, ...(meta.completada ? { borderColor: 'var(--income)' } : {}) }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                        <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800, background: meta.completada ? 'var(--income-soft)' : 'var(--violet-soft)', color: meta.completada ? 'var(--income)' : 'var(--violet)' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{meta.completada ? 'Lograda' : plazoTxt}
                        </span>
                        <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700, textDecoration: meta.completada ? 'line-through' : 'none', color: meta.completada ? 'var(--text-2)' : 'var(--text)' }}>{meta.nombre}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button type="button" className="icon-btn" onClick={() => setShowLinkSelect(v => !v)} aria-label="Vincular ahorro" aria-expanded={showLinkSelect} style={accionBtn(showLinkSelect || !!metaVinculada)}>
                            <Link2 size={17} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                        <BotonNotas />
                        <button type="button" className="icon-btn" onClick={eliminar} aria-label={`Eliminar ${meta.nombre}`} style={accionBtn(false)}>
                            <Trash2 size={17} strokeWidth={1.9} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {showLinkSelect && (
                    <label className="field">
                        <span className="field-label">Vincular con un ahorro</span>
                        <select className="input" value={meta.metaFinancieraId || ''} onChange={(e) => { onLinkMetaFinanciera(meta, e.target.value); setShowLinkSelect(false); }}>
                            <option value="">Sin vínculo</option>
                            {metasFinancieras.map(mf => <option key={mf.id} value={mf.id}>{mf.nombre}</option>)}
                        </select>
                        {metasFinancieras.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Crea una meta financiera primero.</span>}
                    </label>
                )}

                {metaVinculada && (
                    <div style={{ padding: 14, borderRadius: 16, background: 'var(--income-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: 'var(--income)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Coins size={14} aria-hidden="true" /> Ahorro: {metaVinculada.nombre}</span>
                            <span className="num">{pctVinc.toFixed(0)}%</span>
                        </div>
                        <div className="bar" style={{ background: 'var(--surface)' }}><i style={{ width: `${pctVinc}%`, background: 'var(--income)' }} /></div>
                        <span className="num" style={{ fontSize: 13, color: 'var(--text-2)', letterSpacing: 0 }}>{fmtCOP(actVinc)} de {fmtCOP(objVinc)}</span>
                    </div>
                )}

                {/* Checklist de avances */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>Avances {checklist.length > 0 && <span className="num" style={{ color: 'var(--text-3)', letterSpacing: 0 }}>({checklistDone}/{checklist.length})</span>}</span>
                        {checklist.length > 0 && <span className="num" style={{ fontSize: 13, fontWeight: 700, color: checklistPct === 100 ? 'var(--income)' : 'var(--primary)' }}>{checklistPct}%</span>}
                    </div>
                    {checklist.length > 0 && <div className="bar"><i style={{ width: `${checklistPct}%`, background: checklistPct === 100 ? 'var(--income)' : 'linear-gradient(90deg, var(--primary), var(--cyan-bright))' }} /></div>}
                    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 220, overflowY: 'auto' }}>
                        {checklist.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                                <button type="button" onClick={() => onToggleChecklistItem(meta, idx)} aria-pressed={!!item.completado} aria-label={item.completado ? `Desmarcar ${item.texto}` : `Marcar ${item.texto}`}
                                    style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', border: `1.5px solid ${item.completado ? 'transparent' : 'var(--line)'}`, background: item.completado ? 'var(--income)' : 'var(--surface-2)', color: 'var(--on-accent)', transition: 'all .35s var(--spring)' }}>
                                    {item.completado && <Check size={16} strokeWidth={2.6} aria-hidden="true" />}
                                </button>
                                <span style={{ flex: 1, fontSize: 14, color: item.completado ? 'var(--text-3)' : 'var(--text)', textDecoration: item.completado ? 'line-through' : 'none' }}>{item.texto}</span>
                                <button type="button" onClick={() => onDeleteChecklistItem(meta, idx)} aria-label={`Eliminar ${item.texto}`} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}>
                                    <Trash2 size={14} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                        {checklist.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Agrega pasos para llevar el control (ej: cada libro, cada hito).</p>}
                    </div>
                    <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: 8 }}>
                        <input className="input" placeholder="Nuevo avance…" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} aria-label="Nuevo avance" style={{ height: 44, flex: 1, minWidth: 0 }} />
                        <button type="submit" className="icon-btn" aria-label="Agregar avance" style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'transparent' }}><Plus size={18} aria-hidden="true" /></button>
                    </form>
                </div>

                {/* Registro diario (rachas) — opcional por meta */}
                {seguimientoActivo ? (
                    <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>Registro diario</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800 }}>
                                <span style={{ color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Flame size={13} aria-hidden="true" /> {racha}</span>
                                <span style={{ color: 'var(--primary)' }}>{diasEsteMes} este mes</span>
                                <button type="button" onClick={() => onToggleSeguimiento(meta)} aria-label="Desactivar registro diario" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}><X size={14} aria-hidden="true" /></button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <button type="button" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Semana anterior" className="icon-btn" style={{ width: 36, height: 36, border: 0, background: 'transparent' }}><ChevronLeft size={18} aria-hidden="true" /></button>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{etiquetaSemana}</span>
                            <button type="button" onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))} disabled={weekOffset >= 0} aria-label="Semana siguiente" className="icon-btn" style={{ width: 36, height: 36, border: 0, background: 'transparent', opacity: weekOffset >= 0 ? .3 : 1 }}><ChevronRight size={18} aria-hidden="true" /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                            {semana.map((dia) => (
                                <button type="button" key={dia.key} onClick={() => !dia.isFuture && onToggleDia(meta, dia.key)} disabled={dia.isFuture} aria-pressed={dia.done} aria-label={dia.key}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0', background: 'none', border: 0, cursor: dia.isFuture ? 'default' : 'pointer', opacity: dia.isFuture ? .3 : 1 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: dia.isToday ? 'var(--primary)' : 'var(--text-3)' }}>{dia.letra}</span>
                                    <span className="num" style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, letterSpacing: 0, transition: 'all .35s var(--spring)', background: dia.done ? 'var(--income)' : 'var(--surface-2)', color: dia.done ? 'var(--on-accent)' : 'var(--text-2)', boxShadow: dia.isToday && !dia.done ? 'inset 0 0 0 2px var(--primary)' : 'none' }}>
                                        {dia.done ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : dia.num}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <button type="button" onClick={() => onToggleSeguimiento(meta)} className="btn btn-outline btn-sm" style={{ borderStyle: 'dashed', color: 'var(--text-3)' }}>
                        <CalendarClock size={16} aria-hidden="true" /> Activar registro diario
                    </button>
                )}

                {showNotes && notesPanel}

                <button type="button" onClick={() => onToggleCompletada(meta)} className={meta.completada ? 'btn btn-outline' : 'btn btn-primary'} style={meta.completada ? { color: 'var(--income)' } : undefined}>
                    {meta.completada ? <><CheckCircle2 size={18} aria-hidden="true" /> Lograda</> : 'Marcar como lograda'}
                </button>
            </article>
        );
    }

    // ---------- Metas financieras ----------
    const actual = Number(meta.ahorroActual) || 0;
    const objetivo = Number(meta.montoObjetivo) || 1;
    const porcentaje = Math.min((actual / objetivo) * 100, 100);
    const estado = estadoMeta(meta);
    const tienePlan = !!meta.fechaObjetivo;
    const sugerido = tienePlan ? aporteSugeridoMeta(meta) : 0;
    const periodos = tienePlan ? periodosRestantesMeta(meta) : 0;
    const nombrePeriodo = (meta.frecuencia === 'mensual') ? 'mes' : 'quincena';
    // Vinculada a una inversión: el ahorro es su valor actual y se aporta a la inversión.
    const inv = meta.inversion || null;
    const invUSD = inv?.moneda === 'USD';
    const ultimosAportes = inv
        ? aportesDe(inv).slice(-3).reverse().map(a => ({ texto: formatMoney(a.monto, inv.moneda), fecha: a.fecha }))
        : (meta.aportes || []).slice(-3).reverse().map(a => ({ texto: fmtCOP(a.monto), fecha: a.fecha }));

    const ESTADOS = {
        completada: { txt: 'Completada', color: 'var(--income)', soft: 'var(--income-soft)' },
        adelantada: { txt: 'Adelantada', color: 'var(--primary)', soft: 'var(--primary-soft)' },
        aldia: { txt: 'Al día', color: 'var(--income)', soft: 'var(--income-soft)' },
        atrasada: { txt: 'Atrasada', color: 'var(--warn)', soft: 'var(--warn-soft)' },
        sinplan: { txt: 'Sin plan', color: 'var(--text-3)', soft: 'var(--surface-2)' },
    };
    const est = ESTADOS[estado.id];

    const guardarPlan = () => {
        if (!planFecha) return;
        onEditarPlan(meta, planFecha, planFrecuencia);
        setEditandoPlan(false);
    };

    const enviarAporte = async (e) => {
        e.preventDefault();
        if (!aporte) return;
        if (inv) {
            const valor = parseFloat(String(aporte).replace(',', '.'));
            try { await onAportarInversion(inv, { monto: valor, descontar: invUSD && descontarSaldo }); }
            catch (err) { alert(err.message || 'No se pudo registrar el aporte.'); return; }
        } else {
            onAhorrar(meta, aporte, descontarSaldo);
        }
        setAporte('');
        setAportando(false);
    };

    const guardarVinculo = () => {
        const elegida = inversiones.find(i => i.id === invElegida);
        if (elegida && !window.confirm(`La meta tomará el valor real de "${elegida.concepto}" y los aportes se harán a esa inversión. El ahorro registrado solo en la meta se reemplaza. ¿Vincular?`)) return;
        onVincularInversion(meta, invElegida || null);
        setEditandoPlan(false);
    };

    return (
        <article className="card rise" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${delay}s` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: est.soft, color: est.color, fontSize: 12, fontWeight: 800 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{est.txt}
                    </span>
                    <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{meta.nombre}</h2>
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button type="button" className="icon-btn" aria-label="Editar plan (fecha y frecuencia)" aria-expanded={editandoPlan} style={accionBtn(editandoPlan)}
                        onClick={() => { setPlanFecha(meta.fechaObjetivo || ''); setPlanFrecuencia(meta.frecuencia || 'quincenal'); setEditandoPlan(v => !v); }}>
                        <Edit2 size={17} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                    <BotonNotas />
                    <button type="button" className="icon-btn" onClick={eliminar} aria-label={`Eliminar ${meta.nombre}`} style={accionBtn(false)}>
                        <Trash2 size={17} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                    <span><span className="num">{Math.round((actual / objetivo) * 100)}%</span> completado</span>
                    {tienePlan && <span>{meta.frecuencia === 'mensual' ? 'Mensual' : 'Quincenal'}</span>}
                </div>
                <div className="bar" style={{ height: 10, position: 'relative' }}>
                    <i style={{ width: `${porcentaje}%`, background: porcentaje >= 100 ? 'var(--income)' : 'linear-gradient(90deg, var(--primary), var(--cyan-bright))' }} />
                    {[25, 50, 75].map(h => (
                        <span key={h} style={{ position: 'absolute', top: '50%', left: `calc(${h}% - 2px)`, width: 4, height: 4, marginTop: -2, borderRadius: '50%', background: porcentaje >= h ? 'rgba(255,255,255,.85)' : 'var(--line)' }} />
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-3)' }}>
                    <span className="num" style={{ letterSpacing: 0 }}><b style={{ color: 'var(--text)' }}>{fmtCOP(actual)}</b> ahorrado</span>
                    <span className="num" style={{ letterSpacing: 0 }}>Meta {fmtCOP(objetivo)}</span>
                </div>
                {inv && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
                        <Link2 size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {inv.concepto}: depositado {formatMoney(Number(inv.monto) || 0, inv.moneda)} · utilidad{' '}
                        <b style={{ color: (Number(inv.utilidad) || 0) >= 0 ? 'var(--income)' : 'var(--expense)' }}>{(Number(inv.utilidad) || 0) >= 0 ? '+' : '−'}{formatMoney(Math.abs(Number(inv.utilidad) || 0), inv.moneda)}</b>
                        {invUSD ? ' · en pesos con la tasa de hoy' : ''}
                    </span>
                )}
            </div>

            {estado.id === 'completada' && (
                <div className="rise" style={{ padding: 14, borderRadius: 16, background: 'var(--income-soft)', color: 'var(--income)', fontSize: 14, fontWeight: 800, textAlign: 'center' }}>
                    ¡Meta cumplida! Date un gusto (con moderación).
                </div>
            )}

            {editandoPlan ? (
                <div className="rise" style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span className="eyebrow">{tienePlan ? 'Editar plan' : 'Ponle fecha a tu meta'}</span>
                    <input className="input" type="date" min={dateKey()} value={planFecha} onChange={e => setPlanFecha(e.target.value)} aria-label="Fecha objetivo" style={{ background: 'var(--surface)' }} />
                    <div className="seg" style={{ background: 'var(--surface)' }}>
                        <span className="thumb" style={{ transform: planFrecuencia === 'quincenal' ? 'translateX(0)' : 'translateX(100%)', background: 'var(--surface-2)' }} />
                        <button type="button" className={planFrecuencia === 'quincenal' ? 'on' : ''} onClick={() => setPlanFrecuencia('quincenal')}>Quincenal</button>
                        <button type="button" className={planFrecuencia === 'mensual' ? 'on' : ''} onClick={() => setPlanFrecuencia('mensual')}>Mensual</button>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={guardarPlan} disabled={!planFecha}>Guardar plan</button>
                    {inversiones.length > 0 && (
                        <>
                            <span className="eyebrow" style={{ marginTop: 4 }}>Vincular a una inversión</span>
                            <select className="input" value={invElegida} onChange={e => setInvElegida(e.target.value)} aria-label="Inversión vinculada" style={{ background: 'var(--surface)' }}>
                                <option value="">Sin vincular (ahorro propio)</option>
                                {inversiones.map(i => <option key={i.id} value={i.id}>{i.concepto} · {formatMoney((Number(i.monto) || 0) + (Number(i.utilidad) || 0), i.moneda)}</option>)}
                            </select>
                            <button type="button" className="btn btn-outline" onClick={guardarVinculo} disabled={invElegida === (meta.inversionId || '')}>Guardar vínculo</button>
                        </>
                    )}
                </div>
            ) : estado.id === 'completada' ? null : !tienePlan ? (
                <button type="button" className="btn btn-ghost" onClick={() => setEditandoPlan(true)} style={{ color: 'var(--primary)' }}>
                    <Calendar size={18} aria-hidden="true" /> Ponle fecha y te digo cuánto ahorrar
                </button>
            ) : (
                <div style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="tile" style={{ width: 40, height: 40, background: estado.id === 'atrasada' ? 'var(--warn-soft)' : 'var(--primary-soft)', color: estado.id === 'atrasada' ? 'var(--warn)' : 'var(--primary)' }}>
                        {estado.id === 'atrasada' ? <AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true" /> : <TrendingUp size={18} strokeWidth={1.9} aria-hidden="true" />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{estado.id === 'atrasada' ? 'Aporta para nivelarte' : `Sugerido por ${nombrePeriodo}`}</span>
                        <span className="num" style={{ fontSize: 17, fontWeight: 700 }}>{fmtCOP(estado.id === 'atrasada' ? estado.atraso : sugerido)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Quedan {periodos} {nombrePeriodo === 'mes' ? (periodos === 1 ? 'mes' : 'meses') : (periodos === 1 ? 'quincena' : 'quincenas')}</span>
                    </div>
                    {!aportando && <button type="button" className="chip" style={{ color: 'var(--primary)' }} onClick={() => setAportando(true)}>Aportar</button>}
                </div>
            )}

            {estado.id !== 'completada' && (aportando || !tienePlan) && !editandoPlan && (
                <form onSubmit={enviarAporte} className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {invUSD
                            ? <input className="input num" type="number" inputMode="decimal" step="any" min="0" placeholder="+ US$" value={aporte} onChange={e => setAporte(e.target.value)} aria-label={`Aporte en dólares a ${meta.nombre}`} autoFocus={aportando} style={{ height: 48, flex: 1, minWidth: 0 }} />
                            : <MontoInput value={aporte} onChange={setAporte} placeholder={inv ? '+ Aporte' : '+ Ahorro'} aria-label={`Aporte a ${meta.nombre}`} autoFocus={aportando} style={{ height: 48, flex: 1, minWidth: 0 }} />}
                        <button type="submit" className="btn btn-primary btn-sm" disabled={!aporte} style={{ height: 48 }}>Aportar</button>
                    </div>
                    {inv && !invUSD ? (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Se suma a "{inv.concepto}"{inv.afectaBalance !== false ? ' y se descuenta de tu saldo.' : ' (no toca tu saldo).'}</span>
                    ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', minHeight: 32 }}>
                            <input type="checkbox" checked={descontarSaldo} onChange={e => setDescontarSaldo(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
                            Descontar de mi saldo{inv ? ` · se suma a "${inv.concepto}"` : ''}
                        </label>
                    )}
                </form>
            )}

            {ultimosAportes.length > 0 && !editandoPlan && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ultimosAportes.map((a, i) => (
                        <span key={i} className="num" style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: 0 }}>
                            <span style={{ color: 'var(--income)', fontWeight: 700 }}>+ {a.texto}</span> · {a.fecha}
                        </span>
                    ))}
                </div>
            )}

            {showNotes && notesPanel}
        </article>
    );
};

export const GoalTracker = ({ metas, inversiones = [], onAportarInversion, transacciones = [], habitos = [], reglas = [], setActiveTab, genericAdd, genericUpdate, genericDelete }) => {
    const [viewMode, setViewMode] = useState('financieras'); // 'financieras' | 'personales'
    const [formOpen, setFormOpen] = useState(false);

    // Estados Financieras
    const [nombre, setNombre] = useState('');
    const [montoObjetivo, setMontoObjetivo] = useState('');
    const [plazo, setPlazo] = useState('corto');
    const [ahorroActual, setAhorroActual] = useState('');
    const [fechaObjetivo, setFechaObjetivo] = useState('');
    const [frecuencia, setFrecuencia] = useState('quincenal');
    // Vincular meta personal a una meta financiera (opcional)
    const [metaFinancieraId, setMetaFinancieraId] = useState('');

    // Lista de metas financieras (para el selector de vínculo)
    const metasFinancieras = metas.filter(m => m.tipo === 'financiera' || !m.tipo);

    // Deriva el plazo legacy a partir de la fecha (para el badge y el coach).
    const plazoDesdeFecha = (ymd) => {
        const meses = Math.max(diasHasta(ymd), 0) / 30;
        return meses < 12 ? 'corto' : meses < 60 ? 'mediano' : 'largo';
    };

    const agregarMetaHandler = async (e) => {
        e.preventDefault();
        // Si es meta personal, no requiere monto
        const isPersonal = viewMode === 'personales';

        await genericAdd('metas', {
            nombre,
            plazo: isPersonal ? plazo : plazoDesdeFecha(fechaObjetivo),
            tipo: isPersonal ? 'personal' : 'financiera',
            // Campos exclusivos financieras
            montoObjetivo: isPersonal ? 0 : parseFloat(montoObjetivo),
            ahorroActual: isPersonal ? 0 : parseFloat(ahorroActual || 0),
            ...(isPersonal ? {} : {
                fechaObjetivo,
                frecuencia,
                aportes: [],
                createdAt: new Date().toISOString(),
            }),
            // Campos exclusivos personales
            completada: false,
            checklist: [],
            metaFinancieraId: isPersonal ? (metaFinancieraId || null) : null
        });

        setNombre(''); setMontoObjetivo(''); setAhorroActual(''); setMetaFinancieraId(''); setFechaObjetivo('');
    };

    // --- Checklist (avances) de una meta ---
    const addChecklistItem = async (meta, texto) => {
        if (!texto.trim()) return;
        const lista = meta.checklist || [];
        await genericUpdate('metas', meta.id, { checklist: [...lista, { texto: texto.trim(), completado: false }] });
    };

    const toggleChecklistItem = async (meta, index) => {
        const lista = (meta.checklist || []).slice();
        if (!lista[index]) return;
        lista[index] = { ...lista[index], completado: !lista[index].completado };
        await genericUpdate('metas', meta.id, { checklist: lista });
    };

    const deleteChecklistItem = async (meta, index) => {
        const lista = (meta.checklist || []).filter((_, i) => i !== index);
        await genericUpdate('metas', meta.id, { checklist: lista });
    };

    // Marca / desmarca un día como cumplido en el registro diario de la meta.
    const toggleDiaCumplido = async (meta, fechaKey) => {
        const dias = meta.registroDias || [];
        const nuevos = dias.includes(fechaKey)
            ? dias.filter(d => d !== fechaKey)
            : [...dias, fechaKey].sort();
        await genericUpdate('metas', meta.id, { registroDias: nuevos });
    };

    // Activa / desactiva el seguimiento diario para esa meta (no borra el historial).
    const toggleSeguimientoDiario = async (meta) => {
        const activo = meta.seguimientoDiario === true
            || (meta.seguimientoDiario === undefined && (meta.registroDias || []).length > 0);
        await genericUpdate('metas', meta.id, { seguimientoDiario: !activo });
    };

    // Vincular / desvincular una meta financiera a una meta personal
    // Al vincular, la meta deja su ahorro propio: su valor pasa a ser el de la inversión.
    const vincularInversion = async (meta, inversionId) => {
        await genericUpdate('metas', meta.id, inversionId ? { inversionId, ahorroActual: 0, aportes: [] } : { inversionId: null });
    };

    const linkMetaFinanciera = async (meta, id) => {
        await genericUpdate('metas', meta.id, { metaFinancieraId: id || null });
    };

    const actualizarAhorro = async (meta, monto, descontar = false) => {
        const valor = parseFloat(monto);
        if (!valor || valor <= 0) return;
        const actual = Number(meta.ahorroActual) || 0;
        const nuevoTotal = actual + valor;
        const objetivo = Number(meta.montoObjetivo) || 0;

        await genericUpdate('metas', meta.id, {
            ahorroActual: nuevoTotal,
            aportes: [...(meta.aportes || []), { monto: valor, fecha: dateKey() }],
            ...(objetivo > 0 && nuevoTotal >= objetivo ? { completada: true } : {}),
        });

        // "Descontar de mi saldo": la plata apartada deja de estar disponible.
        // esAhorro la excluye de las estadísticas de consumo (como esInversion),
        // pero SÍ resta del saldo total.
        if (descontar) {
            await genericAdd('transacciones', {
                tipo: 'gasto',
                monto: valor,
                concepto: `Ahorro → ${meta.nombre}`,
                categoria: 'Ahorro Metas',
                fecha: dateKey(),
                esAhorro: true,
                metaId: meta.id,
                createdAt: new Date().toISOString(),
            });
        }
    };

    // Pone o cambia el plan (fecha + frecuencia) de una meta; sirve para migrar
    // metas legacy. Fija createdAt si no existía (ancla del cálculo de ritmo).
    const editarPlanMeta = async (meta, nuevaFecha, nuevaFrecuencia) => {
        await genericUpdate('metas', meta.id, {
            fechaObjetivo: nuevaFecha,
            frecuencia: nuevaFrecuencia,
            plazo: plazoDesdeFecha(nuevaFecha),
            ...(meta.createdAt ? {} : { createdAt: new Date().toISOString() }),
            ...(meta.aportes ? {} : { aportes: [] }),
        });
    };

    const toggleCompletada = async (meta) => {
        await genericUpdate('metas', meta.id, { completada: !meta.completada });
    };

    // Funciones para manejar notas
    const addNote = async (meta, texto) => {
        const nuevaNota = {
            texto,
            fecha: new Date().toISOString()
        };
        const notasActuales = meta.notas || [];
        await genericUpdate('metas', meta.id, { notas: [...notasActuales, nuevaNota] });
    };

    const deleteNote = async (meta, index) => {
        const notasActuales = meta.notas || [];
        const nuevasNotas = notasActuales.filter((_, i) => i !== index);
        await genericUpdate('metas', meta.id, { notas: nuevasNotas });
    };

    // Filtrar metas según la pestaña activa
    // Nota: Las metas antiguas (sin tipo) se asumen como financieras
    const metasFiltradas = metas.filter(m => {
        if (viewMode === 'financieras') return m.tipo === 'financiera' || !m.tipo;
        return m.tipo === 'personal';
    });

    const isPersonal = viewMode === 'personales';
    const hoyKeyGT = dateKey();
    const habHechos = habitos.filter(h => (h.historial || []).includes(hoyKeyGT)).length;

    // Vista previa del plan mientras se llena el formulario.
    const preview = (!isPersonal && fechaObjetivo && Number(montoObjetivo) > 0) ? (() => {
        const p = { montoObjetivo: Number(montoObjetivo), ahorroActual: Number(ahorroActual || 0), fechaObjetivo, frecuencia };
        const sugerido = aporteSugeridoMeta(p);
        const capacidad = capacidadAhorroMensual(transacciones);
        const sugeridoMensual = frecuencia === 'quincenal' ? sugerido * 2 : sugerido;
        return { sugerido, periodos: periodosRestantesMeta(p), capacidad, excede: capacidad !== null && sugeridoMensual > capacidad };
    })() : null;

    return (
        <div>
            <ScreenHeader title="Metas" right={<PlusToggle open={formOpen} onClick={() => setFormOpen(v => !v)} label="Nueva meta" />} />

            <div className="seg rise d2" style={{ marginTop: 18 }} role="tablist" aria-label="Tipo de meta">
                <span className="thumb" style={{ transform: isPersonal ? 'translateX(100%)' : 'translateX(0)' }} />
                <button type="button" role="tab" aria-selected={!isPersonal} className={!isPersonal ? 'on' : ''} onClick={() => setViewMode('financieras')}>Financieras</button>
                <button type="button" role="tab" aria-selected={isPersonal} className={isPersonal ? 'on' : ''} onClick={() => setViewMode('personales')}>Personales</button>
            </div>

            {formOpen && (
                <form onSubmit={async (e) => { await agregarMetaHandler(e); setFormOpen(false); }} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{isPersonal ? 'Nueva meta personal' : 'Nueva meta'}</h2>
                    <label className="field"><span className="field-label">Nombre</span>
                        <input className="input" required placeholder={isPersonal ? 'Ej: Correr 10K' : 'Ej: Viaje a Europa'} value={nombre} onChange={e => setNombre(e.target.value)} /></label>
                    {!isPersonal ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                                <label className="field"><span className="field-label">Objetivo</span><MontoInput value={montoObjetivo} onChange={setMontoObjetivo} required /></label>
                                <label className="field"><span className="field-label">Ya tengo</span><MontoInput value={ahorroActual} onChange={setAhorroActual} /></label>
                            </div>
                            <label className="field"><span className="field-label">Fecha límite</span>
                                <input className="input" type="date" required min={dateKey()} value={fechaObjetivo} onChange={e => setFechaObjetivo(e.target.value)} /></label>
                            <div className="field">
                                <span className="field-label">Aportes</span>
                                <div className="seg">
                                    <span className="thumb" style={{ transform: frecuencia === 'quincenal' ? 'translateX(0)' : 'translateX(100%)' }} />
                                    <button type="button" className={frecuencia === 'quincenal' ? 'on' : ''} onClick={() => setFrecuencia('quincenal')}>Quincenal</button>
                                    <button type="button" className={frecuencia === 'mensual' ? 'on' : ''} onClick={() => setFrecuencia('mensual')}>Mensual</button>
                                </div>
                            </div>
                            {preview && (
                                <div style={{ padding: 14, borderRadius: 16, background: preview.excede ? 'var(--warn-soft)' : 'var(--primary-soft)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-2)' }}>
                                    <span>Necesitarás ~<b className="num" style={{ color: 'var(--text)' }}>{fmtCOP(preview.sugerido)}</b> por {frecuencia === 'quincenal' ? 'quincena' : 'mes'} ({preview.periodos} {frecuencia === 'quincenal' ? 'quincenas' : 'meses'}).</span>
                                    {preview.excede && <span style={{ color: 'var(--warn)', fontWeight: 700 }}>Supera tu capacidad de ahorro promedio (~{fmtCOP(preview.capacidad)}/mes). Considera una fecha más lejana.</span>}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <label className="field"><span className="field-label">Plazo</span>
                                <select className="input" value={plazo} onChange={e => setPlazo(e.target.value)}>
                                    {PLAZOS_METAS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select></label>
                            {metasFinancieras.length > 0 && (
                                <label className="field"><span className="field-label">Vincular ahorro (opcional)</span>
                                    <select className="input" value={metaFinancieraId} onChange={e => setMetaFinancieraId(e.target.value)}>
                                        <option value="">Sin vínculo</option>
                                        {metasFinancieras.map(mf => <option key={mf.id} value={mf.id}>{mf.nombre}</option>)}
                                    </select></label>
                            )}
                        </>
                    )}
                    <button type="submit" className="btn btn-primary">{isPersonal ? 'Crear meta personal' : 'Crear plan de ahorro'}</button>
                </form>
            )}

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {metasFiltradas.length === 0 && !formOpen ? (
                    <section className="card rise d3" style={{ gridColumn: '1 / -1', padding: '32px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                        <div style={{ width: 72, height: 72, borderRadius: 24, display: 'grid', placeItems: 'center', background: isPersonal ? 'var(--violet-soft)' : 'var(--primary-soft)', color: isPersonal ? 'var(--violet)' : 'var(--primary)', animation: 'floaty 4s ease-in-out infinite' }}>
                            {isPersonal ? <Sparkles size={30} aria-hidden="true" /> : <Target size={30} aria-hidden="true" />}
                        </div>
                        <h2 className="display" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{isPersonal ? 'Metas personales' : 'Metas de ahorro'}</h2>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>
                            {isPersonal ? 'Aprender un idioma, correr 10K, leer 12 libros. Ponles fecha y sigue tu avance.' : 'Ponle fecha a lo que quieres y te digo cuánto ahorrar cada quincena.'}
                        </p>
                        <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)} style={{ width: '100%' }}>{isPersonal ? 'Crear meta personal' : 'Crear plan de ahorro'}</button>
                    </section>
                ) : (
                    metasFiltradas.map((meta, i) => (
                        <MetaItem
                            key={meta.id}
                            meta={meta}
                            delay={0.19 + i * 0.07}
                            metasFinancieras={metasFinancieras}
                            inversiones={inversiones}
                            onVincularInversion={vincularInversion}
                            onAportarInversion={onAportarInversion}
                            onAhorrar={actualizarAhorro}
                            onEditarPlan={editarPlanMeta}
                            onToggleCompletada={toggleCompletada}
                            onDelete={(id) => genericDelete('metas', id)}
                            onAddNote={addNote}
                            onDeleteNote={deleteNote}
                            onAddChecklistItem={addChecklistItem}
                            onToggleChecklistItem={toggleChecklistItem}
                            onDeleteChecklistItem={deleteChecklistItem}
                            onLinkMetaFinanciera={linkMetaFinanciera}
                            onToggleDia={toggleDiaCumplido}
                            onToggleSeguimiento={toggleSeguimientoDiario}
                        />
                    ))
                )}
            </div>

            {!isPersonal && (
                <ReglasAhorro reglas={reglas} metasFinancieras={metasFinancieras}
                    categoriasIngreso={[...new Set([...CATEGORIAS_INGRESOS, ...transacciones.filter(t => t.tipo === 'ingreso' && t.categoria).map(t => t.categoria)])]}
                    genericAdd={genericAdd} genericUpdate={genericUpdate} genericDelete={genericDelete} />
            )}

            {setActiveTab && (
                <button type="button" onClick={() => setActiveTab('habitos')} className="card lift rise d4" style={{ marginTop: 14, padding: 16, width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'var(--text)', cursor: 'pointer' }}>
                    <span className="tile" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Flame size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>Mis hábitos</span>
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{habitos.length} hábitos · {habHechos} hechos hoy</span>
                    </div>
                    <ChevronRight size={18} strokeWidth={2} color="var(--text-3)" aria-hidden="true" />
                </button>
            )}
        </div>
    );
};

// =============================================
// === REGLAS AUTOMÁTICAS DE AHORRO ===
// =============================================
const ReglasAhorro = ({ reglas = [], metasFinancieras = [], categoriasIngreso = [], genericAdd, genericUpdate, genericDelete }) => {
    const [abierto, setAbierto] = useState(false);
    const [metaId, setMetaId] = useState('');
    const [tipo, setTipo] = useState('porcentaje');
    const [valor, setValor] = useState('10');
    const [categoria, setCategoria] = useState('');
    const [auto, setAuto] = useState(false);
    const disponibles = metasFinancieras.filter(m => !m.completada);
    const metaElegida = metaId || disponibles[0]?.id || '';

    const crear = async (e) => {
        e.preventDefault();
        const v = Number(String(valor).replace(',', '.'));
        if (!metaElegida || !(v > 0)) return;
        await genericAdd('reglas_ahorro', { metaId: metaElegida, tipo, valor: v, categoria, auto, activa: true, createdAt: new Date().toISOString() });
        setAbierto(false); setValor(tipo === 'porcentaje' ? '10' : ''); setCategoria(''); setAuto(false);
    };

    return (
        <section className="card rise d5" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tile" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}><Zap size={19} strokeWidth={1.9} aria-hidden="true" /></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Reglas de ahorro</h2>
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Págate primero: aparta algo apenas entra un ingreso.</span>
                </div>
                <PlusToggle open={abierto} onClick={() => setAbierto(v => !v)} label="Nueva regla" />
            </div>

            {reglas.map(r => {
                const meta = metasFinancieras.find(m => m.id === r.metaId);
                const activa = r.activa !== false;
                return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, background: 'var(--surface-2)', opacity: activa ? 1 : .6 }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{describirRegla(r, meta)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{(r.auto ? 'Se aparta sola' : 'Te pregunto antes de apartar') + (meta?.inversionId ? ' · como aporte a la inversión' : '')}</span>
                        </div>
                        <button type="button" onClick={() => genericUpdate('reglas_ahorro', r.id, { activa: !activa })} aria-pressed={activa} aria-label={activa ? 'Pausar regla' : 'Activar regla'}
                            style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer' }}><Switch on={activa} /></button>
                        <button type="button" onClick={() => { if (window.confirm('¿Eliminar esta regla?')) genericDelete('reglas_ahorro', r.id); }} aria-label="Eliminar regla"
                            style={{ width: 32, height: 40, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}>
                            <Trash2 size={15} aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
            {!reglas.length && !abierto && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Ejemplo: "10% de cada ingreso de Salario → Fondo de emergencia".</p>}

            {abierto && (
                disponibles.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--warn)', fontWeight: 700 }}>Primero crea una meta financiera para asignarle la regla.</p>
                ) : (
                    <form onSubmit={crear} className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label className="field"><span className="field-label">Meta</span>
                            <select className="input" value={metaElegida} onChange={e => setMetaId(e.target.value)}>
                                {disponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                            </select></label>
                        <div className="seg">
                            <span className="thumb" style={{ transform: tipo === 'porcentaje' ? 'translateX(0)' : 'translateX(100%)' }} />
                            <button type="button" className={tipo === 'porcentaje' ? 'on' : ''} onClick={() => { setTipo('porcentaje'); setValor('10'); }}>Porcentaje</button>
                            <button type="button" className={tipo === 'fijo' ? 'on' : ''} onClick={() => { setTipo('fijo'); setValor(''); }}>Monto fijo</button>
                        </div>
                        {tipo === 'porcentaje' ? (
                            <label className="field"><span className="field-label">Porcentaje del ingreso</span>
                                <input className="input num" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="10" /></label>
                        ) : (
                            <label className="field"><span className="field-label">Monto por ingreso</span><MontoInput value={valor} onChange={setValor} /></label>
                        )}
                        <label className="field"><span className="field-label">¿Con qué ingresos?</span>
                            <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
                                <option value="">Cualquier ingreso</option>
                                {categoriasIngreso.map(c => <option key={c} value={c}>Solo {c}</option>)}
                            </select></label>
                        <button type="button" onClick={() => setAuto(v => !v)} aria-pressed={auto}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                            <Switch on={auto} />
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 14, fontWeight: 800 }}>{auto ? 'Apartar automáticamente' : 'Preguntarme antes'}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>El aporte se descuenta de tu saldo y suma a la meta.</span>
                            </span>
                        </button>
                        <button type="submit" className="btn btn-primary">Crear regla</button>
                    </form>
                )
            )}
        </section>
    );
};
