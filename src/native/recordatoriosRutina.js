// Ajuste de recordatorios de rutina (por dispositivo).
//
// Los avisos los dispara el programador único (native/programador.js), en iOS y en
// escritorio. Aquí solo vive el on/off: se guarda en localStorage y se sincroniza con
// el checkbox del menú del tray vía IPC, y con React vía un CustomEvent — así ni
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
