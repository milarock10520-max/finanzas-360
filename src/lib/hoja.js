// Hoja de Google "Finanzas 360 · datos en vivo" para Gemini / Spark.
//
// Gemini y Spark leen Google Sheets de forma nativa (y no usan los conectores MCP
// personalizados en esta cuenta), así que la app mantiene una hoja espejo de sus datos
// y aplica las ediciones que se hagan en ella.
//
// Motor (corre en la app de escritorio y en la del iPhone mientras está abierta; el estado
// compartido y el turno viven en Firebase para que dos dispositivos no se pisen):
//   1. Lee la hoja y la compara con lo último que la app escribió (instantánea en
//      localStorage). Celdas editables cambiadas -> actualizar; filas nuevas sin ID ->
//      crear; columna "Borrar" marcada -> borrar. Todo pasa por genericAdd/Update/Delete,
//      la misma lógica de la app (p. ej. borrar un gasto deshace lo que arrastra).
//   2. Reescribe la hoja con los datos actuales (solo las pestañas que cambiaron).
//
// Nunca se exportan: passwords, vault_config, proyecto_credenciales ni el chat del coach.
// Ingresos y movimientos automáticos son de solo lectura en la hoja.
//
// Acceso: OAuth del usuario con el permiso drive.file (solo archivos creados por la app).
//
// Almacén (lo provee la app, ver lib/hojaAlmacen.js):
//   cargar() -> { id, url, mensajes, snap: { [pestaña]: { filas, n, firma } } } | null
//   guardar(estado, pestañasCambiadas)
//   tomarTurno() -> bool   /   soltarTurno()

import { dateKey, calcStreak, esGastoConsumo } from './finanzas';
import { esPosicionInversion, aportesDe, depositado } from './inversiones';
import { saldoDeuda } from './deudas';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
export const SCOPE_HOJA = 'https://www.googleapis.com/auth/drive.file';
const TITULO_HOJA = 'Finanzas 360 · datos en vivo';
const MSG_TTL = 15 * 60 * 1000; // los mensajes de la columna Estado se ven 15 min

// Huella corta de una pestaña (FNV-1a): la instantánea guarda esto y no la grilla entera.
const huella = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return `${s.length}:${h.toString(36)}`; };

// --- Conversión de valores de celda ---
const norm = (v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v).trim());
const vacio = (v) => norm(v) === '';

export function aNumero(v) {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/[^\d,.-]/g, '');
    if (!s) return NaN;
    const dec = s.match(/[.,](\d{1,2})$/);
    if (dec) return Number(`${s.slice(0, -dec[0].length).replace(/[.,]/g, '')}.${dec[1]}`);
    return Number(s.replace(/[.,]/g, ''));
}
const aMonto = (v, campo = 'Monto') => {
    const n = aNumero(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${campo} inválido`);
    return Math.round(n * 100) / 100;
};
export function aFecha(v) {
    if (typeof v === 'number' && v > 20000) { // número de serie de Sheets (días desde 1899-12-30)
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
        return d.toISOString().slice(0, 10);
    }
    const s = norm(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    throw new Error('Fecha inválida (usa AAAA-MM-DD)');
}
const aBool = (v) => v === true || ['true', 'verdadero', 'sí', 'si', 'x', '1', 'yes'].includes(norm(v).toLowerCase());
const aHora = (v) => {
    if (typeof v === 'number' && v >= 0 && v < 1) { const m = Math.round(v * 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
    const s = norm(v).match(/^(\d{1,2}):(\d{2})/);
    if (!s || Number(s[1]) > 23 || Number(s[2]) > 59) throw new Error('Hora inválida (usa HH:MM)');
    return `${s[1].padStart(2, '0')}:${s[2]}`;
};
const aDiaMes = (v) => { if (vacio(v)) return null; const n = Math.round(aNumero(v)); if (!(n >= 1 && n <= 31)) throw new Error('Día del mes inválido (1–31)'); return n; };
const aTexto = (v, campo) => { const s = norm(v); if (!s) throw new Error(`${campo} no puede quedar vacío`); return s.slice(0, 300); };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const sinTilde = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const aDia = (v) => { const i = DIAS.findIndex(d => sinTilde(d).startsWith(sinTilde(norm(v)).slice(0, 2)) && norm(v)); if (i < 0) throw new Error('Día inválido (lunes…domingo)'); return i; };
const aDias = (v) => (vacio(v) ? [] : norm(v).split(/[,;\s]+/).filter(Boolean).map(aDia));
const enumDe = (opciones, campo) => (v) => { const s = sinTilde(norm(v)); const o = opciones.find(x => sinTilde(x) === s); if (!o) throw new Error(`${campo} debe ser: ${opciones.join(', ')}`); return o; };
const ahora = () => new Date().toISOString();

// --- Pestañas ---
// Columnas: { h: encabezado, v: (doc, ctx) => valor, e?: (valor, doc, ctx) => parche | async (ops) => void }
// Con `e` la columna es editable. ID va primero (oculta); Borrar y Estado al final.
const col = (h, v, e) => ({ h, v, e });

const PROTEGIDO_INGRESO = 'Los ingresos solo se editan en la app';
const origenMov = (t) => t.reglaId ? 'Regla de ahorro' : t.esAhorro ? 'Aporte a meta' : t.inversionId ? 'Aporte a inversión (USD)' : t.categoria === 'Pago de Deudas' ? 'Abono a deuda' : '';

const PESTANAS = [
    {
        titulo: 'Movimientos', coleccion: 'transacciones', borrar: true,
        filas: (d) => d.transacciones.filter(t => !esPosicionInversion(t)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
        protegido: (t) => t.tipo === 'ingreso' ? PROTEGIDO_INGRESO
            : (t.esAhorro || t.reglaId || t.inversionId) ? 'Movimiento automático: cámbialo desde su meta o inversión en la app' : null,
        columnas: [
            col('Fecha', t => t.fecha || '', v => ({ fecha: aFecha(v) })),
            col('Tipo', t => t.tipo || ''),
            col('Categoría', t => t.categoria || '', v => ({ categoria: aTexto(v, 'Categoría') })),
            col('Concepto', t => t.concepto || '', v => ({ concepto: norm(v) })),
            col('Monto', t => Number(t.monto) || 0, v => ({ monto: aMonto(v) })),
            col('Moneda', t => t.moneda || 'COP'),
            col('Cuenta', (t, c) => c.nombreCuenta[t.cuentaId] || '', (v, t, c) => {
                if (vacio(v)) return { cuentaId: null };
                const cu = c.cuentaPorNombre(v); if (!cu) throw new Error(`No existe la cuenta "${norm(v)}"`);
                return { cuentaId: cu.id };
            }),
            col('Origen', origenMov),
        ],
        crear: (f, c) => {
            const tipo = sinTilde(norm(f.Tipo) || 'gasto');
            if (tipo === 'ingreso') throw new Error('No se pueden crear ingresos desde la hoja');
            if (tipo !== 'gasto') throw new Error('Desde la hoja solo se pueden crear gastos');
            const monto = aMonto(f.Monto); if (!(monto > 0)) throw new Error('El monto debe ser mayor que 0');
            const cuenta = vacio(f.Cuenta) ? null : c.cuentaPorNombre(f.Cuenta);
            if (!vacio(f.Cuenta) && !cuenta) throw new Error(`No existe la cuenta "${norm(f.Cuenta)}"`);
            return { coleccion: 'transacciones', datos: {
                tipo: 'gasto', monto, categoria: norm(f['Categoría']) || 'Otros', concepto: norm(f.Concepto) || norm(f['Categoría']) || 'Gasto',
                fecha: vacio(f.Fecha) ? dateKey() : aFecha(f.Fecha), ...(cuenta ? { cuentaId: cuenta.id } : {}), origen: 'hoja', createdAt: ahora(),
            } };
        },
    },
    {
        titulo: 'Presupuesto', coleccion: 'presupuesto', borrar: true,
        filas: (d) => [...d.presupuestoItems].sort((a, b) => (a.diaPago || 99) - (b.diaPago || 99)),
        columnas: [
            col('Concepto', p => p.concepto || '', v => ({ concepto: aTexto(v, 'Concepto') })),
            col('Monto', p => Number(p.monto) || 0, v => ({ monto: aMonto(v) })),
            col('Categoría', p => p.categoria || '', v => ({ categoria: norm(v) })),
            col('Recurrente', p => p.recurrente !== false, v => ({ recurrente: aBool(v) })),
            col('Día de pago', p => p.diaPago || '', v => ({ diaPago: aDiaMes(v) })),
            col('Pagado este mes', (p, c) => (p.lastPaid || '').startsWith(c.mes)),
        ],
        crear: (f) => ({ coleccion: 'presupuesto', datos: {
            concepto: aTexto(f.Concepto, 'Concepto'), monto: aMonto(f.Monto), categoria: norm(f['Categoría']) || 'Otros',
            recurrente: vacio(f.Recurrente) ? true : aBool(f.Recurrente), diaPago: aDiaMes(f['Día de pago']), lastPaid: '',
        } }),
    },
    {
        titulo: 'Topes', coleccion: 'limites', borrar: true,
        filas: (d) => d.limites,
        columnas: [
            col('Categoría', l => l.categoria || '', v => ({ categoria: aTexto(v, 'Categoría') })),
            col('Tope mensual', l => Number(l.limite) || 0, v => ({ limite: aMonto(v, 'Tope') })),
            col('Gastado este mes', (l, c) => Math.round(c.gastoMesPorCat[l.categoria] || 0)),
            col('% usado', (l, c) => (Number(l.limite) > 0 ? Math.round((c.gastoMesPorCat[l.categoria] || 0) / Number(l.limite) * 100) : '')),
        ],
        crear: (f) => ({ coleccion: 'limites', datos: { categoria: aTexto(f['Categoría'], 'Categoría'), limite: aMonto(f['Tope mensual'], 'Tope') } }),
    },
    {
        titulo: 'Metas', coleccion: 'metas', borrar: true,
        filas: (d) => d.metas,
        columnas: [
            col('Tipo', m => (m.tipo === 'personal' ? 'personal' : 'financiera')),
            col('Nombre', m => m.nombre || '', v => ({ nombre: aTexto(v, 'Nombre') })),
            col('Objetivo', m => (m.tipo === 'personal' ? '' : Number(m.montoObjetivo) || 0), (v, m) => { if (m.tipo === 'personal') throw new Error('Las metas personales no tienen monto'); return { montoObjetivo: aMonto(v, 'Objetivo') }; }),
            col('Ahorrado', m => (m.tipo === 'personal' ? '' : Math.round(Number(m.ahorroActual) || 0))),
            col('% avance', m => { const o = Number(m.montoObjetivo) || 0; return m.tipo === 'personal' || !o ? '' : Math.round((Number(m.ahorroActual) || 0) / o * 100); }),
            col('Fecha objetivo', m => m.fechaObjetivo || '', (v, m) => { if (m.tipo === 'personal') throw new Error('Las metas personales no tienen fecha objetivo'); return { fechaObjetivo: vacio(v) ? null : aFecha(v) }; }),
            col('Frecuencia', m => m.frecuencia || '', (v, m) => { if (m.tipo === 'personal') throw new Error('Las metas personales no tienen frecuencia'); return { frecuencia: enumDe(['mensual', 'quincenal'], 'Frecuencia')(v) }; }),
            col('Completada', m => !!m.completada, v => ({ completada: aBool(v) })),
            col('Pasos', m => { const p = Array.isArray(m.checklist) ? m.checklist : []; return p.length ? `${p.filter(x => x.completado).length}/${p.length}` : ''; }),
        ],
        crear: (f) => {
            const personal = sinTilde(norm(f.Tipo)) === 'personal';
            if (personal) return { coleccion: 'metas', datos: { nombre: aTexto(f.Nombre, 'Nombre'), tipo: 'personal', plazo: 'mediano', montoObjetivo: 0, ahorroActual: 0, completada: false, checklist: [], metaFinancieraId: null } };
            const objetivo = aMonto(f.Objetivo, 'Objetivo'); if (!(objetivo > 0)) throw new Error('El objetivo debe ser mayor que 0');
            return { coleccion: 'metas', datos: {
                nombre: aTexto(f.Nombre, 'Nombre'), tipo: 'financiera', plazo: 'mediano', montoObjetivo: objetivo, ahorroActual: 0,
                fechaObjetivo: vacio(f['Fecha objetivo']) ? null : aFecha(f['Fecha objetivo']), frecuencia: vacio(f.Frecuencia) ? 'mensual' : enumDe(['mensual', 'quincenal'], 'Frecuencia')(f.Frecuencia),
                aportes: [], completada: false, checklist: [], metaFinancieraId: null, createdAt: ahora(),
            } };
        },
    },
    {
        titulo: 'Inversiones', coleccion: 'transacciones', borrar: false,
        filas: (d) => d.transacciones.filter(esPosicionInversion),
        columnas: [
            col('Nombre', i => i.concepto || ''),
            col('Tipo', i => i.subTipo || ''),
            col('Moneda', i => i.moneda || 'COP'),
            col('Depositado', i => Math.round(depositado(i) * 100) / 100),
            col('Valor actual', i => Math.round(((Number(i.monto) || 0) + (Number(i.utilidad) || 0)) * 100) / 100,
                (v, i) => ({ utilidad: aMonto(v, 'Valor actual') - (Number(i.monto) || 0), valorManual: true })),
            col('Utilidad', i => Math.round((Number(i.utilidad) || 0) * 100) / 100),
            col('Aportes', i => aportesDe(i).length),
            col('Último aporte', i => aportesDe(i).map(a => a.fecha).filter(Boolean).sort().pop() || i.fecha || ''),
        ],
    },
    {
        titulo: 'Deudas', coleccion: 'deudas', borrar: true,
        filas: (d) => d.deudas,
        columnas: [
            col('Nombre', x => x.nombre || '', v => ({ nombre: aTexto(v, 'Nombre') })),
            col('Monto total', x => Number(x.montoTotal) || 0, v => ({ montoTotal: aMonto(v, 'Monto total') })),
            col('Pagado', x => Number(x.montoPagado) || 0),
            col('Saldo', x => saldoDeuda(x)),
            col('Tasa E.A. %', x => Number(x.tasaInteres) || 0, v => ({ tasaInteres: aMonto(v, 'Tasa') })),
            col('Cuota mensual', x => Number(x.cuotaMensual) || 0, v => ({ cuotaMensual: aMonto(v, 'Cuota') })),
            col('Cuotas', x => x.cuotas || '', v => ({ cuotas: vacio(v) ? '' : Math.round(aNumero(v)) })),
            col('Día de pago', x => x.diaPago || '', v => ({ diaPago: aDiaMes(v) })),
            // Acción: escribir un monto aquí registra un abono (igual que en la app: suma al pagado y crea el gasto).
            col('Abonar ahora', () => '', (v, x) => {
                if (vacio(v)) return {};
                const monto = aMonto(v, 'Abono'); if (!(monto > 0)) throw new Error('El abono debe ser mayor que 0');
                return async (ops) => {
                    await ops.genericUpdate('deudas', x.id, { montoPagado: (Number(x.montoPagado) || 0) + monto });
                    await ops.genericAdd('transacciones', { tipo: 'gasto', monto, concepto: `Abono Deuda: ${x.nombre}`, categoria: 'Pago de Deudas', fecha: dateKey(), origen: 'hoja', createdAt: ahora() });
                };
            }),
        ],
        crear: (f) => ({ coleccion: 'deudas', datos: {
            nombre: aTexto(f.Nombre, 'Nombre'), montoTotal: aMonto(f['Monto total'], 'Monto total'), montoPagado: 0,
            cuotas: vacio(f.Cuotas) ? '' : Math.round(aNumero(f.Cuotas)), tasaInteres: vacio(f['Tasa E.A. %']) ? 0 : aMonto(f['Tasa E.A. %'], 'Tasa'),
            cuotaMensual: vacio(f['Cuota mensual']) ? 0 : aMonto(f['Cuota mensual'], 'Cuota'), diaPago: aDiaMes(f['Día de pago']), createdAt: ahora(),
        } }),
    },
    {
        titulo: 'Cuentas', coleccion: 'cuentas', borrar: false,
        filas: (d) => d.cuentas,
        columnas: [
            col('Nombre', c => c.nombre || '', v => ({ nombre: aTexto(v, 'Nombre') })),
            col('Tipo', c => c.tipo || 'debito'),
            col('Saldo inicial', c => Number(c.saldoInicial) || 0, v => ({ saldoInicial: aNumero(v) || 0 })),
            col('Saldo actual', (c, x) => x.saldoCuenta(c)),
            col('Cupo', c => (c.tipo === 'credito' ? Number(c.cupo) || 0 : ''), (v, c) => { if (c.tipo !== 'credito') throw new Error('Solo las tarjetas de crédito tienen cupo'); return { cupo: aMonto(v, 'Cupo') }; }),
            col('Día de corte', c => c.diaCorte || '', (v, c) => { if (c.tipo !== 'credito') throw new Error('Solo las tarjetas tienen día de corte'); return { diaCorte: aDiaMes(v) }; }),
            col('Día de pago', c => c.diaPago || '', (v, c) => { if (c.tipo !== 'credito') throw new Error('Solo las tarjetas tienen día de pago'); return { diaPago: aDiaMes(v) }; }),
        ],
        crear: (f) => {
            const tipo = vacio(f.Tipo) ? 'debito' : enumDe(['efectivo', 'debito', 'ahorros', 'credito'], 'Tipo')(f.Tipo);
            return { coleccion: 'cuentas', datos: {
                nombre: aTexto(f.Nombre, 'Nombre'), tipo, saldoInicial: vacio(f['Saldo inicial']) ? 0 : aNumero(f['Saldo inicial']) || 0,
                cupo: tipo === 'credito' && !vacio(f.Cupo) ? aMonto(f.Cupo, 'Cupo') : null,
                diaCorte: tipo === 'credito' ? aDiaMes(f['Día de corte']) : null, diaPago: tipo === 'credito' ? aDiaMes(f['Día de pago']) : null, createdAt: ahora(),
            } };
        },
    },
    {
        titulo: 'Hábitos', coleccion: 'habitos', borrar: true,
        filas: (d) => d.habitos,
        columnas: [
            col('Emoji', h => h.emoji || '', v => ({ emoji: norm(v) })),
            col('Nombre', h => h.nombre || '', v => ({ nombre: aTexto(v, 'Nombre') })),
            col('Racha (días)', h => calcStreak(h.historial || [])),
            col('Hecho hoy', (h, c) => (h.historial || []).includes(c.hoy), (v, h, c) => {
                const set = new Set(h.historial || []);
                if (aBool(v)) set.add(c.hoy); else set.delete(c.hoy);
                return { historial: Array.from(set) };
            }),
        ],
        crear: (f) => ({ coleccion: 'habitos', datos: { nombre: aTexto(f.Nombre, 'Nombre'), emoji: norm(f.Emoji) || '✅', color: 'indigo', historial: [], createdAt: ahora() } }),
    },
    {
        titulo: 'Diario', coleccion: 'diario', borrar: true,
        filas: (d) => [...d.diario].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
        columnas: [
            col('Fecha', x => x.fecha || '', v => ({ fecha: aFecha(v) })),
            col('Ánimo (1-5)', x => x.animo || '', v => { const n = Math.round(aNumero(v)); if (!(n >= 1 && n <= 5)) throw new Error('El ánimo va de 1 a 5'); return { animo: n }; }),
            col('Texto', x => x.texto || '', v => ({ texto: norm(v) })),
        ],
        crear: (f) => {
            const animo = vacio(f['Ánimo (1-5)']) ? 3 : Math.round(aNumero(f['Ánimo (1-5)']));
            if (!(animo >= 1 && animo <= 5)) throw new Error('El ánimo va de 1 a 5');
            return { coleccion: 'diario', datos: { fecha: vacio(f.Fecha) ? dateKey() : aFecha(f.Fecha), animo, texto: norm(f.Texto), createdAt: ahora() } };
        },
    },
    {
        titulo: 'Rutina', coleccion: 'rutina', borrar: true,
        filas: (d) => [...d.rutina].sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7) || (a.horaInicio || '').localeCompare(b.horaInicio || '')),
        columnas: [
            col('Día', b => DIAS[b.dia] || '', v => ({ dia: aDia(v) })),
            col('Desde', b => b.horaInicio || '', v => ({ horaInicio: aHora(v) })),
            col('Hasta', b => b.horaFin || '', v => ({ horaFin: aHora(v) })),
            col('Actividad', b => b.titulo || '', v => ({ titulo: aTexto(v, 'Actividad') })),
            col('Emoji', b => b.emoji || '', v => ({ emoji: norm(v) })),
            col('Notas', b => b.notas || '', v => ({ notas: norm(v) })),
        ],
        crear: (f) => ({ coleccion: 'rutina', datos: {
            dia: aDia(f['Día']), horaInicio: aHora(f.Desde), horaFin: aHora(f.Hasta), titulo: aTexto(f.Actividad, 'Actividad'),
            emoji: norm(f.Emoji) || '⏰', notas: norm(f.Notas), color: 'indigo', createdAt: ahora(),
        } }),
    },
    {
        titulo: 'Recordatorios', coleccion: 'recordatorios', borrar: true,
        filas: (d) => d.recordatorios,
        protegerBorrado: (r) => (r.sistema ? 'Los recordatorios del sistema no se borran: desactívalos' : null),
        columnas: [
            col('Emoji', r => r.emoji || '', (v, r) => (r.sistema ? {} : { emoji: norm(v) })),
            col('Título', r => r.titulo || '', (v, r) => { if (r.sistema) throw new Error('El título de un recordatorio del sistema no se cambia'); return { titulo: aTexto(v, 'Título') }; }),
            col('Tipo', r => (r.sistema ? `sistema: ${r.sistema}` : r.tipo || 'hora')),
            col('Hora', r => r.hora || (r.tipo === 'intervalo' ? `${r.desde || ''}–${r.hasta || ''}` : ''), (v, r) => { if (r.tipo === 'intervalo') throw new Error('Los recordatorios por intervalo se editan en la app'); return { hora: aHora(v) }; }),
            col('Fecha', r => r.fecha || '', (v, r) => { if (r.tipo !== 'unico') throw new Error('Solo los recordatorios únicos tienen fecha'); return { fecha: aFecha(v) }; }),
            col('Días', r => (Array.isArray(r.dias) && r.dias.length ? r.dias.map(d => DIAS[d]).join(', ') : ''), (v, r) => { if (r.sistema || r.tipo === 'unico') throw new Error('Este recordatorio no usa días'); return { dias: aDias(v) }; }),
            col('Activo', r => r.activo !== false, v => ({ activo: aBool(v) })),
            col('Mensaje', r => r.mensaje || '', (v, r) => (r.sistema ? {} : { mensaje: norm(v) })),
        ],
        crear: (f) => {
            const unico = !vacio(f.Fecha);
            return { coleccion: 'recordatorios', datos: {
                titulo: aTexto(f['Título'], 'Título'), emoji: norm(f.Emoji) || '🔔', tipo: unico ? 'unico' : 'hora', hora: aHora(f.Hora),
                ...(unico ? { fecha: aFecha(f.Fecha), dias: [] } : { dias: aDias(f['Días']) }),
                habitoId: null, mensaje: norm(f.Mensaje), activo: vacio(f.Activo) ? true : aBool(f.Activo), origen: 'hoja', createdAt: ahora(),
            } };
        },
    },
    {
        titulo: 'Proyectos', coleccion: 'proyectos', borrar: false,
        filas: (d) => d.proyectos,
        columnas: [
            col('Emoji', p => p.emoji || '', v => ({ emoji: norm(v) })),
            col('Nombre', p => p.nombre || '', v => ({ nombre: aTexto(v, 'Nombre') })),
            col('Estado proyecto', p => p.estado || 'activo', v => ({ estado: enumDe(['activo', 'archivado'], 'Estado')(v) })),
            col('Tareas pendientes', (p, c) => c.items.filter(i => i.proyectoId === p.id && i.tipo === 'tarea' && i.estado === 'pendiente').length),
            col('En curso', (p, c) => c.items.filter(i => i.proyectoId === p.id && i.tipo === 'tarea' && i.estado === 'en_curso').length),
            col('Hechas', (p, c) => c.items.filter(i => i.proyectoId === p.id && i.tipo === 'tarea' && i.estado === 'hecha').length),
        ],
        crear: (f) => ({ coleccion: 'proyectos', datos: { nombre: aTexto(f.Nombre, 'Nombre'), emoji: norm(f.Emoji) || '📁', estado: 'activo', createdAt: ahora() } }),
    },
    {
        titulo: 'Tareas de proyectos', coleccion: 'proyecto_items', borrar: true,
        filas: (d) => d.proyectoItems.filter(i => ['tarea', 'avance', 'meta'].includes(i.tipo)),
        columnas: [
            col('Proyecto', (i, c) => c.nombreProyecto[i.proyectoId] || ''),
            col('Tipo', i => i.tipo),
            col('Texto', i => i.titulo || i.texto || '', (v, i) => (i.tipo === 'avance' ? { texto: aTexto(v, 'Texto') } : { titulo: aTexto(v, 'Texto') })),
            col('Estado tarea', i => (i.tipo === 'tarea' ? i.estado || 'pendiente' : i.tipo === 'meta' ? (i.completada ? 'hecha' : 'pendiente') : ''), (v, i) => {
                if (i.tipo === 'avance') throw new Error('Los avances no tienen estado');
                const e = enumDe(['pendiente', 'en_curso', 'hecha'], 'Estado')(v);
                return i.tipo === 'meta' ? { completada: e === 'hecha' } : { estado: e, movedAt: ahora() };
            }),
            col('Fecha', i => i.fechaLimite || i.fecha || '', (v, i) => (i.tipo === 'meta' ? { fechaLimite: vacio(v) ? null : aFecha(v) } : i.tipo === 'avance' ? { fecha: aFecha(v) } : {})),
        ],
        crear: (f, c) => {
            const p = c.proyectoPorNombre(f.Proyecto); if (!p) throw new Error(`No existe el proyecto "${norm(f.Proyecto)}"`);
            const tipo = vacio(f.Tipo) ? 'tarea' : enumDe(['tarea', 'avance', 'meta'], 'Tipo')(f.Tipo);
            const base = { proyectoId: p.id, tipo, createdAt: ahora() };
            if (tipo === 'avance') return { coleccion: 'proyecto_items', datos: { ...base, texto: aTexto(f.Texto, 'Texto'), fecha: vacio(f.Fecha) ? dateKey() : aFecha(f.Fecha) } };
            if (tipo === 'meta') return { coleccion: 'proyecto_items', datos: { ...base, titulo: aTexto(f.Texto, 'Texto'), fechaLimite: vacio(f.Fecha) ? null : aFecha(f.Fecha), completada: false } };
            return { coleccion: 'proyecto_items', datos: { ...base, titulo: aTexto(f.Texto, 'Texto'), estado: 'pendiente', prioridad: 'media', movedAt: ahora() } };
        },
    },
];

// --- Contexto calculado (nombres, saldos, gasto del mes) ---
function contexto(d) {
    const hoy = dateKey(), mes = hoy.slice(0, 7);
    const nombreCuenta = Object.fromEntries(d.cuentas.map(c => [c.id, c.nombre]));
    const nombreProyecto = Object.fromEntries(d.proyectos.map(p => [p.id, p.nombre]));
    const gastoMesPorCat = {};
    d.transacciones.filter(t => esGastoConsumo(t) && (t.fecha || '').startsWith(mes)).forEach(t => { gastoMesPorCat[t.categoria] = (gastoMesPorCat[t.categoria] || 0) + (Number(t.monto) || 0); });
    const porNombre = (lista, v) => lista.find(x => sinTilde(norm(x.nombre)) === sinTilde(norm(v)));
    return {
        hoy, mes, nombreCuenta, nombreProyecto, gastoMesPorCat, items: d.proyectoItems,
        cuentaPorNombre: (v) => porNombre(d.cuentas, v),
        proyectoPorNombre: (v) => porNombre(d.proyectos, v),
        saldoCuenta: (c) => Math.round((Number(c.saldoInicial) || 0) + d.transacciones.reduce((a, t) => {
            const m = Number(t.monto) || 0;
            if (t.tipo === 'ingreso' && t.cuentaId === c.id) return a + m;
            if (t.tipo === 'gasto' && t.cuentaId === c.id) return a - m;
            if (t.tipo === 'transferencia') return a + (t.destinoId === c.id ? m : 0) - (t.origenId === c.id ? m : 0);
            return a;
        }, 0)),
    };
}

// --- Pestañas fijas (solo lectura) ---
function filasResumen(d, c) {
    const suma = (l) => l.reduce((a, t) => a + (Number(t.monto) || 0), 0);
    const ingresos = suma(d.transacciones.filter(t => t.tipo === 'ingreso'));
    const gastos = suma(d.transacciones.filter(t => t.tipo === 'gasto'));
    const delMes = d.transacciones.filter(t => (t.fecha || '').startsWith(c.mes));
    const ahorros = suma(d.transacciones.filter(t => t.tipo === 'gasto' && t.esAhorro));
    const invCOP = d.transacciones.filter(t => esPosicionInversion(t) && t.moneda !== 'USD').reduce((a, t) => a + (Number(t.monto) || 0) + (Number(t.utilidad) || 0), 0);
    const deuda = d.deudas.reduce((a, x) => a + saldoDeuda(x), 0);
    const perfil = (d.coachMemoria.find(m => m.texto) || {}).texto || '';
    return [
        ['Concepto', 'Valor'],
        ['Actualizado', new Date().toLocaleString('es-CO')],
        ['Mes', c.mes],
        ['Saldo disponible (COP)', Math.round(ingresos - gastos)],
        ['Ingresos del mes', Math.round(suma(delMes.filter(t => t.tipo === 'ingreso')))],
        ['Gasto de consumo del mes', Math.round(suma(delMes.filter(esGastoConsumo)))],
        ['Gastado hoy', Math.round(suma(delMes.filter(t => esGastoConsumo(t) && t.fecha === c.hoy)))],
        ['Ahorro apartado del mes', Math.round(suma(delMes.filter(t => t.tipo === 'gasto' && t.esAhorro)))],
        ['Inversiones (COP, valor actual)', Math.round(invCOP)],
        ['Deudas pendientes', Math.round(deuda)],
        ['Patrimonio neto (sin USD)', Math.round(ingresos - gastos + ahorros + invCOP - deuda)],
        ['', ''],
        ['Gasto del mes por categoría', ''],
        ...Object.entries(c.gastoMesPorCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)]),
        ...(perfil ? [['', ''], ['Perfil financiero (análisis semanal)', perfil.slice(0, 45000)]] : []),
    ];
}

const LEEME = [
    ['Finanzas 360 · datos en vivo'],
    ['Esta hoja la mantiene la app Finanzas 360 y se actualiza sola (≈1 minuto después de cada cambio). Montos en pesos colombianos (COP) salvo que la columna Moneda diga USD.'],
    ['This spreadsheet is kept in sync by the Finanzas 360 app. It holds the user\'s personal finances, habits, routine and projects. Amounts are in Colombian pesos (COP) unless Moneda says USD.'],
    [''],
    ['CÓMO EDITAR / HOW TO EDIT'],
    ['• Cambiar: edita una celda de una columna editable. La app aplica el cambio y lo deja en la pestaña Historial.'],
    ['• Crear: agrega una fila nueva al final de la pestaña dejando la columna ID vacía.'],
    ['• Borrar: escribe TRUE en la columna Borrar de la fila.'],
    ['• Abonar a una deuda: escribe el monto en "Abonar ahora". Marcar un hábito: TRUE en "Hecho hoy".'],
    ['• La columna Estado y la pestaña Historial dicen si cada cambio se aplicó o por qué no.'],
    [''],
    ['SOLO LECTURA / READ-ONLY'],
    ['• Ingresos: no se pueden crear ni editar desde la hoja (solo en la app).'],
    ['• Movimientos automáticos (reglas de ahorro, aportes a metas o inversiones): se cambian desde su meta o inversión en la app.'],
    ['• Columnas calculadas (saldos, rachas, porcentajes) y las pestañas Resumen, Léeme e Historial.'],
    ['• No borres filas a mano: usa la columna Borrar. No cambies la columna ID (está oculta).'],
    [''],
    ['Nunca se exportan: contraseñas de la bóveda, credenciales de proyectos ni el chat del coach.'],
];

const HISTORIAL_ENC = ['Fecha y hora', 'Pestaña', 'Acción', 'Registro', 'Detalle', 'Resultado'];
const FIJAS = ['Léeme', 'Resumen'];
const todasLasPestanas = () => [...FIJAS, ...PESTANAS.map(p => p.titulo), 'Historial'];

// Encabezados completos de una pestaña de datos.
const encabezados = (p) => ['ID', ...p.columnas.map(c => c.h), ...(p.borrar ? ['Borrar'] : []), 'Estado'];

// --- API de Sheets ---
async function api(token, ruta, opts = {}) {
    const res = await fetch(`${API}${ruta}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (!res.ok) {
        const detalle = await res.json().catch(() => ({}));
        const msg = detalle?.error?.message || res.statusText;
        const err = new Error(res.status === 401 || res.status === 403
            ? `Google no autorizó el acceso a la hoja (${msg}). Vuelve a conectar Google desde la app.`
            : `Google Sheets: ${msg}`);
        err.status = res.status;
        throw err;
    }
    return res.status === 204 ? null : res.json();
}
const rango = (titulo, a1 = 'A1:Z') => `'${titulo.replace(/'/g, "''")}'!${a1}`;

// Crea la hoja con todas las pestañas, oculta la columna ID y fija los encabezados.
export async function crearHoja(token) {
    const nueva = await api(token, '', {
        method: 'POST',
        body: JSON.stringify({
            properties: { title: TITULO_HOJA, locale: 'es_CO', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota' },
            sheets: todasLasPestanas().map(t => ({ properties: { title: t, gridProperties: { frozenRowCount: 1 } } })),
        }),
    });
    await darFormato(token, nueva);
    return { id: nueva.spreadsheetId, url: nueva.spreadsheetUrl, snap: {}, mensajes: {} };
}

async function darFormato(token, hoja) {
    const ids = Object.fromEntries((hoja.sheets || []).map(s => [s.properties.title, s.properties.sheetId]));
    const requests = [];
    Object.entries(ids).forEach(([t, sheetId]) => {
        requests.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } });
        if (PESTANAS.some(p => p.titulo === t)) {
            requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } });
        }
    });
    if (ids['Léeme'] !== undefined) requests.push({ updateDimensionProperties: { range: { sheetId: ids['Léeme'], dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 900 }, fields: 'pixelSize' } });
    if (requests.length) await api(token, `/${hoja.spreadsheetId}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
}

// Recrea pestañas que alguien haya borrado.
async function asegurarPestanas(token, estado) {
    const hoja = await api(token, `/${estado.id}?fields=spreadsheetId,sheets.properties(title,sheetId)`);
    const existentes = new Set((hoja.sheets || []).map(s => s.properties.title));
    const faltan = todasLasPestanas().filter(t => !existentes.has(t));
    if (!faltan.length) return;
    const r = await api(token, `/${estado.id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: faltan.map(title => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }) });
    faltan.forEach(t => { delete estado.snap[t]; });
    await darFormato(token, { spreadsheetId: estado.id, sheets: (r.replies || []).map(x => x.addSheet) });
}

// --- 1. Leer la hoja y aplicar las ediciones ---
async function aplicarEdiciones(token, estado, datos, ops, registrar) {
    const conSnap = PESTANAS.filter(p => estado.snap[p.titulo]);
    if (!conSnap.length) return 0;
    const q = conSnap.map(p => `ranges=${encodeURIComponent(rango(p.titulo))}`).join('&');
    const lectura = await api(token, `/${estado.id}/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
    const ctx = contexto(datos);
    let aplicados = 0;

    for (const [i, p] of conSnap.entries()) {
        const filas = (lectura.valueRanges?.[i]?.values || []).slice(1);
        const snap = estado.snap[p.titulo];
        // Filas leídas: la próxima escritura cubre al menos esas (limpia filas rechazadas).
        estado.leidas[p.titulo] = filas.length + 1;
        // Si la hoja difiere de lo último escrito, la pestaña se reescribe aunque los datos
        // no cambien (revierte ediciones rechazadas y no las vuelve a procesar).
        if (filas.length + 1 !== snap.n || filas.some(f => { const a = snap.filas[norm(f[0])]; return !a || f.slice(0, a.length).some((v, j) => norm(v) !== a[j]); })) estado.sucias.add(p.titulo);
        const docs = Object.fromEntries(p.filas(datos).map(d => [d.id, d]));
        const iBorrar = p.borrar ? 1 + p.columnas.length : -1;

        for (const fila of filas) {
            const id = norm(fila[0]);
            if (id) {
                const antes = snap.filas[id];
                const doc = docs[id];
                if (!antes) continue;
                if (!doc) continue; // ya no existe en la app; la próxima escritura quita la fila
                if (iBorrar > 0 && aBool(fila[iBorrar]) && !aBool(antes[iBorrar])) {
                    const motivo = p.protegido?.(doc, ctx) || p.protegerBorrado?.(doc, ctx);
                    if (motivo) { registrar(p.titulo, 'Borrar', id, '', `No permitido: ${motivo}`); continue; }
                    await ops.genericDelete(p.coleccion, id);
                    registrar(p.titulo, 'Borrar', id, '', 'Aplicado'); aplicados++;
                    continue;
                }
                const cambios = p.columnas.map((c, j) => ({ c, j: j + 1 })).filter(({ c, j }) => c.e && norm(fila[j]) !== norm(antes[j]));
                if (!cambios.length) continue;
                const motivo = p.protegido?.(doc, ctx);
                if (motivo) { cambios.forEach(({ c, j }) => registrar(p.titulo, `Editar ${c.h}`, id, `${norm(antes[j])} → ${norm(fila[j])}`, `No permitido: ${motivo}`)); estado.mensajes[id] = { m: `✗ ${motivo}`, t: Date.now() }; continue; }
                const parche = {}; const acciones = []; const errores = [];
                for (const { c, j } of cambios) {
                    try {
                        const r = c.e(fila[j], doc, ctx);
                        if (typeof r === 'function') acciones.push(r); else Object.assign(parche, r);
                        registrar(p.titulo, `Editar ${c.h}`, id, `${norm(antes[j])} → ${norm(fila[j])}`, 'Aplicado');
                    } catch (e) {
                        errores.push(`${c.h}: ${e.message}`);
                        registrar(p.titulo, `Editar ${c.h}`, id, `${norm(antes[j])} → ${norm(fila[j])}`, `Error: ${e.message}`);
                    }
                }
                if (Object.keys(parche).length) await ops.genericUpdate(p.coleccion, id, parche);
                for (const a of acciones) await a(ops);
                if (Object.keys(parche).length || acciones.length) aplicados++;
                estado.mensajes[id] = { m: errores.length ? `✗ ${errores.join(' · ')}` : '✓ Cambio aplicado', t: Date.now() };
            } else if (fila.slice(1, 1 + p.columnas.length).some(v => !vacio(v))) {
                const valores = Object.fromEntries(p.columnas.map((c, j) => [c.h, fila[j + 1]]));
                const resumen = p.columnas.map((c, j) => norm(fila[j + 1])).filter(Boolean).join(' · ').slice(0, 200);
                if (!p.crear) { registrar(p.titulo, 'Crear', '', resumen, 'No permitido: en esta pestaña no se crean filas'); continue; }
                try {
                    const { coleccion, datos: nuevo } = p.crear(valores, ctx);
                    const ref = await ops.genericAdd(coleccion, nuevo);
                    if (ref?.id) estado.mensajes[ref.id] = { m: '✓ Creado desde la hoja', t: Date.now() };
                    registrar(p.titulo, 'Crear', ref?.id || '', resumen, 'Aplicado'); aplicados++;
                } catch (e) {
                    registrar(p.titulo, 'Crear', '', resumen, `Error: ${e.message}`);
                }
            }
        }
    }
    return aplicados;
}

// --- 2. Escribir los datos actuales ---
async function escribir(token, estado, datos) {
    const ctx = contexto(datos);
    const ahoraMs = Date.now();
    Object.keys(estado.mensajes).forEach(k => { if (ahoraMs - estado.mensajes[k].t > MSG_TTL) delete estado.mensajes[k]; });
    const data = [];
    const nuevasSnap = {};

    for (const p of PESTANAS) {
        const filas = p.filas(datos).map(doc => {
            const valores = [doc.id, ...p.columnas.map(c => { const v = c.v(doc, ctx); return v === undefined || v === null ? '' : v; })];
            if (p.borrar) valores.push(false);
            valores.push(estado.mensajes[doc.id]?.m || (p.protegido?.(doc, ctx) ? '🔒 Solo lectura' : ''));
            return valores;
        });
        const grilla = [encabezados(p), ...filas];
        const firma = huella(JSON.stringify(grilla));
        const prev = estado.snap[p.titulo];
        nuevasSnap[p.titulo] = { filas: Object.fromEntries(filas.map(f => [f[0], f.map(norm)])), n: grilla.length, firma };
        if (prev && prev.firma === firma && !estado.sucias.has(p.titulo)) continue;
        const ancho = grilla[0].length;
        const cubrir = Math.max(prev?.n || 0, estado.leidas[p.titulo] || 0);
        const relleno = Array.from({ length: Math.max(0, cubrir - grilla.length) }, () => Array(ancho).fill(''));
        data.push({ range: rango(p.titulo, 'A1'), values: [...grilla, ...relleno] });
    }

    if (!estado.snap['Léeme']) data.push({ range: rango('Léeme', 'A1'), values: LEEME });
    nuevasSnap['Léeme'] = { n: LEEME.length };
    if (!estado.snap.Historial) data.push({ range: rango('Historial', 'A1'), values: [HISTORIAL_ENC] });
    nuevasSnap.Historial = { n: 1 };

    // Resumen: se reescribe si cambió su contenido (sin contar la hora) o si cambió otra pestaña.
    const resumen = filasResumen(datos, ctx);
    const firmaRes = huella(JSON.stringify(resumen.filter(f => f[0] !== 'Actualizado')));
    const prevRes = estado.snap.Resumen;
    nuevasSnap.Resumen = { n: resumen.length, firma: firmaRes };
    if (data.length || prevRes?.firma !== firmaRes) {
        data.push({ range: rango('Resumen', 'A1'), values: [...resumen, ...Array.from({ length: Math.max(0, (prevRes?.n || 0) - resumen.length) }, () => ['', ''])] });
    }

    if (data.length) await api(token, `/${estado.id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
    // Pestañas cuya instantánea cambió: solo esas se guardan en el almacén.
    const cambiadas = Object.keys(nuevasSnap).filter(t => { const a = estado.snap[t], b = nuevasSnap[t]; return !a || a.n !== b.n || a.firma !== b.firma; });
    estado.snap = nuevasSnap;
    return cambiadas;
}

// --- Ciclo completo: turno → leer → aplicar → escribir → guardar ---
// Devuelve null si otro dispositivo tiene el turno (lo intentará en el próximo ciclo).
let enCurso = null;
export function sincronizarHoja({ token, obtenerDatos, ops, almacen }) {
    if (enCurso) return enCurso;
    enCurso = (async () => {
        if (!(await almacen.tomarTurno())) return null;
        try {
            const estado = await almacen.cargar();
            if (!estado?.id) throw new Error('La hoja no está activada');
            estado.mensajes ||= {}; estado.snap ||= {};
            estado.leidas = {}; estado.sucias = new Set(); // solo de este ciclo
            await asegurarPestanas(token, estado);
            const historial = [];
            const registrar = (pestana, accion, id, detalle, resultado) => historial.push([new Date().toLocaleString('es-CO'), pestana, accion, id, detalle, resultado]);

            const aplicados = await aplicarEdiciones(token, estado, obtenerDatos(), ops, registrar);
            if (historial.length) {
                await api(token, `/${estado.id}/values/${encodeURIComponent(rango('Historial', 'A1'))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: historial }) });
            }
            // Tras aplicar, esperar a que Firestore refleje los cambios (caché local) antes de reescribir.
            if (aplicados) await new Promise(r => setTimeout(r, 1500));
            const cambiadas = await escribir(token, estado, obtenerDatos());
            delete estado.leidas; delete estado.sucias;
            await almacen.guardar(estado, cambiadas);
            return { aplicados, revisados: historial.length, hora: new Date() };
        } finally {
            await almacen.soltarTurno().catch(() => {});
        }
    })().finally(() => { enCurso = null; });
    return enCurso;
}
