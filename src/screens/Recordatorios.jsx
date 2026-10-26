import { useState } from 'react';
import { Trash2, Sun, BookOpen, Bell, BellOff, Sparkles } from 'lucide-react';
import { ScreenHeader } from '../ui/f360.jsx';
import { PlusToggle, Switch } from '../components/comunes';

// =============================================
// === RECORDATORIOS / ASISTENTE PROACTIVO ===
// =============================================
// Lo que la app (o la IA, por voz o chat) te recuerda como notificación: el resumen de
// la mañana, la lectura del día, hábitos, agua, pausas activas… Todo lo programa un solo
// programador en el teléfono (src/native/programador.js).

const DIAS = [{ v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' }, { v: 4, l: 'J' }, { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' }];
const NOMBRES_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const EMOJIS = ['💧', '🧘', '📚', '💊', '🚶', '🍎', '😴', '🧠', '✍️', '🔔'];
const SUGERENCIAS = [
    { titulo: 'Toma agua', emoji: '💧', tipo: 'intervalo', desde: '08:00', hasta: '18:00', cadaMin: 120, dias: [] },
    { titulo: 'Pausa activa: estírate 3 minutos', emoji: '🧘', tipo: 'intervalo', desde: '09:00', hasta: '17:00', cadaMin: 60, dias: [1, 2, 3, 4, 5] },
    { titulo: 'Lee 20 minutos', emoji: '📚', tipo: 'hora', hora: '20:30', dias: [] },
];

const describirDias = (d) => {
    if (!Array.isArray(d) || d.length === 0 || d.length === 7) return 'todos los días';
    const s = [...d].sort().join(',');
    if (s === '1,2,3,4,5') return 'lunes a viernes';
    if (s === '0,6') return 'fines de semana';
    return d.map(x => NOMBRES_DIA[x]).join(', ');
};
export const describirRecordatorio = (r) => {
    if (r.tipo === 'intervalo') {
        const h = r.cadaMin % 60 === 0 ? `${r.cadaMin / 60} h` : `${r.cadaMin} min`;
        return `Cada ${h} · ${r.desde}–${r.hasta} · ${describirDias(r.dias)}`;
    }
    if (r.tipo === 'unico') return `Una vez · ${r.fecha} a las ${r.hora}`;
    return `${r.hora} · ${describirDias(r.dias)}`;
};

export const RecordatoriosView = ({ recordatorios = [], habitos = [], notifPermiso, onActivarNotif, genericAdd, genericUpdate, genericDelete, onBack, onHablar }) => {
    const [abierto, setAbierto] = useState(false);
    const [titulo, setTitulo] = useState('');
    const [emoji, setEmoji] = useState('🔔');
    const [tipo, setTipo] = useState('hora');
    const [hora, setHora] = useState('08:00');
    const [desde, setDesde] = useState('08:00');
    const [hasta, setHasta] = useState('18:00');
    const [cadaMin, setCadaMin] = useState(60);
    const [fecha, setFecha] = useState('');
    const [dias, setDias] = useState([]);
    const [habitoId, setHabitoId] = useState('');

    const sistema = recordatorios.filter(r => r.sistema);
    const propios = recordatorios.filter(r => !r.sistema).sort((a, b) => (a.hora || a.desde || '').localeCompare(b.hora || b.desde || ''));

    const limpiar = () => { setTitulo(''); setEmoji('🔔'); setTipo('hora'); setHora('08:00'); setDesde('08:00'); setHasta('18:00'); setCadaMin(60); setFecha(''); setDias([]); setHabitoId(''); };
    const crear = async (e) => {
        e.preventDefault();
        if (!titulo.trim()) return;
        await genericAdd('recordatorios', {
            titulo: titulo.trim(), emoji, tipo,
            ...(tipo === 'intervalo' ? { desde, hasta, cadaMin: Math.max(15, Number(cadaMin) || 60) } : { hora }),
            ...(tipo === 'unico' ? { fecha } : {}),
            dias: tipo === 'unico' ? [] : dias, habitoId: habitoId || null, mensaje: '',
            activo: true, origen: 'manual', createdAt: new Date().toISOString(),
        });
        limpiar(); setAbierto(false);
    };
    const usarSugerencia = async (s) => {
        await genericAdd('recordatorios', { ...s, mensaje: '', habitoId: null, activo: true, origen: 'manual', createdAt: new Date().toISOString() });
    };
    const elegirHabito = (id) => {
        setHabitoId(id);
        const h = habitos.find(x => x.id === id);
        if (h) { setTitulo(h.nombre); setEmoji(h.emoji || '🔔'); }
    };

    const fila = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' };

    return (
        <div>
            <ScreenHeader title="Asistente" onBack={onBack} right={<PlusToggle open={abierto} onClick={() => setAbierto(v => !v)} label="Nuevo recordatorio" />} />

            {notifPermiso !== 'granted' && (
                <button type="button" onClick={onActivarNotif} className="card rise d2" style={{ marginTop: 18, width: '100%', padding: 16, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'var(--text)', cursor: 'pointer', border: '1px solid var(--warn)' }}>
                    <span className="tile" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><BellOff size={20} aria-hidden="true" /></span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <b style={{ fontSize: 15 }}>Activa las notificaciones</b>
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Sin permiso no te puedo avisar nada.</span>
                    </span>
                </button>
            )}

            <section className="hero rise d2" style={{ marginTop: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="orb" style={{ width: 220, height: 220, right: -90, top: -100, background: '#7C3AED', opacity: .6 }} />
                <div className="grid-lines" />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,.75)' }}><Sparkles size={15} aria-hidden="true" /> Tu asistente proactivo</span>
                <span className="display" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>Pídeselo con el micrófono: “recuérdame tomar agua cada 2 horas” u “organízame el día”.</span>
                {onHablar && <button type="button" className="btn btn-sm" onClick={onHablar} style={{ alignSelf: 'flex-start', background: '#fff', color: '#0B1220' }}>Hablar con la IA</button>}
            </section>

            <section className="card rise d3" style={{ marginTop: 14, padding: '2px 16px' }}>
                {sistema.map((r, i) => {
                    const Icono = r.sistema === 'resumen' ? Sun : BookOpen;
                    const activo = r.activo !== false;
                    return (
                        <div key={r.id} style={{ ...fila, alignItems: 'flex-start', borderTop: i ? '1px solid var(--line)' : 0, opacity: activo ? 1 : .6 }}>
                            <span className="tile" style={{ background: r.sistema === 'resumen' ? 'var(--warn-soft)' : 'var(--violet-soft)', color: r.sistema === 'resumen' ? 'var(--warn)' : 'var(--violet)' }}><Icono size={19} aria-hidden="true" /></span>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 15, fontWeight: 800 }}>{r.titulo}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>{r.sistema === 'resumen' ? 'Tu día, pagos y un consejo, escrito por la IA' : 'Una idea para pensar antes de dormir'}</span>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                                    A las
                                    <input type="time" className="input" value={r.hora || ''} onChange={e => e.target.value && genericUpdate('recordatorios', r.id, { hora: e.target.value })} aria-label={`Hora de ${r.titulo}`} style={{ width: 'auto', minWidth: 132, height: 36, padding: '0 8px', fontSize: 14 }} />
                                </label>
                            </div>
                            <button type="button" onClick={() => genericUpdate('recordatorios', r.id, { activo: !activo })} aria-pressed={activo} aria-label={activo ? `Pausar ${r.titulo}` : `Activar ${r.titulo}`} style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer' }}><Switch on={activo} /></button>
                        </div>
                    );
                })}
            </section>

            {abierto && (
                <form onSubmit={crear} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {habitos.length > 0 && (
                        <label className="field"><span className="field-label">De un hábito (opcional)</span>
                            <select className="input" value={habitoId} onChange={e => elegirHabito(e.target.value)}>
                                <option value="">Ninguno</option>
                                {habitos.map(h => <option key={h.id} value={h.id}>{h.emoji} {h.nombre}</option>)}
                            </select></label>
                    )}
                    <label className="field"><span className="field-label">¿Qué te recuerdo?</span>
                        <input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Toma agua, Pausa activa, Pastilla" required /></label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {EMOJIS.map(em => <button type="button" key={em} className={`chip ${emoji === em ? 'on' : ''}`} aria-pressed={emoji === em} onClick={() => setEmoji(em)} style={{ fontSize: 18 }}>{em}</button>)}
                    </div>
                    <div className="seg" role="tablist" aria-label="Tipo de recordatorio" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <span className="thumb" style={{ width: 'calc((100% - 8px) / 3)', left: 4, transform: `translateX(${['hora', 'intervalo', 'unico'].indexOf(tipo) * 100}%)` }} />
                        <button type="button" className={tipo === 'hora' ? 'on' : ''} onClick={() => setTipo('hora')}>Hora fija</button>
                        <button type="button" className={tipo === 'intervalo' ? 'on' : ''} onClick={() => setTipo('intervalo')}>Repetir</button>
                        <button type="button" className={tipo === 'unico' ? 'on' : ''} onClick={() => setTipo('unico')}>Una vez</button>
                    </div>
                    {tipo === 'intervalo' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                            <label className="field"><span className="field-label">Cada (min)</span>
                                <input className="input num" type="number" min="15" step="15" value={cadaMin} onChange={e => setCadaMin(e.target.value)} /></label>
                            <label className="field"><span className="field-label">Desde</span>
                                <input className="input" type="time" value={desde} onChange={e => setDesde(e.target.value)} /></label>
                            <label className="field"><span className="field-label">Hasta</span>
                                <input className="input" type="time" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: tipo === 'unico' ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 10 }}>
                            {tipo === 'unico' && <label className="field"><span className="field-label">Fecha</span><input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></label>}
                            <label className="field"><span className="field-label">Hora</span><input className="input" type="time" value={hora} onChange={e => setHora(e.target.value)} required /></label>
                        </div>
                    )}
                    {tipo !== 'unico' && (
                        <div className="field">
                            <span className="field-label">Días ({describirDias(dias)})</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {DIAS.map(d => {
                                    const on = dias.includes(d.v);
                                    return <button type="button" key={d.v} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setDias(on ? dias.filter(x => x !== d.v) : [...dias, d.v])} style={{ flex: 1, justifyContent: 'center', padding: 0 }}>{d.l}</button>;
                                })}
                            </div>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary">Crear recordatorio</button>
                </form>
            )}

            <section className="rise d4" style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Tus recordatorios</h2>
                {propios.length === 0 ? (
                    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Aún no tienes. Empieza con uno de estos:</span>
                        {SUGERENCIAS.map(s => (
                            <button type="button" key={s.titulo} className="chip" onClick={() => usarSugerencia(s)} style={{ justifyContent: 'flex-start', height: 'auto', padding: '10px 14px', textAlign: 'left' }}>
                                <span style={{ fontSize: 18 }}>{s.emoji}</span>
                                <span style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontSize: 14 }}>{s.titulo}</b><span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{describirRecordatorio(s)}</span></span>
                            </button>
                        ))}
                    </div>
                ) : propios.map(r => {
                    const activo = r.activo !== false;
                    const habito = r.habitoId ? habitos.find(h => h.id === r.habitoId) : null;
                    return (
                        <article key={r.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: activo ? 1 : .55 }}>
                            <span className="tile" style={{ background: 'var(--primary-soft)', fontSize: 20 }} aria-hidden="true">{r.emoji || <Bell size={18} />}</span>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{describirRecordatorio(r)}{habito ? ' · no avisa si ya lo hiciste' : ''}{r.origen === 'ia' ? ' · creado por la IA' : ''}</span>
                            </div>
                            <button type="button" onClick={() => genericUpdate('recordatorios', r.id, { activo: !activo })} aria-pressed={activo} aria-label={activo ? `Pausar ${r.titulo}` : `Activar ${r.titulo}`} style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer' }}><Switch on={activo} /></button>
                            <button type="button" onClick={() => { if (window.confirm(`¿Eliminar "${r.titulo}"?`)) genericDelete('recordatorios', r.id); }} aria-label={`Eliminar ${r.titulo}`} style={{ width: 32, height: 40, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}>
                                <Trash2 size={16} aria-hidden="true" />
                            </button>
                        </article>
                    );
                })}
                <p style={{ margin: '4px 2px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' }}>
                    Los avisos se programan en tu iPhone cada vez que abres la app (iOS guarda hasta 64). Si pasas varios días sin abrirla, los más lejanos se programan la próxima vez que entres.
                </p>
            </section>
        </div>
    );
};
