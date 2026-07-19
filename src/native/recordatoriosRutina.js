// Recordatorios de rutina para ESCRITORIO (Electron).
//
// El programador vive en el renderer porque la colección `rutina` ya está viva
// aquí (onSnapshot); la ventana escondida en el tray mantiene el renderer vivo.
// Una cadena de setTimeout calcula la próxima ocurrencia entre todos los
// bloques, dispara una notificación nativa de Windows y se reprograma.
//
// El ajuste on/off es por dispositivo (localStorage) y se sincroniza con el
// checkbox del menú del tray vía IPC, y con React vía un CustomEvent — así ni
// RutinaSemanal ni el root necesitan props nuevas.

const KEY = 'recordatorios_rutina'; // '1' | '0'; encendido por defecto

export const recordatoriosActivos = () => {
    try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
};

export function setRecordatoriosActivos(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* */ }
    window.desktop?.setRecordatorios?.(v);
    window.dispatchEvent(new CustomEvent('recordatorios:changed', { detail: v }));
}

// Próxima fecha real en la que cae este día/hora (si ya pasó, la semana que viene).
function proximaOcurrencia(dia, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setDate(d.getDate() + ((dia - d.getDay() + 7) % 7));
    d.setHours(h, m, 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 7);
    return d;
}

// Arranca la cadena de recordatorios. Devuelve una función de limpieza.
export function iniciarRecordatoriosRutina(rutina) {
    if (!window.desktop?.isElectron || !rutina.length) return () => {};

    let timer = null;
    let resyncInterval = null;
    let cancelado = false;

    const programarSiguiente = () => {
        if (cancelado || !recordatoriosActivos()) return;
        clearTimeout(timer);
        const candidatos = rutina
            .filter(b => b.horaInicio)
            .map(b => ({ b, at: proximaOcurrencia(b.dia, b.horaInicio) }));
        if (!candidatos.length) return;
        const proximo = candidatos.reduce((a, c) => (c.at < a.at ? c : a));
        const espera = proximo.at.getTime() - Date.now(); // < 7 días, sin overflow

        timer = setTimeout(() => {
            const ahora = Date.now();
            // Dispara todos los bloques que caen en ese mismo minuto; si el timer
            // despertó tarde (PC suspendido), los vencidos por >1 min se saltan.
            candidatos
                .filter(c => Math.abs(c.at.getTime() - ahora) < 60000)
                .forEach(({ b }) => {
                    const n = new Notification(`${b.emoji || '⏰'} ${b.titulo}`, {
                        body: `${b.horaInicio} – ${b.horaFin}${b.notas ? ` · ${b.notas}` : ''}`,
                    });
                    n.onclick = () => { window.focus(); window.desktop?.showWindow?.(); };
                });
            programarSiguiente();
        }, Math.max(espera, 1000));
    };

    programarSiguiente();
    // Red de seguridad contra drift de timers y suspensión del PC.
    resyncInterval = setInterval(programarSiguiente, 15 * 60 * 1000);
    const offResync = window.desktop?.onRecordatoriosResync?.(() => programarSiguiente());

    return () => {
        cancelado = true;
        clearTimeout(timer);
        clearInterval(resyncInterval);
        offResync?.();
    };
}
