// Programador ÚNICO de notificaciones (iOS y escritorio).
//
// iOS solo guarda 64 notificaciones pendientes por app. En vez de repartir cupos fijos
// (agenda, rutina, pagos…), aquí se calculan TODAS las ocurrencias de los próximos días
// (resumen de la mañana, lectura del día, recordatorios, hábitos, rutina y pagos), se
// ordenan por hora y se programan las más próximas. Se reprograma cada vez que abres la
// app o cambian los datos, así el cupo siempre cubre lo que viene.
//
// Los avisos inmediatos (topes de gasto) usan su propio rango (3000+) y quedan fuera.

import { Capacitor } from '@capacitor/core';
import { traerEventos, traerTareas, construirCuerpo, conSonido } from './notificaciones';

const LIMITE = 56;          // deja 8 libres para avisos inmediatos
const ID_BASE = 5000;
const DIAS = 7;
const CLAVE_IDS = 'f360-notif-programadas';
// Rangos de la versión anterior (agenda 1000+, rutina 2000+, pagos 4000+): se limpian.
const LEGADO = [...Array.from({ length: 7 }, (_, i) => 1000 + i), ...Array.from({ length: 37 }, (_, i) => 2000 + i), ...Array.from({ length: 20 }, (_, i) => 4000 + i)];

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const aMin = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const enFecha = (dia, min) => { const d = new Date(dia); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d; };
const aplica = (dias, d) => !Array.isArray(dias) || dias.length === 0 || dias.includes(d.getDay());

// --- Contenido que escribe la IA (lo guarda AICoach en el dispositivo) ---
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
export const CLAVE_RESUMEN = (fecha) => `f360-resumen-${fecha}`;
export const CLAVE_LECTURAS = 'f360-lecturas';
export const leerResumen = (fecha) => leer(CLAVE_RESUMEN(fecha));
export const leerLecturas = () => leer(CLAVE_LECTURAS) || {};

// Por si aún no hay lectura escrita por la IA para ese día.
const LECTURAS_BASE = [
    'Lo que no se mide no se mejora: revisa hoy un gasto pequeño que repites sin pensar y decide si vale lo que cuesta.',
    'Págate primero: aparta tu ahorro apenas recibes un ingreso, no con lo que sobra al final del mes.',
    'Un hábito diminuto hecho todos los días gana a un gran plan que nunca empieza. Elige uno para mañana.',
    'Antes de comprar algo que no planeaste, espera 24 horas. Si mañana lo sigues queriendo, decide con calma.',
    'Tu fondo de emergencia no es para invertir ni para gustos: es la tranquilidad de no endeudarte ante un imprevisto.',
    'Descansar también es productivo: una pausa de 5 minutos cada hora mejora tu concentración el resto del día.',
    'Escribe mañana tus tres prioridades antes de abrir el correo. Lo importante primero, lo urgente después.',
];

// Todas las notificaciones de los próximos días: [{ at: Date, title, body, clave }]
export function calcularOcurrencias({ recordatorios = [], habitos = [], rutina = [], rutinaOn = true, pagos = [], eventosPorDia = {}, tareasPorDia = {}, ahora = new Date() }) {
    const out = [];
    const hoyKey = ymd(ahora);
    const lecturas = leerLecturas();
    const dias = Array.from({ length: DIAS }, (_, i) => { const d = new Date(ahora); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
    const add = (at, title, body, clave) => { if (at > ahora) out.push({ at, title, body, clave }); };

    recordatorios.filter(r => r.activo !== false).forEach(r => {
        if (r.sistema === 'resumen') {
            const min = aMin(r.hora || '06:30');
            dias.forEach(d => {
                const fecha = ymd(d);
                const ia = leerResumen(fecha);
                const agenda = construirCuerpo(eventosPorDia[fecha] || [], tareasPorDia[fecha] || []);
                add(enFecha(d, min), ia?.titulo || `☀️ Buenos días`, ia?.texto || agenda, `resumen-${fecha}`);
            });
            return;
        }
        if (r.sistema === 'lectura') {
            const min = aMin(r.hora || '21:00');
            dias.forEach((d, i) => {
                const fecha = ymd(d);
                add(enFecha(d, min), '📖 Lectura del día', lecturas[fecha] || LECTURAS_BASE[(d.getDate() + i) % LECTURAS_BASE.length], `lectura-${fecha}`);
            });
            return;
        }
        const titulo = `${r.emoji || '🔔'} ${r.titulo || 'Recordatorio'}`;
        const cuerpo = r.mensaje || '';
        // Recordatorio de un hábito: no avisa si hoy ya lo marcaste.
        const habito = r.habitoId ? habitos.find(h => h.id === r.habitoId) : null;
        const hecho = (fecha) => !!habito && (habito.historial || []).includes(fecha);

        if (r.tipo === 'unico') {
            if (!r.fecha || aMin(r.hora) === null) return;
            add(enFecha(new Date(`${r.fecha}T00:00:00`), aMin(r.hora)), titulo, cuerpo, `rec-${r.id}`);
            return;
        }
        if (r.tipo === 'intervalo') {
            const desde = aMin(r.desde || '08:00'), hasta = aMin(r.hasta || '18:00');
            const paso = Math.max(15, Number(r.cadaMin) || 60);
            if (desde === null || hasta === null) return;
            dias.forEach(d => {
                if (!aplica(r.dias, d) || (ymd(d) === hoyKey && hecho(hoyKey))) return;
                for (let m = desde; m <= hasta; m += paso) add(enFecha(d, m), titulo, cuerpo, `rec-${r.id}-${ymd(d)}-${m}`);
            });
            return;
        }
        // 'hora' (diario o ciertos días)
        const min = aMin(r.hora);
        if (min === null) return;
        dias.forEach(d => {
            if (!aplica(r.dias, d) || (ymd(d) === hoyKey && hecho(hoyKey))) return;
            add(enFecha(d, min), titulo, cuerpo, `rec-${r.id}-${ymd(d)}`);
        });
    });

    if (rutinaOn) {
        rutina.filter(b => b.horaInicio).forEach(b => {
            dias.forEach(d => {
                if (d.getDay() !== b.dia) return;
                add(enFecha(d, aMin(b.horaInicio)), `${b.emoji || '⏰'} ${b.titulo}`, `${b.horaInicio} – ${b.horaFin}${b.notas ? ` · ${b.notas}` : ''}`, `rutina-${b.id}-${ymd(d)}`);
            });
        });
    }

    pagos.forEach(p => { if (p.at) add(p.at, p.title, p.body, `pago-${p.tag || p.title}-${p.at.getTime()}`); });

    return out.sort((a, b) => a.at - b.at);
}

// Escritorio (Electron): la ventana vive escondida en la bandeja, así que una cadena de
// setTimeout en el renderer dispara los toasts de Windows. Cada reprogramación reemplaza
// la cadena anterior (calcularOcurrencias solo trae lo que aún no ha pasado).
let timerEscritorio = null;
const TOPE_ESPERA = 15 * 60 * 1000; // corrige el desfase de timers tras suspender el PC

function programarEscritorio(lista) {
    clearTimeout(timerEscritorio);
    const disparadas = new Set();
    const siguiente = () => {
        const ahora = Date.now();
        // Suenan las que vencieron hace menos de 1 min; si el PC estuvo suspendido, las viejas se saltan.
        lista.filter(n => !disparadas.has(n.clave) && n.at.getTime() <= ahora && ahora - n.at.getTime() < 60000).forEach(n => {
            disparadas.add(n.clave);
            const aviso = new Notification(n.title, { body: n.body });
            aviso.onclick = () => { window.focus(); window.desktop?.showWindow?.(); };
        });
        const prox = lista.find(n => n.at.getTime() > ahora);
        if (!prox) return;
        timerEscritorio = setTimeout(siguiente, Math.min(Math.max(prox.at.getTime() - ahora, 1000), TOPE_ESPERA));
    };
    siguiente();
}

// Programa las notificaciones (reemplaza las anteriores). Devuelve cuántas quedaron.
export async function programarTodo(datos, googleToken) {
    if (window.desktop?.isElectron) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
        const [eventosPorDia, tareasPorDia] = await Promise.all([traerEventos(googleToken), traerTareas(googleToken)]);
        const lista = calcularOcurrencias({ ...datos, eventosPorDia, tareasPorDia });
        programarEscritorio(lista);
        return lista.length;
    }
    if (!Capacitor.isNativePlatform()) return 0;
    let LocalNotifications;
    try { ({ LocalNotifications } = await import('@capacitor/local-notifications')); } catch { return 0; }
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return 0;

    const [eventosPorDia, tareasPorDia] = await Promise.all([traerEventos(googleToken), traerTareas(googleToken)]);
    const lista = calcularOcurrencias({ ...datos, eventosPorDia, tareasPorDia }).slice(0, LIMITE);

    let previas = LEGADO.length;
    try { previas = Number(localStorage.getItem(CLAVE_IDS)) || 0; } catch { /* */ }
    const cancelar = [...Array.from({ length: Math.max(previas, LIMITE) }, (_, i) => ({ id: ID_BASE + i })), ...LEGADO.map(id => ({ id }))];
    try { await LocalNotifications.cancel({ notifications: cancelar }); } catch { /* nada que cancelar */ }

    if (lista.length) {
        await LocalNotifications.schedule({
            notifications: lista.map((n, i) => conSonido({ id: ID_BASE + i, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })),
        });
    }
    try { localStorage.setItem(CLAVE_IDS, String(lista.length)); } catch { /* */ }
    return lista.length;
}
