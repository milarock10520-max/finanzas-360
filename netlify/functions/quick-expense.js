// Netlify Function para registrar gastos desde Siri Shortcut
// POST /.netlify/functions/quick-expense

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Inicializar Firebase Admin (solo una vez)
let db;
function initFirebase() {
    if (getApps().length === 0) {
        // Manejar diferentes formatos de private key
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

        // Si viene con \\n literal, reemplazar por saltos de línea reales
        if (privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        // Si viene con comillas adicionales, removerlas
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }

        // Log para debug (se verá en Netlify Functions logs)
        console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
        console.log('Firebase Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
        console.log('Private Key starts with:', privateKey.substring(0, 30));

        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey
            })
        });
    }
    db = getFirestore();
}

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Solo POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Parsear body
        const body = JSON.parse(event.body || '{}');
        const { concepto, monto, userId, token } = body;

        // Validar token secreto (simple seguridad)
        const SECRET_TOKEN = process.env.SHORTCUT_SECRET_TOKEN;
        if (token !== SECRET_TOKEN) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Token inválido' })
            };
        }

        // Validar campos requeridos
        if (!concepto || !monto || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Faltan campos: concepto, monto, userId' })
            };
        }

        // Inicializar Firebase
        initFirebase();

        // Crear el documento de transacción
        const transaccion = {
            tipo: 'gasto',
            concepto: String(concepto),
            monto: parseFloat(monto),
            categoria: 'Gastos Hormiga',
            fecha: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            fromShortcut: true // Flag para saber que vino del shortcut
        };

        // Guardar en Firestore
        const appId = 'mi-finanzas-app-v1';
        const collectionPath = `artifacts/${appId}/users/${userId}/transacciones`;

        await db.collection(collectionPath).add(transaccion);

        // Calcular nuevo saldo (opcional - para mostrar en respuesta)
        const transaccionesRef = db.collection(collectionPath);
        const snapshot = await transaccionesRef.get();

        let totalIngresos = 0;
        let totalGastos = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.tipo === 'ingreso') {
                totalIngresos += Number(data.monto) || 0;
            } else if (data.tipo === 'gasto') {
                totalGastos += Number(data.monto) || 0;
            }
        });

        const saldoActual = totalIngresos - totalGastos;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Gasto de $${monto.toLocaleString('es-CO')} en "${concepto}" registrado`,
                saldo: saldoActual
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
        };
    }
};
