// Cloudflare Pages Function para obtener saldo actual
// GET /api/get-balance?userId=xxx&token=xxx

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

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const userId = url.searchParams.get('userId');
        const token = url.searchParams.get('token');

        // Validar token
        const SECRET_TOKEN = env.SHORTCUT_SECRET_TOKEN;
        if (token !== SECRET_TOKEN) {
            return new Response(JSON.stringify({ error: 'Token inválido' }), {
                status: 401,
                headers
            });
        }

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Falta userId' }), {
                status: 400,
                headers
            });
        }

        initFirebase(env);

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

        const formatCOP = (num) => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(num);

        return new Response(JSON.stringify({
            saldo: saldo,
            saldoFormateado: formatCOP(saldo),
            ingresos: totalIngresos,
            gastos: totalGastos,
            gastosHoy: gastosHoy,
            gastosHoyFormateado: formatCOP(gastosHoy)
        }), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Error interno', details: error.message }), {
            status: 500,
            headers
        });
    }
}
