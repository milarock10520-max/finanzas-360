// OAuth de Google para escritorio (Electron) usando el flujo "Desktop app" con
// redirect loopback (RFC 8252): abrimos el navegador REAL del sistema (nunca una
// ventana de Electron, porque Google bloquea el OAuth embebido), levantamos un
// servidor HTTP temporal en 127.0.0.1 para recibir el `code`, y lo canjeamos por
// tokens directamente con Google.
//
// Dos usos comparten el mismo mecanismo de loopback (runLoopbackAuth):
//  - signInWithGoogleDesktop(): login principal de la app (idToken/accessToken
//    para Firebase, igual que la rama nativa vía GoogleAuthProvider.credential).
//  - connectGoogleCalendarDesktop(): conectar Calendar/Tasks (pide un
//    refresh_token con access_type=offline+prompt=consent, que el renderer
//    manda al servidor para guardarlo bajo el linkToken, igual que la conexión
//    permanente nativa).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { shell, safeStorage, app, net } = require('electron');

// Llamadas a Google con la red de Chromium (net.fetch: proxy del sistema y el mismo manejo de
// IPv4/IPv6 que la ventana). El fetch de Node a veces se quedaba sin conectar (ConnectTimeout)
// mientras la ventana sí llegaba a Google.
const pedir = (url, opts) => net.fetch(url, opts);

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 5 * 60 * 1000;

function loadOAuthConfig() {
    const configPath = path.join(__dirname, 'oauth.local.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(
            'Falta electron/oauth.local.json. Copia electron/oauth.local.example.json, ' +
            'renómbralo a oauth.local.json y pega tu Client ID / Client Secret de ' +
            'Google Cloud Console (credencial de tipo "Desktop app").'
        );
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function runLoopbackAuth({ scope, accessType, prompt }) {
    const { clientId, clientSecret } = loadOAuthConfig();

    return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId;
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            fn(value);
        };

        let redirectUri = '';

        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url, 'http://127.0.0.1');
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (!code && !error) {
                res.writeHead(204);
                res.end();
                return;
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(
                error
                    ? '<html><body><h2>Inicio de sesión cancelado. Ya puedes cerrar esta pestaña.</h2></body></html>'
                    : '<html><body><h2>Listo, ya puedes cerrar esta pestaña.</h2></body></html>'
            );
            server.close();

            if (error) {
                finish(reject, new Error(`Google OAuth error: ${error}`));
                return;
            }

            try {
                const tokenRes = await pedir(TOKEN_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                    }).toString(),
                });
                const data = await tokenRes.json();
                if (!tokenRes.ok) {
                    finish(reject, new Error(data.error_description || data.error || 'Fallo al canjear el código de Google.'));
                    return;
                }
                finish(resolve, {
                    idToken: data.id_token,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresIn: data.expires_in,
                });
            } catch (e) {
                finish(reject, e);
            }
        });

        server.on('error', (e) => finish(reject, e));

        timeoutId = setTimeout(() => {
            server.close();
            finish(reject, new Error('Tiempo de espera agotado para el login de Google.'));
        }, TIMEOUT_MS);

        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            redirectUri = `http://127.0.0.1:${port}`;

            const authUrl = new URL(AUTH_ENDPOINT);
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', scope);
            authUrl.searchParams.set('prompt', prompt);
            if (accessType) authUrl.searchParams.set('access_type', accessType);

            shell.openExternal(authUrl.toString());
        });
    });
}

function signInWithGoogleDesktop() {
    return runLoopbackAuth({ scope: 'openid email profile', prompt: 'select_account' });
}

function connectGoogleCalendarDesktop() {
    return runLoopbackAuth({
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks',
        accessType: 'offline',
        prompt: 'consent',
    });
}

// --- Hoja de Google para Gemini (permiso drive.file: solo archivos que crea la app) ---
// El refresh token se guarda cifrado con safeStorage (DPAPI en Windows) en userData y
// nunca sale del proceso principal: el renderer solo recibe access tokens de ~1 h.
const archivoHoja = () => path.join(app.getPath('userData'), 'hoja-google.bin');
let cacheHoja = null; // { token, exp }

function leerRefreshHoja() {
    try { return safeStorage.decryptString(fs.readFileSync(archivoHoja())); } catch (e) { return null; }
}

async function connectHojaDesktop() {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Este equipo no permite guardar el permiso cifrado.');
    const r = await runLoopbackAuth({ scope: 'https://www.googleapis.com/auth/drive.file', accessType: 'offline', prompt: 'consent' });
    if (!r.refreshToken) throw new Error('Google no devolvió un permiso permanente. Intenta de nuevo.');
    fs.writeFileSync(archivoHoja(), safeStorage.encryptString(r.refreshToken));
    cacheHoja = { token: r.accessToken, exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000 };
    return true;
}

async function tokenHojaDesktop() {
    if (cacheHoja && Date.now() < cacheHoja.exp - 2 * 60 * 1000) return cacheHoja.token;
    const refreshToken = leerRefreshHoja();
    if (!refreshToken) throw new Error('sin_permiso_hoja');
    const { clientId, clientSecret } = loadOAuthConfig();
    const res = await pedir(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
        // invalid_grant: el usuario revocó el permiso o caducó; hay que volver a conectar.
        if (data.error === 'invalid_grant') desconectarHojaDesktop();
        throw new Error(data.error === 'invalid_grant' ? 'sin_permiso_hoja' : (data.error_description || data.error || 'No se pudo renovar el permiso de Google.'));
    }
    cacheHoja = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
    return cacheHoja.token;
}

function desconectarHojaDesktop() {
    cacheHoja = null;
    try { fs.unlinkSync(archivoHoja()); } catch (e) { /* ya no estaba */ }
}

module.exports = { signInWithGoogleDesktop, connectGoogleCalendarDesktop, connectHojaDesktop, tokenHojaDesktop, desconectarHojaDesktop };
