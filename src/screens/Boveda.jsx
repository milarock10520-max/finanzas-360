import { useState, useEffect } from 'react';
import { Trash2, Edit2, AlertTriangle, Briefcase, Eye, EyeOff, Lock, Copy, RefreshCw, Globe, KeyRound, Search, Check, Mail, Users, Landmark, Gamepad2, ShoppingBag } from 'lucide-react';
import { ScreenHeader } from '../ui/f360.jsx';
import { PlusToggle } from '../components/comunes';
import { CATEGORIAS_PASSWORDS, decryptText, encryptText, generateStrongPassword } from '../lib/boveda';
import { db } from '../lib/firebase';

// Pantalla de crear/desbloquear bóveda. La usan tanto la bóveda de contraseñas
// como las credenciales de proyectos; los inputs viven aquí para que se
// descarten al desmontar.
export const VaultLockScreen = ({ vault, titulo, subtitulo }) => {
    const [masterInput, setMasterInput] = useState('');
    const [confirmInput, setConfirmInput] = useState('');
    const { isCreatingMaster, error, setError } = vault;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const ok = isCreatingMaster
            ? await vault.createMaster(masterInput, confirmInput)
            : await vault.unlock(masterInput);
        if (ok) { setMasterInput(''); setConfirmInput(''); }
    };

    return (
        <section className="card rise d2" style={{ marginTop: 18, padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, display: 'grid', placeItems: 'center', background: 'var(--hero)', color: '#fff', boxShadow: 'var(--shadow-lg)', animation: 'floaty 5s ease-in-out infinite' }}>
                <Lock size={30} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h2 className="display" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{isCreatingMaster ? 'Crear clave maestra' : (titulo || 'Bóveda bloqueada')}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>
                {isCreatingMaster
                    ? 'Crea una clave maestra fuerte (mínimo 10 caracteres; ideal una frase larga). No se puede recuperar y de ella depende toda la seguridad.'
                    : (subtitulo || 'Ingresa tu clave maestra para acceder')}
            </p>
            {error && (
                <div style={{ width: '100%', padding: '10px 14px', borderRadius: 14, background: 'var(--expense-soft)', color: 'var(--expense)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} aria-hidden="true" /> {error}
                </div>
            )}
            <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input className="input" type="password" placeholder="Clave maestra" aria-label="Clave maestra" autoComplete={isCreatingMaster ? 'new-password' : 'current-password'}
                    value={masterInput} onChange={e => { setMasterInput(e.target.value); setError(''); }} required
                    style={{ textAlign: 'center', letterSpacing: '.15em' }} />
                {isCreatingMaster && (
                    <input className="input" type="password" placeholder="Confirmar clave" aria-label="Confirmar clave" autoComplete="new-password"
                        value={confirmInput} onChange={e => { setConfirmInput(e.target.value); setError(''); }} required
                        style={{ textAlign: 'center', letterSpacing: '.15em' }} />
                )}
                <button type="submit" className="btn btn-primary">
                    {isCreatingMaster ? <><KeyRound size={18} aria-hidden="true" /> Crear bóveda</> : <><Lock size={18} aria-hidden="true" /> Desbloquear</>}
                </button>
            </form>
            {isCreatingMaster && (
                <p style={{ margin: 0, padding: '10px 14px', borderRadius: 14, background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 13, fontWeight: 700 }}>
                    Si olvidas tu clave maestra no podrás recuperar tus contraseñas.
                </p>
            )}
        </section>
    );
};

// =============================================
// === COMPONENTE: PASSWORD VAULT ===
// =============================================

export const PasswordVault = ({ passwords, vault, genericAdd, genericUpdate, genericDelete, user, db, onBack }) => {
    const { isUnlocked, masterPassword, salt, iterations } = vault;
    const [formOpen, setFormOpen] = useState(false);

    // Form states
    const [servicio, setServicio] = useState('');
    const [usuario, setUsuario] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [categoria, setCategoria] = useState(CATEGORIAS_PASSWORDS[0]);
    const [url, setUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPasswords, setShowPasswords] = useState({});
    const [decryptedCache, setDecryptedCache] = useState({});
    const [copiedId, setCopiedId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Al bloquearse la bóveda (por pestaña, inactividad o botón) se tira todo
    // lo que quedó descifrado en memoria.
    useEffect(() => {
        if (!isUnlocked) {
            setDecryptedCache({});
            setShowPasswords({});
        }
    }, [isUnlocked]);

    const handleAddPassword = async (e) => {
        e.preventDefault();
        if (!salt) return;
        const encrypted = await encryptText(passwordInput, masterPassword, salt, iterations);
        await genericAdd('passwords', {
            servicio,
            usuario,
            passwordEncrypted: encrypted.ciphertext,
            iv: encrypted.iv,
            categoria,
            url,
            createdAt: new Date().toISOString()
        });
        setServicio(''); setUsuario(''); setPasswordInput(''); setUrl('');
    };

    const handleShowPassword = async (item) => {
        if (showPasswords[item.id]) {
            setShowPasswords(prev => ({ ...prev, [item.id]: false }));
            return;
        }
        if (decryptedCache[item.id]) {
            setShowPasswords(prev => ({ ...prev, [item.id]: true }));
            return;
        }
        const decrypted = await decryptText({ ciphertext: item.passwordEncrypted, iv: item.iv }, masterPassword, salt, iterations);
        if (decrypted) {
            setDecryptedCache(prev => ({ ...prev, [item.id]: decrypted }));
            setShowPasswords(prev => ({ ...prev, [item.id]: true }));
        } else {
            alert('No se pudo descifrar esta contraseña. Bloquea y vuelve a abrir la bóveda con tu clave maestra.');
        }
    };

    const handleCopy = async (item) => {
        let text = decryptedCache[item.id];
        if (!text) {
            text = await decryptText({ ciphertext: item.passwordEncrypted, iv: item.iv }, masterPassword, salt, iterations);
        }
        if (text) {
            navigator.clipboard.writeText(text);
            setCopiedId(item.id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const handleUpdatePassword = async (item) => {
        if (!salt) return;
        const updates = { ...editForm };
        if (editForm.newPassword) {
            const encrypted = await encryptText(editForm.newPassword, masterPassword, salt, iterations);
            updates.passwordEncrypted = encrypted.ciphertext;
            updates.iv = encrypted.iv;
            delete updates.newPassword;
        }
        delete updates.newPassword;
        await genericUpdate('passwords', item.id, updates);
        setEditingId(null);
        setEditForm({});
        setDecryptedCache(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        setShowPasswords(prev => ({ ...prev, [item.id]: false }));
    };

    const filteredPasswords = passwords.filter(p =>
        p.servicio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.usuario?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- LOCK SCREEN ---
    if (!isUnlocked) {
        return (
            <div>
                <ScreenHeader title="Bóveda" onBack={onBack} />
                <VaultLockScreen vault={vault} />
            </div>
        );
    }

    // --- VAULT UNLOCKED ---
    const CAT_TONO = {
        'Correo': ['var(--expense-soft)', 'var(--expense)', Mail],
        'Red Social': ['var(--primary-soft)', 'var(--primary)', Users],
        'Banco / Finanzas': ['var(--income-soft)', 'var(--income)', Landmark],
        'Trabajo': ['var(--warn-soft)', 'var(--warn)', Briefcase],
        'Entretenimiento': ['var(--violet-soft)', 'var(--violet)', Gamepad2],
        'Compras': ['var(--expense-soft)', 'var(--expense)', ShoppingBag],
        'Otro': ['var(--surface-2)', 'var(--text-2)', KeyRound],
    };
    const iconBtn = { width: 40, height: 40, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-3)' };

    return (
        <div>
            <ScreenHeader title="Bóveda" onBack={onBack} right={
                <>
                    <button type="button" className="icon-btn" onClick={() => vault.lock()} aria-label="Bloquear bóveda"><Lock size={18} aria-hidden="true" /></button>
                    <PlusToggle open={formOpen} onClick={() => setFormOpen(v => !v)} label="Nueva credencial" />
                </>
            } />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="orb" style={{ width: 200, height: 200, right: -80, top: -100, background: '#22D3EE', opacity: .35 }} />
                <div className="grid-lines" />
                <span className="tile" style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.1)', color: '#fff' }}><KeyRound size={24} aria-hidden="true" /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="num" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{passwords.length}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>{passwords.length === 1 ? 'credencial' : 'credenciales'} · cifrado AES-256</span>
                </div>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}><span className="live" />Abierta</span>
            </section>

            {formOpen && (
                <form onSubmit={async (e) => { await handleAddPassword(e); setFormOpen(false); }} className="card rise" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Nueva credencial</h2>
                    <label className="field"><span className="field-label">Servicio</span>
                        <input className="input" placeholder="Ej: Gmail" value={servicio} onChange={e => setServicio(e.target.value)} required /></label>
                    <label className="field"><span className="field-label">Usuario / email</span>
                        <input className="input" placeholder="correo@email.com" autoCapitalize="none" autoCorrect="off" value={usuario} onChange={e => setUsuario(e.target.value)} required /></label>
                    <div className="field">
                        <span className="field-label">Contraseña</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="input" type="text" placeholder="••••••" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Contraseña"
                                value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, monospace' }} />
                            <button type="button" className="icon-btn" onClick={() => setPasswordInput(generateStrongPassword())} aria-label="Generar contraseña segura" style={{ width: 52, height: 52 }}><RefreshCw size={18} aria-hidden="true" /></button>
                        </div>
                    </div>
                    <div className="field">
                        <span className="field-label">Categoría</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {CATEGORIAS_PASSWORDS.map(c => <button key={c} type="button" className={`chip ${categoria === c ? 'on' : ''}`} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}
                        </div>
                    </div>
                    <label className="field"><span className="field-label">URL (opcional)</span>
                        <input className="input" type="url" inputMode="url" autoCapitalize="none" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} /></label>
                    <button type="submit" className="btn btn-primary">Guardar credencial</button>
                </form>
            )}

            <label className="rise d3" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <Search size={18} strokeWidth={2} color="var(--text-3)" aria-hidden="true" />
                <input type="search" placeholder="Buscar servicio, usuario o categoría…" aria-label="Buscar credencial" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
            </label>

            {filteredPasswords.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 24, fontSize: 14 }}>{passwords.length === 0 ? 'Tu bóveda está vacía. Toca + para agregar una credencial.' : 'Sin resultados.'}</p>
            ) : (
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {filteredPasswords.map((item, i) => {
                        const [soft, color, Icon] = CAT_TONO[item.categoria] || CAT_TONO['Otro'];
                        const isEditing = editingId === item.id;
                        const visible = showPasswords[item.id] && decryptedCache[item.id];
                        return (
                            <article key={item.id} className="card rise" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${0.2 + i * 0.04}s` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span className="tile" style={{ background: soft, color }}><Icon size={19} strokeWidth={1.9} aria-hidden="true" /></span>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {isEditing ? (
                                            <input className="input" value={editForm.servicio ?? item.servicio} aria-label="Servicio" onChange={e => setEditForm(prev => ({ ...prev, servicio: e.target.value }))} style={{ height: 40 }} />
                                        ) : (
                                            <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.servicio}</span>
                                        )}
                                        <span style={{ fontSize: 12, fontWeight: 700, color }}>{item.categoria}</span>
                                    </div>
                                    {item.url && !isEditing && (
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label={`Abrir ${item.servicio}`} style={iconBtn}><Globe size={17} aria-hidden="true" /></a>
                                    )}
                                </div>

                                <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span className="eyebrow" style={{ fontSize: 10 }}>Usuario</span>
                                        {isEditing ? (
                                            <input className="input" value={editForm.usuario ?? item.usuario} aria-label="Usuario" autoCapitalize="none" onChange={e => setEditForm(prev => ({ ...prev, usuario: e.target.value }))} style={{ height: 40, background: 'var(--surface)' }} />
                                        ) : (
                                            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.usuario}</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span className="eyebrow" style={{ fontSize: 10 }}>Contraseña</span>
                                        {isEditing ? (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <input className="input" type="text" placeholder="Vacío = mantener" aria-label="Nueva contraseña" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                                    value={editForm.newPassword || ''} onChange={e => setEditForm(prev => ({ ...prev, newPassword: e.target.value }))} style={{ height: 40, flex: 1, minWidth: 0, background: 'var(--surface)', fontFamily: 'ui-monospace, monospace' }} />
                                                <button type="button" className="icon-btn" onClick={() => setEditForm(prev => ({ ...prev, newPassword: generateStrongPassword() }))} aria-label="Generar contraseña" style={{ width: 40, height: 40 }}><RefreshCw size={15} aria-hidden="true" /></button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visible ? decryptedCache[item.id] : '••••••••••••'}</span>
                                                <button type="button" className="icon-btn" onClick={() => handleShowPassword(item)} aria-label={showPasswords[item.id] ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={iconBtn}>
                                                    {showPasswords[item.id] ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                                </button>
                                                <button type="button" className="icon-btn" onClick={() => handleCopy(item)} aria-label="Copiar contraseña"
                                                    style={{ ...iconBtn, ...(copiedId === item.id ? { background: 'var(--income-soft)', color: 'var(--income)' } : {}) }}>
                                                    {copiedId === item.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span className="eyebrow" style={{ fontSize: 10 }}>URL</span>
                                            <input className="input" value={editForm.url ?? item.url ?? ''} aria-label="URL" autoCapitalize="none" onChange={e => setEditForm(prev => ({ ...prev, url: e.target.value }))} style={{ height: 40, background: 'var(--surface)' }} />
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <span className="num" style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 0 }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CO') : ''}</span>
                                    {isEditing ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditForm({}); }}>Cancelar</button>
                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUpdatePassword(item)}>Guardar</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 2 }}>
                                            <button type="button" className="icon-btn" aria-label={`Editar ${item.servicio}`} style={iconBtn}
                                                onClick={() => { setEditingId(item.id); setEditForm({ servicio: item.servicio, usuario: item.usuario, url: item.url || '' }); }}>
                                                <Edit2 size={16} aria-hidden="true" />
                                            </button>
                                            <button type="button" className="icon-btn" aria-label={`Eliminar ${item.servicio}`} style={iconBtn}
                                                onClick={() => { if (!window.confirm(`¿Eliminar la credencial de ${item.servicio}?`)) return; genericDelete('passwords', item.id); setDecryptedCache(prev => { const n = { ...prev }; delete n[item.id]; return n; }); }}>
                                                <Trash2 size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
