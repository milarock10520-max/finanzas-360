// Cliente de IA del Worker: Cloudflare Workers AI (cuota gratuita diaria).
// Modelo principal gpt-oss-120b; si falla (cuota agotada, error del modelo)
// se usa glm-4.7-flash como respaldo, también gratuito.
//
// La app habla en formato "Anthropic" (bloques text / tool_use / tool_result);
// aquí se traduce a mensajes estilo OpenAI y de vuelta, para no tocar el cliente.

export const MODELOS = ['@cf/openai/gpt-oss-120b', '@cf/zai-org/glm-4.7-flash'];

// Herramientas en formato Anthropic -> formato de funciones de Workers AI.
export const aFuncionesIA = (tools = []) => tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

// El historial con bloques tool_use / tool_result se APLANA a texto: los modelos
// abiertos repiten la acción si reciben el formato nativo de herramientas.
const bloqueATexto = (b) => {
    if (!b || typeof b !== 'object') return '';
    if (b.type === 'text') return b.text || '';
    if (b.type === 'tool_use') return `[Acción solicitada: ${b.name} con ${JSON.stringify(b.input || {})}]`;
    if (b.type === 'tool_result') {
        const c = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        return `- Resultado: ${c}`;
    }
    return '';
};

export function aplanarMensajes(messages = []) {
    return messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
        .map(m => {
            if (typeof m.content === 'string') return { role: m.role, content: m.content };
            const bloques = Array.isArray(m.content) ? m.content : [];
            const tieneResultados = bloques.some(b => b?.type === 'tool_result');
            let texto = bloques.map(bloqueATexto).filter(Boolean).join('\n');
            if (tieneResultados) {
                texto = `[Acciones YA ejecutadas por la app — NO las vuelvas a pedir]\n${texto}\nSi el pedido original del usuario incluía OTRA acción que aún no se ha ejecutado, pídela ahora con la herramienta correspondiente. Si ya no queda nada pendiente, confirma brevemente al usuario lo que se hizo.`;
            }
            return { role: m.role, content: texto };
        })
        .filter(m => m.content && m.content.trim());
}

// ¿El último turno trae resultados de acciones? Entonces solo toca confirmar en texto.
export const ultimoTraeResultados = (messages = []) => {
    const ult = messages[messages.length - 1];
    return !!(ult && Array.isArray(ult.content) && ult.content.some(b => b?.type === 'tool_result'));
};

// Llama a Workers AI con respaldo. Devuelve { texto, toolCalls, modelo }.
export async function llamarIA(env, { system, messages, tools, maxTokens = 2000, temperature = 0.4 }) {
    if (!env.AI) throw new Error('Falta el binding AI de Workers AI');
    const msgs = [{ role: 'system', content: system }, ...messages];
    let ultimoError;
    for (const modelo of MODELOS) {
        try {
            const entrada = { messages: msgs, max_tokens: maxTokens, temperature };
            if (tools && tools.length) entrada.tools = tools;
            const out = await env.AI.run(modelo, entrada);
            // Formato compatible con OpenAI (gpt-oss, glm) o formato clásico de Workers AI.
            const msg = out?.choices?.[0]?.message;
            const texto = (msg ? msg.content : out?.response) || '';
            const crudas = (msg ? msg.tool_calls : out?.tool_calls) || [];
            const toolCalls = crudas.map((tc, i) => {
                const fn = tc.function || tc;
                let input = fn.arguments ?? {};
                if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = {}; } }
                return { id: tc.id || `call_${Date.now()}_${i}`, name: fn.name, input };
            }).filter(tc => tc.name);
            if (!texto.trim() && !toolCalls.length) throw new Error('Respuesta vacía');
            return { texto: texto.trim(), toolCalls, modelo };
        } catch (e) {
            console.error(`Workers AI (${modelo}) falló:`, e?.message || e);
            ultimoError = e;
        }
    }
    throw ultimoError || new Error('Sin respuesta de la IA');
}
