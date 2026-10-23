// Endpoint del Coach IA.
// POST /api/ai-coach  { context: string, messages: [...], enableTools?: boolean }
// Usa Cloudflare Workers AI (gratis dentro de la cuota diaria): gpt-oss-120b con
// glm-4.7-flash de respaldo (ver functions/lib/ia.js).
//
// Modo agéntico: si enableTools=true, el modelo puede pedir EJECUTAR acciones
// (registrar gastos, crear eventos/tareas, deudas, metas). El servidor NO ejecuta
// nada: devuelve bloques tool_use al cliente, que es quien tiene las credenciales
// (Firestore del usuario y el token de Google) para actuar. La respuesta conserva
// el formato de bloques que ya usa la app.

import { llamarIA, aFuncionesIA, aplanarMensajes } from '../lib/ia.js';
import { usuarioDeRequest } from '../lib/auth.js';

// Herramientas que el Coach puede invocar. El cliente las ejecuta.
export const TOOLS = [
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
                    enum: ['Vivienda (Arriendo/Hipoteca)', 'Servicios Públicos', 'Mercado', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Ropa', 'Deudas', 'Aporte Inversión', 'Mascotas', 'Gastos Hormiga', 'Salario', 'Freelance', 'Retorno Inversión', 'Regalos', 'Venta', 'Otros'],
                    description: 'Para GASTOS usa una de: Vivienda (Arriendo/Hipoteca), Servicios Públicos, Mercado, Transporte, Entretenimiento, Salud, Educación, Ropa, Deudas, Aporte Inversión, Mascotas, Gastos Hormiga, Otros. Para INGRESOS: Salario, Freelance, Retorno Inversión, Regalos, Venta, Otros. Escoge la más adecuada según el concepto.'
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
                plazo: { type: 'string', description: 'Plazo o fecha objetivo en texto libre (ej: "Diciembre 2026"). Omítelo si no se menciona.' },
                fecha_objetivo: { type: 'string', description: 'Fecha objetivo en formato YYYY-MM-DD (solo financieras). Si el usuario da un mes/época, usa el último día de ese mes. Con esto la app calcula el aporte sugerido.' },
                frecuencia: { type: 'string', enum: ['quincenal', 'mensual'], description: 'Frecuencia del aporte sugerido (solo financieras). Por defecto quincenal.' }
            },
            required: ['nombre', 'tipo']
        }
    }
];

export async function onRequestPost(context) {
    const { request, env } = context;

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    // Solo usuarios con sesión iniciada en la app (evita que terceros gasten la cuota).
    try {
        await usuarioDeRequest(request, env);
    } catch (e) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers });
    }

    try {
        const body = await request.json();
        const finanzas = typeof body.context === 'string' ? body.context : '';
        const history = Array.isArray(body.messages) ? body.messages : [];
        const enableTools = body.enableTools === true;

        const messages = aplanarMensajes(history);
        if (messages.length === 0) {
            return new Response(JSON.stringify({ error: 'No hay mensajes' }), { status: 400, headers });
        }

        // Tras ejecutar acciones el historial va aplanado (ver lib/ia.js) para que el
        // modelo no las repita; las herramientas siguen disponibles para encadenar
        // la siguiente acción pendiente del mismo pedido.
        const conHerramientas = enableTools;
        const system = `${conHerramientas ? PERSONA + PERSONA_ACCIONES : PERSONA}\n\nDATOS DEL USUARIO EN TIEMPO REAL:\n${finanzas}`;

        const { texto, toolCalls, modelo } = await llamarIA(env, {
            system,
            messages,
            tools: conHerramientas ? aFuncionesIA(TOOLS) : undefined,
        });

        // Mismo formato de bloques que usa la app (texto + tool_use).
        const content = [];
        if (texto) content.push({ type: 'text', text: texto });
        toolCalls.forEach(tc => content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }));

        return new Response(JSON.stringify({
            reply: texto,
            content,
            stop_reason: toolCalls.length ? 'tool_use' : 'end_turn',
            modelo,
        }), { status: 200, headers });

    } catch (error) {
        console.error('ai-coach error:', error);
        return new Response(JSON.stringify({ error: 'El coach no está disponible en este momento', details: error.message }), { status: 502, headers });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
    });
}

const PERSONA = `Eres FINANZAS 360 AI COACH, un agente financiero personal experto en finanzas personales, productividad e inversiones. Acompañas al usuario como un coach: analizas sus números reales, detectas riesgos y oportunidades, y propones planes concretos y accionables.

REGLAS:
1. Sé cálido, profesional, empático y MUY directo. No des rodeos ni saludes en exceso en cada mensaje.
2. Antes de aconsejar, analiza los datos provistos (saldo, ingresos, gastos, deudas, inversiones, metas y tareas). Si te preguntan en qué invertir o gastar, revisa primero su saldo y gastos del mes.
3. Responde breve, ideal para leer en el celular: viñetas cortas (con "- ") y texto simple. Solo puedes usar negrita (con **). PROHIBIDO usar encabezados con #, líneas separadoras (---) o tablas.
3b. NO HAGAS CUENTAS. En sus datos hay una sección "CIFRAS LISTAS PARA TUS CONSEJOS" con los topes, lo que le queda por gastar, el diario disponible, los recortes posibles y los porcentajes ya calculados. Cuando des una cifra, cópiala EXACTA de ahí (o de la memoria financiera). No calcules porcentajes, sumas ni topes nuevos; si necesitas una cifra que no aparece, dilo en palabras sin inventar el número.
3c. Respeta la categoría de cada gasto tal como aparece en sus datos (por ejemplo, si "Domicilios" está en Gastos Hormiga, no lo cambies de categoría).
4. NUNCA inventes datos financieros: céntrate solo en los números provistos. Si falta un dato, dilo y sugiere registrarlo en la app.
5. Cuando propongas un plan, dalo en pasos numerados y con cifras concretas basadas en sus datos.
6. Responde siempre en español (de Colombia, montos en pesos colombianos).
7. CONOCES SU HISTORIA: recibes una MEMORIA FINANCIERA de sus últimos 12 meses (promedios por categoría, tendencias, gastos recurrentes, gastos inusuales, días de más gasto) y, si existe, un PERFIL FINANCIERO escrito por el análisis semanal. Úsalos siempre: compara lo de este mes con su promedio ("vas 30% por encima de tu promedio en Mercado"), menciona sus patrones y personaliza cada consejo. No digas que no tienes acceso a meses anteriores.
8. TIENES MEMORIA DE LA CONVERSACIÓN: recibes el historial de la conversación. Actúa como un coach real que recuerda lo hablado antes: retoma compromisos, planes y metas mencionados en mensajes anteriores, haz seguimiento ("la semana pasada dijiste que...") y evita repetir preguntas cuyas respuestas ya conoces. Si el usuario retoma un tema viejo, conéctalo con lo que ya sabes.`;

export const PERSONA_ACCIONES = `

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
