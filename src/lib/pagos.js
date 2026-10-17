// Pagos próximos de todas las fuentes: gastos fijos del presupuesto, cuotas de
// deudas y pagos de tarjetas de crédito. Lo usan Inicio ("Hoy") y los
// recordatorios del iPhone.

import { dateKey, proximaFechaPago } from './finanzas';
import { saldoDeuda } from './deudas';
import { estadoCuentas } from './cuentas';

const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

// Devuelve [{ id, tipo, concepto, monto, dias, fecha: Date, vencido }], ordenado por fecha.
export function pagosProximos({ presupuestoItems = [], deudas = [], cuentas = [], transacciones = [], hoy = new Date(), horizonte = 7 }) {
    const ciclo = dateKey(hoy).slice(0, 7);
    const lista = [];

    presupuestoItems.forEach(i => {
        const prox = proximaFechaPago(i.diaPago);
        if (!prox || i.lastPaid === ciclo) return;
        lista.push({ id: `p-${i.id}`, tipo: 'presupuesto', concepto: i.concepto, monto: Number(i.monto) || 0, dias: prox.dias, fecha: prox.fecha, vencido: false });
    });

    deudas.forEach(d => {
        if (!d.diaPago || !saldoDeuda(d)) return;
        const prox = proximaFechaPago(d.diaPago);
        if (!prox) return;
        // Si ya hubo un abono a esta deuda en los últimos 20 días, se considera pagada la cuota.
        const desde = new Date(hoy); desde.setDate(desde.getDate() - 20);
        const abonoReciente = transacciones.some(t => t.categoria === 'Pago de Deudas' && (t.concepto || '').includes(d.nombre) && (t.fecha || '') >= dateKey(desde));
        if (abonoReciente) return;
        lista.push({ id: `d-${d.id}`, tipo: 'deuda', concepto: `Cuota ${d.nombre}`, monto: Math.min(Number(d.cuotaMensual) || saldoDeuda(d), saldoDeuda(d)), dias: prox.dias, fecha: prox.fecha, vencido: false });
    });

    if (cuentas.length) {
        estadoCuentas(cuentas, transacciones, hoy).cuentas
            .filter(c => c.tipo === 'credito' && c.fechaPago && c.montoPago > 0)
            .forEach(c => lista.push({
                id: `t-${c.id}`, tipo: 'tarjeta', concepto: `Tarjeta ${c.nombre}`, monto: c.montoPago,
                dias: c.diasParaPago, fecha: c.fechaPago, vencido: c.vencido, estimado: c.estimado,
            }));
    }

    return lista.filter(p => p.vencido || p.dias <= horizonte).sort((a, b) => a.dias - b.dias);
}

// Recordatorios programables (iOS): tarjetas (corte y pago) y cuotas de deudas.
export function recordatoriosPagos({ deudas = [], cuentas = [], transacciones = [], hoy = new Date() }) {
    const items = [];
    const a = (fecha, diasAntes, hora) => { const d = new Date(fecha); d.setDate(d.getDate() - diasAntes); d.setHours(hora, 0, 0, 0); return d; };
    const fTxt = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

    estadoCuentas(cuentas, transacciones, hoy).cuentas.filter(c => c.tipo === 'credito').forEach(c => {
        if (c.fechaPago && c.montoPago > 0 && !c.vencido) {
            items.push({ title: `Paga tu tarjeta ${c.nombre}`, body: `${c.estimado ? 'Aprox. ' : ''}${fmt(c.montoPago)} antes del ${fTxt(c.fechaPago)}.`, at: a(c.fechaPago, 2, 9) });
            items.push({ title: `Hoy vence el pago de ${c.nombre}`, body: `${fmt(c.montoPago)}. Regístralo en Cuentas → Pagar tarjeta.`, at: a(c.fechaPago, 0, 8) });
        }
        if (c.proximoCorte) {
            items.push({ title: `Hoy corta tu tarjeta ${c.nombre}`, body: `Llevas ${fmt(c.comprasCiclo)} en compras en este ciclo.`, at: a(c.proximoCorte, 0, 8) });
        }
    });

    deudas.forEach(d => {
        if (!d.diaPago || !saldoDeuda(d)) return;
        const prox = proximaFechaPago(d.diaPago);
        if (!prox) return;
        const cuota = Math.min(Number(d.cuotaMensual) || saldoDeuda(d), saldoDeuda(d));
        items.push({ title: `Mañana pagas ${d.nombre}`, body: `Cuota de ${fmt(cuota)}.`, at: a(prox.fecha, 1, 9) });
        items.push({ title: `Hoy pagas ${d.nombre}`, body: `Cuota de ${fmt(cuota)}. Regístrala como abono en Deudas.`, at: a(prox.fecha, 0, 8) });
    });
    return items;
}
