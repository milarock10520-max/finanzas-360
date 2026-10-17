// Cálculos de deudas: saldo, tasa mensual a partir de la efectiva anual (EA),
// tiempo para terminar de pagar e intereses, y plan de pago con varias deudas
// (bola de nieve = la de menor saldo primero; avalancha = la de mayor tasa primero).

export const saldoDeuda = (d) => Math.max((Number(d.montoTotal) || 0) - (Number(d.montoPagado) || 0), 0);
// Tasa efectiva anual (%) -> tasa mensual equivalente (fracción).
export const tasaMensual = (ea) => {
    const t = Number(ea) || 0;
    return t > 0 ? Math.pow(1 + t / 100, 1 / 12) - 1 : 0;
};

const MAX_MESES = 600;

// Una sola deuda pagando `cuota` al mes. Devuelve { meses, intereses } o null si nunca se paga.
export function proyectarDeuda(d) {
    let saldo = saldoDeuda(d);
    const cuota = Number(d.cuotaMensual) || 0;
    if (!saldo) return { meses: 0, intereses: 0 };
    if (!cuota) return null;
    const i = tasaMensual(d.tasaInteres);
    let meses = 0, intereses = 0;
    while (saldo > 0.5 && meses < MAX_MESES) {
        const interes = saldo * i;
        if (cuota <= interes) return null; // la cuota no alcanza ni para los intereses
        intereses += interes;
        saldo = saldo + interes - Math.min(cuota, saldo + interes);
        meses++;
    }
    return meses >= MAX_MESES ? null : { meses, intereses };
}

// Plan con varias deudas y un presupuesto mensual total.
// estrategia: 'bola' (menor saldo primero) | 'avalancha' (mayor tasa primero).
export function simularPlan(deudas, presupuestoMensual, estrategia = 'avalancha') {
    const lista = deudas
        .map(d => ({ id: d.id, nombre: d.nombre, saldo: saldoDeuda(d), i: tasaMensual(d.tasaInteres), tasa: Number(d.tasaInteres) || 0, minimo: Number(d.cuotaMensual) || 0 }))
        .filter(d => d.saldo > 0);
    const presupuesto = Number(presupuestoMensual) || 0;
    const minimos = lista.reduce((a, d) => a + Math.min(d.minimo, d.saldo), 0);
    if (!lista.length) return { ok: true, meses: 0, intereses: 0, orden: [], minimos };
    if (presupuesto <= 0) return { ok: false, motivo: 'Define cuánto puedes pagar al mes.', minimos };
    if (presupuesto < minimos) return { ok: false, motivo: 'El presupuesto no alcanza para las cuotas mínimas.', minimos };

    const prioridad = (a, b) => (estrategia === 'bola' ? a.saldo - b.saldo || b.i - a.i : b.i - a.i || a.saldo - b.saldo);
    const terminadas = {};
    let mes = 0, intereses = 0;
    while (lista.some(d => d.saldo > 0.5) && mes < MAX_MESES) {
        mes++;
        // 1) intereses del mes
        lista.forEach(d => { if (d.saldo > 0.5) { const it = d.saldo * d.i; d.saldo += it; intereses += it; } });
        // 2) cuotas mínimas
        let disponible = presupuesto;
        lista.forEach(d => {
            if (d.saldo <= 0.5) return;
            const pago = Math.min(d.minimo, d.saldo, disponible);
            d.saldo -= pago; disponible -= pago;
        });
        // 3) el sobrante va a la deuda prioritaria (y en cascada)
        lista.filter(d => d.saldo > 0.5).sort(prioridad).forEach(d => {
            if (disponible <= 0) return;
            const pago = Math.min(d.saldo, disponible);
            d.saldo -= pago; disponible -= pago;
        });
        lista.forEach(d => { if (d.saldo <= 0.5 && !terminadas[d.id]) { d.saldo = 0; terminadas[d.id] = mes; } });
        if (mes > 2 && disponible === presupuesto) break; // sin avance posible
    }
    if (lista.some(d => d.saldo > 0.5)) return { ok: false, motivo: 'Con ese presupuesto las deudas no terminan de pagarse.', minimos };
    const orden = Object.entries(terminadas).sort((a, b) => a[1] - b[1]).map(([id, m]) => ({ ...lista.find(d => d.id === id), mes: m }));
    return { ok: true, meses: mes, intereses, orden, minimos };
}

// Fecha aproximada dentro de N meses, como texto ("mar 2027").
export const mesesATexto = (n) => {
    const d = new Date(); d.setMonth(d.getMonth() + n);
    return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
};
