// Memoria financiera del coach (capa 1): patrones de los últimos 12 meses
// calculados con código (sin IA). La comparten la app (chat), el Worker
// (coach por voz y contexto de las rutinas programadas) y el perfil que
// escribe Claude con la suscripción.
//
// Todo es determinista: promedios por categoría, tendencias, gastos
// recurrentes, gastos inusuales, días de mayor gasto e ingresos.

const MESES = 12;

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ymDe = (d) => dateKey(d).slice(0, 7);
const desplazarYm = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    return ymDe(new Date(y, m - 1 + n, 1));
};
const diasDelMes = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
};
const monto = (t) => Number(t.monto) || 0;
const esConsumo = (t) => t.tipo === 'gasto' && !t.esInversion && !t.esAhorro;
const suma = (lista) => lista.reduce((a, t) => a + monto(t), 0);
const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const pct = (n) => `${(n * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
const signo = (n) => (n >= 0 ? '+' : '−');
const mediana = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const normalizar = (txt) => String(txt || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0-9]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Obligaciones que no se "recortan" en un consejo, y categorías de gastos opcionales.
const NO_RECORTABLES = ['Vivienda (Arriendo/Hipoteca)', 'Servicios Públicos', 'Deudas', 'Pago de Deudas', 'Aporte Inversión', 'Educación', 'Salud'];
const OPCIONALES = ['Entretenimiento', 'Gastos Hormiga', 'Otros', 'Ropa'];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Calcula la memoria a partir de las transacciones (fechas 'YYYY-MM-DD').
export function construirMemoria(transacciones = [], hoy = new Date()) {
    const mesActual = ymDe(hoy);
    const diaHoy = hoy.getDate();
    const meses = Array.from({ length: MESES }, (_, i) => desplazarYm(mesActual, i - (MESES - 1)));
    const primerMes = meses[0];
    const tx = transacciones.filter(t => typeof t.fecha === 'string' && t.fecha.slice(0, 7) >= primerMes && t.fecha.slice(0, 7) <= mesActual);

    // --- Resumen por mes ---
    const porMes = Object.fromEntries(meses.map(ym => [ym, []]));
    tx.forEach(t => porMes[t.fecha.slice(0, 7)]?.push(t));
    const resumenMeses = meses.map(ym => {
        const lista = porMes[ym];
        const ingresos = suma(lista.filter(t => t.tipo === 'ingreso'));
        const consumo = lista.filter(esConsumo);
        const gastos = suma(consumo);
        const ahorroInversion = suma(lista.filter(t => t.tipo === 'gasto' && (t.esAhorro || t.esInversion)));
        const porCat = {};
        consumo.forEach(t => { const c = t.categoria || 'Sin categoría'; porCat[c] = (porCat[c] || 0) + monto(t); });
        return { ym, ingresos, gastos, balance: ingresos - gastos, ahorroInversion, porCat, n: lista.length, enCurso: ym === mesActual };
    }).filter(m => m.n > 0);

    const cerrados = resumenMeses.filter(m => !m.enCurso);
    const actual = resumenMeses.find(m => m.enCurso) || null;
    const nCerrados = cerrados.length;
    const prom = (fn) => (nCerrados ? cerrados.reduce((a, m) => a + fn(m), 0) / nCerrados : 0);
    const promIngresos = prom(m => m.ingresos);
    const promGastos = prom(m => m.gastos);
    const tipicoGastos = mediana(cerrados.map(m => m.gastos));

    // --- Categorías: promedio mensual, peso y tendencia ---
    const categorias = {};
    cerrados.forEach(m => Object.entries(m.porCat).forEach(([c, v]) => { categorias[c] = (categorias[c] || 0) + v; }));
    const ult3 = cerrados.slice(-3);
    const prev3 = cerrados.slice(-6, -3);
    const promCat = (lista, c) => (lista.length ? lista.reduce((a, m) => a + (m.porCat[c] || 0), 0) / lista.length : 0);
    const totalCat = Object.values(categorias).reduce((a, v) => a + v, 0);
    const listaCategorias = Object.entries(categorias)
        .map(([nombre, total]) => {
            const recientes = promCat(ult3, nombre);
            const anteriores = promCat(prev3, nombre);
            return {
                nombre,
                promedio: total / nCerrados,
                // Gasto típico: mediana mensual (no la infla un gasto único como una nevera).
                tipico: mediana(cerrados.map(m => m.porCat[nombre] || 0)),
                peso: totalCat ? total / totalCat : 0,
                tendencia: anteriores > 0 ? (recientes - anteriores) / anteriores : null,
            };
        })
        .sort((a, b) => b.promedio - a.promedio);

    // --- Gastos recurrentes (mismo concepto en 3+ meses con monto estable) ---
    const ventanaRec = meses.slice(-6);
    const grupos = {};
    tx.filter(esConsumo).filter(t => ventanaRec.includes(t.fecha.slice(0, 7))).forEach(t => {
        const k = normalizar(t.concepto);
        if (!k || k.length < 3) return;
        const g = grupos[k] || (grupos[k] = { concepto: (t.concepto || '').trim(), categoria: t.categoria, porMes: {}, dias: [] });
        g.porMes[t.fecha.slice(0, 7)] = (g.porMes[t.fecha.slice(0, 7)] || 0) + monto(t);
        g.dias.push(Number(t.fecha.slice(8, 10)));
    });
    const recurrentes = Object.values(grupos)
        .map(g => {
            const vals = Object.values(g.porMes);
            const media = vals.reduce((a, v) => a + v, 0) / vals.length;
            const desv = Math.sqrt(vals.reduce((a, v) => a + (v - media) ** 2, 0) / vals.length);
            return { ...g, meses: vals.length, media, estable: media > 0 && desv / media < 0.35, dia: Math.round(mediana(g.dias)) };
        })
        .filter(g => g.meses >= 3 && g.estable)
        .sort((a, b) => b.media - a.media)
        .slice(0, 10);

    // --- Mes en curso vs promedio (proyectado al cierre) ---
    // Solo se proyecta la parte VARIABLE: los gastos recurrentes (arriendo,
    // suscripciones) ya pagados no se multiplican por el resto del mes.
    const clavesRecurrentes = new Set(recurrentes.map(r => normalizar(r.concepto)));
    const fijoCat = {}, variableCat = {};
    (porMes[mesActual] || []).filter(esConsumo).forEach(t => {
        const c = t.categoria || 'Sin categoría';
        const destino = clavesRecurrentes.has(normalizar(t.concepto)) ? fijoCat : variableCat;
        destino[c] = (destino[c] || 0) + monto(t);
    });
    const diasMes = diasDelMes(mesActual);
    const factor = diasMes / diaHoy;
    const alertasMes = [];
    if (actual && nCerrados && diaHoy >= 5) {
        listaCategorias.forEach(c => {
            const fijo = fijoCat[c.nombre] || 0;
            const variable = variableCat[c.nombre] || 0;
            const llevas = fijo + variable;
            const proyectado = fijo + variable * factor;
            if (c.tipico > 0 && variable > 0 && proyectado > c.tipico * 1.25 && proyectado - c.tipico > 30000) {
                alertasMes.push({ categoria: c.nombre, llevas, proyectado, promedio: c.tipico, exceso: (proyectado - c.tipico) / c.tipico });
            }
        });
        alertasMes.sort((a, b) => b.exceso - a.exceso);
    }

    // --- Últimos 90 días: días de la semana y gastos inusuales ---
    const desde = new Date(hoy); desde.setDate(desde.getDate() - 89);
    const desdeKey = dateKey(desde);
    const recientes90 = tx.filter(esConsumo).filter(t => t.fecha >= desdeKey);
    const totalDia = Array(7).fill(0);
    const vecesDia = Array(7).fill(0);
    for (let d = new Date(desde); d <= hoy; d.setDate(d.getDate() + 1)) vecesDia[d.getDay()] += 1;
    recientes90.forEach(t => {
        const [y, m, d] = t.fecha.split('-').map(Number);
        totalDia[new Date(y, m - 1, d).getDay()] += monto(t);
    });
    const porDiaSemana = totalDia.map((tot, i) => ({ dia: DIAS[i], promedio: vecesDia[i] ? tot / vecesDia[i] : 0 }))
        .sort((a, b) => b.promedio - a.promedio);
    const finDeSemana = (porDiaSemana.find(d => d.dia === 'sábado').promedio + porDiaSemana.find(d => d.dia === 'domingo').promedio) / 2;
    const entreSemana = porDiaSemana.filter(d => d.dia !== 'sábado' && d.dia !== 'domingo').reduce((a, d) => a + d.promedio, 0) / 5;

    const ticketsCat = {};
    tx.filter(esConsumo).forEach(t => { (ticketsCat[t.categoria] = ticketsCat[t.categoria] || []).push(monto(t)); });
    const inusuales = recientes90
        .filter(t => {
            const tickets = ticketsCat[t.categoria] || [];
            return tickets.length >= 4 && monto(t) > mediana(tickets) * 3 && monto(t) >= Math.max(promGastos * 0.05, 50000);
        })
        .sort((a, b) => monto(b) - monto(a))
        .slice(0, 5);

    // --- Gastos hormiga ---
    const hormigaMes = cerrados.map(m => porMes[m.ym].filter(t => esConsumo(t) && t.categoria === 'Gastos Hormiga'));
    const hormiga = nCerrados ? {
        compras: hormigaMes.reduce((a, l) => a + l.length, 0) / nCerrados,
        monto: hormigaMes.reduce((a, l) => a + suma(l), 0) / nCerrados,
    } : null;

    // --- Ingresos: fuentes y variabilidad ---
    const fuentes = {};
    cerrados.forEach(m => porMes[m.ym].filter(t => t.tipo === 'ingreso').forEach(t => {
        const c = t.categoria || 'Otros'; fuentes[c] = (fuentes[c] || 0) + monto(t);
    }));
    const totalFuentes = Object.values(fuentes).reduce((a, v) => a + v, 0);
    const listaFuentes = Object.entries(fuentes).map(([c, v]) => ({ categoria: c, peso: totalFuentes ? v / totalFuentes : 0 })).sort((a, b) => b.peso - a.peso);
    const ingresosMeses = cerrados.map(m => m.ingresos);
    const variacionIngresos = promIngresos > 0 && ingresosMeses.length > 1
        ? Math.sqrt(ingresosMeses.reduce((a, v) => a + (v - promIngresos) ** 2, 0) / ingresosMeses.length) / promIngresos
        : null;

    const ordenBalance = [...cerrados].sort((a, b) => b.balance - a.balance);

    // --- Cifras listas para los consejos ---
    // El modelo de IA NO debe calcular: aquí se dejan hechos los topes, lo que
    // queda por gastar, el diario disponible, los recortes posibles y los porcentajes.
    const diasRestantes = Math.max(diasMes - diaHoy, 0);
    const proyectar = (fijo, variable) => (diaHoy >= 5 ? fijo + variable * factor : null);
    const presupuestoCat = (nombre, promedio, fijo, variable) => {
        const llevas = fijo + variable;
        const restante = promedio - llevas;
        return {
            nombre, promedio, llevas, soloFijo: fijo > 0 && variable === 0,
            proyectado: proyectar(fijo, variable),
            pctDelPromedio: promedio > 0 ? llevas / promedio : null,
            restante,
            diario: restante > 0 && diasRestantes > 0 ? restante / diasRestantes : 0,
        };
    };
    let consejos = null;
    if (actual && nCerrados) {
        const fijoTotal = Object.values(fijoCat).reduce((a, v) => a + v, 0);
        const variableTotal = Object.values(variableCat).reduce((a, v) => a + v, 0);
        const total = presupuestoCat('Total', tipicoGastos, fijoTotal, variableTotal);
        total.soloFijo = false;
        const categoriasMes = listaCategorias.slice(0, 8)
            .map(c => presupuestoCat(c.nombre, c.tipico, fijoCat[c.nombre] || 0, variableCat[c.nombre] || 0))
            .concat(Object.keys({ ...fijoCat, ...variableCat })
                .filter(n => !listaCategorias.slice(0, 8).some(c => c.nombre === n))
                .map(n => presupuestoCat(n, 0, fijoCat[n] || 0, variableCat[n] || 0)))
            .filter(c => c.llevas > 0 || c.promedio > 0);
        // Recortes: categorías que sí se pueden ajustar (no obligaciones fijas).
        const recortes = listaCategorias
            .filter(c => !NO_RECORTABLES.includes(c.nombre) && c.tipico > 0)
            .sort((a, b) => b.tipico - a.tipico)
            .slice(0, 3)
            .map(c => ({ nombre: c.nombre, promedio: c.tipico, menos10: c.tipico * 0.1, menos20: c.tipico * 0.2 }));
        const ingresosRef = Math.max(actual.ingresos, promIngresos);
        const gastoProyectado = total.proyectado ?? promGastos;
        consejos = {
            diasMes, diasRestantes, total, categoriasMes, recortes,
            recurrentesMes: recurrentes.reduce((a, r) => a + r.media, 0),
            opcionales: recurrentes.filter(r => OPCIONALES.includes(r.categoria)),
            tasaProyectada: ingresosRef > 0 ? (ingresosRef - gastoProyectado) / ingresosRef : null,
        };
    }

    return {
        generadoEn: hoy.toISOString(),
        mesActual, diaHoy, nCerrados,
        resumenMeses, promIngresos, promGastos,
        tasaAhorroPromedio: promIngresos > 0 ? (promIngresos - promGastos) / promIngresos : null,
        tendenciaGasto: prev3.length && ult3.length
            ? { recientes: ult3.reduce((a, m) => a + m.gastos, 0) / ult3.length, anteriores: prev3.reduce((a, m) => a + m.gastos, 0) / prev3.length }
            : null,
        categorias: listaCategorias, alertasMes, recurrentes,
        porDiaSemana, finDeSemana, entreSemana, inusuales, hormiga,
        fuentesIngreso: listaFuentes, variacionIngresos,
        mejorMes: ordenBalance[0] || null, peorMes: ordenBalance[ordenBalance.length - 1] || null,
        consejos,
    };
}

// Versión en texto compacto para el contexto de la IA.
export function memoriaTexto(transacciones = [], hoy = new Date()) {
    const m = construirMemoria(transacciones, hoy);
    if (!m.resumenMeses.length) return 'MEMORIA FINANCIERA: aún no hay suficientes movimientos registrados.';
    const L = [];
    L.push(`MEMORIA FINANCIERA (últimos ${MESES} meses, calculada automáticamente a partir de sus movimientos; ${m.nCerrados} meses cerrados):`);

    L.push('Resumen mensual (ingresos / gastos de consumo / balance / tasa de ahorro):');
    [...m.resumenMeses].reverse().forEach(r => {
        const tasa = r.ingresos > 0 ? pct(r.balance / r.ingresos) : '—';
        L.push(`- ${r.ym}${r.enCurso ? ` (en curso, día ${m.diaHoy})` : ''}: ${fmt(r.ingresos)} / ${fmt(r.gastos)} / ${signo(r.balance)}${fmt(Math.abs(r.balance))} / ${tasa}${r.ahorroInversion ? ` · apartado a ahorro/inversión ${fmt(r.ahorroInversion)}` : ''}`);
    });

    if (m.nCerrados) {
        L.push(`Promedio por mes cerrado: ingresos ${fmt(m.promIngresos)}, gastos ${fmt(m.promGastos)}, tasa de ahorro ${m.tasaAhorroPromedio === null ? '—' : pct(m.tasaAhorroPromedio)}.`);
    }
    if (m.tendenciaGasto) {
        const t = m.tendenciaGasto;
        const cambio = t.anteriores > 0 ? (t.recientes - t.anteriores) / t.anteriores : 0;
        L.push(`Tendencia del gasto: últimos 3 meses ${fmt(t.recientes)}/mes vs los 3 anteriores ${fmt(t.anteriores)}/mes (${signo(cambio)}${pct(Math.abs(cambio))}).`);
    }

    if (m.categorias.length) {
        L.push('En qué se le va el dinero (gasto típico mensual = mediana de los meses cerrados; entre paréntesis su peso en el gasto total):');
        m.categorias.slice(0, 10).forEach(c => {
            const tend = c.tendencia === null ? ''
                : Math.abs(c.tendencia) < 0.05 ? ' · estable'
                : ` · tendencia ${c.tendencia >= 0 ? '↑' : '↓'}${pct(Math.abs(c.tendencia))}`;
            const media = Math.abs(c.promedio - c.tipico) > c.tipico * 0.15 ? ` (promedio ${fmt(c.promedio)}, inflado por gastos puntuales)` : '';
            L.push(`- ${c.nombre}: típico ${fmt(c.tipico)}/mes${media} · ${pct(c.peso)} del gasto${tend}`);
        });
    }

    if (m.alertasMes.length) {
        L.push('Este mes va por encima de su gasto típico (proyección al cierre del mes):');
        m.alertasMes.slice(0, 5).forEach(a => {
            L.push(`- ${a.categoria}: lleva ${fmt(a.llevas)}, proyectado ${fmt(a.proyectado)} vs típico ${fmt(a.promedio)} (+${pct(a.exceso)})`);
        });
    }

    if (m.recurrentes.length) {
        L.push('Gastos recurrentes detectados (se repiten 3+ meses con monto estable):');
        m.recurrentes.forEach(r => L.push(`- "${r.concepto}" ~${fmt(r.media)}/mes (${r.categoria}), suele ser hacia el día ${r.dia}`));
    }

    if (m.hormiga && m.hormiga.compras > 0) {
        L.push(`Gastos hormiga: en promedio ${m.hormiga.compras.toLocaleString('es-CO', { maximumFractionDigits: 1 })} compras y ${fmt(m.hormiga.monto)} por mes.`);
    }

    const top = m.porDiaSemana.filter(d => d.promedio > 0).slice(0, 3);
    if (top.length) {
        L.push(`Días que más gasta (últimos 90 días, promedio por día): ${top.map(d => `${d.dia} ${fmt(d.promedio)}`).join(', ')}. Fin de semana ${fmt(m.finDeSemana)}/día vs entre semana ${fmt(m.entreSemana)}/día.`);
    }

    if (m.inusuales.length) {
        L.push('Gastos inusuales recientes (muy por encima de lo normal en su categoría):');
        m.inusuales.forEach(t => L.push(`- ${t.fecha} "${t.concepto}" ${fmt(t.monto)} (${t.categoria})`));
    }

    if (m.fuentesIngreso.length) {
        const var_ = m.variacionIngresos === null ? '' : `; sus ingresos varían ±${pct(m.variacionIngresos)} entre meses`;
        L.push(`Ingresos: promedio ${fmt(m.promIngresos)}/mes; fuentes: ${m.fuentesIngreso.slice(0, 4).map(f => `${f.categoria} ${pct(f.peso)}`).join(', ')}${var_}.`);
    }

    if (m.mejorMes && m.peorMes && m.mejorMes !== m.peorMes) {
        L.push(`Mejor mes por balance: ${m.mejorMes.ym} (${signo(m.mejorMes.balance)}${fmt(Math.abs(m.mejorMes.balance))}); peor: ${m.peorMes.ym} (${signo(m.peorMes.balance)}${fmt(Math.abs(m.peorMes.balance))}).`);
    }

    const c = m.consejos;
    if (c) {
        L.push('');
        L.push('CIFRAS LISTAS PARA TUS CONSEJOS (ya calculadas con código; úsalas TAL CUAL y no hagas cuentas propias):');
        L.push(`Mes en curso: día ${m.diaHoy} de ${c.diasMes}, quedan ${c.diasRestantes} días.`);
        const linea = (x) => {
            const base = `${x.nombre}: lleva ${fmt(x.llevas)}`;
            if (x.soloFijo) return `- ${x.nombre}: lleva ${fmt(x.llevas)}, que es su gasto recurrente del mes (ya registrado).`;
            if (!x.promedio) return `- ${base}; no tiene historial para comparar.`;
            const comp = ` (${pct(x.pctDelPromedio)} de su gasto típico mensual de ${fmt(x.promedio)})`;
            const proy = x.proyectado !== null ? ` Al ritmo actual cerraría el mes en ${fmt(x.proyectado)}.` : ' Aún es pronto para proyectar el cierre.';
            if (x.restante >= 0) {
                return `- ${base}${comp}. Para no pasar su gasto típico le quedan ${fmt(x.restante)}${c.diasRestantes ? `, es decir ${fmt(x.diario)} por día en los ${c.diasRestantes} días que faltan` : ''}.${proy}`;
            }
            if (x.nombre === 'Total') {
                return `- ${base}${comp}. Ya superó su gasto típico mensual por ${fmt(-x.restante)}, así que NO queda presupuesto diario disponible: lo que gaste de aquí en adelante debe ser solo lo esencial.${proy}`;
            }
            return `- ${base}${comp}. YA SUPERÓ su gasto típico por ${fmt(-x.restante)}: el tope realista es no gastar más en esto este mes.${proy}`;
        };
        L.push(linea(c.total));
        L.push('Por categoría este mes:');
        c.categoriasMes.forEach(x => L.push(linea(x)));
        if (c.recortes.length) {
            L.push('Recortes posibles sobre su gasto típico (para metas de ahorro):');
            c.recortes.forEach(r => L.push(`- ${r.nombre} (típico ${fmt(r.promedio)}/mes): bajar 10% = ahorrar ${fmt(r.menos10)}/mes (${fmt(r.menos10 * 12)}/año); bajar 20% = ${fmt(r.menos20)}/mes (${fmt(r.menos20 * 12)}/año).`));
        }
        if (m.recurrentes.length) {
            L.push(`Sus gastos recurrentes suman ${fmt(c.recurrentesMes)}/mes (${fmt(c.recurrentesMes * 12)}/año).`);
            if (c.opcionales.length) {
                const sumaOpc = c.opcionales.reduce((a, r) => a + r.media, 0);
                L.push(`Recurrentes opcionales (se pueden cancelar o reducir): ${c.opcionales.map(r => `"${r.concepto}" ${fmt(r.media)}/mes = ${fmt(r.media * 12)}/año`).join(', ')}. Si suspende todos: ahorra ${fmt(sumaOpc)}/mes = ${fmt(sumaOpc * 12)}/año.`);
            }
        }
        if (c.tasaProyectada !== null) {
            L.push(`Tasa de ahorro: histórica ${m.tasaAhorroPromedio === null ? '—' : pct(m.tasaAhorroPromedio)}; proyectada para este mes ${pct(c.tasaProyectada)}.`);
        }
    }

    return L.join('\n');
}
