// Cloudflare Pages Function: proxy al Coach IA (Claude)
// POST /api/ai-coach  { context: string, messages: [{role, content}] }
// La API key de Anthropic vive solo en el servidor (env.ANTHROPIC_API_KEY).

const MODEL = 'claude-opus-4-8';

export async function onRequestPost(context) {
    const { request, env } = context;

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const apiKey = env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Falta ANTHROPIC_API_KEY en el servidor' }), { status: 500, headers });
        }

        const body = await request.json();
        const finanzas = typeof body.context === 'string' ? body.context : '';
        const history = Array.isArray(body.messages) ? body.messages : [];

        // Mensajes de la conversación, saneados a {role, content}
        const messages = history
            .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map(m => ({ role: m.role, content: m.content }));

        if (messages.length === 0) {
            return new Response(JSON.stringify({ error: 'No hay mensajes' }), { status: 400, headers });
        }

        // System prompt: persona estable (cacheable) + datos financieros en tiempo real.
        const system = [
            {
                type: 'text',
                text: PERSONA,
                cache_control: { type: 'ephemeral' }
            },
            {
                type: 'text',
                text: `DATOS FINANCIEROS DEL USUARIO EN TIEMPO REAL:\n${finanzas}`
            }
        ];

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 1024,
                system,
                messages
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Anthropic error:', res.status, errText);
            return new Response(JSON.stringify({ error: 'Error en la API de Claude', status: res.status }), { status: 502, headers });
        }

        const data = await res.json();
        const reply = (data.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n')
            .trim();

        return new Response(JSON.stringify({ reply }), { status: 200, headers });

    } catch (error) {
        console.error('ai-coach error:', error);
        return new Response(JSON.stringify({ error: 'Error interno', details: error.message }), { status: 500, headers });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
    });
}

const PERSONA = `Eres FINANZAS 360 AI COACH, un agente financiero personal experto en finanzas personales, productividad e inversiones. Acompañas al usuario como un coach: analizas sus números reales, detectas riesgos y oportunidades, y propones planes concretos y accionables.

REGLAS:
1. Sé cálido, profesional, empático y MUY directo. No des rodeos ni saludes en exceso en cada mensaje.
2. Antes de aconsejar, analiza los datos provistos (saldo, ingresos, gastos, deudas, inversiones, metas y tareas). Si te preguntan en qué invertir o gastar, revisa primero su saldo y gastos del mes.
3. Responde breve, ideal para leer en un widget móvil: usa viñetas cortas y texto simple. Solo puedes usar negrita (con **). No uses tablas ni encabezados largos.
4. NUNCA inventes datos financieros: céntrate solo en los números provistos. Si falta un dato, dilo y sugiere registrarlo en la app.
5. Cuando propongas un plan, dalo en pasos numerados y con cifras concretas basadas en sus datos.
6. Responde siempre en español.`;
