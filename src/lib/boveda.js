import { useState, useEffect, useRef } from 'react';

// =============================================
// === CRYPTO HELPERS (AES-256-GCM + PBKDF2) ===
// =============================================

// Nº de iteraciones PBKDF2 para bóvedas NUEVAS. Recomendación OWASP 2023
// para PBKDF2-HMAC-SHA256 es 600.000. Las bóvedas antiguas (creadas con
// 100.000) guardan su propio valor en vault_config para seguir funcionando.
export const PBKDF2_ITERATIONS = 600000;
export const LEGACY_PBKDF2_ITERATIONS = 100000;
// Texto fijo que ciframos con la clave maestra para verificar el desbloqueo
// SIN almacenar ningún hash rápido de la clave (que sería atacable offline).
export const VAULT_VERIFIER_TEXT = 'FINANZAS_360_VAULT_VERIFIER_V1';

export const getKeyMaterial = async (password) => {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
};

export const deriveEncryptionKey = async (password, salt, iterations = PBKDF2_ITERATIONS) => {
    const keyMaterial = await getKeyMaterial(password);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

export const encryptText = async (plaintext, masterPassword, salt, iterations = PBKDF2_ITERATIONS) => {
    const key = await deriveEncryptionKey(masterPassword, salt, iterations);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return {
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    };
};

export const decryptText = async (encryptedData, masterPassword, salt, iterations = PBKDF2_ITERATIONS) => {
    try {
        const key = await deriveEncryptionKey(masterPassword, salt, iterations);
        const iv = new Uint8Array(atob(encryptedData.iv).split('').map(c => c.charCodeAt(0)));
        const ciphertext = new Uint8Array(atob(encryptedData.ciphertext).split('').map(c => c.charCodeAt(0)));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
};

export const hashText = async (text) => {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
};

// Entero aleatorio seguro en [0, max) usando crypto.getRandomValues sin sesgo.
export const secureRandomInt = (max) => {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
};

export const generateStrongPassword = (length = 20) => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const all = upper + lower + digits + symbols;
    let pw = [
        upper[secureRandomInt(upper.length)],
        lower[secureRandomInt(lower.length)],
        digits[secureRandomInt(digits.length)],
        symbols[secureRandomInt(symbols.length)],
    ];
    for (let i = pw.length; i < length; i++) pw.push(all[secureRandomInt(all.length)]);
    // Mezcla Fisher-Yates con aleatoriedad criptográfica.
    for (let i = pw.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [pw[i], pw[j]] = [pw[j], pw[i]];
    }
    return pw.join('');
};

export const CATEGORIAS_PASSWORDS = ['Correo', 'Red Social', 'Banco / Finanzas', 'Trabajo', 'Entretenimiento', 'Compras', 'Otro'];

export const CAT_COLORS = {
    'Correo': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '📧' },
    'Red Social': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '👥' },
    'Banco / Finanzas': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '🏦' },
    'Trabajo': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '💼' },
    'Entretenimiento': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', icon: '🎮' },
    'Compras': { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', icon: '🛒' },
    'Otro': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: '🔑' },
};

// =============================================
// === SESIÓN DE BÓVEDA (compartida) ===
// =============================================
// La clave maestra vive SOLO en memoria (estado de React): nunca se guarda en
// localStorage ni viaja al servidor. Este hook la comparte entre la bóveda de
// contraseñas y las credenciales de proyectos (misma clave para ambas).
//
// OJO: al compartirla dejó de destruirse sola al desmontar la pestaña de
// contraseñas, así que el bloqueo por inactividad de abajo NO es opcional:
// es justamente lo que compensa esa protección.

export const VAULT_TABS = ['passwords', 'proyectos'];
export const VAULT_IDLE_MS = 5 * 60 * 1000;

export const useVaultSession = (vaultConfig, activeTab, genericAdd, genericUpdate) => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [masterPassword, setMasterPassword] = useState('');
    const [isCreatingMaster, setIsCreatingMaster] = useState(false);
    const [error, setError] = useState('');
    const [salt, setSalt] = useState(null);
    const [iterations, setIterations] = useState(PBKDF2_ITERATIONS);
    const lastActivity = useRef(Date.now());

    const lock = () => {
        setIsUnlocked(false);
        setMasterPassword('');
        setError('');
    };
    const touch = () => { lastActivity.current = Date.now(); };

    // ¿Ya existe bóveda creada?
    useEffect(() => {
        if (vaultConfig && vaultConfig.length > 0) {
            setIsCreatingMaster(false);
            const config = vaultConfig[0];
            if (config.salt) {
                setSalt(new Uint8Array(atob(config.salt).split('').map(c => c.charCodeAt(0))));
            }
            // Bóvedas antiguas no guardan iterations -> usaban 100.000.
            setIterations(config.iterations || LEGACY_PBKDF2_ITERATIONS);
        } else {
            setIsCreatingMaster(true);
            setIterations(PBKDF2_ITERATIONS);
        }
    }, [vaultConfig]);

    // Bloqueo al salir de las pestañas que usan la bóveda.
    useEffect(() => {
        if (!VAULT_TABS.includes(activeTab)) lock();
    }, [activeTab]);

    // Bloqueo por inactividad. Compara contra Date.now() real porque el
    // navegador estrangula los timers cuando la ventana está en segundo plano.
    useEffect(() => {
        if (!isUnlocked) return;
        lastActivity.current = Date.now();
        const marcar = () => { lastActivity.current = Date.now(); };
        const onVisibility = () => { if (!document.hidden) marcar(); };
        window.addEventListener('mousedown', marcar);
        window.addEventListener('keydown', marcar);
        document.addEventListener('visibilitychange', onVisibility);
        const timer = setInterval(() => {
            if (Date.now() - lastActivity.current > VAULT_IDLE_MS) lock();
        }, 30000);
        return () => {
            window.removeEventListener('mousedown', marcar);
            window.removeEventListener('keydown', marcar);
            document.removeEventListener('visibilitychange', onVisibility);
            clearInterval(timer);
        };
    }, [isUnlocked]);

    const createMaster = async (input, confirm) => {
        if (input.length < 10) { setError('Usa al menos 10 caracteres (mejor una frase larga)'); return false; }
        if (input !== confirm) { setError('Las claves no coinciden'); return false; }

        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const saltB64 = btoa(String.fromCharCode(...newSalt));
        // Verificador: ciframos un texto fijo con la clave maestra. Para
        // desbloquear hay que poder descifrarlo (no se guarda ningún hash
        // rápido que pueda atacarse offline).
        const verifier = await encryptText(VAULT_VERIFIER_TEXT, input, newSalt, PBKDF2_ITERATIONS);

        await genericAdd('vault_config', { salt: saltB64, iterations: PBKDF2_ITERATIONS, verifier });
        setSalt(newSalt);
        setIterations(PBKDF2_ITERATIONS);
        setMasterPassword(input);
        setIsUnlocked(true);
        setError('');
        touch();
        return true;
    };

    const unlock = async (input) => {
        if (!vaultConfig || vaultConfig.length === 0) return false;
        const config = vaultConfig[0];
        const saltBytes = new Uint8Array(atob(config.salt).split('').map(c => c.charCodeAt(0)));
        const iters = config.iterations || LEGACY_PBKDF2_ITERATIONS;

        let ok = false;
        if (config.verifier) {
            // Esquema nuevo: desbloqueo = poder descifrar el verificador.
            const dec = await decryptText(config.verifier, input, saltBytes, iters);
            ok = dec === VAULT_VERIFIER_TEXT;
        } else if (config.masterHash) {
            // Esquema antiguo: hash rápido. Si coincide, MIGRAMOS a verificador
            // y eliminamos el hash para cerrar el ataque offline.
            const inputHash = await hashText(input + config.salt);
            ok = inputHash === config.masterHash;
            if (ok) {
                try {
                    const verifier = await encryptText(VAULT_VERIFIER_TEXT, input, saltBytes, iters);
                    await genericUpdate('vault_config', config.id, {
                        verifier, iterations: iters, masterHash: null
                    });
                } catch (_) { /* si falla, seguimos desbloqueando igual */ }
            }
        }

        if (ok) {
            setMasterPassword(input);
            setSalt(saltBytes);
            setIterations(iters);
            setIsUnlocked(true);
            setError('');
            touch();
        } else {
            setError('Clave maestra incorrecta');
        }
        return ok;
    };

    return {
        isUnlocked, masterPassword, salt, iterations, isCreatingMaster,
        error, setError, createMaster, unlock, lock, touch,
    };
};
