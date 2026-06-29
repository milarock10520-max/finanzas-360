// Hace que el login nativo de Google (@capacitor-firebase/authentication)
// devuelva un `serverAuthCode` canjeable por un refresh token desde el servidor.
//
// El plugin configura GoogleSignIn con serverClientID = clientID de iOS, lo que
// produce un serverAuthCode que NO se puede canjear con el secreto del cliente
// WEB. Para una conexión permanente (refresh token) el serverClientID debe ser
// el ID del cliente OAuth tipo "Aplicación web".
//
// Se ejecuta en cada `npm install` (postinstall). Es idempotente.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'node_modules', '@capacitor-firebase', 'authentication', 'ios', 'Plugin', 'Handlers', 'GoogleAuthProviderHandler.swift');

// ID del cliente OAuth tipo "Aplicación web" (proyecto appfinanzas-84626).
const WEB_CLIENT_ID = '163542408412-90a73np4ur8hr165f95ra3ba5p63sbql.apps.googleusercontent.com';

if (!existsSync(file)) {
    process.exit(0);
}

const ORIGINAL = 'let config = GIDConfiguration(clientID: clientId, serverClientID: clientId)';
const PATCHED = `let config = GIDConfiguration(clientID: clientId, serverClientID: "${WEB_CLIENT_ID}")`;

let swift = readFileSync(file, 'utf8');
if (swift.includes(PATCHED)) {
    console.log('[patch-firebase-google] Ya estaba parcheado.');
    process.exit(0);
}
if (swift.includes(ORIGINAL)) {
    swift = swift.replace(ORIGINAL, PATCHED);
    writeFileSync(file, swift);
    console.log('[patch-firebase-google] serverClientID -> cliente WEB aplicado.');
} else {
    console.warn('[patch-firebase-google] AVISO: no encontré la línea esperada; ¿cambió la versión del plugin?');
}
