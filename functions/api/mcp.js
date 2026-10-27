// Servidor MCP de SOLO LECTURA (Streamable HTTP, sin estado) para Gemini u otro asistente.
//
// POST /mcp con JSON-RPC 2.0 y `Authorization: Bearer <access token>` emitido por
// mcp-oauth.js. Sin token válido responde 401 con el enlace a los metadatos OAuth.
//
// Seguridad:
//   - Solo hay herramientas de lectura; ninguna escribe en Firestore.
//   - Cada herramienta lee colecciones de una lista cerrada y devuelve solo campos
//     elegidos. Nunca se leen: passwords, vault_config, proyecto_credenciales,
//     diario, coach_mensajes ni coach_memoria.
//   - Cada llamada queda en los logs del Worker (herramienta + resultado, sin datos).

import { leerColeccion } from '../lib/firestore.js';
import { uidDeToken, SCOPE } from './mcp-oauth.js';
import { esPosicionInversion, aportesDe, depositado } from '../../src/lib/inversiones.js';
import { esGastoConsumo, aporteSugeridoMeta, estadoMeta, calcStreak } from '../../src/lib/finanzas.js';
import { saldoDeuda } from '../../src/lib/deudas.js';

const VERSIONES = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const ZONA = 'America/Bogota';

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
const rpcOk = (id, result) => json({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => json({ jsonrpc: '2.0', id, error: { code, message } });

// --- Fechas en la zona del usuario (el Worker corre en UTC) ---
const hoyKey = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
const sumarDias = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mesAnterior = (ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); };
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const esMes = (s) => /^\d{4}-\d{2}$/.test(s || '');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const n = (v) => Number(v) || 0;
const suma = (lista) => lista.reduce((a, t) => a + n(t.monto), 0);
const redondo = (v) => Math.round(n(v));

// --- Herramientas ---
const SIN_PARAMS = { type: 'object', properties: {}, additionalProperties: false };
const LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const HERRAMIENTAS = [
    {
        name: 'resumen_financiero',
        description: 'Panorama financiero de un mes (por defecto el actual) en pesos colombianos (COP): saldo disponible, ingresos, gasto de consumo total y por categoría, gasto de hoy, comparación con el mes anterior, topes de gasto y patrimonio neto.',
        inputSchema: { type: 'object', properties: { mes: { type: 'string', description: 'Mes en formato YYYY-MM. Por defecto, el mes actual.' } }, additionalProperties: false },
        colecciones: ['transacciones', 'limites', 'deudas'],
        run: ({ transacciones, limites, deudas }, args) => {
            const hoy = hoyKey();
            const mes = esMes(args.mes) ? args.mes : hoy.slice(0, 7);
            const delMes = (ym) => transacciones.filter(t => (t.fecha || '').startsWith(ym));
            const consumoPorCat = (lista) => lista.filter(esGastoConsumo).reduce((acc, t) => { const c = t.categoria || 'Sin categoría'; acc[c] = (acc[c] || 0) + n(t.monto); return acc; }, {});
            const actual = delMes(mes), previo = delMes(mesAnterior(mes));
            const porCat = consumoPorCat(actual);
            const ingresosTot = suma(transacciones.filter(t => t.tipo === 'ingreso'));
            const gastosTot = suma(transacciones.filter(t => t.tipo === 'gasto'));
            const ahorros = suma(transacciones.filter(t => t.tipo === 'gasto' && t.esAhorro));
            const invCOP = transacciones.filter(t => esPosicionInversion(t) && t.moneda !== 'USD').reduce((a, t) => a + n(t.monto) + n(t.utilidad), 0);
            const invUSD = transacciones.filter(t => esPosicionInversion(t) && t.moneda === 'USD').reduce((a, t) => a + n(t.monto) + n(t.utilidad), 0);
            const deudaTot = deudas.reduce((a, d) => a + saldoDeuda(d), 0);
            return {
                mes, hoy, moneda: 'COP',
                saldo_disponible: redondo(ingresosTot - gastosTot),
                ingresos_mes: redondo(suma(actual.filter(t => t.tipo === 'ingreso'))),
                gasto_consumo_mes: redondo(suma(actual.filter(esGastoConsumo))),
                ahorro_apartado_mes: redondo(suma(actual.filter(t => t.tipo === 'gasto' && t.esAhorro))),
                gasto_hoy: mes === hoy.slice(0, 7) ? redondo(suma(actual.filter(t => esGastoConsumo(t) && t.fecha === hoy))) : null,
                gasto_por_categoria: Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([categoria, total]) => ({ categoria, total: redondo(total) })),
                mes_anterior: { ingresos: redondo(suma(previo.filter(t => t.tipo === 'ingreso'))), gasto_consumo: redondo(suma(previo.filter(esGastoConsumo))) },
                topes_de_gasto: limites.map(l => {
                    const gastado = porCat[l.categoria] || 0, tope = n(l.limite);
                    return { categoria: l.categoria, tope: redondo(tope), gastado: redondo(gastado), porcentaje: tope > 0 ? Math.round(gastado / tope * 100) : null, excedido: tope > 0 && gastado > tope };
                }),
                patrimonio: { disponible: redondo(ingresosTot - gastosTot), ahorros_apartados: redondo(ahorros), inversiones_cop: redondo(invCOP), inversiones_usd: Math.round(invUSD * 100) / 100, deudas: redondo(deudaTot), neto_sin_usd: redondo(ingresosTot - gastosTot + ahorros + invCOP - deudaTot) },
            };
        },
    },
    {
        name: 'movimientos',
        description: 'Lista de movimientos (ingresos, gastos, transferencias, aportes) filtrados por fechas, tipo, categoría o texto. Por defecto, los últimos 30 días. Montos en COP salvo que se indique moneda USD.',
        inputSchema: {
            type: 'object',
            properties: {
                desde: { type: 'string', description: 'Fecha inicial YYYY-MM-DD (incluida).' },
                hasta: { type: 'string', description: 'Fecha final YYYY-MM-DD (incluida).' },
                tipo: { type: 'string', enum: ['ingreso', 'gasto', 'transferencia'] },
                categoria: { type: 'string', description: 'Categoría exacta, p. ej. "Comida".' },
                texto: { type: 'string', description: 'Busca en el concepto (sin distinguir mayúsculas).' },
                limite: { type: 'integer', minimum: 1, maximum: 500, description: 'Máximo de resultados (por defecto 100).' },
            },
            additionalProperties: false,
        },
        colecciones: ['transacciones', 'cuentas'],
        run: ({ transacciones, cuentas }, args) => {
            const hasta = esFecha(args.hasta) ? args.hasta : hoyKey();
            const desde = esFecha(args.desde) ? args.desde : sumarDias(hasta, -30);
            const texto = String(args.texto || '').toLowerCase();
            const limite = Math.min(Math.max(Number(args.limite) || 100, 1), 500);
            const nombreCuenta = Object.fromEntries(cuentas.map(c => [c.id, c.nombre]));
            const filtrados = transacciones
                .filter(t => (t.fecha || '') >= desde && (t.fecha || '') <= hasta)
                .filter(t => !args.tipo || t.tipo === args.tipo)
                .filter(t => !args.categoria || t.categoria === args.categoria)
                .filter(t => !texto || String(t.concepto || '').toLowerCase().includes(texto))
                .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
            return {
                desde, hasta, total_encontrados: filtrados.length,
                movimientos: filtrados.slice(0, limite).map(t => ({
                    fecha: t.fecha, tipo: t.tipo, categoria: t.categoria || null, concepto: t.concepto || null,
                    monto: n(t.monto), moneda: t.moneda || 'COP',
                    ...(t.esAhorro ? { ahorro: true } : {}), ...(t.esInversion ? { inversion: true } : {}),
                    ...(t.cuentaId && nombreCuenta[t.cuentaId] ? { cuenta: nombreCuenta[t.cuentaId] } : {}),
                    ...(t.tipo === 'transferencia' ? { desde_cuenta: nombreCuenta[t.origenId] || null, hacia_cuenta: nombreCuenta[t.destinoId] || null } : {}),
                })),
            };
        },
    },
    {
        name: 'presupuesto',
        description: 'Presupuesto mensual: pagos planeados (recurrentes o no) con su día de pago y si ya se pagaron este mes, topes de gasto por categoría, y deudas con cuota y día de pago.',
        inputSchema: SIN_PARAMS,
        colecciones: ['presupuesto', 'limites', 'deudas', 'transacciones'],
        run: ({ presupuesto, limites, deudas, transacciones }) => {
            const hoy = hoyKey(), mes = hoy.slice(0, 7);
            const porCat = transacciones.filter(t => esGastoConsumo(t) && (t.fecha || '').startsWith(mes))
                .reduce((acc, t) => { acc[t.categoria] = (acc[t.categoria] || 0) + n(t.monto); return acc; }, {});
            const items = presupuesto.map(p => ({
                concepto: p.concepto, monto: redondo(p.monto), categoria: p.categoria || null, recurrente: p.recurrente !== false,
                dia_pago: p.diaPago || null, pagado_este_mes: (p.lastPaid || '').startsWith(mes),
            }));
            return {
                mes, total_planeado: redondo(items.reduce((a, i) => a + i.monto, 0)),
                total_pendiente: redondo(items.filter(i => !i.pagado_este_mes).reduce((a, i) => a + i.monto, 0)),
                pagos_planeados: items.sort((a, b) => (a.dia_pago || 99) - (b.dia_pago || 99)),
                topes_de_gasto: limites.map(l => ({ categoria: l.categoria, tope: redondo(l.limite), gastado_este_mes: redondo(porCat[l.categoria] || 0) })),
                cuotas_de_deudas: deudas.filter(d => saldoDeuda(d) > 0).map(d => ({ deuda: d.nombre, cuota_mensual: redondo(d.cuotaMensual) || null, dia_pago: d.diaPago || null })),
            };
        },
    },
    {
        name: 'metas',
        description: 'Metas financieras (objetivo, ahorrado, porcentaje, fecha objetivo, aporte sugerido y si van al día) y metas personales (avance de su lista de pasos).',
        inputSchema: SIN_PARAMS,
        colecciones: ['metas', 'transacciones'],
        run: ({ metas, transacciones }) => {
            const valorInversion = (id) => { const inv = transacciones.find(t => t.id === id && esPosicionInversion(t)); return inv && inv.moneda !== 'USD' ? n(inv.monto) + n(inv.utilidad) : null; };
            return {
                financieras: metas.filter(m => m.tipo !== 'personal').map(m => {
                    const vinculada = m.inversionId ? valorInversion(m.inversionId) : null;
                    const meta = vinculada !== null ? { ...m, ahorroActual: vinculada } : m;
                    const objetivo = n(meta.montoObjetivo), ahorrado = n(meta.ahorroActual);
                    return {
                        nombre: m.nombre, objetivo: redondo(objetivo), ahorrado: redondo(ahorrado),
                        porcentaje: objetivo > 0 ? Math.round(ahorrado / objetivo * 100) : null,
                        fecha_objetivo: m.fechaObjetivo || null, frecuencia: m.frecuencia || null,
                        aporte_sugerido: m.fechaObjetivo ? redondo(aporteSugeridoMeta(meta)) : null,
                        estado: estadoMeta(meta).id, completada: !!m.completada || (objetivo > 0 && ahorrado >= objetivo),
                        ...(m.inversionId ? { vinculada_a_inversion: true } : {}),
                    };
                }),
                personales: metas.filter(m => m.tipo === 'personal').map(m => {
                    const pasos = Array.isArray(m.checklist) ? m.checklist : [];
                    return { nombre: m.nombre, plazo: m.plazo || null, completada: !!m.completada, pasos_hechos: pasos.filter(p => p.completado).length, pasos_total: pasos.length };
                }),
            };
        },
    },
    {
        name: 'inversiones',
        description: 'Portafolio de inversiones: cada posición con tipo, moneda (COP o USD), monto depositado, utilidad, valor actual, número de aportes y fecha del último aporte; y totales por moneda.',
        inputSchema: SIN_PARAMS,
        colecciones: ['transacciones'],
        run: ({ transacciones }) => {
            const posiciones = transacciones.filter(esPosicionInversion).map(inv => {
                const aportes = aportesDe(inv);
                return {
                    nombre: inv.concepto, tipo: inv.subTipo || null, moneda: inv.moneda || 'COP',
                    depositado: Math.round(depositado(inv) * 100) / 100, utilidad: Math.round(n(inv.utilidad) * 100) / 100,
                    valor_actual: Math.round((n(inv.monto) + n(inv.utilidad)) * 100) / 100,
                    aportes: aportes.length, ultimo_aporte: aportes.map(a => a.fecha).filter(Boolean).sort().pop() || inv.fecha || null,
                    descuenta_saldo: inv.afectaBalance !== false,
                };
            });
            const totales = {};
            posiciones.forEach(p => {
                const t = totales[p.moneda] || (totales[p.moneda] = { depositado: 0, utilidad: 0, valor_actual: 0 });
                t.depositado += p.depositado; t.utilidad += p.utilidad; t.valor_actual += p.valor_actual;
            });
            return { posiciones, totales_por_moneda: totales };
        },
    },
    {
        name: 'deudas',
        description: 'Deudas: monto total, pagado, saldo pendiente, tasa de interés (E.A. %), cuota mensual, número de cuotas y día de pago.',
        inputSchema: SIN_PARAMS,
        colecciones: ['deudas'],
        run: ({ deudas }) => ({
            total_pendiente: redondo(deudas.reduce((a, d) => a + saldoDeuda(d), 0)),
            deudas: deudas.map(d => ({
                nombre: d.nombre, monto_total: redondo(d.montoTotal), pagado: redondo(d.montoPagado), saldo: redondo(saldoDeuda(d)),
                tasa_interes_ea: n(d.tasaInteres) || null, cuota_mensual: redondo(d.cuotaMensual) || null, cuotas: d.cuotas || null, dia_pago: d.diaPago || null,
            })),
        }),
    },
    {
        name: 'cuentas',
        description: 'Cuentas de efectivo, débito, ahorros y tarjetas de crédito con su saldo calculado (en crédito: lo que se debe), cupo, y días de corte y pago.',
        inputSchema: SIN_PARAMS,
        colecciones: ['cuentas', 'transacciones'],
        run: ({ cuentas, transacciones }) => ({
            cuentas: cuentas.map(c => {
                const efecto = transacciones.reduce((a, t) => {
                    if (t.tipo === 'ingreso' && t.cuentaId === c.id) return a + n(t.monto);
                    if (t.tipo === 'gasto' && t.cuentaId === c.id) return a - n(t.monto);
                    if (t.tipo === 'transferencia' && t.destinoId === c.id) return a + n(t.monto);
                    if (t.tipo === 'transferencia' && t.origenId === c.id) return a - n(t.monto);
                    return a;
                }, 0);
                const saldo = n(c.saldoInicial) + efecto;
                const credito = c.tipo === 'credito';
                return {
                    nombre: c.nombre, tipo: c.tipo || 'debito',
                    ...(credito
                        ? { deuda_actual: redondo(Math.max(-saldo, 0)), cupo: redondo(c.cupo) || null, disponible: c.cupo ? redondo(n(c.cupo) + saldo) : null, dia_corte: c.diaCorte || null, dia_pago: c.diaPago || null }
                        : { saldo: redondo(saldo) }),
                };
            }),
        }),
    },
    {
        name: 'habitos_rutina_recordatorios',
        description: 'Hábitos con su racha y si ya se hicieron hoy, la rutina semanal por día (bloques con hora) y los recordatorios activos del asistente.',
        inputSchema: SIN_PARAMS,
        colecciones: ['habitos', 'rutina', 'recordatorios'],
        run: ({ habitos, rutina, recordatorios }) => {
            const hoy = hoyKey();
            const rutinaPorDia = {};
            rutina.filter(b => b.horaInicio).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)).forEach(b => {
                (rutinaPorDia[DIAS[b.dia] || 'sin día'] ||= []).push({ desde: b.horaInicio, hasta: b.horaFin || null, actividad: `${b.emoji ? `${b.emoji} ` : ''}${b.titulo}` });
            });
            return {
                hoy, dia_semana: DIAS[new Date(`${hoy}T12:00:00Z`).getUTCDay()],
                habitos: habitos.map(h => ({ nombre: `${h.emoji ? `${h.emoji} ` : ''}${h.nombre}`, racha_dias: calcStreak(h.historial || []), hecho_hoy: (h.historial || []).includes(hoy) })),
                rutina_semanal: rutinaPorDia,
                recordatorios: recordatorios.filter(r => r.activo !== false).map(r => ({
                    titulo: `${r.emoji ? `${r.emoji} ` : ''}${r.titulo || 'Recordatorio'}`, tipo: r.sistema ? `sistema:${r.sistema}` : (r.tipo || 'hora'),
                    hora: r.hora || null, fecha: r.fecha || null, dias: Array.isArray(r.dias) && r.dias.length ? r.dias.map(d => DIAS[d]) : null,
                    ...(r.tipo === 'intervalo' ? { cada_min: r.cadaMin || null, desde: r.desde || null, hasta: r.hasta || null } : {}),
                })),
            };
        },
    },
];

// Colecciones que alguna herramienta puede leer: lista cerrada (defensa en profundidad).
const PERMITIDAS = new Set(['transacciones', 'limites', 'deudas', 'cuentas', 'presupuesto', 'metas', 'habitos', 'rutina', 'recordatorios']);

async function ejecutar(env, uid, herramienta, args) {
    const nombres = herramienta.colecciones.filter(c => PERMITIDAS.has(c));
    const datos = Object.fromEntries(await Promise.all(nombres.map(async c => [c, await leerColeccion(env, uid, c)])));
    return herramienta.run(datos, args || {});
}

function noAutorizado(request) {
    const origin = new URL(request.url).origin;
    return json({ error: 'invalid_token', error_description: 'Falta un token válido.' }, 401, {
        'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="${SCOPE}"`,
    });
}

// POST /mcp
export async function mcpPost(context) {
    const { request, env } = context;
    const auth = request.headers.get('Authorization') || '';
    const uid = await uidDeToken(env, auth.startsWith('Bearer ') ? auth.slice(7) : '');
    if (!uid) return noAutorizado(request);

    let msg;
    try { msg = await request.json(); } catch { return rpcError(null, -32700, 'JSON inválido'); }
    if (Array.isArray(msg)) return rpcError(null, -32600, 'No se admiten lotes');
    const { id = null, method, params = {} } = msg || {};

    // Notificaciones (sin id): se aceptan sin respuesta.
    if (id === null || id === undefined) return new Response(null, { status: 202 });

    switch (method) {
        case 'initialize': {
            const pedida = params.protocolVersion;
            return rpcOk(id, {
                protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[1],
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'finanzas-360', title: 'Finanzas 360', version: '1.0.0' },
                instructions: 'Datos personales de Finanzas 360 (solo lectura). Montos en pesos colombianos (COP) salvo que se indique USD. Las fechas están en hora de Colombia. Las reuniones están en Google Calendar, no aquí.',
            });
        }
        case 'ping':
            return rpcOk(id, {});
        case 'tools/list':
            return rpcOk(id, {
                tools: HERRAMIENTAS.map(h => ({ name: h.name, title: h.name.replace(/_/g, ' '), description: h.description, inputSchema: h.inputSchema, annotations: LECTURA })),
            });
        case 'tools/call': {
            const h = HERRAMIENTAS.find(x => x.name === params.name);
            if (!h) return rpcError(id, -32602, `Herramienta desconocida: ${params.name}`);
            try {
                const resultado = await ejecutar(env, uid, h, params.arguments);
                console.log(`mcp: ${h.name} ok`);
                return rpcOk(id, { content: [{ type: 'text', text: JSON.stringify(resultado) }], structuredContent: resultado, isError: false });
            } catch (e) {
                console.error(`mcp: ${h.name} error`, e?.message);
                return rpcOk(id, { content: [{ type: 'text', text: 'No se pudieron leer los datos en este momento.' }], isError: true });
            }
        }
        default:
            return rpcError(id, -32601, `Método no soportado: ${method}`);
    }
}

// GET /mcp: sin flujo SSE iniciado por el servidor.
export function mcpGet() {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
