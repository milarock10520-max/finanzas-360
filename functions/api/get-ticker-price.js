export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker') || 'SPY';
    const purchaseDateStr = url.searchParams.get('purchaseDate');

    try {
        // Fetch up to 10 years of daily data from Yahoo Finance
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10y&interval=1d`;
        const res = await fetch(yahooUrl);
        if (!res.ok) throw new Error(`Yahoo Finance API falló: ${res.status}`);
        
        const data = await res.json();
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const closePrices = result.indicators.quote[0].close;

        if (!timestamps || !closePrices || timestamps.length === 0) {
            throw new Error('No historical data found');
        }

        let currentPrice = closePrices[closePrices.length - 1];
        if (currentPrice === null && closePrices.length > 2) {
             currentPrice = closePrices[closePrices.length - 2];
        }

        let originalPrice = currentPrice;

        if (purchaseDateStr) {
            const purchaseTimestamp = new Date(`${purchaseDateStr}T00:00:00Z`).getTime() / 1000;
            let purchaseIdx = -1;
            
            for (let i = 0; i < timestamps.length; i++) {
                if (timestamps[i] >= purchaseTimestamp - 172800) {
                    if (closePrices[i] !== null && closePrices[i] !== undefined) {
                        purchaseIdx = i;
                        break;
                    }
                }
            }
            
            if (purchaseIdx !== -1) {
                originalPrice = closePrices[purchaseIdx];
            } else {
                originalPrice = closePrices[0];
            }
        }

        const percentChange = (currentPrice / originalPrice) - 1;

        return new Response(JSON.stringify({
            success: true,
            ticker,
            currentPrice,
            originalPrice,
            percentChange
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*' // Good for local testing if hit externally
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
