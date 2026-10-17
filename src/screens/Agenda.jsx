import { useState, useEffect } from 'react';
import { Trash2, Calendar, Loader2, RefreshCw, CalendarDays, ListTodo, Clock } from 'lucide-react';
import { ScreenHeader } from '../ui/f360.jsx';
import { PlusToggle } from '../components/comunes';
import { dateKey } from '../lib/finanzas';
import { disconnectGoogle, requestGoogleToken } from '../lib/google';

// =============================================
// === COMPONENTE: PRODUCTIVITY HUB ===
// =============================================
export const ProductivityHub = ({ genericAdd, genericUpdate, genericDelete, googleToken, setGoogleToken, onBack }) => {
    const [activeView, setActiveView] = useState('calendar'); // 'calendar' | 'gtasks'
    const [formOpen, setFormOpen] = useState(false);

    // Calendar
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [eventError, setEventError] = useState('');

    // Google Tasks
    const [gtasks, setGtasks] = useState([]);
    const [loadingGtasks, setLoadingGtasks] = useState(false);
    const [gtaskError, setGtaskError] = useState('');
    const [newGtaskTitle, setNewGtaskTitle] = useState('');
    const [newGtaskDue, setNewGtaskDue] = useState('');
    
    // Formulario Evento
    const [eventTitle, setEventTitle] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventDuration, setEventDuration] = useState('60');

    // Inicializar Google Client (conexión interactiva)
    const handleGoogleLogin = async () => {
        try {
            // Nativo: login de Google dentro de la app (sin Safari). conectarGoogle
            // hace el login nativo, canjea el serverAuthCode en el servidor y
            // devuelve el primer token.
            const { token } = await requestGoogleToken(true);
            setGoogleToken(token);
            fetchEvents(token);
        } catch (e) {
            console.error('Error Google Auth:', e);
            alert('No se pudo conectar con Google. Intenta de nuevo en unos segundos.');
        }
    };

    const fetchEvents = async (token) => {
        if (!token) return;
        setLoadingEvents(true);
        setEventError('');
        try {
            const timeMin = new Date().toISOString();
            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&orderBy=startTime&singleEvents=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401) {
                // Token caducado o revocado: limpiar para volver a "Conectar".
                localStorage.removeItem('google_calendar_token');
                setGoogleToken(null);
                setEvents([]);
                return;
            }
            if (res.status === 403) {
                let detalle = '';
                try { detalle = (await res.json())?.error?.message || ''; } catch (e) { /* sin cuerpo */ }
                if (/has not been used|is disabled|disabled/i.test(detalle)) {
                    setEventError('La API de Google Calendar no está habilitada en tu proyecto de Google Cloud. Actívala en console.cloud.google.com (APIs y servicios → habilitar "Google Calendar API") y vuelve a intentar.');
                } else {
                    setEventError('Reconecta tu cuenta de Google para activar el permiso de Calendar.' + (detalle ? ` (${detalle})` : ''));
                }
                setEvents([]);
                return;
            }
            const data = await res.json();
            setEvents(data.items || []);
        } catch (error) {
            console.error('Error fetching events:', error);
            setEventError('No se pudieron cargar los eventos de Calendar.');
        } finally {
            setLoadingEvents(false);
        }
    };

    useEffect(() => {
        if (googleToken && activeView === 'calendar') fetchEvents(googleToken);
    }, [googleToken, activeView]);

    // --- Google Tasks (API REST) ---
    const GTASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

    const fetchGoogleTasks = async (token) => {
        if (!token) return;
        setLoadingGtasks(true);
        setGtaskError('');
        try {
            const res = await fetch(`${GTASKS_BASE}?showCompleted=false&maxResults=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                // 401 = token sin permiso de Tasks (reconectar). 403 = puede ser API deshabilitada.
                let detalle = '';
                try {
                    const err = await res.json();
                    detalle = err?.error?.message || '';
                } catch (e) { /* sin cuerpo */ }
                if (res.status === 403 && /has not been used|is disabled|disabled/i.test(detalle)) {
                    setGtaskError('La API de Google Tasks no está habilitada en tu proyecto de Google Cloud. Actívala en console.cloud.google.com (APIs y servicios → habilitar "Tasks API") y vuelve a intentar.');
                } else {
                    setGtaskError('Reconecta tu cuenta de Google para activar el permiso de Tasks.' + (detalle ? ` (${detalle})` : ''));
                }
                setGtasks([]);
                return;
            }
            const data = await res.json();
            // Ordenar: las que tienen fecha primero, por fecha; luego el resto.
            const items = (data.items || []).slice().sort((a, b) => {
                if (a.due && b.due) return new Date(a.due) - new Date(b.due);
                if (a.due) return -1;
                if (b.due) return 1;
                return 0;
            });
            setGtasks(items);
        } catch (error) {
            console.error('Error fetching Google Tasks:', error);
            setGtaskError('No se pudieron cargar las tareas de Google.');
        } finally {
            setLoadingGtasks(false);
        }
    };

    useEffect(() => {
        if (googleToken && activeView === 'gtasks') fetchGoogleTasks(googleToken);
    }, [googleToken, activeView]);

    const handleAddGoogleTask = async (e) => {
        e.preventDefault();
        if (!googleToken) return alert('Conecta tu cuenta de Google primero.');
        if (!newGtaskTitle.trim()) return;

        const body = { title: newGtaskTitle.trim() };
        // Google Tasks usa due en formato RFC3339 (solo se respeta la fecha, no la hora).
        if (newGtaskDue) body.due = new Date(`${newGtaskDue}T00:00:00`).toISOString();

        try {
            const res = await fetch(GTASKS_BASE, {
                method: 'POST',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.status === 401 || res.status === 403) {
                let detalle = '';
                try {
                    const err = await res.json();
                    detalle = err?.error?.message || '';
                } catch (e) { /* sin cuerpo */ }
                if (res.status === 403 && /has not been used|is disabled|disabled/i.test(detalle)) {
                    setGtaskError('La API de Google Tasks no está habilitada en tu proyecto de Google Cloud. Actívala en console.cloud.google.com (APIs y servicios → habilitar "Tasks API") y vuelve a intentar.');
                } else {
                    setGtaskError('Reconecta tu cuenta de Google para activar el permiso de Tasks.' + (detalle ? ` (${detalle})` : ''));
                }
                return;
            }
            if (res.ok) {
                setNewGtaskTitle('');
                setNewGtaskDue('');
                setGtaskError('');
                fetchGoogleTasks(googleToken);
            } else {
                alert('No se pudo crear la tarea en Google Tasks.');
            }
        } catch (error) {
            console.error('Error creando Google Task:', error);
        }
    };

    const toggleGoogleTask = async (task) => {
        if (!googleToken) return;
        const nuevoEstado = task.status === 'completed' ? 'needsAction' : 'completed';
        try {
            const res = await fetch(`${GTASKS_BASE}/${task.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nuevoEstado })
            });
            if (res.ok) fetchGoogleTasks(googleToken);
        } catch (error) {
            console.error('Error actualizando Google Task:', error);
        }
    };

    const deleteGoogleTask = async (task) => {
        if (!googleToken) return;
        try {
            const res = await fetch(`${GTASKS_BASE}/${task.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${googleToken}` }
            });
            if (res.ok || res.status === 204) fetchGoogleTasks(googleToken);
        } catch (error) {
            console.error('Error eliminando Google Task:', error);
        }
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        if (!googleToken) return alert('Por favor conecta tu cuenta de Google primero.');
        
        const startDateTime = new Date(`${eventDate}T${eventTime}`);
        const endDateTime = new Date(startDateTime.getTime() + parseInt(eventDuration) * 60000);

        const eventParams = {
            summary: eventTitle,
            start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        };

        try {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventParams)
            });
            if (res.ok) {
                setEventTitle(''); setEventDate(''); setEventTime('');
                fetchEvents(googleToken);
                alert('¡Evento creado en Google Calendar!');
            } else {
                const err = await res.json();
                console.error('Error creando evento', err);
                alert('No se pudo crear el evento.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const esCal = activeView === 'calendar';
    const desconectar = () => { disconnectGoogle(); setGoogleToken(null); setEvents([]); setGtasks([]); };
    const iconBtn = { width: 40, height: 40, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-3)' };
    const GoogleG = () => (
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
    );

    return (
        <div>
            <ScreenHeader title="Agenda" onBack={onBack} right={googleToken ? (
                <>
                    <button type="button" className="icon-btn" onClick={() => esCal ? fetchEvents(googleToken) : fetchGoogleTasks(googleToken)} aria-label="Actualizar"><RefreshCw size={17} aria-hidden="true" /></button>
                    <PlusToggle open={formOpen} onClick={() => setFormOpen(v => !v)} label={esCal ? 'Nuevo evento' : 'Nueva tarea'} />
                </>
            ) : null} />

            <div className="seg rise d2" style={{ marginTop: 18 }} role="tablist" aria-label="Vista de agenda">
                <span className="thumb" style={{ transform: esCal ? 'translateX(0)' : 'translateX(100%)' }} />
                <button type="button" role="tab" aria-selected={esCal} className={esCal ? 'on' : ''} onClick={() => { setActiveView('calendar'); setFormOpen(false); }}><CalendarDays size={16} aria-hidden="true" /> Calendario</button>
                <button type="button" role="tab" aria-selected={!esCal} className={!esCal ? 'on' : ''} onClick={() => { setActiveView('gtasks'); setFormOpen(false); }}><ListTodo size={16} aria-hidden="true" /> Tareas</button>
            </div>

            {!googleToken ? (
                <section className="card rise d3" style={{ marginTop: 14, padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)', animation: 'floaty 4s ease-in-out infinite' }}>
                        {esCal ? <CalendarDays size={28} aria-hidden="true" /> : <ListTodo size={28} aria-hidden="true" />}
                    </div>
                    <h2 className="display" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{esCal ? 'Tu calendario' : 'Tus tareas'}</h2>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>Conecta tu cuenta de Google para ver y crear {esCal ? 'eventos de Google Calendar' : 'tareas de Google Tasks'} desde aquí.</p>
                    <button type="button" className="btn btn-outline" onClick={handleGoogleLogin} style={{ width: '100%', gap: 12 }}><GoogleG /> Conectar Google</button>
                </section>
            ) : (
                <div className="rise d3" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}><span className="live" /> Google conectado</span>
                    <button type="button" onClick={() => { if (window.confirm('¿Desconectar tu cuenta de Google?')) desconectar(); }} style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-3)', background: 'none', border: 0, padding: '10px 0', cursor: 'pointer' }}>Desconectar</button>
                </div>
            )}

            {googleToken && esCal && (
                <>
                    {formOpen && (
                        <form onSubmit={async (e) => { await handleAddEvent(e); setFormOpen(false); }} className="card rise" style={{ marginTop: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Agendar evento</h2>
                            <label className="field"><span className="field-label">Título</span>
                                <input className="input" placeholder="Ej: Cita odontólogo" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required /></label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                                <label className="field"><span className="field-label">Fecha</span>
                                    <input className="input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required min={dateKey()} /></label>
                                <label className="field"><span className="field-label">Hora</span>
                                    <input className="input" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} required /></label>
                            </div>
                            <div className="field">
                                <span className="field-label">Duración</span>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                                    {[['15', '15 min'], ['30', '30 min'], ['60', '1 h'], ['120', '2 h']].map(([v, l]) => (
                                        <button key={v} type="button" className={`chip ${String(eventDuration) === v ? 'on' : ''}`} aria-pressed={String(eventDuration) === v} onClick={() => setEventDuration(v)} style={{ justifyContent: 'center' }}>{l}</button>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary">Agendar y sincronizar</button>
                        </form>
                    )}

                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {loadingEvents ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Sincronizando…</p>
                        ) : eventError ? (
                            <p style={{ margin: 0, padding: 14, borderRadius: 16, background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 14, fontWeight: 700 }}>{eventError}</p>
                        ) : events.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No tienes eventos próximos en tu calendario principal.</p>
                        ) : events.map((ev, i) => {
                            const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date);
                            const isToday = new Date().toDateString() === start.toDateString();
                            return (
                                <article key={ev.id || i} className="card rise" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${0.2 + i * 0.04}s` }}>
                                    <span style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--primary)' : 'var(--surface-2)', color: isToday ? 'var(--on-primary)' : 'var(--text)' }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .8 }}>{start.toLocaleString('es', { weekday: 'short' })}</span>
                                        <span className="num" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{start.getDate()}</span>
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.summary || '(Sin título)'}</span>
                                        <span className="num" style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={12} aria-hidden="true" />
                                            {ev.start.dateTime ? `${start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} – ${new Date(ev.end.dateTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : 'Todo el día'}
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </>
            )}

            {googleToken && !esCal && (
                <>
                    {formOpen && (
                        <form onSubmit={async (e) => { await handleAddGoogleTask(e); setFormOpen(false); }} className="card rise" style={{ marginTop: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nueva tarea</h2>
                            <label className="field"><span className="field-label">¿Qué necesitas hacer?</span>
                                <input className="input" placeholder="Ej: Pagar arriendo" value={newGtaskTitle} onChange={e => setNewGtaskTitle(e.target.value)} required /></label>
                            <label className="field"><span className="field-label">Fecha límite (opcional)</span>
                                <input className="input" type="date" value={newGtaskDue} onChange={e => setNewGtaskDue(e.target.value)} /></label>
                            <button type="submit" className="btn btn-primary">Crear en Google Tasks</button>
                        </form>
                    )}

                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {gtaskError ? (
                            <div style={{ padding: 14, borderRadius: 16, background: 'var(--warn-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <p style={{ margin: 0, color: 'var(--warn)', fontSize: 14, fontWeight: 700 }}>{gtaskError}</p>
                                <button type="button" className="btn btn-outline btn-sm" onClick={handleGoogleLogin} style={{ gap: 10 }}><GoogleG /> Reconectar Google</button>
                            </div>
                        ) : loadingGtasks ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando…</p>
                        ) : gtasks.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No tienes tareas pendientes en Google Tasks.</p>
                        ) : gtasks.map((task, i) => {
                            const due = task.due ? new Date(task.due) : null;
                            return (
                                <article key={task.id} className="card rise" style={{ padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: 10, animationDelay: `${0.2 + i * 0.04}s` }}>
                                    <button type="button" onClick={() => toggleGoogleTask(task)} aria-label={`Completar ${task.title || 'tarea'}`}
                                        style={{ width: 44, height: 44, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'none', border: 0, cursor: 'pointer', color: 'var(--text-3)' }}>
                                        <span style={{ width: 24, height: 24, borderRadius: 8, border: '2px solid currentColor' }} />
                                    </button>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title || '(Sin título)'}</span>
                                        {due && <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={12} aria-hidden="true" /> {due.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
                                    </div>
                                    <button type="button" className="icon-btn" onClick={() => { if (window.confirm('¿Eliminar esta tarea de Google Tasks?')) deleteGoogleTask(task); }} aria-label={`Eliminar ${task.title || 'tarea'}`} style={iconBtn}>
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
