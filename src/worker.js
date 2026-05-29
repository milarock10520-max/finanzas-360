// Punto de entrada del Worker.
// Enruta /api/ai-coach al handler de Claude y sirve el sitio (SPA) para todo lo demás.
import { onRequestPost, onRequestOptions } from '../functions/api/ai-coach.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/api/ai-coach') {
            const context = { request, env, params: {}, waitUntil: (p) => ctx.waitUntil(p) };
            if (request.method === 'OPTIONS') return onRequestOptions(context);
            if (request.method === 'POST') return onRequestPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        return env.ASSETS.fetch(request);
    }
};
