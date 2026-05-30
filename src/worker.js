// Punto de entrada del Worker.
// Enruta los endpoints /api/* y sirve el sitio (SPA) para todo lo demás.
import { onRequestPost as aiCoachPost, onRequestOptions as aiCoachOptions } from '../functions/api/ai-coach.js';
import { onRequestPost as quickExpensePost, onRequestOptions as quickExpenseOptions } from '../functions/api/quick-expense.js';

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

        return env.ASSETS.fetch(request);
    }
};
