// Cloudflare Pages Function: proxy al Coach IA (Claude)
// POST /api/ai-coach  { context: string, messages: [...], enableTools?: boolean }
// La API key de Anthropic vive solo en el servidor (env.ANTHROPIC_API_KEY).
//
// Modo agéntico: si enableTools=true, Claude puede pedir EJECUTAR acciones
// (registrar gastos, crear eventos/tareas, deudas, metas). El servidor NO ejecuta
// nada: devuelve los bloques tool_use al cliente, que es quien tiene las
// credenciales (Firestore del usuario y el token de Google) para actuar.

const MODEL = 'claude-opus-4-8';

// Herramientas que el Coach puede invocar. El cliente las ejecuta.
const TOOLS = [
    {
        name: 'registrar_transaccion',
        description: 'Registra un GASTO o un INGRESO en las finanzas del usuario. Úsalo cuando pida anotar/registrar un gasto, compra, pago, o un ingreso/entrada de dinero. No lo uses para abonar deudas (usa el monto como número, sin símbolos).',
        input_schema: {
            type: 'object',
            properties: {
                tipo: { type: 'string', enum: ['gasto', 'ingreso'], description: 'gasto o ingreso' },
                monto: { type: 'number', description: 'Monto en pesos colombianos, solo el número (ej: 50000 para "50 mil")' },
                categoria: {
                    type: 'string',
                    description: 'Para GASTOS elige una de: "Vivienda (Arriendo/Hipoteca)", "Servicios Públicos", "Mercado", "Transporte", "Entretenimiento", "Salud", "Educación", "Ropa", "Deudas", "Aporte Inversión", "Mascotas", "Gastos Hormiga", "Otros". Para INGRESOS elige una de: "Salario", "Freelance", "Retorno Inversión", "Regalos", "Venta", "Otros". Escoge la más adecuada según el concepto.'
                },
                concepto: { type: 'string', description: 'Descripción corta (ej: "Mercado del mes", "Almuerzo", "Pago freelance")' },
                fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD. Si el usuario no la menciona, OMITE este campo (se usará hoy).' }
            },
            required: ['tipo', 'monto', 'categoria', 'concepto']
        }
    },
    {
        name: 'crear_evento_calendar',
        description: 'Crea un evento/reunión en el Google Calendar del usuario. Úsalo cuando pida agendar una reunión, cita o recordatorio con hora concreta. Resuelve fechas relativas ("mañana", "el viernes") usando la fecha/hora actual que se te da en el contexto.',
        input_schema: {
            type: 'object',
            properties: {
                titulo: { type: 'string', description: 'Título del evento (ej: "Reunión con Juan")' },
                fecha: { type: 'string', description: 'Fecha del evento en formato YYYY-MM-DD' },
                hora: { type: 'string', description: 'Hora de inicio en formato 24h HH:MM. Omítelo si es un evento de todo el día.' },
                duracion_min: { type: 'number', description: 'Duración en minutos. Por defecto 60 si no se especifica.' }
            },
            required: ['titulo', 'fecha']
        }
    },
    {
        name: 'crear_tarea',
        description: 'Crea una tarea/pendiente en Google Tasks. Úsalo cuando el usuario pida recordar hacer algo o anotar un pendiente, sin una hora concreta de reunión.',
        input_schema: {
            type: 'object',
            properties: {
                titulo: { type: 'string', description: 'Texto de la tarea (ej: "Pagar el arriendo")' },
                fecha_limite: { type: 'string', description: 'Fecha límite en formato YYYY-MM-DD. Omítelo si no hay fecha.' }
            },
            required: ['titulo']
        }
    },
    {
        name: 'registrar_deuda',
        description: 'Registra una nueva deuda del usuario. Úsalo cuando pida anotar/registrar una deuda o préstamo.',
        input_schema: {
            type: 'object',
            properties: {
                nombre: { type: 'string', description: 'Nombre de la deuda (ej: "Tarjeta de crédito", "Préstamo carro")' },
                monto_total: { type: 'number', description: 'Monto total de la deuda, solo el número' },
                cuotas: { type: 'number', description: 'Número de cuotas. Omítelo si no se menciona.' }
            },
            required: ['nombre', 'monto_total']
        }
    },
    {
        name: 'crear_meta',
        description: 'Crea una meta de ahorro (financiera) o personal. Úsalo cuando el usuario pida crear/registrar una meta u objetivo.',
        input_schema: {
            type: 'object',
            properties: {
                nombre: { type: 'string', description: 'Nombre de la meta (ej: "Fondo de emergencia", "Viaje a Europa")' },
                tipo: { type: 'string', enum: ['financiera', 'personal'], description: 'financiera si tiene monto objetivo de ahorro; personal si es un objetivo sin dinero.' },
                monto_objetivo: { type: 'number', description: 'Monto a ahorrar (solo para metas financieras), solo el número.' },
                plazo: { type: 'string', description: 'Plazo o fecha objetivo en texto libre (ej: "Diciembre 2026"). Omítelo si no se menciona.' }
            },
            required: ['nombre', 'tipo']
        }
    }
];

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
        const enableTools = body.enableTools === true;

        // Mensajes de la conversación. El content puede ser string (texto normal)
        // o un array de bloques (tool_use / tool_result) en el flujo agéntico.
        const messages = history
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .map(m => ({ role: m.role, content: m.content }))
            .filter(m => (typeof m.content === 'string' && m.content.length) || (Array.isArray(m.content) && m.content.length));

        if (messages.length === 0) {
            return new Response(JSON.stringify({ error: 'No hay mensajes' }), { status: 400, headers });
        }

        // System prompt: persona estable (cacheable) + datos financieros en tiempo real.
        const system = [
            {
                type: 'text',
                text: enableTools ? PERSONA + PERSONA_ACCIONES : PERSONA,
                cache_control: { type: 'ephemeral' }
            },
            {
                type: 'text',
                text: `DATOS FINANCIEROS DEL USUARIO EN TIEMPO REAL:\n${finanzas}`
            }
        ];

        const payload = { model: MODEL, max_tokens: 1024, system, messages };
        if (enableTools) payload.tools = TOOLS;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Anthropic error:', res.status, errText);
            return new Response(JSON.stringify({ error: 'Error en la API de Claude', status: res.status }), { status: 502, headers });
        }

        const data = await res.json();
        const content = Array.isArray(data.content) ? data.content : [];
        const reply = content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n')
            .trim();

        // Devolvemos reply (compatibilidad con el modo solo-texto) y, para el modo
        // agéntico, los bloques crudos + stop_reason para que el cliente ejecute.
        return new Response(JSON.stringify({ reply, content, stop_reason: data.stop_reason }), { status: 200, headers });

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
6. Responde siempre en español.
7. TIENES MEMORIA: recibes el historial de la conversación. Actúa como un coach real que recuerda lo hablado antes: retoma compromisos, planes y metas mencionados en mensajes anteriores, haz seguimiento ("la semana pasada dijiste que...") y evita repetir preguntas cuyas respuestas ya conoces. Si el usuario retoma un tema viejo, conéctalo con lo que ya sabes.`;

const PERSONA_ACCIONES = `

ACCIONES (MUY IMPORTANTE):
Además de aconsejar, PUEDES EJECUTAR acciones por el usuario usando tus herramientas:
- registrar_transaccion: anotar un gasto o ingreso.
- crear_evento_calendar: agendar una reunión/cita en Google Calendar.
- crear_tarea: crear un pendiente en Google Tasks.
- registrar_deuda: anotar una deuda.
- crear_meta: crear una meta de ahorro o personal.

REGLAS DE LAS ACCIONES:
- Cuando el usuario pida claramente hacer algo ("anota...", "registra...", "agenda...", "recuérdame...", "crea una meta..."), USA la herramienta correspondiente en lugar de solo responder texto.
- Si te falta un dato OBLIGATORIO (por ejemplo el monto de un gasto, o la fecha de una reunión), NO llames la herramienta: pregunta brevemente por el dato que falta.
- Usa la FECHA Y HORA ACTUAL que aparece en el contexto para resolver fechas relativas como "mañana", "el viernes", "en la tarde".
- Para montos en lenguaje natural convierte a número: "50 mil" = 50000, "2 millones" = 2000000.
- No anuncies largamente lo que vas a hacer: una frase breve basta; el usuario verá una confirmación antes de que se ejecute.
- Puedes encadenar varias acciones si el usuario lo pide (ej: crear un evento y una tarea a la vez).`;
