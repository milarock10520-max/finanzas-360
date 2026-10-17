import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, ArrowRightCircle, RotateCcw, Edit2, X, Shield, Eye, EyeOff, Lock, Copy, KeyRound, Search, Circle, Archive, FolderKanban, Server, FileCode, ChevronRight, ChevronDown } from 'lucide-react';
import { ScreenHeader, BottomSheet } from '../ui/f360.jsx';
import { PlusToggle } from '../components/comunes';
import { decryptText, encryptText } from '../lib/boveda';
import { dateKey } from '../lib/finanzas';
import { VaultLockScreen } from './Boveda';
import { RUTINA_COLORS } from './Rutina';

// =============================================
// === PROYECTOS (trabajo laboral por proyectos) ===
// =============================================

export const PROYECTO_EMOJIS = ['💼', '📊', '🚀', '💡', '🔧', '🖥️', '📱', '🌐', '📈', '🤝', '✍️', '🎯', '🧪', '🎨', '📦', '🔐'];

export const KANBAN_COLS = [
    { id: 'pendiente', label: 'Pendiente', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
    { id: 'en_curso', label: 'En curso', dot: 'bg-sky-400', chip: 'bg-sky-100 text-sky-700' },
    { id: 'hecha', label: 'Hecho', dot: 'bg-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
];

export const PRIORIDAD_DOT = { alta: 'bg-rose-500', media: 'bg-amber-400', baja: 'bg-slate-300' };

export const tiempoRelativo = (iso) => {
    if (!iso) return '';
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} días`;
    return `hace ${Math.floor(dias / 30)} mes${dias >= 60 ? 'es' : ''}`;
};

export const ProyectoEditorModal = ({ proyecto, onClose, onSave }) => {
    const esNuevo = !proyecto?.id;
    const [nombre, setNombre] = useState(proyecto?.nombre || '');
    const [emoji, setEmoji] = useState(proyecto?.emoji || '💼');
    const [color, setColor] = useState(proyecto?.color || 'azul');
    const [descripcion, setDescripcion] = useState(proyecto?.descripcion || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setSaving(true);
        await onSave({ nombre: nombre.trim(), emoji, color, descripcion: descripcion.trim() });
        setSaving(false);
        onClose();
    };

    return (
        <BottomSheet open onClose={onClose} label={esNuevo ? 'Nuevo proyecto' : 'Editar proyecto'}>
            <div style={{ padding: '14px 20px 8px' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{esNuevo ? 'Nuevo proyecto' : 'Editar proyecto'}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
                </header>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Nombre del proyecto"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors"
                        autoFocus
                        required
                    />
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Emoji</p>
                        <div className="grid grid-cols-8 gap-1">
                            {PROYECTO_EMOJIS.map(em => (
                                <button type="button" key={em} onClick={() => setEmoji(em)}
                                    className={`text-xl p-1.5 rounded-lg transition-all ${emoji === em ? 'bg-slate-200 ring-2 ring-slate-500 scale-110' : 'hover:bg-slate-100'}`}
                                >{em}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Color</p>
                        <div className="flex gap-2">
                            {Object.entries(RUTINA_COLORS).map(([key, c]) => (
                                <button type="button" key={key} onClick={() => setColor(key)}
                                    className={`w-8 h-8 rounded-full ${c.dot} transition-all ${color === key ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : 'hover:scale-105'}`}
                                />
                            ))}
                        </div>
                    </div>
                    <textarea
                        placeholder="Descripción (opcional)"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors resize-none"
                    />
                    <button type="submit" disabled={saving} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-300 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </form>
            </div>
        </BottomSheet>
    );
};

// =============================================
// === CREDENCIALES CIFRADAS POR PROYECTO ===
// =============================================
// Cada credencial guarda UN solo blob cifrado (AES-256-GCM) con todo lo
// sensible junto: {valor, usuario, url, notas}. En Firestore queda en claro
// únicamente la etiqueta y el tipo — lo mínimo para poder listar y avisar
// vencimientos con la bóveda bloqueada. A diferencia de la colección
// `passwords`, aquí ni el usuario ni la URL son visibles: en infraestructura
// el metadato ya es media credencial (revela host, motor y usuario de servicio).
//
// Los helpers de cifrado y VaultLockScreen se declaran más abajo en el archivo;
// como solo se usan en tiempo de render, el orden no importa.

export const TIPOS_CREDENCIAL = {
    apikey: { label: 'API Key / Token', icon: KeyRound, bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-400' },
    acceso: { label: 'Acceso (usuario/clave)', icon: Lock, bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-400' },
    conexion: { label: 'Cadena de conexión', icon: Server, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
    bloque: { label: 'Bloque (SSH / PEM / .env)', icon: FileCode, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
};

export const ENTORNOS = ['', 'dev', 'staging', 'prod'];
export const OCULTAR_SECRETO_MS = 30000;
export const LIMPIAR_PORTAPAPELES_MS = 45000;

export const ProyectoCredenciales = ({ proyectoId, credenciales, vault, genericAdd, genericUpdate, genericDelete }) => {
    const [showForm, setShowForm] = useState(false);
    const [tipo, setTipo] = useState('apikey');
    const [nombre, setNombre] = useState('');
    const [valor, setValor] = useState('');
    const [usuario, setUsuario] = useState('');
    const [url, setUrl] = useState('');
    const [notas, setNotas] = useState('');
    const [entorno, setEntorno] = useState('');
    const [expiraEn, setExpiraEn] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [revelados, setRevelados] = useState({}); // id -> payload descifrado
    const [copiedId, setCopiedId] = useState(null);
    const timersRef = useRef({});

    // Si la bóveda se bloquea (pestaña, inactividad o botón), se borra de
    // memoria todo lo que estaba descifrado.
    useEffect(() => {
        if (!vault.isUnlocked) setRevelados({});
    }, [vault.isUnlocked]);

    useEffect(() => () => {
        Object.values(timersRef.current).forEach(clearTimeout);
    }, []);

    if (!vault.isUnlocked) {
        return (
            <VaultLockScreen
                vault={vault}
                titulo="Credenciales del Proyecto"
                subtitulo="Usa la misma clave maestra de tu bóveda de contraseñas"
            />
        );
    }

    const limpiarForm = () => {
        setNombre(''); setValor(''); setUsuario(''); setUrl('');
        setNotas(''); setEntorno(''); setExpiraEn(''); setError('');
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        vault.touch();
        if (!nombre.trim() || !valor.trim()) { setError('Falta el nombre o el valor.'); return; }
        if (!vault.salt) { setError('La bóveda aún no está lista, intenta de nuevo.'); return; }
        setSaving(true);
        try {
            const payload = JSON.stringify({
                valor,
                usuario: usuario || '',
                url: url || '',
                notas: notas || '',
            });
            const cifrado = await encryptText(payload, vault.masterPassword, vault.salt, vault.iterations);
            await genericAdd('proyecto_credenciales', {
                proyectoId,
                nombre: nombre.trim(),
                tipo,
                entorno,
                expiraEn: expiraEn || null,
                secretoEncrypted: cifrado.ciphertext,
                iv: cifrado.iv,
                createdAt: new Date().toISOString(),
            });
            limpiarForm();
            setShowForm(false);
        } catch (err) {
            setError('No se pudo cifrar la credencial.');
        } finally {
            setSaving(false);
        }
    };

    // Descifrado defensivo: decryptText devuelve null si la clave no sirve, y
    // JSON.parse(null) explota.
    const descifrar = async (cred) => {
        try {
            const json = await decryptText(
                { ciphertext: cred.secretoEncrypted, iv: cred.iv },
                vault.masterPassword, vault.salt, vault.iterations
            );
            if (!json) return null;
            return JSON.parse(json);
        } catch (err) {
            return null;
        }
    };

    const toggleRevelar = async (cred) => {
        vault.touch();
        if (revelados[cred.id]) {
            clearTimeout(timersRef.current[cred.id]);
            setRevelados(prev => { const p = { ...prev }; delete p[cred.id]; return p; });
            return;
        }
        const payload = await descifrar(cred);
        if (!payload) { setError('No se pudo descifrar esa credencial.'); return; }
        setRevelados(prev => ({ ...prev, [cred.id]: payload }));
        // Se vuelve a ocultar sola para no dejarla expuesta en pantalla.
        timersRef.current[cred.id] = setTimeout(() => {
            setRevelados(prev => { const p = { ...prev }; delete p[cred.id]; return p; });
        }, OCULTAR_SECRETO_MS);
    };

    const copiar = async (cred, campo = 'valor') => {
        vault.touch();
        const payload = revelados[cred.id] || await descifrar(cred);
        if (!payload) { setError('No se pudo descifrar esa credencial.'); return; }
        await navigator.clipboard.writeText(payload[campo] || '');
        setCopiedId(cred.id + campo);
        setTimeout(() => setCopiedId(null), 2000);
        // Limpieza parcial del portapapeles (ver aviso en la UI).
        setTimeout(() => {
            if (!document.hasFocus()) return;
            navigator.clipboard.writeText('').catch(() => {});
        }, LIMPIAR_PORTAPAPELES_MS);
    };

    const eliminar = (cred) => {
        vault.touch();
        if (!window.confirm(`¿Eliminar la credencial "${cred.nombre}"? No se puede recuperar.`)) return;
        clearTimeout(timersRef.current[cred.id]);
        genericDelete('proyecto_credenciales', cred.id);
    };

    const lista = credenciales
        .filter(c => !busqueda || `${c.nombre} ${c.entorno || ''}`.toLowerCase().includes(busqueda.toLowerCase()))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const campos = {
        apikey: { valorLabel: 'API key / token', multilinea: false, usaUsuario: false, usaUrl: false, usaExpira: true },
        acceso: { valorLabel: 'Contraseña', multilinea: false, usaUsuario: true, usaUrl: true, usaExpira: false },
        conexion: { valorLabel: 'Cadena de conexión', multilinea: false, usaUsuario: false, usaUrl: false, usaExpira: false },
        bloque: { valorLabel: 'Contenido (SSH / PEM / .env)', multilinea: true, usaUsuario: false, usaUrl: false, usaExpira: false },
    }[tipo];

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="bg-slate-800 text-white rounded-2xl p-4 flex items-start gap-3">
                <Shield size={20} className="shrink-0 mt-0.5 text-emerald-400" />
                <div className="text-xs leading-relaxed">
                    <p className="font-bold text-sm mb-0.5">Cifrado en tu dispositivo</p>
                    <p className="text-slate-300">
                        El valor, usuario, URL y notas se cifran con tu clave maestra antes de salir del equipo.
                        En la nube solo queda el nombre y el tipo. La bóveda se bloquea sola tras 5 min sin actividad.
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                        type="text" placeholder="Buscar credencial..." value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm"
                    />
                </div>
                <button onClick={() => { setShowForm(!showForm); setError(''); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors shrink-0">
                    {showForm ? 'Cancelar' : '+ Credencial'}
                </button>
                <button onClick={() => vault.lock()} title="Bloquear bóveda" className="bg-slate-100 text-slate-500 px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors shrink-0">
                    <Lock size={16} />
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(TIPOS_CREDENCIAL).map(([id, t]) => {
                            const Icono = t.icon;
                            return (
                                <button type="button" key={id} onClick={() => setTipo(id)}
                                    className={`flex items-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold border-2 transition-all ${tipo === id ? `${t.bg} ${t.text} ${t.border}` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                                    <Icono size={14} /> <span className="truncate">{t.label.split(' ')[0]}</span>
                                </button>
                            );
                        })}
                    </div>

                    <input
                        type="text" placeholder='Nombre (ej: "Stripe producción") — visible sin descifrar'
                        value={nombre} onChange={e => setNombre(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm" required
                    />

                    {campos.usaUsuario && (
                        <input type="text" placeholder="Usuario" value={usuario} onChange={e => setUsuario(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm" />
                    )}

                    {campos.multilinea ? (
                        <textarea
                            placeholder={campos.valorLabel} value={valor} onChange={e => setValor(e.target.value)}
                            rows={6} maxLength={65536} required
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-xs font-mono resize-y"
                        />
                    ) : (
                        <input type="text" placeholder={campos.valorLabel} value={valor} onChange={e => setValor(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm font-mono" required />
                    )}

                    {campos.usaUrl && (
                        <input type="text" placeholder="URL / host" value={url} onChange={e => setUrl(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm" />
                    )}

                    <div className="flex gap-2">
                        <select value={entorno} onChange={e => setEntorno(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm bg-white">
                            {ENTORNOS.map(en => <option key={en} value={en}>{en ? en.toUpperCase() : 'Sin entorno'}</option>)}
                        </select>
                        {campos.usaExpira && (
                            <input type="date" value={expiraEn} onChange={e => setExpiraEn(e.target.value)} title="Fecha de expiración"
                                className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm text-slate-500" />
                        )}
                    </div>

                    <input type="text" placeholder="Notas (se cifran)" value={notas} onChange={e => setNotas(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 text-sm" />

                    {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

                    <button type="submit" disabled={saving} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50">
                        {saving ? 'Cifrando...' : '🔐 Guardar cifrada'}
                    </button>
                </form>
            )}

            {error && !showForm && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            {lista.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                    Sin credenciales guardadas. Aquí puedes tener las API keys y accesos del proyecto, cifrados de punta a punta.
                </div>
            ) : (
                <div className="space-y-2">
                    {lista.map((cred, i) => {
                        const t = TIPOS_CREDENCIAL[cred.tipo] || TIPOS_CREDENCIAL.apikey;
                        const Icono = t.icon;
                        const abierto = revelados[cred.id];
                        const vencida = cred.expiraEn && cred.expiraEn < dateKey();
                        const porVencer = cred.expiraEn && !vencida && (new Date(cred.expiraEn) - new Date()) < 14 * 86400000;
                        return (
                            <div key={cred.id} style={{ animationDelay: `${i * 30}ms` }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 animate-in zoom-in-95 duration-300">
                                <div className="flex items-start gap-3">
                                    <span className={`w-9 h-9 flex items-center justify-center rounded-xl shrink-0 ${t.bg} ${t.text}`}>
                                        <Icono size={17} />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{cred.nombre}</h4>
                                            {cred.entorno && (
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cred.entorno === 'prod' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{cred.entorno}</span>
                                            )}
                                            {vencida && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600">⚠ Vencida {cred.expiraEn}</span>}
                                            {porVencer && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">📅 Vence {cred.expiraEn}</span>}
                                        </div>
                                        <p className="text-[11px] text-slate-400">{t.label}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => toggleRevelar(cred)} title={abierto ? 'Ocultar' : 'Revelar'}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                            {abierto ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                        <button onClick={() => copiar(cred, 'valor')} title="Copiar valor"
                                            className={`p-1.5 rounded-lg transition-colors ${copiedId === cred.id + 'valor' ? 'bg-emerald-100 text-emerald-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                                            {copiedId === cred.id + 'valor' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                        </button>
                                        <button onClick={() => eliminar(cred)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {abierto && (
                                    <div className="mt-3 pt-3 border-t border-slate-50 space-y-2 animate-in fade-in duration-300">
                                        {abierto.usuario && (
                                            <p className="text-xs text-slate-500">Usuario: <span className="font-mono font-bold text-slate-700">{abierto.usuario}</span>
                                                <button onClick={() => copiar(cred, 'usuario')} className="ml-2 text-slate-300 hover:text-slate-600 align-middle"><Copy size={12} /></button>
                                            </p>
                                        )}
                                        {abierto.url && <p className="text-xs text-slate-500">URL: <span className="font-mono text-slate-700 break-all">{abierto.url}</span></p>}
                                        {cred.tipo === 'bloque' ? (
                                            <pre className="max-h-48 overflow-auto text-xs font-mono bg-slate-50 p-3 rounded-xl whitespace-pre-wrap break-all text-slate-700">{abierto.valor}</pre>
                                        ) : (
                                            <p className="text-xs font-mono bg-slate-50 p-2.5 rounded-xl break-all text-slate-700">{abierto.valor}</p>
                                        )}
                                        {abierto.notas && <p className="text-xs text-slate-400 italic">{abierto.notas}</p>}
                                        <p className="text-[10px] text-slate-300">Se oculta sola en 30 s · al copiar, el portapapeles se limpia en 45 s (el historial de Windows Win+V puede conservarlo)</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const ProyectoDetail = ({ proyecto, items, credenciales = [], vault, onBack, onEdit, genericAdd, genericUpdate, genericDelete }) => {
    const [vista, setVista] = useState('tareas');
    const [nuevaTarea, setNuevaTarea] = useState('');
    const [nuevaPrioridad, setNuevaPrioridad] = useState('media');
    const [nuevoAvance, setNuevoAvance] = useState('');
    const [nuevaNota, setNuevaNota] = useState('');
    const [nuevaMeta, setNuevaMeta] = useState('');
    const [nuevaMetaFecha, setNuevaMetaFecha] = useState('');

    const c = RUTINA_COLORS[proyecto.color] || RUTINA_COLORS.gris;
    const tareas = items.filter(i => i.tipo === 'tarea');
    const avances = items.filter(i => i.tipo === 'avance').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const notas = items.filter(i => i.tipo === 'nota').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const metas = items.filter(i => i.tipo === 'meta').sort((a, b) => (a.completada ? 1 : 0) - (b.completada ? 1 : 0));
    const hechas = tareas.filter(t => t.estado === 'hecha').length;
    const pct = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0;

    const addItem = (datos) => genericAdd('proyecto_items', { proyectoId: proyecto.id, createdAt: new Date().toISOString(), ...datos });

    const moverTarea = (tarea, dir) => {
        const orden = ['pendiente', 'en_curso', 'hecha'];
        const idx = orden.indexOf(tarea.estado) + dir;
        if (idx < 0 || idx >= orden.length) return;
        genericUpdate('proyecto_items', tarea.id, { estado: orden[idx], movedAt: new Date().toISOString() });
    };

    const TABS = [
        { id: 'tareas', label: `Tareas${tareas.length ? ` (${tareas.length})` : ''}` },
        { id: 'avances', label: `Avances${avances.length ? ` (${avances.length})` : ''}` },
        { id: 'notas', label: `Notas${notas.length ? ` (${notas.length})` : ''}` },
        { id: 'metas', label: `Metas${metas.length ? ` (${metas.length})` : ''}` },
        { id: 'credenciales', label: `🔐 Credenciales${credenciales.length ? ` (${credenciales.length})` : ''}` },
    ];

    const NOTA_COLORES = ['amarillo', 'verde', 'azul', 'rosa', 'naranja'];

    return (
        <div className="space-y-5">
            <ScreenHeader title={proyecto.nombre} onBack={onBack} right={
                <>
                    <button type="button" className="icon-btn" onClick={onEdit} aria-label="Editar proyecto"><Edit2 size={17} aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={proyecto.estado === 'archivado' ? 'Desarchivar' : 'Archivar'}
                        onClick={() => genericUpdate('proyectos', proyecto.id, { estado: proyecto.estado === 'archivado' ? 'activo' : 'archivado' })}>
                        <Archive size={17} aria-hidden="true" />
                    </button>
                </>
            } />

            <section className="card rise d2" style={{ marginTop: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="tile" style={{ background: 'var(--surface-2)', fontSize: 22 }}>{proyecto.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>{proyecto.descripcion || 'Sin descripción'}</span>
                        {proyecto.estado === 'archivado' && <span className="eyebrow">Archivado</span>}
                    </div>
                </div>
                {tareas.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="bar" style={{ flex: 1 }}><i style={{ width: `${pct}%`, background: 'var(--income)' }} /></div>
                        <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0 }}>{hechas}/{tareas.length} tareas</span>
                    </div>
                )}
            </section>

            <div className="hscroll rise d3" role="tablist" style={{ marginTop: 14, marginBottom: 14 }}>
                {TABS.map(t => (
                    <button key={t.id} type="button" role="tab" aria-selected={vista === t.id} onClick={() => setVista(t.id)} className={`chip ${vista === t.id ? 'on' : ''}`}>{t.label}</button>
                ))}
            </div>

            {vista === 'tareas' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevaTarea.trim()) return; addItem({ tipo: 'tarea', titulo: nuevaTarea.trim(), estado: 'pendiente', prioridad: nuevaPrioridad, movedAt: new Date().toISOString() }); setNuevaTarea(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2 items-center"
                    >
                        <input type="text" placeholder="Nueva tarea..." value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm min-w-0" />
                        <div className="flex gap-1 shrink-0">
                            {['alta', 'media', 'baja'].map(p => (
                                <button type="button" key={p} onClick={() => setNuevaPrioridad(p)} title={`Prioridad ${p}`}
                                    className={`w-6 h-6 rounded-full ${PRIORIDAD_DOT[p]} transition-all ${nuevaPrioridad === p ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'opacity-40 hover:opacity-70'}`} />
                            ))}
                        </div>
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0"><Plus size={18} /></button>
                    </form>

                    <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 md:grid md:grid-cols-3 md:overflow-visible">
                        {KANBAN_COLS.map(col => {
                            const colTareas = tareas.filter(t => t.estado === col.id).sort((a, b) => ({ alta: 0, media: 1, baja: 2 }[a.prioridad] ?? 1) - ({ alta: 0, media: 1, baja: 2 }[b.prioridad] ?? 1));
                            return (
                                <div key={col.id} className="min-w-[85%] snap-center md:min-w-0 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${col.chip}`}>
                                        <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                        {col.label} · {colTareas.length}
                                    </div>
                                    <div className="space-y-2 min-h-[3rem]">
                                        {colTareas.length === 0 && <p className="text-xs text-slate-300 text-center py-4">Vacío</p>}
                                        {colTareas.map((t, i) => (
                                            <div key={t.id} style={{ animationDelay: `${i * 30}ms` }} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 animate-in zoom-in-95 duration-300">
                                                <div className="flex items-start gap-2">
                                                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORIDAD_DOT[t.prioridad] || PRIORIDAD_DOT.media}`} />
                                                    <p className={`flex-1 text-sm font-medium leading-snug ${t.estado === 'hecha' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.titulo}</p>
                                                </div>
                                                <div className="flex justify-end gap-1 mt-2">
                                                    {col.id !== 'pendiente' && (
                                                        <button onClick={() => moverTarea(t, -1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="Retroceder">
                                                            <RotateCcw size={15} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => { if (window.confirm('¿Eliminar tarea?')) genericDelete('proyecto_items', t.id); }} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors">
                                                        <Trash2 size={15} />
                                                    </button>
                                                    {col.id !== 'hecha' && (
                                                        <button onClick={() => moverTarea(t, 1)} className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors" title="Avanzar">
                                                            <ArrowRightCircle size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {vista === 'avances' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevoAvance.trim()) return; addItem({ tipo: 'avance', texto: nuevoAvance.trim(), fecha: dateKey() }); setNuevoAvance(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2"
                    >
                        <input type="text" placeholder="Hoy logré..." value={nuevoAvance} onChange={(e) => setNuevoAvance(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm min-w-0" />
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0"><Plus size={18} /></button>
                    </form>
                    {avances.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                            Registra tu primer avance: pequeños logros diarios cuentan la historia del proyecto.
                        </div>
                    )}
                    <div className="space-y-2">
                        {avances.map((a, i) => (
                            <div key={a.id} style={{ animationDelay: `${i * 25}ms` }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-300 flex items-start gap-3 animate-in slide-in-from-bottom duration-300 group">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700">{a.texto}</p>
                                    <p className="text-xs text-slate-400 mt-1">{a.fecha} · {tiempoRelativo(a.createdAt)}</p>
                                </div>
                                <button onClick={() => { if (window.confirm('¿Eliminar avance?')) genericDelete('proyecto_items', a.id); }} className="p-1.5 rounded-lg text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {vista === 'notas' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevaNota.trim()) return; addItem({ tipo: 'nota', texto: nuevaNota.trim(), color: NOTA_COLORES[notas.length % NOTA_COLORES.length] }); setNuevaNota(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2"
                    >
                        <textarea placeholder="Idea, enlace, decisión, apunte..." value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} rows={2}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm resize-none min-w-0" />
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0 self-end"><Plus size={18} /></button>
                    </form>
                    {notas.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                            Sin notas aún. Guarda aquí ideas, enlaces y decisiones del proyecto.
                        </div>
                    )}
                    <div className="columns-2 gap-3 [column-fill:_balance]">
                        {notas.map((n, i) => {
                            const nc = RUTINA_COLORS[n.color] || RUTINA_COLORS.amarillo;
                            return (
                                <div key={n.id} style={{ animationDelay: `${i * 30}ms` }} className={`break-inside-avoid mb-3 p-4 rounded-2xl border ${nc.bg} ${nc.border} ${nc.text} animate-in zoom-in-95 duration-300 group relative`}>
                                    <p className="text-sm whitespace-pre-wrap break-words">{n.texto}</p>
                                    <p className="text-[10px] opacity-60 mt-2">{tiempoRelativo(n.createdAt)}</p>
                                    <button onClick={() => { if (window.confirm('¿Eliminar nota?')) genericDelete('proyecto_items', n.id); }} className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/50 transition-all">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {vista === 'credenciales' && (
                <ProyectoCredenciales
                    proyectoId={proyecto.id}
                    credenciales={credenciales}
                    vault={vault}
                    genericAdd={genericAdd}
                    genericUpdate={genericUpdate}
                    genericDelete={genericDelete}
                />
            )}

            {vista === 'metas' && (
                <div className="space-y-4">
                    <form
                        onSubmit={(e) => { e.preventDefault(); if (!nuevaMeta.trim()) return; addItem({ tipo: 'meta', titulo: nuevaMeta.trim(), fechaLimite: nuevaMetaFecha || null, completada: false }); setNuevaMeta(''); setNuevaMetaFecha(''); }}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-2"
                    >
                        <input type="text" placeholder="Objetivo del proyecto..." value={nuevaMeta} onChange={(e) => setNuevaMeta(e.target.value)}
                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm min-w-[10rem]" />
                        <input type="date" value={nuevaMetaFecha} onChange={(e) => setNuevaMetaFecha(e.target.value)}
                            className="px-3 py-2 border-2 border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-colors text-sm text-slate-500" />
                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-900 transition-colors shrink-0"><Plus size={18} /></button>
                    </form>
                    {metas.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400 text-sm">
                            Define los objetivos grandes del proyecto, separados del día a día.
                        </div>
                    )}
                    <div className="space-y-2">
                        {metas.map((m, i) => {
                            const vencida = m.fechaLimite && !m.completada && m.fechaLimite < dateKey();
                            return (
                                <div key={m.id} style={{ animationDelay: `${i * 25}ms` }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 group">
                                    <button onClick={() => genericUpdate('proyecto_items', m.id, { completada: !m.completada })} className="shrink-0">
                                        {m.completada
                                            ? <CheckCircle2 size={22} className="text-emerald-500" />
                                            : <Circle size={22} className="text-slate-300 hover:text-slate-400 transition-colors" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${m.completada ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.titulo}</p>
                                        {m.fechaLimite && (
                                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${vencida ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {vencida ? '⚠ ' : '📅 '}{m.fechaLimite}
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => { if (window.confirm('¿Eliminar meta?')) genericDelete('proyecto_items', m.id); }} className="p-1.5 rounded-lg text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ProyectosSection = ({ proyectos, proyectoItems, proyectoCredenciales = [], vault, genericAdd, genericUpdate, genericDelete, onBack }) => {
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [editorProyecto, setEditorProyecto] = useState(null); // null | 'nuevo' | proyecto
    const [showArchived, setShowArchived] = useState(false);

    const activos = proyectos.filter(p => p.estado !== 'archivado');
    const archivados = proyectos.filter(p => p.estado === 'archivado');
    const proyectoActual = proyectos.find(p => p.id === selectedProjectId);

    const handleSaveProyecto = async (datos) => {
        if (editorProyecto && editorProyecto !== 'nuevo') {
            await genericUpdate('proyectos', editorProyecto.id, datos);
        } else {
            await genericAdd('proyectos', { ...datos, estado: 'activo', createdAt: new Date().toISOString() });
        }
    };

    if (proyectoActual) {
        return (
            <>
                <ProyectoDetail
                    proyecto={proyectoActual}
                    items={proyectoItems.filter(i => i.proyectoId === proyectoActual.id)}
                    credenciales={proyectoCredenciales.filter(c => c.proyectoId === proyectoActual.id)}
                    vault={vault}
                    onBack={() => setSelectedProjectId(null)}
                    onEdit={() => setEditorProyecto(proyectoActual)}
                    genericAdd={genericAdd}
                    genericUpdate={genericUpdate}
                    genericDelete={genericDelete}
                />
                {editorProyecto && (
                    <ProyectoEditorModal
                        proyecto={editorProyecto === 'nuevo' ? null : editorProyecto}
                        onClose={() => setEditorProyecto(null)}
                        onSave={handleSaveProyecto}
                    />
                )}
            </>
        );
    }

    const CardProyecto = ({ p, index }) => {
        const c = RUTINA_COLORS[p.color] || RUTINA_COLORS.gris;
        const items = proyectoItems.filter(i => i.proyectoId === p.id);
        const tareas = items.filter(i => i.tipo === 'tarea');
        const hechas = tareas.filter(t => t.estado === 'hecha').length;
        const pct = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0;
        const ultima = items.reduce((max, i) => {
            const t = i.movedAt || i.createdAt || '';
            return t > max ? t : max;
        }, p.createdAt || '');
        return (
            <button type="button" onClick={() => setSelectedProjectId(p.id)} className="card lift rise"
                style={{ animationDelay: `${0.2 + index * 0.05}s`, padding: 16, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left', color: 'var(--text)', cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <span className="tile" style={{ background: 'var(--surface-2)', fontSize: 20 }}>{p.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Actividad {tiempoRelativo(ultima)}</span>
                    </span>
                    <ChevronRight size={18} color="var(--text-3)" aria-hidden="true" />
                </span>
                {p.descripcion && <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.descripcion}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <span className="bar" style={{ flex: 1, display: 'block' }}><i style={{ width: `${pct}%`, background: 'var(--income)' }} /></span>
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0 }}>{tareas.length ? `${hechas}/${tareas.length}` : 'Sin tareas'}</span>
                </span>
            </button>
        );
    };

    return (
        <div>
            <ScreenHeader title="Proyectos" onBack={onBack} right={<PlusToggle open={false} onClick={() => setEditorProyecto('nuevo')} label="Nuevo proyecto" />} />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="orb" style={{ width: 200, height: 200, right: -80, top: -100, background: '#3355FF', opacity: .6 }} />
                <div className="grid-lines" />
                <span className="tile" style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.1)', color: '#fff' }}><FolderKanban size={24} aria-hidden="true" /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="num" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{activos.length}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>{activos.length === 1 ? 'proyecto activo' : 'proyectos activos'}</span>
                </div>
            </section>

            {activos.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 24, fontSize: 14, lineHeight: 1.5 }}>Crea tu primer proyecto laboral con +: tendrá su tablero de tareas, bitácora de avances, notas y metas.</p>
            )}

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {activos.map((p, i) => <CardProyecto key={p.id} p={p} index={i} />)}
            </div>

            {archivados.length > 0 && (
                <div style={{ marginTop: 18 }}>
                    <button type="button" onClick={() => setShowArchived(!showArchived)} className="chip" aria-expanded={showArchived}>
                        <ChevronDown size={14} aria-hidden="true" style={{ transform: showArchived ? 'none' : 'rotate(-90deg)', transition: 'transform .3s' }} /> Archivados ({archivados.length})
                    </button>
                    {showArchived && (
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, opacity: .7 }}>
                            {archivados.map((p, i) => <CardProyecto key={p.id} p={p} index={i} />)}
                        </div>
                    )}
                </div>
            )}

            {editorProyecto && (
                <ProyectoEditorModal
                    proyecto={editorProyecto === 'nuevo' ? null : editorProyecto}
                    onClose={() => setEditorProyecto(null)}
                    onSave={handleSaveProyecto}
                />
            )}
        </div>
    );
};
