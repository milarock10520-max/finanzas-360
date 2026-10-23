// Componentes base del sistema de diseño F360 (ver design/HANDOFF.md).
import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Sun, Moon, ChevronLeft, Home, ArrowLeftRight, Plus, BarChart3, Target, Mic } from 'lucide-react';

// --- TEMA ---
const THEME_KEY = 'f360-theme';

const temaInicial = () => {
    try {
        const guardado = localStorage.getItem(THEME_KEY);
        if (guardado) return guardado === 'dark';
    } catch (e) { /* almacenamiento bloqueado */ }
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
};

const aplicarTema = (dark) => {
    const root = document.documentElement;
    root.classList.add('f360');
    root.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#06080E' : '#F4F6FB');
    if (Capacitor.isNativePlatform()) {
        import('@capacitor/status-bar')
            .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
            .catch(() => {});
    }
};

// Aplica el tema guardado antes del primer render (evita parpadeo).
aplicarTema(temaInicial());

// iOS puede restablecer el estilo de la barra de estado al volver de segundo plano.
if (Capacitor.isNativePlatform()) {
    import('@capacitor/app')
        .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => { if (isActive) aplicarTema(document.documentElement.classList.contains('dark')); }))
        .catch(() => {});
}

const listeners = new Set();
let darkActual = temaInicial();

export const setTema = (dark) => {
    darkActual = dark;
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) { /* */ }
    aplicarTema(dark);
    listeners.forEach(fn => fn(dark));
};

export const useTheme = () => {
    const [dark, setDark] = useState(darkActual);
    useEffect(() => {
        listeners.add(setDark);
        return () => listeners.delete(setDark);
    }, []);
    return [dark, () => setTema(!darkActual)];
};

export const ThemeToggle = () => {
    const [dark, toggle] = useTheme();
    return (
        <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
            <Sun className="sun" size={20} strokeWidth={1.8} aria-hidden="true" />
            <Moon className="moon" size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>
    );
};

// --- FORMATO ---
export const fmtCOP = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');

// Cifra que cuenta desde 0 (easeOutQuart, 1500ms). Respeta prefers-reduced-motion.
export const CountUp = ({ value, format = fmtCOP, duration = 1500 }) => {
    const [shown, setShown] = useState(0);
    const desdeRef = useRef(0);
    useEffect(() => {
        const objetivo = Number(value) || 0;
        const reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducir) { setShown(objetivo); desdeRef.current = objetivo; return; }
        const desde = desdeRef.current;
        const t0 = performance.now();
        let raf;
        const step = (t) => {
            const k = Math.min(1, (t - t0) / duration);
            const e = 1 - Math.pow(1 - k, 4);
            const v = desde + (objetivo - desde) * e;
            setShown(v);
            desdeRef.current = v;
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);
    return <>{format(shown)}</>;
};

// --- ENCABEZADO DE PANTALLA ---
// Título grande + acciones a la derecha; con onBack muestra el botón de volver.
export const ScreenHeader = ({ title, onBack, right, className = '' }) => (
    <header className={`rise d1 ${className}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {onBack && (
                <button type="button" className="icon-btn" onClick={onBack} aria-label="Volver">
                    <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
                </button>
            )}
            <h1 className="display" style={{ margin: 0, fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {right}
            <ThemeToggle />
        </div>
    </header>
);

// --- BARRA INFERIOR FLOTANTE ---
// Inicio · Flujo · [+] · Análisis · Metas
export const BottomNav = ({ active, onNavigate, onAdd, onVoz }) => {
    const item = (id, Icon, label) => (
        <button type="button" className={`nav-item ${active === id ? 'on' : ''}`} onClick={() => onNavigate(id)} aria-current={active === id ? 'page' : undefined}>
            <Icon size={22} strokeWidth={1.9} aria-hidden="true" />{label}
        </button>
    );
    return (
        <nav className="nav" aria-label="Principal">
            {onVoz && (
                <button type="button" className="nav-voz" onClick={onVoz} aria-label="Hablar con la IA">
                    <Mic size={24} strokeWidth={2.2} aria-hidden="true" />
                </button>
            )}
            {item('midia', Home, 'Inicio')}
            {item('flujo', ArrowLeftRight, 'Flujo')}
            <button type="button" className="nav-item" onClick={onAdd} aria-label="Registrar movimiento">
                <span className="add"><Plus size={24} strokeWidth={2.4} aria-hidden="true" /></span>
            </button>
            {item('analisis', BarChart3, 'Análisis')}
            {item('metas', Target, 'Metas')}
        </nav>
    );
};

// --- HOJA INFERIOR ---
// Bloquea el scroll del fondo mientras está abierta.
export const BottomSheet = ({ open, onClose, label, children, style }) => {
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [open, onClose]);
    if (!open) return null;
    return (
        <>
            <button type="button" className="scrim" aria-label="Cerrar" onClick={onClose} />
            <section className="sheet" role="dialog" aria-modal="true" aria-label={label} style={style}>
                <div className="grabber" />
                {children}
            </section>
        </>
    );
};

// --- SPARKLINE ---
// values: serie numérica. Dibuja una curva suave que se traza al entrar.
export const Sparkline = ({ values, height = 56 }) => {
    const W = 300;
    const pts = values.length > 1 ? values : [0, 0];
    const min = Math.min(...pts), max = Math.max(...pts);
    const span = max - min || 1;
    const xy = pts.map((v, i) => [i * (W / (pts.length - 1)), height - 6 - ((v - min) / span) * (height - 12)]);
    let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
    for (let i = 1; i < xy.length; i++) {
        const [x0, y0] = xy[i - 1], [x1, y1] = xy[i];
        const cx = (x0 + x1) / 2;
        d += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return (
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} aria-hidden="true" style={{ display: 'block' }} preserveAspectRatio="none">
            <defs>
                <linearGradient id="spk" x1="0" x2="1">
                    <stop offset="0" stopColor="#22D3EE" stopOpacity=".2" />
                    <stop offset="1" stopColor="#67E8F9" />
                </linearGradient>
            </defs>
            <path className="draw" d={d} fill="none" stroke="url(#spk)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

// --- ANILLO DE PROGRESO ---
// r=48 → circunferencia ≈ 302 (coincide con @keyframes ring).
export const Ring = ({ pct, size = 112, stroke = 10, color = 'var(--primary)', track = 'var(--surface-2)', children }) => {
    const r = 48;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, pct));
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg viewBox="0 0 112 112" width={size} height={size} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="56" cy="56" r={r} fill="none" stroke={track} strokeWidth={stroke} />
                <circle className="ring-arc" cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .8s var(--ease)' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
        </div>
    );
};
