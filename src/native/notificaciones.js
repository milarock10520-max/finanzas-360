import { Capacitor } from '@capacitor/core';

// iOS solo suena si la notificación trae `sound` (el plugin no pone uno por defecto).
// 'default' no es un archivo de la app, así que iOS usa su sonido estándar de avisos.
const SONIDO = 'default';
export const conSonido = (n) => ({ ...n, sound: SONIDO });

// Agenda de Google de los próximos días (la usa el programador para el resumen de la mañana).
const DIAS = 7;

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const hhmm = (iso) => {
    try {
        return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
};

// Trae los eventos del calendario para los próximos DIAS días, agrupados por fecha.
export async function traerEventos(token) {
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
export async function traerTareas(token) {
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

export function construirCuerpo(eventos, tareas) {
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

// =============================================
// === Avisos inmediatos (topes, recordatorios) =
// =============================================
// En iOS usa notificaciones locales; en web/escritorio, el service worker o la
// API Notification. Un mismo `tag` produce siempre el mismo id (no duplica).

const AVISO_ID_BASE = 3000;
const idDeTag = (tag) => {
    let h = 0;
    for (const ch of String(tag)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVISO_ID_BASE + (h % 900);
};

// 'granted' | 'denied' | 'default'
export async function estadoPermisoAvisos() {
    if (Capacitor.isNativePlatform()) {
        try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const p = await LocalNotifications.checkPermissions();
            return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
        } catch { return 'denied'; }
    }
    return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
}

export async function pedirPermisoAvisos() {
    if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const p = await LocalNotifications.requestPermissions();
        return p.display === 'granted' ? 'granted' : 'denied';
    }
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.requestPermission();
}

export async function enviarAviso({ title, body, tag }) {
    if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
            notifications: [conSonido({ id: idDeTag(tag || title), title, body, schedule: { at: new Date(Date.now() + 1500) } })],
        });
        return;
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' });
        return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag });
}
