import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { App as CapApp } from '@capacitor/app';
import { Lock, Fingerprint } from 'lucide-react';

// Envuelve la app: en iOS exige Face ID / Touch ID antes de mostrarla y
// vuelve a bloquear cuando la app regresa del segundo plano.
// En web (no nativo) renderiza la app directamente, sin cambios.
export default function NativeGate({ children }) {
    const isNative = Capacitor.isNativePlatform();
    const [unlocked, setUnlocked] = useState(!isNative);
    const [error, setError] = useState('');
    const [authenticating, setAuthenticating] = useState(false);

    // Refs para leer el estado actual dentro del listener (evita closures obsoletas).
    // `busyRef` = el diálogo de Face ID está en pantalla; mientras tanto iOS reporta
    // la app como "inactiva", y debemos IGNORAR esos cambios para no caer en un bucle.
    const busyRef = useRef(false);
    const unlockedRef = useRef(!isNative);
    useEffect(() => { unlockedRef.current = unlocked; }, [unlocked]);

    const authenticate = useCallback(async () => {
        if (busyRef.current || unlockedRef.current) return;
        busyRef.current = true;
        setAuthenticating(true);
        setError('');
        try {
            await BiometricAuth.authenticate({
                reason: 'Desbloquea Finanzas 360',
                cancelTitle: 'Cancelar',
                allowDeviceCredential: true, // permite el código del iPhone si Face ID falla
                iosFallbackTitle: 'Usar código',
            });
            setUnlocked(true);
        } catch (e) {
            setUnlocked(false);
            setError('No se pudo verificar tu identidad. Toca para reintentar.');
        } finally {
            setAuthenticating(false);
            // Pequeño margen para que iOS termine de devolver el foco a la app
            // antes de volver a escuchar cambios de estado.
            setTimeout(() => { busyRef.current = false; }, 400);
        }
    }, []);

    // Primer desbloqueo al abrir la app.
    useEffect(() => {
        if (isNative) authenticate();
    }, [isNative, authenticate]);

    // Re-bloquear SOLO cuando la app se va de verdad a segundo plano
    // (ignorando los cambios provocados por el propio diálogo de Face ID).
    useEffect(() => {
        if (!isNative) return;
        let handle;
        CapApp.addListener('appStateChange', ({ isActive }) => {
            if (busyRef.current) return; // el diálogo de Face ID está abierto: ignorar
            if (!isActive) {
                setUnlocked(false);
            } else if (!unlockedRef.current) {
                authenticate();
            }
        }).then((h) => { handle = h; });
        return () => { if (handle) handle.remove(); };
    }, [isNative, authenticate]);

    if (unlocked) return children;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#4f46e5', color: 'white',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24,
            textAlign: 'center',
        }}>
            <Lock size={48} />
            <div style={{ fontSize: 22, fontWeight: 700 }}>Finanzas 360</div>
            <div style={{ opacity: 0.85, maxWidth: 280 }}>
                Tus finanzas están protegidas. Verifica tu identidad para continuar.
            </div>
            {error && <div style={{ color: '#fecaca', fontSize: 14 }}>{error}</div>}
            <button
                onClick={authenticate}
                disabled={authenticating}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'white', color: '#4f46e5', border: 'none',
                    borderRadius: 12, padding: '14px 24px', fontSize: 16,
                    fontWeight: 600, cursor: 'pointer', opacity: authenticating ? 0.6 : 1,
                }}
            >
                <Fingerprint size={20} />
                {authenticating ? 'Verificando…' : 'Desbloquear'}
            </button>
        </div>
    );
}
