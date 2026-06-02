// Cloudflare Function: datos de mercado (acciones / ETF / índices).
// GET /api/market?ticker=SPY&range=5y&interval=1d
//
// Se hace desde el servidor (Worker) para evitar dos problemas del navegador:
//  1) CORS: Yahoo Finance no permite peticiones directas desde el navegador.
//  2) Proxies públicos (allorigins, etc.) que se caen y dejan la gráfica vacía.
// Devuelve un formato normalizado { timestamps, closes } para el front.

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// User-Agent de navegador: Yahoo responde 429 sin él, pero 200 con uno válido.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    // Saneamos el ticker (solo letras, números, punto y guion).
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
    const range = (url.searchParams.get('range') || '5y').replace(/[^a-z0-9]/gi, '');
    const interval = (url.searchParams.get('interval') || '1d').replace(/[^a-z0-9]/gi, '');

    if (!ticker) {
        return new Response(JSON.stringify({ error: 'Falta el parámetro ticker' }), { status: 400, headers: CORS });
    }

    // Cacheamos 1 hora: los precios diarios no cambian a cada minuto y ahorra llamadas a Yahoo.
    const headersOk = { ...CORS, 'Cache-Control': 'public, max-age=3600' };

    // 1) Intento principal: Yahoo Finance (query2 + User-Agent de navegador).
    try {
        const yUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
        const yres = await fetch(yUrl, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            cf: { cacheTtl: 3600, cacheEverything: true }
        });
        if (yres.ok) {
            const data = await yres.json();
            const result = data?.chart?.result?.[0];
            const timestamps = result?.timestamp;
            const closes = result?.indicators?.quote?.[0]?.close;
            if (Array.isArray(timestamps) && Array.isArray(closes) && timestamps.length > 0) {
                return new Response(JSON.stringify({ source: 'yahoo', ticker, timestamps, closes }), { status: 200, headers: headersOk });
            }
        }
    } catch (e) { /* probamos el respaldo */ }

    // 2) Respaldo: Stooq (CSV abierto, sin clave). Tickers de EE. UU. usan sufijo .us
    try {
        const sUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&i=d`;
        const sres = await fetch(sUrl, { headers: { 'User-Agent': UA } });
        if (sres.ok) {
            const csv = await sres.text();
            const lines = csv.trim().split('\n');
            const timestamps = [];
            const closes = [];
            // Cabecera esperada: Date,Open,High,Low,Close,Volume
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 5) continue;
                const t = Date.parse(cols[0] + 'T00:00:00Z') / 1000;
                const c = parseFloat(cols[4]);
                if (!Number.isNaN(t) && !Number.isNaN(c)) { timestamps.push(t); closes.push(c); }
            }
            if (timestamps.length > 0) {
                return new Response(JSON.stringify({ source: 'stooq', ticker, timestamps, closes }), { status: 200, headers: headersOk });
            }
        }
    } catch (e) { /* sin datos */ }

    return new Response(JSON.stringify({ error: 'No se pudieron obtener datos de mercado para ' + ticker }), { status: 502, headers: CORS });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
    });
}
