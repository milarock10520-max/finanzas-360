// Widget de iOS: la app le pasa el resumen del día (plugin nativo WidgetBridge, que lo
// guarda en el App Group y recarga el widget). En web y Android no hace nada.
import { Capacitor, registerPlugin } from '@capacitor/core';

const WidgetBridge = registerPlugin('WidgetBridge');
const disponible = () => Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('WidgetBridge');

let ultimaFirma = '';

export async function actualizarWidget({ saldo, gastoHoy, gastoMes, proximoPago }) {
    if (!disponible()) return;
    const datos = {
        saldo: Math.round(saldo || 0),
        gastoHoy: Math.round(gastoHoy || 0),
        gastoMes: Math.round(gastoMes || 0),
        proximoPago: proximoPago || '',
    };
    const firma = JSON.stringify(datos);
    if (firma === ultimaFirma) return;
    ultimaFirma = firma;
    try { await WidgetBridge.actualizar(datos); } catch (e) { ultimaFirma = ''; console.warn('Widget:', e); }
}

export async function limpiarWidget() {
    if (!disponible()) return;
    ultimaFirma = '';
    try { await WidgetBridge.limpiar(); } catch { /* sin widget */ }
}
