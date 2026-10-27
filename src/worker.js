// Punto de entrada del Worker.
// Enruta los endpoints /api/* y sirve el sitio (SPA) para todo lo demás.
import { onRequestPost as aiCoachPost, onRequestOptions as aiCoachOptions } from '../functions/api/ai-coach.js';
import { onRequestPost as quickExpensePost, onRequestOptions as quickExpenseOptions } from '../functions/api/quick-expense.js';
import { onRequestPost as coachSummaryPost, onRequestOptions as coachSummaryOptions } from '../functions/api/coach-summary.js';
import { onRequestGet as marketGet, onRequestOptions as marketOptions } from '../functions/api/market.js';
import { callbackGet as googleCallback, connectPost as googleConnect, tokenPost as googleToken, disconnectPost as googleDisconnect, optionsHandler as googleOptions } from '../functions/api/google-auth.js';
import { onRequestPost as asistenteDiarioPost, onRequestOptions as asistenteDiarioOptions } from '../functions/api/asistente-diario.js';
import { onRequestPost as vozTokenPost, onRequestOptions as vozTokenOptions } from '../functions/api/voz-token.js';
import { contextPost as coachContextPost, pushPost as coachPushPost, memoriaPost as coachMemoriaPost, onRequestOptions as coachProactivoOptions } from '../functions/api/coach-proactivo.js';
import { mcpPost, mcpGet } from '../functions/api/mcp.js';
import { metadatosRecurso, metadatosServidor, autorizarGet, loginGet as mcpLoginGet, esCallbackMcp, callbackGoogle as mcpCallbackGoogle, tokenPost as mcpTokenPost } from '../functions/api/mcp-oauth.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const context = { request, env, params: {}, waitUntil: (p) => ctx.waitUntil(p) };

        if (url.pathname === '/api/ai-coach') {
            if (request.method === 'OPTIONS') return aiCoachOptions(context);
            if (request.method === 'POST') return aiCoachPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        if (url.pathname === '/api/asistente-diario') {
            if (request.method === 'OPTIONS') return asistenteDiarioOptions(context);
            if (request.method === 'POST') return asistenteDiarioPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        if (url.pathname === '/api/voz-token') {
            if (request.method === 'OPTIONS') return vozTokenOptions(context);
            if (request.method === 'POST') return vozTokenPost(context);
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

        // Coach proactivo (agente programado de Claude en la nube)
        if (url.pathname === '/api/coach-context') {
            if (request.method === 'OPTIONS') return coachProactivoOptions(context);
            if (request.method === 'POST') return coachContextPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/api/coach-push') {
            if (request.method === 'OPTIONS') return coachProactivoOptions(context);
            if (request.method === 'POST') return coachPushPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/api/coach-memoria') {
            if (request.method === 'OPTIONS') return coachProactivoOptions(context);
            if (request.method === 'POST') return coachMemoriaPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        // OAuth de Google (conexión permanente con Calendar/Tasks)
        if (url.pathname === '/api/google/callback') {
            // El login del conector MCP reutiliza este redirect (ya autorizado en Google).
            if (request.method === 'GET' && esCallbackMcp(url)) return mcpCallbackGoogle(context);
            if (request.method === 'GET') return googleCallback(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/api/google/connect') {
            if (request.method === 'OPTIONS') return googleOptions(context);
            if (request.method === 'POST') return googleConnect(context);
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

        // Conector MCP de solo lectura (Gemini u otro asistente) + su OAuth.
        if (url.pathname === '/mcp') {
            if (request.method === 'POST') return mcpPost(context);
            if (request.method === 'GET') return mcpGet(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === '/.well-known/oauth-protected-resource/mcp') {
            return metadatosRecurso(request);
        }
        if (url.pathname === '/.well-known/oauth-authorization-server' || url.pathname === '/.well-known/openid-configuration') {
            return metadatosServidor(request);
        }
        if (url.pathname === '/oauth/authorize') {
            if (request.method === 'GET') return autorizarGet(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/oauth/login') {
            if (request.method === 'GET') return mcpLoginGet(context);
            return new Response('Method Not Allowed', { status: 405 });
        }
        if (url.pathname === '/oauth/token') {
            if (request.method === 'POST') return mcpTokenPost(context);
            return new Response('Method Not Allowed', { status: 405 });
        }

        return env.ASSETS.fetch(request);
    }
};
