import { Capacitor } from '@capacitor/core';

// Notificación diaria de agenda: cada mañana a esta hora.
const NOTIF_HORA = 6;   // 6:00 AM
const NOTIF_MIN = 0;
const DIAS = 7;         // programa los próximos 7 días con contenido real
const ID_BASE = 1000;   // ids reservados para estas notificaciones

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const hhmm = (iso) => {
    try {
        return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
};

const tituloDia = (d) => {
    const hoy = ymd(new Date()) === ymd(d);
    const etiqueta = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });
    return hoy ? `☀️ Hoy · ${etiqueta}` : `☀️ ${etiqueta}`;
};

// Trae los eventos del calendario para los próximos DIAS días, agrupados por fecha.
async function traerEventos(token) {
    const porDia = {};
    if (!token) return porDia;
    const timeMin = new Date();
    const timeMax = new Date(); timeMax.setDate(timeMax.getDate() + DIAS);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=100`;
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return porDia;
        const data = await res.json();
        (data.items || []).forEach((ev) => {
            const start = ev.start?.dateTime || ev.start?.date;
            if (!start) return;
            const fecha = new Date(start);
            const key = ymd(fecha);
            (porDia[key] = porDia[key] || []).push({
                hora: ev.start?.dateTime ? hhmm(ev.start.dateTime) : null,
                titulo: ev.summary || '(sin título)',
            });
        });
    } catch { /* sin conexión: agenda vacía */ }
    return porDia;
}

// Trae las tareas pendientes con fecha, agrupadas por fecha de vencimiento.
async function traerTareas(token) {
    const porDia = {};
    if (!token) return porDia;
    const url = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=100';
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return porDia;
        const data = await res.json();
        (data.items || []).forEach((t) => {
            if (!t.due) return;
            const key = ymd(new Date(t.due));
            (porDia[key] = porDia[key] || []).push(t.title || '(tarea)');
        });
    } catch { /* ignora */ }
    return porDia;
}

function construirCuerpo(eventos, tareas) {
    const partes = [];
    if (eventos.length) {
        const lista = eventos.slice(0, 3).map((e) => (e.hora ? `${e.hora} ${e.titulo}` : e.titulo)).join(' · ');
        const extra = eventos.length > 3 ? ` (+${eventos.length - 3} más)` : '';
        partes.push(`📅 ${eventos.length} ${eventos.length === 1 ? 'reunión' : 'reuniones'}: ${lista}${extra}`);
    }
    if (tareas.length) {
        const lista = tareas.slice(0, 3).join(' · ');
        const extra = tareas.length > 3 ? ` (+${tareas.length - 3} más)` : '';
        partes.push(`✅ ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}: ${lista}${extra}`);
    }
    if (!partes.length) return 'No tienes reuniones ni tareas para hoy. 🎉';
    return partes.join('\n');
}

// Programa (o reprograma) las notificaciones de agenda de los próximos días.
export async function programarAgendaDiaria(googleToken) {
    if (!Capacitor.isNativePlatform()) return 0;
    let LocalNotifications;
    try {
        ({ LocalNotifications } = await import('@capacitor/local-notifications'));
    } catch { return 0; }

    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return 0;

    // Limpia las anteriores para no duplicar.
    const previas = Array.from({ length: DIAS }, (_, i) => ({ id: ID_BASE + i }));
    try { await LocalNotifications.cancel({ notifications: previas }); } catch { /* nada que cancelar */ }

    const [eventosPorDia, tareasPorDia] = await Promise.all([
        traerEventos(googleToken),
        traerTareas(googleToken),
    ]);

    const notifs = [];
    for (let i = 0; i < DIAS; i++) {
        const dia = new Date();
        dia.setDate(dia.getDate() + i);
        const at = new Date(dia);
        at.setHours(NOTIF_HORA, NOTIF_MIN, 0, 0);
        if (at.getTime() <= Date.now()) continue; // ya pasó la hora de hoy

        const key = ymd(dia);
        const body = googleToken
            ? construirCuerpo(eventosPorDia[key] || [], tareasPorDia[key] || [])
            : 'Abre Finanzas 360 y conecta Google para ver tu agenda del día.';

        notifs.push({
            id: ID_BASE + i,
            title: tituloDia(dia),
            body,
            schedule: { at, allowWhileIdle: true },
        });
    }

    if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
    return notifs.length;
}
