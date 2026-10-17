// Tasa USD → COP (Yahoo Finance "COP=X" vía /api/market), con caché de 12 h en el
// dispositivo. Si no hay conexión se usa la última tasa conocida.
import { useEffect, useState } from 'react';
import { API_BASE } from './firebase';

const CLAVE = 'f360-tasa-usd';
const VIGENCIA_MS = 12 * 60 * 60 * 1000;

const leerCache = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; }
};

let enCurso = null;
async function obtenerTasa() {
    const cache = leerCache();
    if (cache && Date.now() - cache.at < VIGENCIA_MS) return cache;
    if (!enCurso) {
        enCurso = fetch(`${API_BASE}/api/market?ticker=COP=X&range=5d&interval=1d`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                const closes = (d?.closes || []).filter(v => Number(v) > 0);
                const tasa = closes[closes.length - 1];
                if (!tasa) return cache;
                const nuevo = { tasa: Number(tasa), at: Date.now() };
                try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* */ }
                return nuevo;
            })
            .catch(() => cache)
            .finally(() => { enCurso = null; });
    }
    return enCurso;
}

// Devuelve { tasa, at } o null mientras carga / si nunca se obtuvo.
export function useTasaUSD() {
    const [dato, setDato] = useState(leerCache);
    useEffect(() => {
        let vivo = true;
        obtenerTasa().then(d => { if (vivo && d) setDato(d); });
        return () => { vivo = false; };
    }, []);
    return dato;
}

// Convierte a pesos. Sin tasa disponible, un monto en USD devuelve null.
export const aCOP = (monto, moneda, tasa) => {
    const n = Number(monto) || 0;
    if (moneda !== 'USD') return n;
    return tasa ? n * tasa : null;
};

// Valor actual de una inversión (aporte + utilidad) en pesos.
export const valorInversionCOP = (inv, tasa) => aCOP((Number(inv.monto) || 0) + (Number(inv.utilidad) || 0), inv.moneda, tasa);

// Última tasa guardada en el dispositivo (para cálculos fuera de componentes).
export const tasaUSDGuardada = () => leerCache()?.tasa || null;
