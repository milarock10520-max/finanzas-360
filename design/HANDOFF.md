# Finanzas 360 — Handoff de rediseño para Claude Code

Estilo: **moderno, minimalista, "futurista suave"**. Tema claro por defecto + tema oscuro opcional. Motion con propósito: entradas escalonadas, cifras que cuentan, gráficas que se dibujan, luz ambiental lenta en las tarjetas protagonistas.

Archivos incluidos:

| Archivo | Para qué |
|---|---|
| `f360.css` | **Fuente de verdad**: tokens de color (claro/oscuro), clases de componentes y todos los `@keyframes`. Cópialo tal cual al proyecto. |
| `screens/*.dc.html` | Referencia visual y de comportamiento de cada pantalla (HTML + lógica simple). Úsalos como spec, no como código de producción. |
| `HANDOFF.md` | Este documento. |

---

## 1. Cambios de arquitectura de información (lo más importante)

1. **Eliminar la barra superior de 9 iconos.** Era la fuente principal de ruido.
2. **Barra inferior flotante (glass)** con 4 pestañas + botón central:
   `Inicio · Flujo · [+] · Análisis · Metas`
   - "Flujo" une **Ingresos y Gastos** en una sola pantalla con un segmented control.
   - El botón **[+]** abre registrar movimiento (sustituye al FAB naranja ⚡ y al botón del sol).
3. **Pantalla "Todo" (módulos)**: Inversiones, Deudas, Agenda, Rutina semanal, Proyectos, Bóveda, Presupuesto (Lista fija + Topes) y Hábitos en una cuadrícula 2×N con buscador. Se abre desde el icono de cuadrícula del header de Inicio.
4. **Coach**: deja de ser un modal bloqueante al abrir la app. En Inicio aparece como **tarjeta de insight**; al tocarla abre una **hoja inferior** con hallazgos, sugerencias y un input de chat. Se elimina el FAB morado ✨.
5. **Header de Inicio**: logo + fecha + "Hola, {nombre}", y a la derecha **toggle de tema (sol/luna)** + **cuadrícula de módulos**.
6. Formularios (Nueva meta, Nueva deuda, Nuevo hábito) quedan **colapsados** tras un botón `+` que rota 45° al abrir.

## 2. Tema claro / oscuro

- Todo el color sale de variables CSS en `.f360`. Para oscuro, añadir `.dark` al mismo elemento raíz.
- Persistir la elección en `localStorage('f360-theme')` y, si no hay elección, usar `prefers-color-scheme`.
- La transición de tema ya está definida (`background-color/color .5s`). El icono sol↔luna rota y escala (`.theme-btn .sun/.moon`).
- **No uses colores literales en componentes**: siempre `var(--token)`.

```js
// ejemplo React
const [dark, setDark] = useState(() =>
  localStorage.getItem('f360-theme') ? localStorage.getItem('f360-theme') === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches);
useEffect(() => {
  document.documentElement.classList.toggle('dark', dark); // si .f360 está en <html>
  localStorage.setItem('f360-theme', dark ? 'dark' : 'light');
}, [dark]);
```

Si el proyecto usa Tailwind: mapear los tokens en `tailwind.config` → `colors: { bg: 'var(--bg)', surface: 'var(--surface)', ... }` y `darkMode: 'class'`.

## 3. Tokens

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | #F4F6FB | #06080E | Fondo de app |
| `--surface` | #FFFFFF | #0E121C | Tarjetas |
| `--surface-2` | #EEF1F7 | #161B28 | Inputs, pistas de barras, segmented |
| `--line` | #E2E6EF | #222939 | Bordes 1px |
| `--text` / `--text-2` / `--text-3` | #0B1020 / #475066 / #646C80 | #EDF0F7 / #A6AEC0 / #8790A5 | Jerarquía de texto (todos ≥4.5:1) |
| `--primary` | #3355FF | #6B84FF | Acción principal, pestaña activa |
| `--on-primary` | #FFFFFF | #05081A | Texto sobre primario |
| `--hero` | #0B1020 | #0E1424 | Tarjeta protagonista (saldo, patrimonio) |
| `--income` | #047857 | #34D399 | Ingresos, completado |
| `--expense` | #C8253A | #FB7185 | Gastos, alertas |
| `--warn` | #A35208 | #FBBF24 | Atrasos, topes |
| `--violet` | #6D28D9 | #A78BFA | Coach, inversiones |

Cada semántico tiene su `-soft` para fondos de iconos/insights.

**Tipografía** (Google Fonts): `Sora` (cifras y títulos, `font-variant-numeric: tabular-nums`, tracking −3%) + `Manrope` (UI y texto).
**Radios**: tarjetas 24px, hero 28px, botones/inputs 14–16px, iconos 12–14px, hojas 32px.
**Espaciado**: márgenes de pantalla 20px, separación entre tarjetas 12–14px, entre secciones 24px.
**Toque mínimo**: 44×44px.

## 4. Sistema de motion

| Nombre | Clase / keyframe | Valores |
|---|---|---|
| Entrada escalonada | `.rise` + `.d1`…`.d8` | 700ms, `cubic-bezier(.2,.8,.2,1)`, +70ms por elemento, opacidad + translateY(18px) + blur(4px) |
| Navegación | `.nav` (`navIn`) | 700ms spring, entra desde abajo |
| Hoja inferior | `.sheet` + `.scrim` | `sheetUp` 700ms spring; scrim con `backdrop-filter: blur(6px)` |
| Conteo de cifras | JS (rAF) | 1500ms, easeOutQuart: `1 - (1-k)^4` |
| Sparkline | `.draw` | trazo que se dibuja, 2s |
| Barras | `.grow` | scaleY desde 0, 900ms, escalonado |
| Anillos | `.ring-arc` | stroke-dashoffset desde 302 (r=48) |
| Progreso | `.bar > i` | width desde 0, 1.2s |
| Luz ambiental | `.orb` (`drift`), `.sheen` | 6–18s en loop, muy sutil |
| Botón primario | `.btn-primary::after` | brillo que barre cada 3.6s |
| Botón + central | `.add` (`breathe`) | glow que respira 3.4s |
| Indicador en vivo | `.live` (`ping`) | pulso cian 2.2s |
| Tap | `.icon-btn:active`, `.btn:active` | scale .9–.97 con resorte |
| Segmented | `.seg .thumb` | translateX con spring 450ms |
| Check de hábito | botón | scale 1.08 + rotate(−6deg) con spring |

Todo se desactiva con `@media (prefers-reduced-motion: reduce)` (ya incluido).
Recomendado para transiciones entre pantallas: **View Transitions API** (`document.startViewTransition`) o Framer Motion `AnimatePresence` con fade + 12px de desplazamiento.

## 5. Pantallas

1. **Login** — anillos orbitando el logo, cuadrícula de fondo con máscara radial, CTA "Continuar con Google". ⚠️ Usa el botón/logo oficial de Google Sign-In según sus guías de marca (en el diseño hay un icono genérico).
2. **Inicio** — hero oscuro con saldo que cuenta, sparkline, "Gastado hoy" y "Hábitos"; tarjeta Coach con barra de tope; 4 acciones rápidas; "Hoy" (pagos + calendario); hábitos del día.
3. **Coach** — hoja inferior sobre Inicio: anillo cónico animado, 3 hallazgos (rojo/verde/ámbar), chips de preguntas sugeridas, input de chat, "Entendido" / "Abrir chat".
4. **Flujo** — segmented Gasto/Ingreso que cambia color de acento, monto grande centrado con formato es-CO en vivo, categorías como chips, "Hoy" + Guardar; el movimiento guardado entra al historial con animación.
5. **Análisis** — selector de mes, hero con balance neto + anillo de tasa de ahorro, KPIs con delta, barras Sep vs Oct, topes del mes.
6. **Metas** — Financieras/Personales, formulario colapsable, tarjeta de meta con estado (Atrasada), barra de progreso y "Aporta para nivelarte".
7. **Hábitos** — anillo diario que se llena al marcar, tarjetas con check animado y franja semanal.
8. **Todo (módulos)** — buscador con filtro en vivo, cuadrícula de módulos con dato vivo por módulo, cerrar sesión.
9. **Inversiones** — hero de patrimonio (orbes violeta/azul), 3 métricas glass, formulario con tipos en chips.
10. **Deudas** — anillo de "pagado", estado "Libre de deudas", historial con barras completas.

Agenda, Rutina, Proyectos, Bóveda y Presupuesto siguen el mismo patrón: header con back + título + toggle, tarjeta hero o resumen, lista de tarjetas `.card` con `.tile` de color semántico.

## 6. Reglas a respetar

- Sin emojis como iconos → usar **Lucide** (`lucide-react`), trazo 1.8–2.
- Cifras siempre con `toLocaleString('es-CO')` y fuente `Sora` tabular.
- Ingreso/Gasto se distinguen por **color + signo (+/−) + flecha**, no solo color.
- Botones de solo icono con `aria-label`.
- Montos con `inputmode="numeric"`.

---

## Prompt sugerido para Claude Code

> Lee `HANDOFF.md`, `f360.css` y los archivos de `screens/`. Aplica este rediseño a la app Finanzas 360 sin cambiar la lógica de datos ni Firebase/Google Auth existentes:
> 1. Integra `f360.css` como hoja global (o conviértelo a variables de Tailwind si el proyecto usa Tailwind) y añade el toggle de tema claro/oscuro persistente.
> 2. Reemplaza la barra superior de iconos y los FAB por la barra inferior flotante `Inicio · Flujo · [+] · Análisis · Metas` y la pantalla "Todo" para el resto de módulos.
> 3. Une Ingresos y Gastos en "Flujo" con segmented control.
> 4. Convierte el modal del Coach en tarjeta de insight en Inicio + hoja inferior.
> 5. Rehaz cada pantalla siguiendo los `.dc.html` como referencia visual y aplica el sistema de motion (respetando prefers-reduced-motion).
> Trabaja pantalla por pantalla y muéstrame cada una antes de seguir.
