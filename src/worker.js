// Punto de entrada del Worker.
// Enruta los endpoints /api/* y sirve el sitio (SPA) para todo lo demás.
import { onRequestPost as aiCoachPost, onRequestOptions as aiCoachOptions } from '../functions/api/ai-coach.js';
import { onRequestPost as quickExpensePost, onRequestOptions as quickExpenseOptions } from '../functions/api/quick-expense.js';
import { onRequestPost as coachSummaryPost, onRequestOptions as coachSummaryOptions } from '../functions/api/coach-summary.js';
import { onRequestGet as marketGet, onRequestOptions as marketOptions } from '../functions/api/market.js';
import { callbackGet as googleCallback, tokenPost as googleToken, disconnectPost as googleDisconnect, optionsHandler as googleOptions } from '../functions/api/google-auth.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const context = { request, env, params: {}, waitUntil: (p) => ctx.waitUntil(p) };

        if (url.pathname === '/api/ai-coach') {
            if (request.method === 'OPTIONS') return aiCoachOptions(context);
            if (request.method === 'POST') return aiCoachPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        if (url.pathname === '/api/quick-expense') {
            if (request.method === 'OPTIONS') return quickExpenseOptions(context);
            if (request.method === 'POST') return quickExpensePost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        if (url.pathname === '/api/coach-summary') {
            if (request.method === 'OPTIONS') return coachSummaryOptions(context);
            if (request.method === 'POST') return coachSummaryPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        if (url.pathname === '/api/market') {
            if (request.method === 'OPTIONS') return marketOptions(context);
            if (request.method === 'GET') return marketGet(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        // OAuth de Google (conexión permanente con Calendar/Tasks)
        if (url.pathname === '/api/google/callback') {
            if (request.method === 'GET') return googleCallback(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/api/google/token') {
            if (request.method === 'OPTIONS') return googleOptions(context);
            if (request.method === 'POST') return googleToken(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/api/google/disconnect') {
            if (request.method === 'OPTIONS') return googleOptions(context);
            if (request.method === 'POST') return googleDisconnect(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        return env.ASSETS.fetch(request);
    }
};
