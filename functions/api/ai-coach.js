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
    },
    {
        name: 'crear_recordatorio',
        description: 'Crea un recordatorio que llega como notificación al celular. Úsalo para hábitos y rutinas personales: tomar agua, pausas activas, leer, medicamentos, estirarse, o cualquier "recuérdame…". Tipos: "hora" (todos los días o ciertos días a una hora), "intervalo" (cada N minutos entre dos horas, p. ej. agua cada 2 horas de 8 a 18) y "unico" (una sola vez en una fecha y hora).',
        input_schema: {
            type: 'object',
            properties: {
                titulo: { type: 'string', description: 'Texto corto del aviso (ej: "Toma agua", "Pausa activa: estírate 3 minutos")' },
                emoji: { type: 'string', description: 'Un emoji que lo represente (ej: "💧", "🧘", "📚")' },
                tipo: { type: 'string', enum: ['hora', 'intervalo', 'unico'], description: 'hora | intervalo | unico' },
                hora: { type: 'string', description: 'HH:MM en 24h. Para tipo hora y unico.' },
                desde: { type: 'string', description: 'HH:MM de inicio (solo intervalo)' },
                hasta: { type: 'string', description: 'HH:MM de fin (solo intervalo)' },
                cada_min: { type: 'number', description: 'Minutos entre avisos (solo intervalo; mínimo 15)' },
                dias: { type: 'string', description: 'Días en que aplica: "todos", "laborales" (lunes a viernes), "fin_de_semana" o una lista como "lunes,miércoles,viernes". Por defecto todos.' },
                fecha: { type: 'string', description: 'YYYY-MM-DD (solo tipo unico)' },
                mensaje: { type: 'string', description: 'Texto opcional bajo el título del aviso' },
                habito_id: { type: 'string', description: 'Si el recordatorio es de uno de sus HÁBITOS, su id: así no le avisa los días que ya lo marcó.' }
            },
            required: ['titulo', 'tipo']
        }
    },
    {
        name: 'eliminar_recordatorio',
        description: 'Elimina un recordatorio del usuario. Usa el id que aparece en su lista de RECORDATORIOS.',
        input_schema: { type: 'object', properties: { recordatorio_id: { type: 'string', description: 'id del recordatorio' } }, required: ['recordatorio_id'] }
    },
    {
        name: 'pausar_recordatorio',
        description: 'Pausa o reactiva un recordatorio (incluye el resumen de la mañana y la lectura del día). También sirve para cambiarle la hora.',
        input_schema: {
            type: 'object',
            properties: {
                recordatorio_id: { type: 'string', description: 'id del recordatorio' },
                activo: { type: 'boolean', description: 'false para pausar, true para reactivar' },
                hora: { type: 'string', description: 'Nueva hora HH:MM (opcional)' }
            },
            required: ['recordatorio_id']
        }
    },
    {
        name: 'mover_evento_calendar',
        description: 'Cambia la fecha/hora de un evento existente de Google Calendar. Usa el id del evento de su AGENDA.',
        input_schema: {
            type: 'object',
            properties: {
                evento_id: { type: 'string', description: 'id del evento' },
                fecha: { type: 'string', description: 'Nueva fecha YYYY-MM-DD' },
                hora: { type: 'string', description: 'Nueva hora de inicio HH:MM (24h)' },
                duracion_min: { type: 'number', description: 'Duración en minutos; si se omite, conserva la actual' }
            },
            required: ['evento_id', 'fecha', 'hora']
        }
    },
    {
        name: 'eliminar_evento_calendar',
        description: 'Elimina un evento de Google Calendar. Usa el id del evento de su AGENDA.',
        input_schema: { type: 'object', properties: { evento_id: { type: 'string', description: 'id del evento' } }, required: ['evento_id'] }
    },
    {
        name: 'completar_tarea',
        description: 'Marca como hecha una tarea de Google Tasks. Usa el id de la tarea de su lista de TAREAS.',
        input_schema: { type: 'object', properties: { tarea_id: { type: 'string', description: 'id de la tarea' } }, required: ['tarea_id'] }
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
- Puedes encadenar varias acciones si el usuario lo pide (ej: crear un evento y una tarea a la vez).

ERES SU ASISTENTE PERSONAL (no solo financiero):
- Tienes su AGENDA de Google Calendar (próximos días, con id), sus TAREAS de Google Tasks (con id), sus RECORDATORIOS, HÁBITOS y RUTINA. Si Google aparece como NO conectado, dile que vaya a Todo → Agenda → "Conectar Google" (una sola vez) y que tú no puedes verla hasta entonces.
- "Organízame el día / planéame la semana": revisa agenda, tareas con fecha, rutina, hábitos y pagos próximos. Propón un horario concreto (bloques con hora de inicio y fin), sin chocar con lo que ya tiene, con pausas y comidas. Si acepta, crea los bloques con crear_evento_calendar y los avisos con crear_recordatorio.
- Recordatorios: "recuérdame tomar agua", "pausas activas", "leer", "tomar la pastilla"… → crear_recordatorio. Si no dice la hora o el intervalo, propón uno razonable (agua: cada 2 horas de 8:00 a 18:00; pausas activas: cada hora de 9:00 a 17:00 en días laborales) y créalo.
- Para cambiar o quitar algo usa su id: pausar_recordatorio, eliminar_recordatorio, mover_evento_calendar, eliminar_evento_calendar, completar_tarea.
- Cada mañana le llega un resumen escrito por ti y cada noche una lectura del día; puede cambiarles la hora o pausarlos con pausar_recordatorio (ids "sistema-resumen" y "sistema-lectura").
- Sé proactivo: si ves una reunión sin preparar, un pago cercano o un hábito descuidado, menciónalo y ofrece crear el recordatorio o el bloque.`;
