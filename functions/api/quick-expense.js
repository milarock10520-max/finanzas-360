// Cloudflare Pages Function para registrar gastos desde Siri Shortcut
// POST /api/quick-expense

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;
function initFirebase(env) {
    if (getApps().length === 0) {
        let privateKey = env.FIREBASE_PRIVATE_KEY || '';

        if (privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }

        initializeApp({
            credential: cert({
                projectId: env.FIREBASE_PROJECT_ID,
                clientEmail: env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey
            })
        });
    }
    db = getFirestore();
}

// Manejar preflight CORS
export async function onRequestOptions() {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    try {
        const body = await request.json();
        const { concepto, monto, userId, token } = body;

        // Validar token secreto
        const SECRET_TOKEN = env.SHORTCUT_SECRET_TOKEN;
        if (token !== SECRET_TOKEN) {
            return new Response(JSON.stringify({ error: 'Token inválido' }), {
                status: 401,
                headers
            });
        }

        // Validar campos requeridos
        if (!concepto || !monto || !userId) {
            return new Response(JSON.stringify({ error: 'Faltan campos: concepto, monto, userId' }), {
                status: 400,
                headers
            });
        }

        initFirebase(env);

        // Crear el documento de transacción
        const transaccion = {
            tipo: 'gasto',
            concepto: String(concepto),
            monto: parseFloat(monto),
            categoria: 'Gastos Hormiga',
            fecha: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            fromShortcut: true
        };

        // Guardar en Firestore
        const appId = 'mi-finanzas-app-v1';
        const collectionPath = `artifacts/${appId}/users/${userId}/transacciones`;

        await db.collection(collectionPath).add(transaccion);

        // Calcular nuevo saldo
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

        return new Response(JSON.stringify({
            success: true,
            message: `Gasto de $${parseFloat(monto).toLocaleString('es-CO')} en "${concepto}" registrado`,
            saldo: saldoActual
        }), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor', details: error.message }), {
            status: 500,
            headers
        });
    }
}
