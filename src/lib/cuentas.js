// Cuentas y medios de pago: efectivo, débito/ahorros y tarjetas de crédito.
//
// Modelo de datos:
// - Colección `cuentas`: { nombre, tipo: 'efectivo'|'debito'|'ahorros'|'credito',
//   saldoInicial (para crédito: deuda al crearla), cupo, diaCorte, diaPago, createdAt }.
// - Las transacciones de gasto/ingreso pueden llevar `cuentaId`.
// - Movimientos entre cuentas (pagar la tarjeta, sacar efectivo): transacciones con
//   tipo 'transferencia', { monto, origenId, destinoId, concepto, fecha }. No cambian
//   el saldo global (ingresos − gastos) porque no son ni ingreso ni gasto.
//
// Las compras con tarjeta de crédito son gastos desde el día de la compra; la deuda
// de la tarjeta baja cuando se registra el pago (transferencia hacia la tarjeta).

import { Wallet, Landmark, PiggyBank, CreditCard } from 'lucide-react';

export const TIPOS_CUENTA = {
    efectivo: { label: 'Efectivo', Icon: Wallet, tono: 'income' },
    debito: { label: 'Débito', Icon: Landmark, tono: 'primary' },
    ahorros: { label: 'Ahorros', Icon: PiggyBank, tono: 'violet' },
    credito: { label: 'Tarjeta de crédito', Icon: CreditCard, tono: 'expense' },
};

const pad = (n) => String(n).padStart(2, '0');
const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const diasDelMes = (y, m) => new Date(y, m + 1, 0).getDate();
// Fecha con ese día del mes (si el mes es más corto, el último día).
const conDia = (y, m, dia) => new Date(y, m, Math.min(dia, diasDelMes(y, m)));

// Última fecha <= hoy cuyo día del mes es `dia`.
export function ultimaFechaDia(dia, hoy = new Date()) {
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let f = conDia(h.getFullYear(), h.getMonth(), dia);
    if (f > h) f = conDia(h.getFullYear(), h.getMonth() - 1, dia);
    return f;
}

// Primera fecha > `desde` cuyo día del mes es `dia`.
export function siguienteFechaDia(dia, desde) {
    let f = conDia(desde.getFullYear(), desde.getMonth(), dia);
    if (f <= desde) f = conDia(desde.getFullYear(), desde.getMonth() + 1, dia);
    return f;
}

const diasEntre = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

const monto = (t) => Number(t.monto) || 0;

// Estado de todas las cuentas a partir de las transacciones.
export function estadoCuentas(cuentas = [], transacciones = [], hoy = new Date()) {
    const ids = new Set(cuentas.map(c => c.id));
    const resultado = cuentas.map(c => {
        const esCredito = c.tipo === 'credito';
        const propias = transacciones.filter(t => t.cuentaId === c.id || t.origenId === c.id || t.destinoId === c.id);
        // Efecto de un movimiento en el "saldo" de la cuenta (en crédito: deuda con signo negativo).
        const efecto = (t) => {
            if (t.tipo === 'ingreso' && t.cuentaId === c.id) return monto(t);
            if (t.tipo === 'gasto' && t.cuentaId === c.id) return -monto(t);
            if (t.tipo === 'transferencia') {
                if (t.destinoId === c.id) return monto(t);
                if (t.origenId === c.id) return -monto(t);
            }
            return 0;
        };
        const neto = propias.reduce((a, t) => a + efecto(t), 0);
        const inicial = Number(c.saldoInicial) || 0;
        const base = {
            ...c,
            Icon: (TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.debito).Icon,
            tono: (TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.debito).tono,
            movimientos: [...propias].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
        };
        if (!esCredito) return { ...base, saldo: inicial + neto };

        // Tarjeta de crédito: deuda = inicial + compras − pagos.
        const deuda = Math.max(inicial - neto, 0);
        const cupo = Number(c.cupo) || 0;
        const info = { ...base, deuda, cupo, disponible: cupo ? cupo - deuda : null, usoPct: cupo ? deuda / cupo : null };
        const diaCorte = Number(c.diaCorte);
        const diaPago = Number(c.diaPago);
        if (!(diaCorte >= 1 && diaCorte <= 31)) return info;

        const ultimoCorte = ultimaFechaDia(diaCorte, hoy);
        const proximoCorte = siguienteFechaDia(diaCorte, ultimoCorte);
        const corteKey = clave(ultimoCorte);
        // Deuda al cierre del último corte, menos los pagos hechos después.
        const deudaAlCorte = Math.max(inicial - propias.filter(t => (t.fecha || '') <= corteKey).reduce((a, t) => a + efecto(t), 0), 0);
        const pagosDespues = propias.filter(t => t.tipo === 'transferencia' && t.destinoId === c.id && (t.fecha || '') > corteKey).reduce((a, t) => a + monto(t), 0);
        const pagarDelCorte = Math.max(deudaAlCorte - pagosDespues, 0);
        const comprasCiclo = propias.filter(t => t.tipo === 'gasto' && (t.fecha || '') > corteKey).reduce((a, t) => a + monto(t), 0);
        // Pago: el del último corte si aún no vence; si ya venció y quedó saldo, se marca
        // VENCIDO; si se pagó completo, el siguiente pago es por las compras del ciclo actual.
        let fechaPago = null, montoPago = 0, vencido = false, estimado = false;
        if (diaPago >= 1 && diaPago <= 31) {
            const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            const pagoDelCorte = siguienteFechaDia(diaPago, ultimoCorte);
            if (pagoDelCorte >= h) { fechaPago = pagoDelCorte; montoPago = pagarDelCorte; }
            else if (pagarDelCorte > 0) { fechaPago = pagoDelCorte; montoPago = pagarDelCorte; vencido = true; }
            else { fechaPago = siguienteFechaDia(diaPago, proximoCorte); montoPago = comprasCiclo; estimado = true; }
        }
        return {
            ...info, ultimoCorte, proximoCorte, fechaPago, montoPago, vencido, estimado, pagarDelCorte, comprasCiclo,
            diasParaCorte: diasEntre(hoy, proximoCorte),
            diasParaPago: fechaPago ? diasEntre(hoy, fechaPago) : null,
        };
    });

    // Movimientos sin cuenta (o de cuentas eliminadas): saldo "sin asignar".
    const sinCuenta = transacciones
        .filter(t => (t.tipo === 'ingreso' || t.tipo === 'gasto') && !(t.cuentaId && ids.has(t.cuentaId)))
        .reduce((a, t) => a + (t.tipo === 'ingreso' ? 1 : -1) * monto(t), 0);
    const efectivoYBancos = resultado.filter(c => c.tipo !== 'credito').reduce((a, c) => a + c.saldo, 0);
    const deudaTarjetas = resultado.filter(c => c.tipo === 'credito').reduce((a, c) => a + c.deuda, 0);
    return { cuentas: resultado, sinCuenta, efectivoYBancos, deudaTarjetas };
}

// Texto compacto para el contexto del coach.
export function cuentasTexto(cuentas, transacciones) {
    if (!cuentas.length) return 'CUENTAS: el usuario no ha creado cuentas ni tarjetas.';
    const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
    const fFecha = (d) => d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';
    const e = estadoCuentas(cuentas, transacciones);
    const L = ['CUENTAS Y TARJETAS:'];
    e.cuentas.forEach(c => {
        if (c.tipo === 'credito') {
            const pago = !c.fechaPago ? ''
                : c.vencido ? `; ⚠️ PAGO VENCIDO desde el ${fFecha(c.fechaPago)}: debe ${fmt(c.montoPago)} del último corte`
                : `; próximo pago ${fFecha(c.fechaPago)} por ${c.estimado ? 'aprox. ' : ''}${fmt(c.montoPago)}`;
            L.push(`- ${c.nombre} (tarjeta de crédito): debe ${fmt(c.deuda)}${c.cupo ? ` de un cupo de ${fmt(c.cupo)}` : ''}${pago}${c.proximoCorte ? `; corta el ${fFecha(c.proximoCorte)}, compras del ciclo actual ${fmt(c.comprasCiclo)}` : ''}.`);
        } else {
            L.push(`- ${c.nombre} (${(TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.debito).label}): saldo ${fmt(c.saldo)}.`);
        }
    });
    L.push(`Total en efectivo y bancos: ${fmt(e.efectivoYBancos)}; deuda en tarjetas: ${fmt(e.deudaTarjetas)}; movimientos sin cuenta asignada suman ${fmt(e.sinCuenta)}.`);
    return L.join('\n');
}
