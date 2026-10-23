// Inversiones con historial de aportes.
//
// Cada inversión es un documento de `transacciones` (esInversion) con:
//   monto     → total depositado (suma de los aportes), en su moneda (COP o USD)
//   utilidad  → valor actual − depositado (la calcula la tarjeta de Inversiones)
//   aportes   → [{ id, monto, fecha, tasa?, cop?, txId? }]. Las inversiones antiguas
//               no lo tienen: se toman como un único aporte por `monto` en `fecha`.
//
// Un aporte en dólares que sale del saldo crea además un gasto en pesos hijo
// ({ inversionId, aporteId }) que solo descuenta el saldo: no es otra inversión.

export const esPosicionInversion = (t) => (t.categoria === 'Aporte Inversión' || t.esInversion === true) && !t.inversionId;

export const aportesDe = (inv) => (Array.isArray(inv.aportes) && inv.aportes.length
    ? inv.aportes
    : [{ id: 'inicial', monto: Number(inv.monto) || 0, fecha: inv.fecha }]);

export const depositado = (inv) => aportesDe(inv).reduce((a, x) => a + (Number(x.monto) || 0), 0);

export const valorInversion = (inv) => (Number(inv.monto) || 0) + (Number(inv.utilidad) || 0);

const dias = (desde, hoy) => Math.max(0, (hoy - new Date(`${desde}T00:00:00`)) / 86_400_000);

// Renta fija: cada aporte rinde la tasa E.A. desde su propia fecha.
export function utilidadRentaFija(inv, hoy = new Date()) {
    const tasa = (Number(inv.tasaInteres) || 9) / 100;
    return aportesDe(inv).reduce((a, x) => a + (Number(x.monto) || 0) * (Math.pow(1 + tasa, dias(x.fecha || inv.fecha, hoy) / 365) - 1), 0);
}

// Precio de cierre en (o justo después de) una fecha; si no hay datos tan antiguos, el primero.
export function precioEnFecha(timestamps, closes, fecha) {
    if (!fecha) return null;
    const ts = new Date(`${fecha}T00:00:00Z`).getTime() / 1000;
    for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] >= ts - 172800 && closes[i] != null) return closes[i];
    }
    return closes.find(c => c != null) ?? null;
}

// Bolsa / cripto: cada aporte gana o pierde según el precio desde el día en que entró.
export function utilidadMercado(inv, timestamps, closes, precioActual) {
    return aportesDe(inv).reduce((a, x) => {
        const compra = precioEnFecha(timestamps, closes, x.fecha || inv.fecha) || precioActual;
        return a + (Number(x.monto) || 0) * (precioActual / compra - 1);
    }, 0);
}

export const nuevoIdAporte = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
