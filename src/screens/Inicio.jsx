import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, CreditCard, Calendar, Save, PieChart, Sparkles, Circle, Clock, Smile, CalendarClock, ChevronRight, ArrowUp, ArrowDown, LayoutGrid, Check, Frown, Meh, Annoyed, Laugh } from 'lucide-react';
import { ThemeToggle, CountUp, Sparkline, fmtCOP } from '../ui/f360.jsx';
import { calcularAlertasCoach } from '../coach/Coach';
import { MOODS, dateKey, esGastoConsumo, proximaFechaPago, sumaMonto } from '../lib/finanzas';
import { pagosProximos } from '../lib/pagos';

// =============================================
// === COMPONENTE: MI DÍA (DASHBOARD DIARIO) ===
// =============================================
// Caras del ánimo (Lucide en vez de emojis, según el sistema de diseño).
export const MOOD_ICONS = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh };

export const MiDia = ({ user, habitos, diario, transacciones, presupuestoItems, limites = [], cuentas = [], deudas = [], saldoActual, googleToken, genericAdd, genericUpdate, setActiveTab, onOpenCoach, onNuevoMovimiento }) => {
    const [eventos, setEventos] = useState([]);
    const [gtareas, setGtareas] = useState([]);
    const [moodTexto, setMoodTexto] = useState('');

    const hoy = dateKey();
    const ahora = new Date();
    const nombre = (user?.displayName || '').split(' ')[0] || '';
    const fechaLarga = ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const fechaCap = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);

    // Eventos de Google de hoy
    useEffect(() => {
        if (!googleToken) return;
        const fetchHoy = async () => {
            try {
                const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
                const fin = new Date(); fin.setHours(23, 59, 59, 999);
                const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${inicio.toISOString()}&timeMax=${fin.toISOString()}&singleEvents=true&orderBy=startTime`, {
                    headers: { Authorization: `Bearer ${googleToken}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                setEventos(data.items || []);
            } catch (e) { /* sin conexión */ }
        };
        const fetchTareas = async () => {
            try {
                const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=10', {
                    headers: { Authorization: `Bearer ${googleToken}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                setGtareas((data.items || []).slice(0, 5));
            } catch (e) { /* sin conexión */ }
        };
        fetchHoy();
        fetchTareas();
    }, [googleToken]);

    // Marca una tarea de Google como completada.
    const completarGtarea = async (t) => {
        if (!googleToken) return;
        setGtareas(prev => prev.filter(x => x.id !== t.id));
        try {
            await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${t.id}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
            });
        } catch (e) { /* sin conexión */ }
    };

    // Pagos próximos (≤7 días): presupuesto, cuotas de deudas y tarjetas de crédito.
    const proximos = pagosProximos({ presupuestoItems, deudas, cuentas, transacciones });

    // Finanzas de hoy y del mes
    const gastoHoy = transacciones
        .filter(t => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro && t.fecha === hoy)
        .reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const mesKey = hoy.slice(0, 7);
    const txMes = transacciones.filter(t => typeof t.fecha === 'string' && t.fecha.startsWith(mesKey));
    const balanceMes = sumaMonto(txMes.filter(t => t.tipo === 'ingreso')) - sumaMonto(txMes.filter(esGastoConsumo));

    // Sparkline: saldo acumulado de los últimos 30 días.
    const serieSaldo = useMemo(() => {
        const dias = 30;
        const claves = [];
        for (let i = dias - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); claves.push(dateKey(d)); }
        const netoPorDia = Object.fromEntries(claves.map(k => [k, 0]));
        transacciones.forEach(t => {
            if (!(t.fecha in netoPorDia) || (t.tipo !== 'ingreso' && t.tipo !== 'gasto')) return; // transferencias no cambian el saldo
            netoPorDia[t.fecha] += (t.tipo === 'ingreso' ? 1 : -1) * (Number(t.monto) || 0);
        });
        const netoVentana = claves.reduce((a, k) => a + netoPorDia[k], 0);
        let acc = saldoActual - netoVentana;
        return claves.map(k => (acc += netoPorDia[k]));
    }, [transacciones, saldoActual]);

    // Coach: hallazgo principal para la tarjeta de insight.
    const alertas = useMemo(() => calcularAlertasCoach({ transacciones, limites, presupuestoItems }), [transacciones, limites, presupuestoItems]);
    const insight = alertas.find(a => a.tono !== 'income') || alertas[0] || null;

    // Hábitos de hoy
    const habitosHechos = habitos.filter(h => (h.historial || []).includes(hoy)).length;

    // Diario de hoy
    const entradaHoy = diario.find(d => d.fecha === hoy);
    const guardarMood = async (v) => {
        if (entradaHoy) {
            await genericUpdate('diario', entradaHoy.id, { animo: v, texto: moodTexto || entradaHoy.texto || '' });
        } else {
            await genericAdd('diario', { fecha: hoy, animo: v, texto: moodTexto, createdAt: new Date().toISOString() });
        }
    };
    const guardarTextoDiario = async () => {
        if (!moodTexto.trim() && !entradaHoy) return;
        if (entradaHoy) {
            await genericUpdate('diario', entradaHoy.id, { texto: moodTexto });
        } else {
            await genericAdd('diario', { fecha: hoy, animo: 3, texto: moodTexto, createdAt: new Date().toISOString() });
        }
        setMoodTexto('');
    };

    const fmtHoraEvento = (ev) => {
        const dt = ev.start?.dateTime;
        if (!dt) return 'Todo el día';
        return new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    };

    const acciones = [
        { label: 'Ingreso', Icon: ArrowUp, soft: 'var(--income-soft)', color: 'var(--income)', onClick: () => onNuevoMovimiento('ingreso') },
        { label: 'Gasto', Icon: ArrowDown, soft: 'var(--expense-soft)', color: 'var(--expense)', onClick: () => onNuevoMovimiento('gasto') },
        { label: 'Deuda', Icon: CreditCard, soft: 'var(--warn-soft)', color: 'var(--warn)', onClick: () => setActiveTab('deudas') },
        { label: 'Invertir', Icon: PieChart, soft: 'var(--primary-soft)', color: 'var(--primary)', onClick: () => setActiveTab('inversiones') },
    ];

    const fila = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' };

    return (
        <div>
            <header className="rise d1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div className="tile display" style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700, fontSize: 18, boxShadow: '0 8px 20px -8px var(--glow)' }}>F</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>{fechaCap}</span>
                        <h1 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Hola{nombre ? `, ${nombre}` : ''}</h1>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <ThemeToggle />
                    <button type="button" className="icon-btn" onClick={() => setActiveTab('todo')} aria-label="Más módulos">
                        <LayoutGrid size={20} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {/* Hero: saldo */}
            <section className="hero rise d2" style={{ marginTop: 22, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="orb" style={{ width: 240, height: 240, right: -90, top: -110, background: '#3355FF', opacity: .75 }} />
                <div className="orb" style={{ width: 170, height: 170, left: -60, bottom: -80, background: '#22D3EE', opacity: .45, animationDuration: '18s' }} />
                <div className="grid-lines" />
                <div className="sheen" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Saldo disponible</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}><span className="live" />En vivo</span>
                </div>
                <div className="num" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}><CountUp value={saldoActual} /></div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: balanceMes >= 0 ? '#67E8F9' : '#FDA4AF' }}>
                    {balanceMes >= 0 ? <TrendingUp size={16} strokeWidth={2} aria-hidden="true" /> : <TrendingDown size={16} strokeWidth={2} aria-hidden="true" />}
                    <span className="num" style={{ letterSpacing: 0 }}>{fmtCOP(Math.abs(balanceMes))}</span>
                    {balanceMes >= 0 ? 'te sobró este mes' : 'de más este mes'}
                </div>
                <Sparkline values={serieSaldo} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <div className="glass-pill" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>Gastado hoy</span>
                        <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{fmtCOP(gastoHoy)}</span>
                    </div>
                    <button type="button" onClick={() => setActiveTab('habitos')} className="glass-pill" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, color: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>Hábitos</span>
                        <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{habitosHechos} / {habitos.length}</span>
                    </button>
                </div>
            </section>

            {/* Coach: tarjeta de insight → hoja inferior */}
            <button type="button" onClick={onOpenCoach} className="card lift rise d3" style={{ marginTop: 14, padding: 16, width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', color: 'var(--text)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <div className="tile" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}>
                        <Sparkles size={20} strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="eyebrow" style={{ color: 'var(--violet)' }}>Tu coach</span>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{insight ? insight.titulo : 'Pregúntale lo que quieras sobre tu dinero'}</span>
                    </div>
                    <ChevronRight size={18} strokeWidth={2} color="var(--text-3)" aria-hidden="true" />
                </div>
                {insight?.tipo === 'limite' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: '100%' }}>
                            <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', letterSpacing: 0 }}>{fmtCOP(insight.gastado)} de {fmtCOP(insight.tope)}</span>
                            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--expense)' }}>{Math.round(insight.pct * 100)}%</span>
                        </div>
                        <div className="bar" style={{ width: '100%' }}><i style={{ width: `${Math.min(100, insight.pct * 100)}%`, background: 'linear-gradient(90deg, var(--warn), var(--expense))' }} /></div>
                    </>
                )}
                {insight && insight.tipo !== 'limite' && (
                    <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{insight.texto}</span>
                )}
            </button>

            {/* Acciones rápidas */}
            <nav aria-label="Acciones rápidas" className="rise d4" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                {acciones.map(({ label, Icon, soft, color, onClick }) => (
                    <button key={label} type="button" onClick={onClick} className="card lift" style={{ borderRadius: 20, padding: '14px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                        <span className="tile" style={{ width: 40, height: 40, background: soft, color }}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
                        {label}
                    </button>
                ))}
            </nav>

            {/* Hoy: pagos + calendario */}
            <div className="rise d5" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Hoy</h2>
                <button type="button" onClick={() => setActiveTab('agenda')} style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', background: 'none', border: 0, cursor: 'pointer', padding: '8px 0' }}>Ver agenda</button>
            </div>

            <div className="card rise d5" style={{ marginTop: 12, padding: '6px 16px' }}>
                {proximos.length === 0 ? (
                    <div style={{ ...fila, borderBottom: '1px solid var(--line)' }}>
                        <span className="tile" style={{ width: 40, height: 40, background: 'var(--income-soft)', color: 'var(--income)' }}><Check size={20} strokeWidth={2.2} aria-hidden="true" /></span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>Pagos al día</span>
                            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Nada por pagar en los próximos 7 días</span>
                        </div>
                    </div>
                ) : proximos.map(p => {
                    const urgente = p.vencido || p.dias <= 2;
                    return (
                        <div key={p.id} style={{ ...fila, borderBottom: '1px solid var(--line)' }}>
                            <span className="tile" style={{ width: 40, height: 40, background: urgente ? 'var(--expense-soft)' : 'var(--warn-soft)', color: urgente ? 'var(--expense)' : 'var(--warn)' }}><CalendarClock size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.concepto}</span>
                                <span style={{ fontSize: 13, color: urgente ? 'var(--expense)' : 'var(--text-3)', fontWeight: urgente ? 700 : 500 }}>
                                    {p.vencido ? 'Vencido' : p.dias === 0 ? 'Vence hoy' : p.dias === 1 ? 'Mañana' : `En ${p.dias} días`}{p.estimado ? ' · aprox.' : ''}
                                </span>
                            </div>
                            <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{fmtCOP(p.monto)}</span>
                        </div>
                    );
                })}

                {!googleToken ? (
                    <div style={fila}>
                        <span className="tile" style={{ width: 40, height: 40, background: 'var(--primary-soft)', color: 'var(--primary)' }}><Calendar size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>Tu calendario</span>
                            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Conecta Google para ver eventos y tareas</span>
                        </div>
                        <button type="button" className="chip" style={{ color: 'var(--primary)' }} onClick={() => setActiveTab('agenda')}>Conectar</button>
                    </div>
                ) : eventos.length === 0 && gtareas.length === 0 ? (
                    <div style={fila}>
                        <span className="tile" style={{ width: 40, height: 40, background: 'var(--primary-soft)', color: 'var(--primary)' }}><Calendar size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>Agenda libre</span>
                            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Sin eventos ni tareas pendientes</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {eventos.map((ev, i) => (
                            <div key={ev.id} style={{ ...fila, borderBottom: (i < eventos.length - 1 || gtareas.length) ? '1px solid var(--line)' : 0 }}>
                                <span className="tile" style={{ width: 40, height: 40, background: 'var(--primary-soft)', color: 'var(--primary)' }}><Clock size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.summary || '(sin título)'}</span>
                                    <span className="num" style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 0 }}>{fmtHoraEvento(ev)}</span>
                                </div>
                            </div>
                        ))}
                        {gtareas.map((t, i) => (
                            <div key={t.id} style={{ ...fila, borderBottom: i < gtareas.length - 1 ? '1px solid var(--line)' : 0 }}>
                                <button type="button" onClick={() => completarGtarea(t)} aria-label={`Completar ${t.title}`} className="tile" style={{ width: 40, height: 40, background: 'var(--surface-2)', color: 'var(--text-3)', border: 0, cursor: 'pointer' }}>
                                    <Circle size={18} strokeWidth={1.8} aria-hidden="true" />
                                </button>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Hábitos de hoy */}
            <button type="button" onClick={() => setActiveTab('habitos')} className="card lift rise d6" style={{ marginTop: 14, padding: 16, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left', color: 'var(--text)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>Hábitos de hoy</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0 }}>{habitos.length ? `${habitosHechos} de ${habitos.length}` : 'Crear hábitos'}</span>
                </div>
                {habitos.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${habitos.length}, minmax(0, 1fr))`, gap: 6, width: '100%' }}>
                        {habitos.map(h => {
                            const done = (h.historial || []).includes(hoy);
                            return <span key={h.id} style={{ height: 8, borderRadius: 99, background: done ? 'var(--income)' : 'var(--surface-2)', border: done ? 0 : '1px dashed var(--line)', transition: 'background .4s var(--ease)' }} />;
                        })}
                    </div>
                )}
            </button>

            {/* Ánimo del día */}
            <section className="card rise d7" style={{ marginTop: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>¿Cómo te sientes hoy?</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                    {MOODS.map(m => {
                        const Icon = MOOD_ICONS[m.v];
                        const on = entradaHoy?.animo === m.v;
                        return (
                            <button key={m.v} type="button" onClick={() => guardarMood(m.v)} aria-label={m.label} aria-pressed={on}
                                style={{ height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', cursor: 'pointer', border: `1px solid ${on ? 'var(--violet)' : 'var(--line)'}`, background: on ? 'var(--violet-soft)' : 'var(--surface-2)', color: on ? 'var(--violet)' : 'var(--text-3)', transition: 'all .3s var(--spring)', transform: on ? 'scale(1.06)' : 'none' }}>
                                <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); guardarTextoDiario(); }} style={{ display: 'flex', gap: 8 }}>
                    <input className="input" value={moodTexto} onChange={e => setMoodTexto(e.target.value)} placeholder={entradaHoy?.texto || 'Una nota del día (opcional)…'} aria-label="Nota del día" style={{ flex: 1, minWidth: 0 }} />
                    <button type="submit" className="icon-btn" aria-label="Guardar nota" style={{ width: 52, height: 52, background: 'var(--violet)', color: 'var(--on-accent)', borderColor: 'transparent' }}><Save size={18} aria-hidden="true" /></button>
                </form>
            </section>
        </div>
    );
};
