# 📱 Configuración de Siri Shortcut para Finanzas 360

## Paso 1: Configurar Variables de Entorno en Netlify

Ve a tu dashboard de Netlify → tu sitio → Site Settings → Environment Variables

Agrega estas 4 variables:

| Variable | Valor |
|----------|-------|
| `FIREBASE_PROJECT_ID` | `appfinanzas-84626` |
| `FIREBASE_CLIENT_EMAIL` | (del Service Account - ver abajo) |
| `FIREBASE_PRIVATE_KEY` | (del Service Account - ver abajo) |
| `SHORTCUT_SECRET_TOKEN` | (inventa uno, ej: `MiTokenSecreto123!`) |

### ¿Cómo obtener las credenciales de Firebase?

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto "appfinanzas-84626"
3. Click en ⚙️ → Configuración del proyecto → Cuentas de servicio
4. Click en "Generar nueva clave privada"
5. Descarga el archivo JSON
6. Del archivo JSON:
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (copia todo incluyendo `-----BEGIN PRIVATE KEY-----`)

---

## Paso 2: Obtener tu User ID

1. Abre tu app en el navegador
2. Abre las DevTools (F12) → Console
3. Ejecuta: `firebase.auth().currentUser.uid`
4. Copia ese ID (algo como `abc123xyz...`)

---

## Paso 3: Crear el Shortcut en iPhone

### Atajo "💰 Registrar Gasto"

1. Abre la app **Atajos** en tu iPhone
2. Toca **+** para crear nuevo atajo
3. Agrega estas acciones en orden:

#### Acción 1: Solicitar entrada
- Tipo: **Texto**
- Pregunta: "¿En qué gastaste?"
- Guardar resultado en variable: `concepto`

#### Acción 2: Solicitar entrada
- Tipo: **Número**
- Pregunta: "¿Cuánto?"
- Guardar resultado en variable: `monto`

#### Acción 3: Obtener contenido de URL
- URL: `https://TU-SITIO.netlify.app/.netlify/functions/quick-expense`
- Método: **POST**
- Cuerpo de la solicitud: **JSON**
- Contenido:
```json
{
  "concepto": [Variable: concepto],
  "monto": [Variable: monto],
  "userId": "TU_USER_ID_AQUI",
  "token": "TU_TOKEN_SECRETO_AQUI"
}
```

#### Acción 4: Obtener valor del diccionario
- Clave: `message`
- Del resultado anterior

#### Acción 5: Mostrar notificación
- Título: "✅ Finanzas 360"
- Cuerpo: [Resultado de acción anterior]

4. Nombra el atajo: "💰 Registrar Gasto"
5. Toca "..." → Agregar a pantalla de inicio

---

### Atajo "💵 Ver Saldo" (Opcional)

1. Crear nuevo atajo
2. Agregar acción: **Obtener contenido de URL**
   - URL: `https://TU-SITIO.netlify.app/.netlify/functions/get-balance?userId=TU_USER_ID&token=TU_TOKEN`
   - Método: **GET**

3. Agregar acción: **Obtener valor del diccionario**
   - Clave: `saldoFormateado`

4. Agregar acción: **Mostrar resultado**

5. Nombrar: "💵 Ver Saldo"

---

## Paso 4: Probar

1. Toca el icono del atajo en tu pantalla de inicio
2. Responde las preguntas
3. Deberías ver la notificación de confirmación
4. Abre la app Finanzas 360 - el gasto debería aparecer

---

## 🎤 Bonus: Activar con Siri

1. Ve a Ajustes → Siri y Buscar → Atajos
2. Busca tu atajo "Registrar Gasto"
3. Asigna una frase, ej: "Registrar gasto"

Ahora puedes decir: **"Oye Siri, registrar gasto"** 🎉

---

## Solución de Problemas

| Error | Solución |
|-------|----------|
| "Token inválido" | Verifica que `SHORTCUT_SECRET_TOKEN` en Netlify coincida con el del Shortcut |
| "Falta userId" | Asegúrate de poner tu User ID correcto en el Shortcut |
| "Error interno" | Revisa las credenciales de Firebase en Netlify |
