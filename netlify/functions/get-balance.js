// Netlify Function para obtener saldo actual
// GET /.netlify/functions/get-balance?userId=xxx&token=xxx

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;
function initFirebase() {
    if (getApps().length === 0) {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    }
    db = getFirestore();
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const params = event.queryStringParameters || {};
        const { userId, token } = params;

        // Validar token
        const SECRET_TOKEN = process.env.SHORTCUT_SECRET_TOKEN;
        if (token !== SECRET_TOKEN) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Token inválido' })
            };
        }

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Falta userId' })
            };
        }

        initFirebase();

        const appId = 'mi-finanzas-app-v1';
        const collectionPath = `artifacts/${appId}/users/${userId}/transacciones`;

        const snapshot = await db.collection(collectionPath).get();

        let totalIngresos = 0;
        let totalGastos = 0;
        let gastosHoy = 0;
        const hoy = new Date().toISOString().split('T')[0];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.tipo === 'ingreso') {
                totalIngresos += Number(data.monto) || 0;
            } else if (data.tipo === 'gasto') {
                totalGastos += Number(data.monto) || 0;
                if (data.fecha === hoy) {
                    gastosHoy += Number(data.monto) || 0;
                }
            }
        });

        const saldo = totalIngresos - totalGastos;

        // Formatear para Colombia
        const formatCOP = (num) => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(num);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                saldo: saldo,
                saldoFormateado: formatCOP(saldo),
                ingresos: totalIngresos,
                gastos: totalGastos,
                gastosHoy: gastosHoy,
                gastosHoyFormateado: formatCOP(gastosHoy)
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error interno', details: error.message })
        };
    }
};
