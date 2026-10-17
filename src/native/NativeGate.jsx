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
            position: 'fixed', inset: 0, zIndex: 9999, isolation: 'isolate', overflow: 'hidden',
            background: 'var(--bg)', color: 'var(--text)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 22,
            padding: 'calc(var(--sat) + 24px) 28px calc(var(--sab) + 40px)',
            textAlign: 'center',
        }}>
            <div className="orb" style={{ width: 320, height: 320, left: -120, top: -80, background: 'var(--primary)', opacity: .22 }} />
            <div className="orb" style={{ width: 260, height: 260, right: -110, top: 300, background: 'var(--cyan-bright)', opacity: .18, animationDuration: '18s' }} />
            <div className="rise d1" style={{ width: 76, height: 76, borderRadius: 24, display: 'grid', placeItems: 'center', background: 'var(--primary)', color: 'var(--on-primary)', boxShadow: '0 18px 40px -12px var(--glow)', animation: 'floaty 5s ease-in-out infinite' }}>
                <Lock size={32} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h1 className="display rise d2" style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Finanzas 360</h1>
            <p className="rise d3" style={{ margin: 0, maxWidth: 280, fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>
                Tus finanzas están protegidas. Verifica tu identidad para continuar.
            </p>
            {error && <p style={{ margin: 0, color: 'var(--expense)', fontSize: 14, fontWeight: 700 }}>{error}</p>}
            <button
                className="btn btn-primary rise d4"
                onClick={authenticate}
                disabled={authenticating}
                style={{ width: '100%', maxWidth: 320 }}
            >
                <Fingerprint size={20} aria-hidden="true" />
                {authenticating ? 'Verificando…' : 'Desbloquear'}
            </button>
        </div>
    );
}
