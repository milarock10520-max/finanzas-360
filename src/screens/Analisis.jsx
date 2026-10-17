import { useState, useMemo } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ScreenHeader, CountUp, Ring, fmtCOP } from '../ui/f360.jsx';
import { COLORES_ANALISIS, DIAS_SEMANA_CORTOS, MESES_CORTOS, desplazarMes, esGastoConsumo, etiquetaMesLarga, formatCurrency, sumaMonto } from '../lib/finanzas';

export const FinancialAnalysis = ({ transacciones, limites = [], onAjustarTopes }) => {
    const hoyMes = new Date().toISOString().slice(0, 7);
    const [mes, setMes] = useState(hoyMes); // YYYY-MM
    const [categoriaAbierta, setCategoriaAbierta] = useState(null);

    const datos = useMemo(() => {
        const delMes = (ym) => transacciones.filter(t => t.fecha && t.fecha.startsWith(ym));
        const resumen = (ym) => {
            const lista = delMes(ym);
            return {
                ingresos: sumaMonto(lista.filter(t => t.tipo === 'ingreso')),
                gastos: sumaMonto(lista.filter(esGastoConsumo)),
            };
        };

        const txMes = delMes(mes);
        const gastosLista = txMes.filter(esGastoConsumo);
        const ingresosLista = txMes.filter(t => t.tipo === 'ingreso');
        const ingresos = sumaMonto(ingresosLista);
        const gastos = sumaMonto(gastosLista);
        const invertido = sumaMonto(txMes.filter(t => t.tipo === 'gasto' && (t.esInversion || t.categoria === 'Aporte Inversión')));
        const ahorrado = sumaMonto(txMes.filter(t => t.tipo === 'gasto' && t.esAhorro));
        const balance = ingresos - gastos;
        const tasaAhorro = ingresos > 0 ? (balance / ingresos) * 100 : null;

        const prevMes = desplazarMes(mes, -1);
        const prev = resumen(prevMes);
        const gastosPrevLista = delMes(prevMes).filter(esGastoConsumo);

        // Por categoría (mes actual y anterior)
        const agrupar = (lista) => lista.reduce((acc, t) => {
            const c = t.categoria || 'Sin categoría';
            if (!acc[c]) acc[c] = { total: 0, n: 0, items: [] };
            acc[c].total += Number(t.monto) || 0;
            acc[c].n += 1;
            acc[c].items.push(t);
            return acc;
        }, {});
        const porCat = agrupar(gastosLista);
        const porCatPrev = agrupar(gastosPrevLista);
        const categorias = Object.entries(porCat)
            .map(([nombre, v]) => ({
                nombre,
                total: v.total,
                n: v.n,
                items: [...v.items].sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0)),
                anterior: porCatPrev[nombre]?.total || 0,
                pct: gastos > 0 ? (v.total / gastos) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total)
            .map((c, i) => ({ ...c, color: COLORES_ANALISIS[i % COLORES_ANALISIS.length] }));

        // Por día del mes
        const [y, m] = mes.split('-').map(Number);
        const diasMes = new Date(y, m, 0).getDate();
        const porDia = Array.from({ length: diasMes }, () => 0);
        gastosLista.forEach(t => {
            const d = parseInt(t.fecha.slice(8, 10), 10);
            if (d >= 1 && d <= diasMes) porDia[d - 1] += Number(t.monto) || 0;
        });
        const maxDia = Math.max(...porDia, 0);
        const diaMasCaro = maxDia > 0 ? porDia.indexOf(maxDia) + 1 : null;
        const diasConGasto = porDia.filter(v => v > 0).length;

        // Por día de la semana (total y promedio por ocurrencia de ese día en el mes)
        const totalSemana = Array(7).fill(0);
        const vecesSemana = Array(7).fill(0);
        for (let d = 1; d <= diasMes; d++) vecesSemana[new Date(y, m - 1, d).getDay()] += 1;
        gastosLista.forEach(t => {
            const d = parseInt(t.fecha.slice(8, 10), 10);
            if (d >= 1 && d <= diasMes) totalSemana[new Date(y, m - 1, d).getDay()] += Number(t.monto) || 0;
        });
        const promedioSemana = totalSemana.map((tot, i) => (vecesSemana[i] ? tot / vecesSemana[i] : 0));
        const maxSemana = Math.max(...promedioSemana, 0);

        // Ritmo / proyección (solo el mes en curso)
        const esMesActual = mes === hoyMes;
        const diaHoy = new Date().getDate();
        const diasTranscurridos = esMesActual ? diaHoy : diasMes;
        const promedioDiario = diasTranscurridos > 0 ? gastos / diasTranscurridos : 0;
        const proyeccion = esMesActual ? promedioDiario * diasMes : null;

        // Mayores gastos individuales y conceptos que más se repiten
        const mayores = [...gastosLista].sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0)).slice(0, 8);
        const porConcepto = gastosLista.reduce((acc, t) => {
            const clave = (t.concepto || 'Sin concepto').trim().toLowerCase();
            if (!acc[clave]) acc[clave] = { nombre: (t.concepto || 'Sin concepto').trim(), total: 0, n: 0 };
            acc[clave].total += Number(t.monto) || 0;
            acc[clave].n += 1;
            return acc;
        }, {});
        const conceptosTop = Object.values(porConcepto).sort((a, b) => b.total - a.total).slice(0, 8);

        // Gastos hormiga
        const hormigaLista = gastosLista.filter(t => t.categoria === 'Gastos Hormiga');
        const hormiga = sumaMonto(hormigaLista);

        // Tendencia de los últimos 6 meses
        const tendencia = Array.from({ length: 6 }, (_, i) => {
            const ym = desplazarMes(mes, i - 5);
            return { ym, ...resumen(ym) };
        });
        const maxTendencia = Math.max(...tendencia.map(t => Math.max(t.ingresos, t.gastos)), 0);
        const mesesConGasto = tendencia.filter(t => t.gastos > 0);
        const promedio6m = mesesConGasto.length > 0 ? mesesConGasto.reduce((a, t) => a + t.gastos, 0) / mesesConGasto.length : 0;

        // Límites por categoría
        const limitesEstado = limites
            .map(l => {
                const gastado = porCat[l.categoria]?.total || 0;
                const tope = Number(l.limite) || 0;
                return { categoria: l.categoria, gastado, tope, pct: tope > 0 ? (gastado / tope) * 100 : 0 };
            })
            .sort((a, b) => b.pct - a.pct);

        // Lectura rápida (hallazgos automáticos)
        const hallazgos = [];
        if (gastosLista.length > 0) {
            if (ingresos > 0) {
                const p = (gastos / ingresos) * 100;
                hallazgos.push({ tipo: p > 90 ? 'warn' : p > 70 ? 'info' : 'ok', texto: `Gastaste ${formatCurrency(gastos)}, el ${p.toFixed(0)}% de tus ingresos del mes.` });
            } else {
                hallazgos.push({ tipo: 'info', texto: `Gastaste ${formatCurrency(gastos)} y no registraste ingresos en este mes.` });
            }
            if (balance < 0) hallazgos.push({ tipo: 'warn', texto: `Gastaste ${formatCurrency(-balance)} más de lo que ingresó este mes.` });
            const top = categorias[0];
            hallazgos.push({ tipo: top.pct >= 50 ? 'warn' : 'info', texto: `Tu mayor gasto es "${top.nombre}": ${formatCurrency(top.total)} (${top.pct.toFixed(0)}% del total).` });
            if (categorias.length >= 3) {
                const top3 = categorias.slice(0, 3).reduce((a, c) => a + c.pct, 0);
                hallazgos.push({ tipo: 'info', texto: `Solo 3 categorías concentran el ${top3.toFixed(0)}% de tus gastos.` });
            }
            if (prev.gastos > 0) {
                const dif = gastos - prev.gastos;
                const p = (dif / prev.gastos) * 100;
                hallazgos.push({
                    tipo: dif > 0 ? 'warn' : 'ok',
                    texto: dif > 0
                        ? `Gastaste ${formatCurrency(dif)} más (+${p.toFixed(0)}%) que en ${etiquetaMesLarga(prevMes)}.`
                        : `Gastaste ${formatCurrency(-dif)} menos (${p.toFixed(0)}%) que en ${etiquetaMesLarga(prevMes)}.`,
                });
                const sube = categorias.filter(c => c.anterior > 0 || c.total > 0).map(c => ({ ...c, dif: c.total - c.anterior })).sort((a, b) => b.dif - a.dif)[0];
                if (sube && sube.dif > 0 && prev.gastos > 0) {
                    hallazgos.push({ tipo: 'warn', texto: `La categoría que más subió fue "${sube.nombre}": +${formatCurrency(sube.dif)} frente al mes anterior.` });
                }
            }
            if (hormiga > 0) {
                hallazgos.push({ tipo: 'info', texto: `Los gastos hormiga sumaron ${formatCurrency(hormiga)} en ${hormigaLista.length} compra${hormigaLista.length === 1 ? '' : 's'} (${((hormiga / gastos) * 100).toFixed(0)}% del gasto).` });
            }
            if (diaMasCaro) hallazgos.push({ tipo: 'info', texto: `El día de mayor gasto fue el ${diaMasCaro}: ${formatCurrency(maxDia)}.` });
            if (proyeccion !== null && diaHoy < diasMes) {
                hallazgos.push({ tipo: ingresos > 0 && proyeccion > ingresos ? 'warn' : 'info', texto: `Al ritmo actual (${formatCurrency(promedioDiario)} al día) cerrarías el mes con unos ${formatCurrency(proyeccion)} en gastos.` });
            }
            const excedidos = limitesEstado.filter(l => l.tope > 0 && l.gastado > l.tope);
            if (excedidos.length > 0) {
                hallazgos.push({ tipo: 'warn', texto: `Superaste el límite en: ${excedidos.map(l => l.categoria).join(', ')}.` });
            }
        }

        return {
            ingresos, gastos, balance, tasaAhorro, invertido, ahorrado, prev, categorias, porDia, maxDia, diasMes, diaMasCaro,
            diasConGasto, promedioSemana, maxSemana, esMesActual, promedioDiario, proyeccion, mayores, conceptosTop, hormiga,
            hormigaN: hormigaLista.length, tendencia, maxTendencia, promedio6m, limitesEstado, hallazgos, nGastos: gastosLista.length,
            nIngresos: ingresosLista.length,
        };
    }, [transacciones, limites, mes, hoyMes]);

    const {
        ingresos, gastos, balance, tasaAhorro, invertido, ahorrado, prev, categorias, porDia, maxDia, diasMes, diasConGasto,
        promedioSemana, maxSemana, esMesActual, promedioDiario, proyeccion, mayores, conceptosTop, hormiga, hormigaN, tendencia,
        maxTendencia, promedio6m, limitesEstado, hallazgos, nGastos,
    } = datos;

    const TONO_HALLAZGO = { warn: 'var(--warn)', ok: 'var(--income)', info: 'var(--primary)' };
    const card = { padding: 18, display: 'flex', flexDirection: 'column', gap: 14 };
    const h2 = { margin: 0, fontSize: 15, fontWeight: 800 };
    const sub = { margin: '-8px 0 0', fontSize: 13, color: 'var(--text-3)' };
    const mesLabel = etiquetaMesLarga(mes);
    const mesCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
    const prevYm = desplazarMes(mes, -1);
    const nombreMesCorto = (ym) => { const n = MESES_CORTOS[Number(ym.slice(5)) - 1] || ''; return n.charAt(0).toUpperCase() + n.slice(1); };

    // Delta vs mes anterior: color + signo + flecha (no solo color).
    const Delta = ({ actual, anterior, subirEsMalo = false }) => {
        if (!anterior) return <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Sin datos del mes anterior</span>;
        const p = ((actual - anterior) / anterior) * 100;
        const sube = p >= 0;
        const malo = subirEsMalo ? sube : !sube;
        const color = malo ? 'var(--expense)' : 'var(--income)';
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, color }}>
                {sube ? <ArrowUp size={13} strokeWidth={2.4} aria-hidden="true" /> : <ArrowDown size={13} strokeWidth={2.4} aria-hidden="true" />}
                <span className="num" style={{ letterSpacing: 0 }}>{sube ? '+' : '−'}{Math.abs(p).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</span> vs {nombreMesCorto(prevYm).toLowerCase()}
            </span>
        );
    };

    // Barras mes anterior vs actual
    const maxComp = Math.max(prev.ingresos, prev.gastos, ingresos, gastos, 1);
    const alto = (v) => `${Math.max(v > 0 ? 4 : 0, (v / maxComp) * 140)}px`;

    // Donut: cada segmento en base 100 sobre una circunferencia de radio 15.9155
    let acumulado = 0;
    const segmentos = categorias.map(c => {
        const seg = { ...c, offset: 25 - acumulado };
        acumulado += c.pct;
        return seg;
    });

    return (
        <div>
            <ScreenHeader title="Análisis" />

            <div className="rise d2" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 4, borderRadius: 16, background: 'var(--surface-2)' }}>
                <button type="button" className="icon-btn" onClick={() => setMes(desplazarMes(mes, -1))} aria-label="Mes anterior" style={{ border: 0, background: 'transparent' }}>
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <label style={{ position: 'relative', fontSize: 15, fontWeight: 800, padding: '10px 16px', cursor: 'pointer' }}>
                    {mesCap}
                    <input type="month" value={mes} max={hoyMes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Elegir mes"
                        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </label>
                <button type="button" className="icon-btn" onClick={() => setMes(desplazarMes(mes, 1))} disabled={mes >= hoyMes} aria-label="Mes siguiente"
                    style={{ border: 0, background: 'transparent', opacity: mes >= hoyMes ? .4 : 1, cursor: mes >= hoyMes ? 'default' : 'pointer' }}>
                    <ChevronRight size={20} aria-hidden="true" />
                </button>
            </div>

            {/* Hero: balance + tasa de ahorro */}
            <section className="hero rise d3" style={{ marginTop: 14, padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
                <div className="orb" style={{ width: 200, height: 200, right: -70, top: -90, background: '#3355FF', opacity: .7 }} />
                <div className="grid-lines" />
                <div className="sheen" />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.72)' }}>Balance neto</span>
                    <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: balance < 0 ? '#FDA4AF' : '#fff' }}>
                        {balance < 0 ? '− ' : ''}<CountUp value={Math.abs(balance)} />
                    </span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.72)' }}>{balance >= 0 ? 'te sobró este mes' : 'gastaste más de lo que ingresó'}</span>
                </div>
                <Ring pct={tasaAhorro === null ? 0 : Math.max(0, tasaAhorro) / 100} size={108} stroke={8} color="url(#rgAhorro)" track="rgba(255,255,255,.1)">
                    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
                        <defs><linearGradient id="rgAhorro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#6B84FF" /></linearGradient></defs>
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{tasaAhorro === null ? '—' : `${tasaAhorro.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>ahorro</span>
                    </div>
                </Ring>
            </section>

            {/* KPIs */}
            <div className="rise d4" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Ingresos</span>
                    <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--income)' }}>{fmtCOP(ingresos)}</span>
                    <Delta actual={ingresos} anterior={prev.ingresos} />
                </div>
                <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Gastos</span>
                    <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--expense)' }}>{fmtCOP(gastos)}</span>
                    <Delta actual={gastos} anterior={prev.gastos} subirEsMalo />
                </div>
            </div>

            {/* Mes anterior vs actual */}
            <section className="card rise d5" style={{ ...card, marginTop: 14, gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={h2}>{nombreMesCorto(prevYm)} vs {nombreMesCorto(mes).toLowerCase()}</h2>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--income)' }} />Ingresos</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--expense)' }} />Gastos</span>
                    </div>
                </div>
                <div role="img" aria-label={`Ingresos: ${fmtCOP(prev.ingresos)} a ${fmtCOP(ingresos)}. Gastos: ${fmtCOP(prev.gastos)} a ${fmtCOP(gastos)}.`}
                    style={{ height: 160, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, alignItems: 'end', borderBottom: '1px solid var(--line)', padding: '0 16px' }}>
                    {[{ d: prev, op: .45, dl: .5 }, { d: { ingresos, gastos }, op: 1, dl: .7 }].map((g, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, height: '100%' }}>
                            <span className="grow" style={{ width: 34, height: alto(g.d.ingresos), borderRadius: '10px 10px 4px 4px', background: 'var(--income)', opacity: g.op, animationDelay: `${g.dl}s` }} />
                            <span className="grow" style={{ width: 34, height: alto(g.d.gastos), borderRadius: '10px 10px 4px 4px', background: 'var(--expense)', opacity: g.op, animationDelay: `${g.dl + .1}s` }} />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-3)', marginTop: -6 }}>
                    <span>{nombreMesCorto(prevYm)}</span><span style={{ color: 'var(--text)' }}>{nombreMesCorto(mes)}</span>
                </div>
            </section>

            {/* Topes del mes */}
            {limitesEstado.length > 0 && (
                <section className="card rise d6" style={{ ...card, marginTop: 14, gap: 12 }}>
                    <h2 style={h2}>Topes del mes</h2>
                    {limitesEstado.map(l => {
                        const color = l.pct >= 100 ? 'var(--expense)' : l.pct >= 80 ? 'var(--warn)' : 'var(--income)';
                        return (
                            <div key={l.categoria} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 700 }}>
                                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.categoria}</span>
                                    <span className="num" style={{ color: l.pct >= 100 ? 'var(--expense)' : 'var(--text-2)', letterSpacing: 0, whiteSpace: 'nowrap' }}>{fmtCOP(l.gastado)} / {fmtCOP(l.tope)}</span>
                                </div>
                                <div className="bar"><i style={{ width: `${Math.min(l.pct, 100)}%`, background: l.pct >= 100 ? 'linear-gradient(90deg, var(--warn), var(--expense))' : color }} /></div>
                            </div>
                        );
                    })}
                    {onAjustarTopes && <button type="button" onClick={onAjustarTopes} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 800, color: 'var(--primary)', background: 'none', border: 0, padding: '6px 0', cursor: 'pointer' }}>Ajustar topes</button>}
                </section>
            )}

            {nGastos === 0 ? (
                <div className="card rise d6" style={{ marginTop: 14, padding: 32, textAlign: 'center', fontSize: 14, color: 'var(--text-3)' }}>
                    No hay gastos registrados en {mesLabel}.
                </div>
            ) : (
                <>
                    {/* Lectura rápida */}
                    <section className="card rise d6" style={{ ...card, marginTop: 14 }}>
                        <h2 style={{ ...h2, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} color="var(--violet)" aria-hidden="true" /> Lectura rápida</h2>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {hallazgos.map((h, i) => (
                                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--text)' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONO_HALLAZGO[h.tipo], flexShrink: 0, marginTop: 6 }} />
                                    <span>{h.texto}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Datos clave */}
                    <div className="rise d7" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        {[
                            { t: 'Promedio diario', v: fmtCOP(promedioDiario), s: `${diasConGasto} día${diasConGasto === 1 ? '' : 's'} con gastos` },
                            esMesActual
                                ? { t: 'Proyección', v: fmtCOP(proyeccion), s: 'si sigues a este ritmo' }
                                : { t: 'Nº de gastos', v: String(nGastos), s: `ticket medio ${fmtCOP(gastos / nGastos)}` },
                            { t: 'Gastos hormiga', v: fmtCOP(hormiga), s: `${hormigaN} compra${hormigaN === 1 ? '' : 's'}` },
                            { t: 'Invertido / ahorrado', v: fmtCOP(invertido + ahorrado), s: 'no cuenta como gasto' },
                        ].map(k => (
                            <div key={k.t} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                <span className="eyebrow">{k.t}</span>
                                <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{k.v}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{k.s}</span>
                            </div>
                        ))}
                    </div>

                    {/* ¿En qué se fue tu dinero? */}
                    <section className="card rise d8" style={{ ...card, marginTop: 14 }}>
                        <h2 style={h2}>¿En qué se fue tu dinero?</h2>
                        <div style={{ position: 'relative', width: 200, height: 200, margin: '4px auto' }}>
                            <svg viewBox="0 0 36 36" width="200" height="200" role="img" aria-label="Distribución del gasto por categoría">
                                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="5" />
                                {segmentos.map(s => (
                                    <circle key={s.nombre} cx="18" cy="18" r="15.9155" fill="none" stroke={s.color} strokeWidth="5"
                                        strokeDasharray={`${s.pct} ${100 - s.pct}`} strokeDashoffset={s.offset}>
                                        <title>{`${s.nombre}: ${formatCurrency(s.total)} (${s.pct.toFixed(1)}%)`}</title>
                                    </circle>
                                ))}
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Total gastado</span>
                                <span className="num" style={{ fontSize: 17, fontWeight: 700 }}>{fmtCOP(gastos)}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {categorias.map((c, idx) => {
                                const abierta = categoriaAbierta === c.nombre;
                                const dif = c.total - c.anterior;
                                return (
                                    <div key={c.nombre} style={{ borderTop: idx ? '1px solid var(--line)' : 0 }}>
                                        <button type="button" onClick={() => setCategoriaAbierta(abierta ? null : c.nombre)} aria-expanded={abierta}
                                            style={{ width: '100%', textAlign: 'left', padding: '12px 0', background: 'none', border: 0, cursor: 'pointer', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 14 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontWeight: 700 }}>
                                                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    <span className="num" style={{ fontWeight: 700 }}>{fmtCOP(c.total)}</span>
                                                    <span className="num" style={{ color: 'var(--text-3)', width: 44, textAlign: 'right', letterSpacing: 0, fontSize: 13 }}>{c.pct.toFixed(0)}%</span>
                                                    <ChevronDown size={16} color="var(--text-3)" aria-hidden="true" style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .3s var(--ease)' }} />
                                                </span>
                                            </span>
                                            <span className="bar" style={{ display: 'block', height: 6 }}><i style={{ width: `${c.pct}%`, background: c.color }} /></span>
                                            {prev.gastos > 0 && (
                                                <span style={{ fontSize: 12, fontWeight: 700, color: c.anterior === 0 || dif === 0 ? 'var(--text-3)' : dif > 0 ? 'var(--expense)' : 'var(--income)' }}>
                                                    {c.anterior === 0 ? 'Sin gasto el mes anterior' : dif === 0 ? 'Igual que el mes anterior' : `${dif > 0 ? '↑ +' : '↓ −'}${fmtCOP(Math.abs(dif))} vs mes anterior`}
                                                </span>
                                            )}
                                        </button>
                                        {abierta && (
                                            <div className="rise" style={{ margin: '0 0 12px', paddingLeft: 14, borderLeft: `2px solid ${c.color}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {c.items.map(t => (
                                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                                                        <span style={{ color: 'var(--text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.concepto || 'Sin concepto'} <span style={{ color: 'var(--text-3)' }}>· {t.fecha}</span></span>
                                                        <span className="num" style={{ fontWeight: 700, flexShrink: 0 }}>{fmtCOP(t.monto)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Gasto día a día */}
                    <section className="card rise" style={{ ...card, marginTop: 14 }}>
                        <h2 style={h2}>Gasto día a día</h2>
                        <p style={sub}>Cuánto gastaste cada día de {mesLabel}.</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
                            {porDia.map((v, i) => (
                                <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }} title={`Día ${i + 1}: ${formatCurrency(v)}`}>
                                    <div className="grow" style={{ width: '100%', borderRadius: '4px 4px 2px 2px', background: v > 0 && v === maxDia ? 'var(--expense)' : 'var(--primary)', opacity: v === maxDia ? 1 : .55, height: `${maxDia > 0 ? (v / maxDia) * 100 : 0}%`, minHeight: v > 0 ? 3 : 0, animationDelay: `${i * 0.015}s` }} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 2, marginTop: -6 }}>
                            {porDia.map((_, i) => (
                                <span key={i} className="num" style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-3)', letterSpacing: 0 }}>{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>
                            ))}
                        </div>
                    </section>

                    {/* Día de la semana */}
                    <section className="card rise" style={{ ...card, marginTop: 14 }}>
                        <h2 style={h2}>¿Qué días gastas más?</h2>
                        <p style={sub}>Promedio gastado por cada día de la semana.</p>
                        {promedioSemana.map((v, i) => ({ v, i })).sort((a, b) => ((a.i + 6) % 7) - ((b.i + 6) % 7)).map(({ v, i }) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                <span style={{ width: 32, fontWeight: 700, color: 'var(--text-2)' }}>{DIAS_SEMANA_CORTOS[i]}</span>
                                <div className="bar" style={{ flex: 1 }}><i style={{ width: `${maxSemana > 0 ? (v / maxSemana) * 100 : 0}%`, background: v > 0 && v === maxSemana ? 'var(--expense)' : 'var(--primary)' }} /></div>
                                <span className="num" style={{ width: 96, textAlign: 'right', color: 'var(--text-2)', letterSpacing: 0 }}>{fmtCOP(v)}</span>
                            </div>
                        ))}
                    </section>

                    {/* Tendencia 6 meses */}
                    <section className="card rise" style={{ ...card, marginTop: 14 }}>
                        <h2 style={h2}>Últimos 6 meses</h2>
                        <p style={sub}>Ingresos vs gastos{promedio6m > 0 ? ` · gasto promedio ${fmtCOP(promedio6m)}` : ''}.</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
                            {tendencia.map((t, i) => (
                                <div key={t.ym} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, flex: 1 }}>
                                        <div className="grow" title={`Ingresos: ${formatCurrency(t.ingresos)}`} style={{ width: '45%', borderRadius: '6px 6px 2px 2px', background: 'var(--income)', height: `${maxTendencia > 0 ? (t.ingresos / maxTendencia) * 100 : 0}%`, minHeight: t.ingresos > 0 ? 3 : 0, animationDelay: `${i * 0.06}s` }} />
                                        <div className="grow" title={`Gastos: ${formatCurrency(t.gastos)}`} style={{ width: '45%', borderRadius: '6px 6px 2px 2px', background: 'var(--expense)', height: `${maxTendencia > 0 ? (t.gastos / maxTendencia) * 100 : 0}%`, minHeight: t.gastos > 0 ? 3 : 0, animationDelay: `${i * 0.06 + .03}s` }} />
                                    </div>
                                    <span style={{ textAlign: 'center', fontSize: 12, marginTop: 6, fontWeight: 800, color: t.ym === mes ? 'var(--text)' : 'var(--text-3)' }}>{nombreMesCorto(t.ym)}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Mayores gastos */}
                    <section className="card rise" style={{ ...card, marginTop: 14, gap: 4 }}>
                        <h2 style={{ ...h2, marginBottom: 6 }}>Tus mayores gastos</h2>
                        {mayores.map((t, i) => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                                <span className="num" style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.concepto || 'Sin concepto'}</p>
                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>{t.categoria} · {t.fecha}</p>
                                </div>
                                <span className="num" style={{ fontWeight: 700, color: 'var(--expense)', fontSize: 14, flexShrink: 0 }}>− {fmtCOP(t.monto)}</span>
                            </div>
                        ))}
                    </section>

                    {/* Conceptos que más se repiten */}
                    <section className="card rise" style={{ ...card, marginTop: 14, gap: 4 }}>
                        <h2 style={{ ...h2, marginBottom: 6 }}>En qué conceptos gastas más</h2>
                        {conceptosTop.map((c, i) => (
                            <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</p>
                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>{c.n} vez{c.n === 1 ? '' : 'es'} · {((c.total / gastos) * 100).toFixed(1)}% del gasto</p>
                                </div>
                                <span className="num" style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{fmtCOP(c.total)}</span>
                            </div>
                        ))}
                    </section>
                </>
            )}
        </div>
    );
};
