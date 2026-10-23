// Reglas automáticas de ahorro.
// Colección `reglas_ahorro`: { metaId, tipo: 'porcentaje'|'fijo', valor, categoria ('' = cualquier
// ingreso), auto (aplicar sin preguntar), activa, createdAt }.
// Cada ingreso guarda en `reglasProcesadas` los ids de las reglas ya aplicadas u omitidas,
// así ninguna regla se aplica dos veces al mismo ingreso. El aporte se registra en una
// transacción (vale aunque la app esté abierta en varios dispositivos) y guarda
// `origenIngreso` y `metaId`: al borrar el ingreso o el aporte se devuelve a la meta.

const monto = (t) => Number(t.monto) || 0;

export const montoRegla = (regla, ingreso) => {
    const v = Number(regla.valor) || 0;
    if (regla.tipo === 'porcentaje') return Math.round(monto(ingreso) * v / 100);
    // Monto fijo: solo si el ingreso es mayor; si es igual o menor no se aparta nada
    // (si no, la regla se llevaría el ingreso completo).
    return monto(ingreso) > v ? v : 0;
};

// Lo que apartarían las reglas activas de un ingreso nuevo (para avisar antes de guardar).
export function previaReglas(reglas = [], metas = [], ingreso) {
    return reglas
        .filter(r => r.activa !== false && (!r.categoria || r.categoria === ingreso.categoria))
        .map(regla => ({ regla, meta: metas.find(m => m.id === regla.metaId), monto: montoRegla(regla, ingreso) }))
        .filter(x => x.meta && !x.meta.completada && x.monto > 0);
}

// Aporte de una meta que corresponde a un movimiento de ahorro (para revertirlo al borrarlo).
// Los aportes nuevos guardan `tx`; los antiguos se emparejan por monto y fecha.
export function indiceAporte(meta, mov) {
    const aportes = meta?.aportes || [];
    let i = aportes.findIndex(a => a.tx && a.tx === mov.id);
    if (i < 0) {
        for (let j = aportes.length - 1; j >= 0; j--) {
            const a = aportes[j];
            if (!a.tx && Number(a.monto) === Number(mov.monto) && a.fecha === mov.fecha) { i = j; break; }
        }
    }
    return i;
}

export const describirRegla = (regla, meta) => {
    const cuanto = regla.tipo === 'porcentaje' ? `${regla.valor}%` : `$${Math.round(Number(regla.valor) || 0).toLocaleString('es-CO')}`;
    const de = (regla.categoria ? `cada ingreso de ${regla.categoria}` : 'cada ingreso')
        + (regla.tipo === 'porcentaje' ? '' : ` mayor a ${cuanto}`);
    return `${cuanto} de ${de} → ${meta ? meta.nombre : 'meta eliminada'}`;
};

// Ingresos que activan una regla y aún no se han procesado.
export function pendientesDeReglas(reglas = [], transacciones = [], metas = []) {
    const out = [];
    reglas.filter(r => r.activa !== false).forEach(regla => {
        const meta = metas.find(m => m.id === regla.metaId);
        if (!meta || meta.completada) return;
        const desde = (regla.createdAt || '').slice(0, 10);
        transacciones
            .filter(t => t.tipo === 'ingreso'
                && (t.fecha || '') >= desde
                && (!regla.categoria || t.categoria === regla.categoria)
                && !(t.reglasProcesadas || []).includes(regla.id))
            .forEach(ingreso => {
                const valor = montoRegla(regla, ingreso);
                if (valor > 0) out.push({ regla, ingreso, meta, monto: valor });
            });
    });
    return out.sort((a, b) => (a.ingreso.fecha || '').localeCompare(b.ingreso.fecha || ''));
}
