// Patrimonio neto = disponible + ahorros apartados + inversiones (valor actual) − deudas.
//
// - Disponible: ingresos − gastos (como el saldo de la app; ya descuenta las compras
//   con tarjeta de crédito y los aportes a inversiones/ahorros).
// - Ahorros apartados: aportes a metas que se descontaron del saldo (esAhorro): siguen siendo tuyos.
// - Inversiones: aporte + utilidad de cada inversión, en pesos.
// - Deudas: saldo pendiente de la sección Deudas.
//
// Historia: cada mes se guarda una foto exacta (colección `patrimonio`, id YYYY-MM).
// Para los meses sin foto se reconstruye con los movimientos (inversiones al valor
// aportado y deudas sumando los abonos hechos después).

import { saldoDeuda } from './deudas';
import { aCOP } from './moneda';

const monto = (t) => Number(t.monto) || 0;
const esInversion = (t) => t.categoria === 'Aporte Inversión' || t.esInversion === true;
const finDeMes = (ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m, 0); return `${ym}-${String(d.getDate()).padStart(2, '0')}`; };
const ymMas = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function patrimonioActual({ transacciones = [], deudas = [], tasaUSD = null }) {
    const ingresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((a, t) => a + monto(t), 0);
    const gastos = transacciones.filter(t => t.tipo === 'gasto').reduce((a, t) => a + monto(t), 0);
    const disponible = ingresos - gastos;
    const ahorros = transacciones.filter(t => t.tipo === 'gasto' && t.esAhorro).reduce((a, t) => a + monto(t), 0);
    const inversiones = transacciones.filter(esInversion)
        .reduce((a, t) => a + (aCOP(monto(t) + (Number(t.utilidad) || 0), t.moneda, tasaUSD) ?? 0), 0);
    const deuda = deudas.reduce((a, d) => a + saldoDeuda(d), 0);
    return { disponible, ahorros, inversiones, deudas: deuda, neto: disponible + ahorros + inversiones - deuda };
}

// Serie de los últimos `meses` meses (cierre de cada mes; el actual con valores de hoy).
export function seriePatrimonio({ transacciones = [], deudas = [], fotos = [], tasaUSD = null, meses = 12, hoy = new Date() }) {
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const actual = patrimonioActual({ transacciones, deudas, tasaUSD });
    const porMes = Object.fromEntries(fotos.map(f => [f.id, f]));
    const lista = [];
    for (let i = meses - 1; i >= 0; i--) {
        const ym = ymMas(mesActual, -i);
        if (ym === mesActual) { lista.push({ ym, ...actual, exacto: true }); continue; }
        if (porMes[ym] && typeof porMes[ym].neto === 'number') { lista.push({ ym, ...porMes[ym], exacto: true }); continue; }
        const corte = finDeMes(ym);
        const hasta = transacciones.filter(t => (t.fecha || '') <= corte);
        if (!hasta.length) continue; // aún no había datos
        const ingresos = hasta.filter(t => t.tipo === 'ingreso').reduce((a, t) => a + monto(t), 0);
        const gastos = hasta.filter(t => t.tipo === 'gasto').reduce((a, t) => a + monto(t), 0);
        const ahorros = hasta.filter(t => t.tipo === 'gasto' && t.esAhorro).reduce((a, t) => a + monto(t), 0);
        const inversiones = hasta.filter(esInversion).reduce((a, t) => a + (aCOP(monto(t), t.moneda, tasaUSD) ?? 0), 0);
        // Deuda al cierre: la de hoy + abonos hechos después, sin las deudas creadas después.
        const abonosDespues = transacciones.filter(t => t.categoria === 'Pago de Deudas' && (t.fecha || '') > corte).reduce((a, t) => a + monto(t), 0);
        const creadasDespues = deudas.filter(d => d.createdAt && d.createdAt.slice(0, 10) > corte).reduce((a, d) => a + (Number(d.montoTotal) || 0), 0);
        const deuda = Math.max(actual.deudas + abonosDespues - creadasDespues, 0);
        const disponible = ingresos - gastos;
        lista.push({ ym, disponible, ahorros, inversiones, deudas: deuda, neto: disponible + ahorros + inversiones - deuda, exacto: false });
    }
    return lista;
}
