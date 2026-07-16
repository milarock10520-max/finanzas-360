// Login de Google para escritorio (Electron) usando el flujo "Desktop app" con
// redirect loopback (RFC 8252): abrimos el navegador REAL del sistema (nunca una
// ventana de Electron, porque Google bloquea el OAuth embebido), levantamos un
// servidor HTTP temporal en 127.0.0.1 para recibir el `code`, y lo canjeamos por
// tokens directamente con Google. El resultado ({ idToken, accessToken }) se le
// pasa al renderer, que lo usa igual que la rama nativa de la app
// (GoogleAuthProvider.credential + signInWithCredential).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

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

function signInWithGoogleDesktop() {
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
                const tokenRes = await fetch(TOKEN_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                    }),
                });
                const data = await tokenRes.json();
                if (!tokenRes.ok) {
                    finish(reject, new Error(data.error_description || data.error || 'Fallo al canjear el código de Google.'));
                    return;
                }
                finish(resolve, { idToken: data.id_token, accessToken: data.access_token });
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
            authUrl.searchParams.set('scope', 'openid email profile');
            authUrl.searchParams.set('prompt', 'select_account');

            shell.openExternal(authUrl.toString());
        });
    });
}

module.exports = { signInWithGoogleDesktop };
