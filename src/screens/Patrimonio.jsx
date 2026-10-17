import { useMemo } from 'react';
import { ArrowUp, ArrowDown, Wallet, PiggyBank, PieChart, CreditCard } from 'lucide-react';
import { ScreenHeader, CountUp, fmtCOP } from '../ui/f360.jsx';
import { useTasaUSD } from '../lib/moneda';
import { seriePatrimonio } from '../lib/patrimonio';

const nombreMes = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const t = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short' });
    return t.charAt(0).toUpperCase() + t.slice(1).replace('.', '');
};

// =============================================
// === PATRIMONIO NETO EN EL TIEMPO ===
// =============================================
export const PatrimonioView = ({ transacciones, deudas, fotos, onBack }) => {
    const tasaUSD = useTasaUSD();
    const serie = useMemo(
        () => seriePatrimonio({ transacciones, deudas, fotos, tasaUSD: tasaUSD?.tasa || null }),
        [transacciones, deudas, fotos, tasaUSD]
    );
    const actual = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    const inicio = serie[0];
    if (!actual) return <ScreenHeader title="Patrimonio" onBack={onBack} />;

    const cambioMes = anterior ? actual.neto - anterior.neto : null;
    const cambioAnio = inicio && inicio !== actual ? actual.neto - inicio.neto : null;
    const max = Math.max(...serie.map(p => p.neto), 1);
    const min = Math.min(...serie.map(p => p.neto), 0);
    const rango = max - min || 1;
    const hayEstimados = serie.some(p => !p.exacto);

    const partes = [
        { label: 'Disponible', valor: actual.disponible, Icon: Wallet, color: 'var(--primary)', soft: 'var(--primary-soft)' },
        { label: 'Ahorros en metas', valor: actual.ahorros, Icon: PiggyBank, color: 'var(--income)', soft: 'var(--income-soft)' },
        { label: 'Inversiones', valor: actual.inversiones, Icon: PieChart, color: 'var(--violet)', soft: 'var(--violet-soft)' },
        { label: 'Deudas', valor: -actual.deudas, Icon: CreditCard, color: 'var(--expense)', soft: 'var(--expense-soft)' },
    ];

    const Cambio = ({ valor, etiqueta }) => valor === null ? null : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: valor >= 0 ? '#6EE7B7' : '#FDA4AF' }}>
            {valor >= 0 ? <ArrowUp size={14} strokeWidth={2.4} aria-hidden="true" /> : <ArrowDown size={14} strokeWidth={2.4} aria-hidden="true" />}
            <span className="num" style={{ letterSpacing: 0 }}>{valor >= 0 ? '+' : '−'}{fmtCOP(Math.abs(valor))}</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{etiqueta}</span>
        </span>
    );

    return (
        <div>
            <ScreenHeader title="Patrimonio" onBack={onBack} />

            <section className="hero rise d2" style={{ marginTop: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="orb" style={{ width: 230, height: 230, right: -90, top: -100, background: '#3355FF', opacity: .7 }} />
                <div className="orb" style={{ width: 160, height: 160, left: -60, bottom: -80, background: '#10B981', opacity: .45, animationDuration: '17s' }} />
                <div className="grid-lines" />
                <div className="sheen" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Patrimonio neto</span>
                <span className="num" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: actual.neto < 0 ? '#FDA4AF' : '#fff' }}>
                    {actual.neto < 0 ? '− ' : ''}<CountUp value={Math.abs(actual.neto)} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Cambio valor={cambioMes} etiqueta="vs el mes pasado" />
                    <Cambio valor={cambioAnio} etiqueta={`en ${serie.length - 1} meses`} />
                </div>
            </section>

            <section className="card rise d3" style={{ marginTop: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Evolución</h2>
                <div role="img" aria-label={`Patrimonio de ${nombreMes(serie[0].ym)} a ${nombreMes(actual.ym)}`} style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: 6, borderBottom: '1px solid var(--line)', position: 'relative' }}>
                    {min < 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: `${(-min / rango) * 100}%`, borderTop: '1px dashed var(--line)' }} />}
                    {serie.map((p, i) => {
                        const base = (-min / rango) * 100;
                        const alto = (Math.abs(p.neto) / rango) * 100;
                        return (
                            <div key={p.ym} style={{ flex: 1, height: '100%', position: 'relative' }} title={`${nombreMes(p.ym)}: ${fmtCOP(p.neto)}${p.exacto ? '' : ' (estimado)'}`}>
                                <span className="grow" style={{
                                    position: 'absolute', left: 0, right: 0,
                                    bottom: p.neto >= 0 ? `${base}%` : `${base - alto}%`, height: `${Math.max(alto, 1.5)}%`,
                                    borderRadius: 6, background: p.neto < 0 ? 'var(--expense)' : i === serie.length - 1 ? 'var(--primary)' : 'var(--primary)',
                                    opacity: i === serie.length - 1 ? 1 : p.exacto ? 0.55 : 0.3, animationDelay: `${i * 0.04}s`,
                                }} />
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: -6 }}>
                    {serie.map((p, i) => (
                        <span key={p.ym} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, color: i === serie.length - 1 ? 'var(--text)' : 'var(--text-3)' }}>
                            {serie.length > 8 && i % 2 && i !== serie.length - 1 ? '' : nombreMes(p.ym)}
                        </span>
                    ))}
                </div>
                {hayEstimados && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
                        Las barras más claras son estimadas con tus movimientos (inversiones al valor aportado). Desde ahora cada mes queda guardado con el valor exacto.
                    </span>
                )}
            </section>

            <section className="card rise d4" style={{ marginTop: 14, padding: '4px 16px' }}>
                {partes.map((p, i) => (
                    <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                        <span className="tile" style={{ width: 40, height: 40, background: p.soft, color: p.color }}><p.Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{p.label}</span>
                        <span className="num" style={{ fontSize: 15, fontWeight: 700, color: p.valor < 0 ? 'var(--expense)' : 'var(--text)' }}>{p.valor < 0 ? '− ' : ''}{fmtCOP(Math.abs(p.valor))}</span>
                    </div>
                ))}
            </section>

            <section className="card rise d5" style={{ marginTop: 14, padding: '4px 16px' }}>
                {[...serie].reverse().map((p, i, arr) => {
                    const prev = arr[i + 1];
                    const dif = prev ? p.neto - prev.neto : null;
                    return (
                        <div key={p.ym} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                            <span style={{ width: 48, fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>{nombreMes(p.ym)} {p.ym.slice(2, 4)}</span>
                            <span className="num" style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.neto < 0 ? '− ' : ''}{fmtCOP(Math.abs(p.neto))}{p.exacto ? '' : <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · est.</span>}</span>
                            {dif !== null && (
                                <span className="num" style={{ fontSize: 13, fontWeight: 700, color: dif >= 0 ? 'var(--income)' : 'var(--expense)', letterSpacing: 0 }}>{dif >= 0 ? '+' : '−'}{fmtCOP(Math.abs(dif))}</span>
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
};
