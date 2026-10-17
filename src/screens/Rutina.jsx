import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Sparkles, Bell, BellOff, X, ListTodo, CalendarClock, ChevronRight } from 'lucide-react';
import { recordatoriosActivos, setRecordatoriosActivos } from '../native/recordatoriosRutina';
import { ScreenHeader, BottomSheet } from '../ui/f360.jsx';
import { PlusToggle } from '../components/comunes';

// =============================================
// === RUTINA SEMANAL (calendario de rutinas) ===
// =============================================

// Días en orden visual Lun→Dom; id sigue la convención de Date.getDay() (0=Dom).
export const DIAS_SEMANA = [
    { id: 1, label: 'Lunes', corto: 'L' },
    { id: 2, label: 'Martes', corto: 'M' },
    { id: 3, label: 'Miércoles', corto: 'X' },
    { id: 4, label: 'Jueves', corto: 'J' },
    { id: 5, label: 'Viernes', corto: 'V' },
    { id: 6, label: 'Sábado', corto: 'S' },
    { id: 0, label: 'Domingo', corto: 'D' },
];

// Clases completas (no interpolar: el JIT de Tailwind necesita verlas literales).
export const RUTINA_COLORS = {
    amarillo: { bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-400' },
    verde: { bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-400' },
    azul: { bg: 'bg-sky-100', border: 'border-sky-200', text: 'text-sky-800', dot: 'bg-sky-400' },
    morado: { bg: 'bg-violet-100', border: 'border-violet-200', text: 'text-violet-800', dot: 'bg-violet-400' },
    rosa: { bg: 'bg-pink-100', border: 'border-pink-200', text: 'text-pink-800', dot: 'bg-pink-400' },
    naranja: { bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400' },
    gris: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' },
};

export const RUTINA_EMOJIS = ['🌅', '💧', '🏋️', '🧘', '🏃', '🍳', '💻', '🥗', '🚶', '📊', '📚', '🎓', '🎸', '☕', '💪', '🍽️', '📝', '📖', '✅', '🌙', '😴', '📌'];

export const horaToMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// La grilla cubre 05:00–23:00 en pasos de 30 min: fila 1 = header, filas 2..37 = slots.
export const RUTINA_MIN_INICIO = 5 * 60;
export const RUTINA_MIN_FIN = 23 * 60;
export const rowFromHora = (hhmm) => {
    const min = Math.min(Math.max(horaToMin(hhmm), RUTINA_MIN_INICIO), RUTINA_MIN_FIN);
    return (min - RUTINA_MIN_INICIO) / 30 + 2;
};

// Opciones de hora en pasos de 30 min para los selects del editor.
export const HORAS_RUTINA = [];
for (let m = RUTINA_MIN_INICIO; m <= RUTINA_MIN_FIN; m += 30) {
    HORAS_RUTINA.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}

// Plantilla inicial basada en el "Plan Semanal de Alto Rendimiento" del usuario.
export const PLANTILLA_RUTINA = [
    { titulo: 'Levantarse + Agua', emoji: '🌅', color: 'amarillo', dias: [1, 2, 3, 4, 5], horaInicio: '05:30', horaFin: '06:30' },
    { titulo: 'Gimnasio (Fuerza)', emoji: '🏋️', color: 'verde', dias: [1, 3, 5], horaInicio: '06:30', horaFin: '07:30' },
    { titulo: 'Movilidad + Caminata', emoji: '🧘', color: 'verde', dias: [2], horaInicio: '06:30', horaFin: '07:30' },
    { titulo: 'Cardio (Correr/Bici)', emoji: '🏃', color: 'verde', dias: [4], horaInicio: '06:30', horaFin: '07:30' },
    { titulo: 'Desayuno saludable', emoji: '🍳', color: 'naranja', dias: [1, 2, 3, 4, 5], horaInicio: '07:30', horaFin: '08:00' },
    { titulo: 'Trabajo Profundo', emoji: '💻', color: 'azul', dias: [1, 2, 3, 4, 5], horaInicio: '08:00', horaFin: '12:00' },
    { titulo: 'Almuerzo + Caminata', emoji: '🥗', color: 'naranja', dias: [1, 2, 3, 4, 5], horaInicio: '12:00', horaFin: '13:00' },
    { titulo: 'Trabajo / Reuniones', emoji: '📊', color: 'azul', dias: [1, 2, 3, 4, 5], horaInicio: '13:00', horaFin: '17:30' },
    { titulo: 'Lectura Técnica', emoji: '📚', color: 'morado', dias: [1, 3, 5], horaInicio: '17:30', horaFin: '18:30' },
    { titulo: 'Estudio / Aprender', emoji: '🎓', color: 'morado', dias: [2, 4], horaInicio: '17:30', horaFin: '18:30' },
    { titulo: 'Instrumento musical', emoji: '🎸', color: 'rosa', dias: [1, 4], horaInicio: '18:30', horaFin: '20:00' },
    { titulo: 'Tiempo personal', emoji: '☕', color: 'rosa', dias: [2, 5], horaInicio: '18:30', horaFin: '20:00' },
    { titulo: 'Gimnasio ligero', emoji: '💪', color: 'rosa', dias: [3], horaInicio: '18:30', horaFin: '20:00' },
    { titulo: 'Cena + Desconectar', emoji: '🍽️', color: 'naranja', dias: [1, 2, 3, 4, 5], horaInicio: '20:00', horaFin: '21:00' },
    { titulo: 'Planificación + Notas', emoji: '📝', color: 'gris', dias: [1], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Lectura personal', emoji: '📖', color: 'gris', dias: [2], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Revisión de lo aprendido', emoji: '✅', color: 'gris', dias: [3], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Meditación + Relajación', emoji: '🧘', color: 'gris', dias: [4], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Revisión semanal', emoji: '✅', color: 'gris', dias: [5], horaInicio: '21:00', horaFin: '22:00' },
    { titulo: 'Rutina de sueño', emoji: '🌙', color: 'gris', dias: [1, 2, 3, 4, 5], horaInicio: '22:00', horaFin: '22:30' },
    { titulo: 'Dormir', emoji: '😴', color: 'gris', dias: [1, 2, 3, 4, 5], horaInicio: '22:30', horaFin: '23:00' },
];

export const BloqueEditorModal = ({ editor, onClose, onSave, onDelete, googleToken, onCalendar, onTask, gFeedback }) => {
    const esNuevo = editor.mode === 'new';
    const base = esNuevo ? editor.defaults : editor.bloque;
    const [titulo, setTitulo] = useState(base.titulo || '');
    const [emoji, setEmoji] = useState(base.emoji || '📌');
    const [color, setColor] = useState(base.color || 'azul');
    const [dias, setDias] = useState([base.dia ?? 1]);
    const [horaInicio, setHoraInicio] = useState(base.horaInicio || '08:00');
    const [horaFin, setHoraFin] = useState(base.horaFin || '09:00');
    const [notas, setNotas] = useState(base.notas || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const toggleDia = (id) => {
        setDias(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!titulo.trim()) { setError('Ponle un nombre a la actividad.'); return; }
        if (horaToMin(horaFin) <= horaToMin(horaInicio)) { setError('La hora de fin debe ser mayor que la de inicio.'); return; }
        if (esNuevo && dias.length === 0) { setError('Elige al menos un día.'); return; }
        setSaving(true);
        await onSave({ titulo: titulo.trim(), emoji, color, horaInicio, horaFin, notas }, esNuevo ? dias : [dias[0]]);
        setSaving(false);
        onClose();
    };

    const SWATCH_RUTINA = { amarillo: '#F59E0B', verde: '#10B981', azul: '#3355FF', morado: '#7C3AED', rosa: '#E11D48', naranja: '#F97316', gris: '#64748B' };

    return (
        <BottomSheet open onClose={onClose} label={esNuevo ? 'Nuevo bloque' : 'Editar bloque'}>
            <form onSubmit={handleSubmit} style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{esNuevo ? 'Nuevo bloque' : 'Editar bloque'}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
                </header>

                <label className="field"><span className="field-label">Actividad</span>
                    <input className="input" placeholder="Ej: Gimnasio, Lectura…" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>

                <div className="field">
                    <span className="field-label">Ícono</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 6 }}>
                        {RUTINA_EMOJIS.map(em => (
                            <button type="button" key={em} onClick={() => setEmoji(em)} aria-pressed={emoji === em}
                                style={{ height: 40, borderRadius: 12, fontSize: 19, cursor: 'pointer', border: `1px solid ${emoji === em ? 'var(--primary)' : 'transparent'}`, background: emoji === em ? 'var(--primary-soft)' : 'var(--surface-2)' }}>{em}</button>
                        ))}
                    </div>
                </div>

                <div className="field">
                    <span className="field-label">Color</span>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {Object.keys(RUTINA_COLORS).map(key => (
                            <button type="button" key={key} onClick={() => setColor(key)} aria-label={key} aria-pressed={color === key}
                                style={{ width: 40, height: 40, borderRadius: 13, border: 0, cursor: 'pointer', background: SWATCH_RUTINA[key], boxShadow: color === key ? `0 0 0 3px var(--surface), 0 0 0 5px ${SWATCH_RUTINA[key]}` : 'none', transform: color === key ? 'scale(1.06)' : 'none', transition: 'box-shadow .3s, transform .3s var(--spring)' }} />
                        ))}
                    </div>
                </div>

                <div className="field">
                    <span className="field-label">{esNuevo ? 'Días (elige varios)' : 'Día'}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                        {DIAS_SEMANA.map(d => {
                            const on = dias.includes(d.id);
                            return (
                                <button type="button" key={d.id} onClick={() => esNuevo ? toggleDia(d.id) : setDias([d.id])} aria-pressed={on} aria-label={d.label}
                                    style={{ height: 44, borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 0, background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'var(--on-primary)' : 'var(--text-3)', transition: 'all .3s var(--spring)' }}>{d.corto}</button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <label className="field"><span className="field-label">Inicio</span>
                        <select className="input num" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}>{HORAS_RUTINA.slice(0, -1).map(h => <option key={h} value={h}>{h}</option>)}</select></label>
                    <label className="field"><span className="field-label">Fin</span>
                        <select className="input num" value={horaFin} onChange={(e) => setHoraFin(e.target.value)}>{HORAS_RUTINA.slice(1).map(h => <option key={h} value={h}>{h}</option>)}</select></label>
                </div>

                <label className="field"><span className="field-label">Notas</span>
                    <textarea className="input" placeholder="Opcional" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} style={{ height: 'auto', padding: 14, resize: 'none', lineHeight: 1.4 }} /></label>

                {error && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--expense)' }}>{error}</p>}

                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
                    {!esNuevo && (
                        <button type="button" className="btn btn-ghost" aria-label="Eliminar bloque" style={{ color: 'var(--expense)', width: 54, padding: 0 }}
                            onClick={() => { if (window.confirm('¿Eliminar este bloque?')) { onDelete(editor.bloque); onClose(); } }}>
                            <Trash2 size={18} aria-hidden="true" />
                        </button>
                    )}
                </div>

                {!esNuevo && (
                    <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {!googleToken ? (
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>Conecta Google en Agenda para enviar este bloque a Calendar o Tasks.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCalendar(editor.bloque)} disabled={gFeedback.calendar === 'loading'} style={{ color: 'var(--primary)' }}>
                                    <Calendar size={16} aria-hidden="true" /> {gFeedback.calendar === 'ok' ? 'Enviado' : gFeedback.calendar === 'loading' ? 'Enviando…' : 'A Calendar'}
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTask(editor.bloque)} disabled={gFeedback.task === 'loading'} style={{ color: 'var(--cyan)' }}>
                                    <ListTodo size={16} aria-hidden="true" /> {gFeedback.task === 'ok' ? 'Creada' : gFeedback.task === 'loading' ? 'Creando…' : 'A Tasks'}
                                </button>
                            </div>
                        )}
                        {gFeedback.error && <p style={{ margin: 0, fontSize: 13, color: 'var(--expense)', textAlign: 'center' }}>{gFeedback.error}</p>}
                    </div>
                )}
            </form>
        </BottomSheet>
    );
};

export const RutinaSemanal = ({ rutina, genericAdd, genericUpdate, genericDelete, googleToken, onBack }) => {
    const [editorState, setEditorState] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const [diaMovil, setDiaMovil] = useState(new Date().getDay());
    const [gFeedback, setGFeedback] = useState({});
    const hoy = new Date().getDay();

    // Campana de recordatorios: espejo del ajuste por dispositivo (sin props nuevas;
    // el módulo de recordatorios emite un CustomEvent al cambiar desde aquí o el tray).
    const [notifOn, setNotifOn] = useState(recordatoriosActivos());
    useEffect(() => {
        const h = (e) => setNotifOn(e.detail);
        window.addEventListener('recordatorios:changed', h);
        return () => window.removeEventListener('recordatorios:changed', h);
    }, []);

    const colDeDia = (dia) => DIAS_SEMANA.findIndex(d => d.id === dia) + 2;

    // Orden estable para la cascada de entrada (por columna y hora).
    const bloquesOrdenados = [...rutina].sort((a, b) =>
        (colDeDia(a.dia) - colDeDia(b.dia)) || (horaToMin(a.horaInicio) - horaToMin(b.horaInicio))
    );

    const handleSave = async (datos, dias) => {
        if (editorState?.mode === 'edit') {
            await genericUpdate('rutina', editorState.bloque.id, { ...datos, dia: dias[0] });
        } else {
            for (const dia of dias) {
                await genericAdd('rutina', { ...datos, dia, createdAt: new Date().toISOString() });
            }
        }
    };

    const handleDelete = (bloque) => genericDelete('rutina', bloque.id);

    const usarPlantilla = async () => {
        setSeeding(true);
        try {
            for (const b of PLANTILLA_RUTINA) {
                for (const dia of b.dias) {
                    await genericAdd('rutina', {
                        titulo: b.titulo, emoji: b.emoji, color: b.color, dia,
                        horaInicio: b.horaInicio, horaFin: b.horaFin, notas: '',
                        createdAt: new Date().toISOString()
                    });
                }
            }
        } finally {
            setSeeding(false);
        }
    };

    // Próxima fecha real en la que cae este día/hora (si ya pasó, la semana que viene).
    const proximaOcurrencia = (dia, hhmm) => {
        const [h, m] = hhmm.split(':').map(Number);
        const d = new Date();
        d.setDate(d.getDate() + ((dia - d.getDay() + 7) % 7));
        d.setHours(h, m, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 7);
        return d;
    };

    const enviarACalendar = async (bloque) => {
        setGFeedback({ calendar: 'loading' });
        try {
            const inicio = proximaOcurrencia(bloque.dia, bloque.horaInicio);
            const fin = new Date(inicio.getTime() + (horaToMin(bloque.horaFin) - horaToMin(bloque.horaInicio)) * 60000);
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: `${bloque.emoji} ${bloque.titulo}`,
                    description: bloque.notas || 'Bloque de mi rutina semanal (Finanzas 360)',
                    start: { dateTime: inicio.toISOString(), timeZone },
                    end: { dateTime: fin.toISOString(), timeZone },
                })
            });
            if (!res.ok) throw new Error(res.status === 401 ? 'Reconecta Google en la pestaña Agenda.' : 'Google rechazó el evento.');
            setGFeedback({ calendar: 'ok' });
        } catch (e) {
            setGFeedback({ error: e.message });
        }
    };

    const crearGoogleTask = async (bloque) => {
        setGFeedback({ task: 'loading' });
        try {
            const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
                method: 'POST',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `${bloque.emoji} ${bloque.titulo}`,
                    notes: bloque.notas || 'Bloque de mi rutina semanal',
                    due: proximaOcurrencia(bloque.dia, bloque.horaInicio).toISOString(),
                })
            });
            if (!res.ok) throw new Error(res.status === 401 ? 'Reconecta Google en la pestaña Agenda.' : 'Google rechazó la tarea.');
            setGFeedback({ task: 'ok' });
        } catch (e) {
            setGFeedback({ error: e.message });
        }
    };

    const abrirNuevo = (defaults = {}) => {
        setGFeedback({});
        setEditorState({ mode: 'new', defaults: { dia: hoy, horaInicio: '08:00', horaFin: '09:00', ...defaults } });
    };
    const abrirEdicion = (bloque) => {
        setGFeedback({});
        setEditorState({ mode: 'edit', bloque });
    };

    const bloquesDelDia = (dia) => rutina.filter(b => b.dia === dia).sort((a, b) => horaToMin(a.horaInicio) - horaToMin(b.horaInicio));

    // Color del bloque → tokens del sistema.
    const TONO_RUTINA = {
        amarillo: ['var(--warn-soft)', 'var(--warn)'], naranja: ['var(--warn-soft)', 'var(--warn)'],
        verde: ['var(--income-soft)', 'var(--income)'], azul: ['var(--primary-soft)', 'var(--primary)'],
        morado: ['var(--violet-soft)', 'var(--violet)'], rosa: ['var(--expense-soft)', 'var(--expense)'],
        gris: ['var(--surface-2)', 'var(--text-2)'],
    };
    const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();
    const bloquesHoy = bloquesDelDia(hoy);
    const actual = bloquesHoy.find(b => horaToMin(b.horaInicio) <= ahoraMin && ahoraMin < horaToMin(b.horaFin));
    const siguiente = bloquesHoy.find(b => horaToMin(b.horaInicio) > ahoraMin);
    const diaHoyLabel = (DIAS_SEMANA.find(d => d.id === hoy) || {}).label || '';

    return (
        <div>
            <ScreenHeader title="Rutina" onBack={onBack} right={
                <>
                    <button type="button" className="icon-btn" onClick={() => setRecordatoriosActivos(!notifOn)} aria-pressed={notifOn}
                        aria-label={notifOn ? 'Desactivar recordatorios' : 'Activar recordatorios'}
                        style={notifOn ? { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'transparent' } : undefined}>
                        {notifOn ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
                    </button>
                    <PlusToggle open={false} onClick={() => abrirNuevo({ dia: diaMovil })} label="Nuevo bloque" />
                </>
            } />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="orb" style={{ width: 200, height: 200, right: -80, top: -100, background: '#22D3EE', opacity: .45 }} />
                <div className="grid-lines" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Hoy, {diaHoyLabel.toLowerCase()} · {bloquesHoy.length} bloques</span>
                    {actual && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}><span className="live" />Ahora</span>}
                </div>
                <span className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                    {actual ? actual.titulo : siguiente ? `Sigue: ${siguiente.titulo}` : rutina.length ? 'Sin más bloques por hoy' : 'Diseña tu semana ideal'}
                </span>
                <span className="num" style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', letterSpacing: 0 }}>
                    {actual ? `${actual.horaInicio} – ${actual.horaFin}` : siguiente ? `A las ${siguiente.horaInicio}` : 'Toca + para añadir un bloque'}
                </span>
            </section>

            {rutina.length === 0 && !seeding && (
                <section className="card rise d3" style={{ marginTop: 14, padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)', animation: 'floaty 4s ease-in-out infinite' }}><CalendarClock size={28} aria-hidden="true" /></div>
                    <h2 className="display" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Tu semana está en blanco</h2>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>Empieza con la plantilla de alto rendimiento (gimnasio, trabajo profundo, lectura, sueño…) o crea tus bloques desde cero.</p>
                    <button type="button" className="btn btn-primary" onClick={usarPlantilla} disabled={seeding} style={{ width: '100%' }}>
                        <Sparkles size={18} aria-hidden="true" /> Usar plantilla
                    </button>
                </section>
            )}
            {seeding && <p style={{ marginTop: 14, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Creando rutina…</p>}

            {rutina.length > 0 && (
                <>
                    {/* ===== Grilla semanal (escritorio) ===== */}
                    <div className="hidden md:block card rise d3" style={{ marginTop: 14, padding: 20, overflowX: 'auto' }}>
                        <div className="min-w-[860px]" style={{ display: 'grid', gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(36, 1.35rem)', gap: '2px' }}>
                            <div style={{ gridColumn: 1, gridRow: 1 }} />
                            {DIAS_SEMANA.map(d => (
                                <div key={d.id} className="eyebrow" style={{ gridColumn: colDeDia(d.id), gridRow: 1, textAlign: 'center', paddingBottom: 8, color: d.id === hoy ? 'var(--primary)' : undefined }}>{d.label}</div>
                            ))}
                            {HORAS_RUTINA.filter(h => h.endsWith(':00')).map(h => (
                                <div key={`t-${h}`} className="num" style={{ gridColumn: 1, gridRow: `${rowFromHora(h)} / span 2`, fontSize: 10, color: 'var(--text-3)', textAlign: 'right', paddingRight: 8, borderTop: '1px solid var(--line)', letterSpacing: 0 }}>{h}</div>
                            ))}
                            {DIAS_SEMANA.map(d => HORAS_RUTINA.filter(h => h.endsWith(':00')).map(h => (
                                <button key={`empty-${d.id}-${h}`} type="button" aria-label={`Nuevo bloque ${d.label} ${h}`}
                                    onClick={() => abrirNuevo({ dia: d.id, horaInicio: h, horaFin: HORAS_RUTINA[HORAS_RUTINA.indexOf(h) + 2] || '23:00' })}
                                    style={{ gridColumn: colDeDia(d.id), gridRow: `${rowFromHora(h)} / span 2`, zIndex: 0, borderRadius: 8, border: 0, borderTop: '1px solid var(--line)', background: d.id === hoy ? 'var(--primary-soft)' : 'transparent', cursor: 'pointer' }} />
                            )))}
                            {bloquesOrdenados.map((b, i) => {
                                const [soft, color] = TONO_RUTINA[b.color] || TONO_RUTINA.gris;
                                const filas = rowFromHora(b.horaFin) - rowFromHora(b.horaInicio);
                                return (
                                    <button key={b.id} type="button" onClick={() => abrirEdicion(b)} className="rise"
                                        style={{ gridColumn: colDeDia(b.dia), gridRow: `${rowFromHora(b.horaInicio)} / ${rowFromHora(b.horaFin)}`, zIndex: 10, animationDelay: `${i * 20}ms`, borderRadius: 12, border: 0, borderLeft: `3px solid ${color}`, background: soft, color: 'var(--text)', padding: '4px 6px', textAlign: 'left', overflow: 'hidden', cursor: 'pointer' }}>
                                        <span style={{ display: 'block', fontSize: 11, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.emoji} {b.titulo}</span>
                                        {filas >= 3 && <span className="num" style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: 0 }}>{b.horaInicio} – {b.horaFin}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ===== Vista por día (móvil) ===== */}
                    <div className="md:hidden">
                        <div className="rise d3" role="tablist" aria-label="Día de la semana" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                            {DIAS_SEMANA.map(d => {
                                const on = diaMovil === d.id;
                                return (
                                    <button key={d.id} type="button" role="tab" aria-selected={on} aria-label={d.label} onClick={() => setDiaMovil(d.id)}
                                        style={{ height: 48, borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all .3s var(--spring)', border: `1px solid ${on ? 'transparent' : 'var(--line)'}`, background: on ? 'var(--primary)' : d.id === hoy ? 'var(--primary-soft)' : 'var(--surface)', color: on ? 'var(--on-primary)' : d.id === hoy ? 'var(--primary)' : 'var(--text-3)', boxShadow: on ? '0 10px 24px -10px var(--glow)' : 'none' }}>
                                        {d.corto}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {bloquesDelDia(diaMovil).length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--text-3)', margin: '16px 0', fontSize: 14 }}>Sin bloques este día.</p>
                            )}
                            {bloquesDelDia(diaMovil).map((b, i) => {
                                const [soft, color] = TONO_RUTINA[b.color] || TONO_RUTINA.gris;
                                const enCurso = diaMovil === hoy && b === actual;
                                return (
                                    <button key={b.id} type="button" onClick={() => abrirEdicion(b)} className="card lift rise"
                                        style={{ animationDelay: `${0.2 + i * 0.04}s`, width: '100%', padding: 14, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'var(--text)', cursor: 'pointer', ...(enCurso ? { borderColor: color } : {}) }}>
                                        <span className="tile" style={{ background: soft, color, fontSize: 20 }}>{b.emoji}</span>
                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titulo}</span>
                                            <span className="num" style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 0 }}>{b.horaInicio} – {b.horaFin}</span>
                                        </span>
                                        {enCurso ? <span className="live" aria-label="En curso" /> : <ChevronRight size={18} color="var(--text-3)" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                            <button type="button" onClick={() => abrirNuevo({ dia: diaMovil })} className="btn btn-outline" style={{ borderStyle: 'dashed', color: 'var(--text-3)' }}>
                                <Plus size={18} aria-hidden="true" /> Añadir bloque
                            </button>
                        </div>
                    </div>
                </>
            )}

            {editorState && (
                <BloqueEditorModal
                    key={editorState.mode === 'edit' ? editorState.bloque.id : 'nuevo'}
                    editor={editorState}
                    onClose={() => setEditorState(null)}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    googleToken={googleToken}
                    onCalendar={enviarACalendar}
                    onTask={crearGoogleTask}
                    gFeedback={gFeedback}
                />
            )}
        </div>
    );
};
