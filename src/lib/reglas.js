// Reglas automáticas de ahorro.
// Colección `reglas_ahorro`: { metaId, tipo: 'porcentaje'|'fijo', valor, categoria ('' = cualquier
// ingreso), auto (aplicar sin preguntar), activa, createdAt }.
// Cada ingreso guarda en `reglasProcesadas` los ids de las reglas ya aplicadas u omitidas,
// así ninguna regla se aplica dos veces al mismo ingreso.

const monto = (t) => Number(t.monto) || 0;

export const montoRegla = (regla, ingreso) => {
    const v = Number(regla.valor) || 0;
    if (regla.tipo === 'porcentaje') return Math.round(monto(ingreso) * v / 100);
    return Math.min(v, monto(ingreso));
};

export const describirRegla = (regla, meta) => {
    const cuanto = regla.tipo === 'porcentaje' ? `${regla.valor}%` : `$${Math.round(Number(regla.valor) || 0).toLocaleString('es-CO')}`;
    const de = regla.categoria ? `cada ingreso de ${regla.categoria}` : 'cada ingreso';
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
