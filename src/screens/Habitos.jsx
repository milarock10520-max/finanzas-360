import { useState } from 'react';
import { Trash2, Flame, Sun, BookOpen, Check, Droplet, Footprints, Flower2, Dumbbell, CigaretteOff, Salad, Moon, PenLine, Brain, Star, Heart } from 'lucide-react';
import { ScreenHeader, Ring } from '../ui/f360.jsx';
import { PlusToggle } from '../components/comunes';
import { HABIT_EMOJIS, calcStreak, dateKey } from '../lib/finanzas';

// =============================================
// === COMPONENTE: HÁBITOS (RASTREADOR) ===
// =============================================
// Íconos Lucide equivalentes a los emojis guardados en cada hábito (compatibilidad con datos existentes).
export const HABIT_ICONS = {
    '💧': Droplet, '🏃': Footprints, '🧘': Flower2, '📚': BookOpen, '💪': Dumbbell, '🚭': CigaretteOff,
    '🥗': Salad, '😴': Moon, '🙏': Heart, '✍️': PenLine, '☀️': Sun, '🧠': Brain,
};
export const HabitIcon = ({ emoji, size = 20 }) => {
    const Icon = HABIT_ICONS[emoji] || Star;
    return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
};
// Colores del hábito → tokens del sistema (las claves se mantienen por compatibilidad).
export const HABIT_COLORS = {
    indigo: { label: 'Azul', color: 'var(--primary)', soft: 'var(--primary-soft)', swatch: '#3355FF' },
    cyan: { label: 'Cian', color: 'var(--cyan)', soft: 'var(--income-soft)', swatch: '#06B6D4' },
    emerald: { label: 'Verde', color: 'var(--income)', soft: 'var(--income-soft)', swatch: '#059669' },
    amber: { label: 'Ámbar', color: 'var(--warn)', soft: 'var(--warn-soft)', swatch: '#D97706' },
    violet: { label: 'Violeta', color: 'var(--violet)', soft: 'var(--violet-soft)', swatch: '#7C3AED' },
    rose: { label: 'Rosa', color: 'var(--expense)', soft: 'var(--expense-soft)', swatch: '#E11D48' },
};

export const HabitTracker = ({ habitos, genericAdd, genericUpdate, genericDelete, onBack }) => {
    const [nombre, setNombre] = useState('');
    const [emoji, setEmoji] = useState(HABIT_EMOJIS[0]);
    const [color, setColor] = useState('indigo');
    const [formOpen, setFormOpen] = useState(habitos.length === 0);

    const hoy = dateKey();
    const diaNombre = new Date().toLocaleDateString('es-CO', { weekday: 'long' });

    const agregarHabito = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await genericAdd('habitos', { nombre: nombre.trim(), emoji, color, historial: [], createdAt: new Date().toISOString() });
        setNombre(''); setEmoji(HABIT_EMOJIS[0]); setColor('indigo'); setFormOpen(false);
    };

    const toggleHoy = async (h) => {
        const set = new Set(h.historial || []);
        if (set.has(hoy)) set.delete(hoy); else set.add(hoy);
        await genericUpdate('habitos', h.id, { historial: Array.from(set) });
    };

    // Últimos 7 días (de más antiguo a hoy)
    const dias7 = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dias7.push(dateKey(d)); }

    const hechos = habitos.filter(h => (h.historial || []).includes(hoy)).length;
    const total = habitos.length;
    const mensaje = total === 0 ? 'Crea tu primer hábito'
        : hechos === total ? '¡Día perfecto! Racha en marcha'
        : hechos === 0 ? 'Empieza con el más fácil'
        : 'Vas muy bien, sigue así';

    return (
        <div>
            <ScreenHeader title="Hábitos" onBack={onBack} right={<PlusToggle open={formOpen} onClick={() => setFormOpen(v => !v)} label="Nuevo hábito" />} />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
                <div className="orb" style={{ width: 200, height: 200, right: -80, bottom: -100, background: '#22D3EE', opacity: .45 }} />
                <div className="grid-lines" />
                <Ring pct={total ? hechos / total : 0} size={96} stroke={9} color="#22D3EE" track="rgba(255,255,255,.1)">
                    <span className="num" style={{ fontSize: 22, fontWeight: 700 }} aria-label={`${hechos} de ${total} hábitos completados hoy`}>{hechos}/{total}</span>
                </Ring>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Hoy, {diaNombre}</span>
                    <span className="display" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{mensaje}</span>
                </div>
            </section>

            {formOpen && (
                <form onSubmit={agregarHabito} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label className="field"><span className="field-label">Nuevo hábito</span>
                        <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Tomar 2L de agua, Leer 20 min" required /></label>
                    <div className="field">
                        <span className="field-label">Ícono</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
                            {HABIT_EMOJIS.map(em => {
                                const on = emoji === em;
                                return (
                                    <button type="button" key={em} onClick={() => setEmoji(em)} aria-pressed={on} aria-label={`Ícono ${em}`}
                                        style={{ height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', cursor: 'pointer', border: `1px solid ${on ? 'var(--primary)' : 'var(--line)'}`, background: on ? 'var(--primary-soft)' : 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--text-2)', transition: 'all .3s var(--spring)' }}>
                                        <HabitIcon emoji={em} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="field">
                        <span className="field-label">Color</span>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {Object.entries(HABIT_COLORS).map(([k, c]) => {
                                const on = color === k;
                                return (
                                    <button type="button" key={k} onClick={() => setColor(k)} aria-label={c.label} aria-pressed={on}
                                        style={{ width: 44, height: 44, borderRadius: 14, border: 0, cursor: 'pointer', background: c.swatch, boxShadow: on ? `0 0 0 3px var(--surface), 0 0 0 5px ${c.swatch}` : 'none', transform: on ? 'scale(1.06)' : 'none', transition: 'box-shadow .3s, transform .3s var(--spring)' }} />
                                );
                            })}
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary">Crear hábito</button>
                </form>
            )}

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {habitos.length === 0 && !formOpen && (
                    <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 24, fontSize: 14 }}>Aún no tienes hábitos. Toca + para crear el primero.</p>
                )}
                {habitos.map((h, i) => {
                    const set = new Set(h.historial || []);
                    const on = set.has(hoy);
                    const streak = calcStreak(h.historial);
                    const c = HABIT_COLORS[h.color] || HABIT_COLORS.indigo;
                    return (
                        <article key={h.id} className="card rise" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animationDelay: `${0.2 + i * 0.08}s` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className="tile" style={{ background: c.soft, color: c.color }}><HabitIcon emoji={h.emoji} /></span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 15, fontWeight: 800 }}>{h.nombre}</span>
                                    <span style={{ fontSize: 13, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <Flame size={13} strokeWidth={2} color={streak > 0 ? 'var(--warn)' : 'currentColor'} aria-hidden="true" />
                                        {streak} {streak === 1 ? 'día' : 'días'} de racha
                                    </span>
                                </div>
                                <button type="button" onClick={() => { if (window.confirm(`¿Eliminar el hábito "${h.nombre}"?`)) genericDelete('habitos', h.id); }}
                                    aria-label={`Eliminar ${h.nombre}`} style={{ width: 36, height: 44, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer' }}>
                                    <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => toggleHoy(h)} aria-pressed={on} aria-label={on ? `Desmarcar ${h.nombre}` : `Marcar ${h.nombre} como hecho`}
                                    style={{ width: 48, height: 48, borderRadius: 16, cursor: 'pointer', display: 'grid', placeItems: 'center', border: `1.5px solid ${on ? 'transparent' : 'var(--line)'}`, background: on ? c.color : 'var(--surface-2)', color: on ? 'var(--on-accent)' : 'var(--text-3)', transition: 'all .45s var(--spring)', transform: on ? 'scale(1.08) rotate(-6deg)' : 'none' }}>
                                    <Check size={22} strokeWidth={2.6} aria-hidden="true" style={{ opacity: on ? 1 : .35, transition: 'opacity .3s' }} />
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                                {dias7.map(dk => {
                                    const done = set.has(dk);
                                    const esHoy = dk === hoy;
                                    const dow = new Date(`${dk}T00:00:00`).toLocaleDateString('es-CO', { weekday: 'narrow' }).toUpperCase();
                                    return (
                                        <div key={dk} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 11, fontWeight: 800, color: esHoy ? 'var(--text)' : 'var(--text-3)' }}>{dow}</span>
                                            <span style={{ width: '100%', height: 8, borderRadius: 99, background: done ? c.color : (esHoy ? 'var(--line)' : 'var(--surface-2)'), transition: 'background .4s' }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};
