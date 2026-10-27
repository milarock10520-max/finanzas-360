// Estado compartido de la hoja para Gemini, en Firestore (artifacts/{appId}/users/{uid}/hoja/...).
//
// Lo comparten el escritorio y el iPhone: si cada uno guardara "lo último que escribió" en su
// propio dispositivo, uno tomaría lo que escribió el otro por ediciones de Gemini.
//   hoja/config        { id, url, mensajes, turno: { dispositivo, hasta } }
//   hoja/snap_<pestaña> { filas, n, firma }   (uno por pestaña: lejos del límite de 1 MB)
//
// Turno: un candado con vencimiento (90 s). Solo quien lo tiene sincroniza; si un dispositivo
// se cierra a mitad del ciclo, el candado vence solo.

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';

const TURNO_MS = 90 * 1000;

export const idDispositivo = () => {
    let id = null;
    try { id = localStorage.getItem('f360-dispositivo'); } catch { /* */ }
    if (!id) {
        id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        try { localStorage.setItem('f360-dispositivo', id); } catch { /* */ }
    }
    return id;
};

export function crearAlmacenHoja(db, base) {
    const ruta = `${base}/hoja`;
    const config = doc(db, ruta, 'config');
    const yo = idDispositivo();
    let mensajesGuardados = '';

    return {
        // Solo la configuración (para saber si hay hoja y mostrar su enlace).
        async config() {
            const s = await getDoc(config);
            return s.exists() ? s.data() : null;
        },
        async cargar() {
            const docs = await getDocs(collection(db, ruta));
            const estado = { snap: {} };
            docs.forEach(d => {
                if (d.id === 'config') Object.assign(estado, { id: d.data().id, url: d.data().url, mensajes: d.data().mensajes || {} });
                else if (d.id.startsWith('snap_')) estado.snap[d.id.slice(5)] = d.data();
            });
            mensajesGuardados = JSON.stringify(estado.mensajes || {});
            return estado.id ? estado : null;
        },
        async guardar(estado, cambiadas = []) {
            await Promise.all(cambiadas.map(t => setDoc(doc(db, ruta, `snap_${t}`), estado.snap[t])));
            const mensajes = JSON.stringify(estado.mensajes || {});
            if (mensajes !== mensajesGuardados) {
                await updateDoc(config, { mensajes: estado.mensajes || {} });
                mensajesGuardados = mensajes;
            }
        },
        async crear({ id, url }) {
            await setDoc(config, { id, url, mensajes: {}, creada: new Date().toISOString() });
        },
        async borrar() {
            const docs = await getDocs(collection(db, ruta));
            await Promise.all(docs.docs.map(d => deleteDoc(d.ref)));
        },
        async tomarTurno() {
            try {
                return await runTransaction(db, async (tx) => {
                    const s = await tx.get(config);
                    if (!s.exists()) return false;
                    const t = s.data().turno;
                    if (t && t.dispositivo !== yo && t.hasta > Date.now()) return false;
                    tx.update(config, { turno: { dispositivo: yo, hasta: Date.now() + TURNO_MS } });
                    return true;
                });
            } catch {
                return false; // sin conexión: tampoco se podría hablar con Google
            }
        },
        async soltarTurno() {
            await runTransaction(db, async (tx) => {
                const s = await tx.get(config);
                if (s.exists() && s.data().turno?.dispositivo === yo) tx.update(config, { turno: null });
            });
        },
    };
}
