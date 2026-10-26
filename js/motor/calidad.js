// ═══════════════════════════════════════════════════════════
// motor/calidad.js — métricas de calidad del código con bloques:
// reutilización, duplicados (copiar/pegar), claridad de nombres,
// parámetros usados. Para telemetría y puntuación del Nivel 2+.
// ═══════════════════════════════════════════════════════════
import { CALIDAD_NIVEL2 } from '../../datos/subretos-nivel2.js';

/** Serializa un subtree de bloques (tipo + campos + estructura). */
function serializar(bloque){
  if (!bloque) return '';
  let s = bloque.type;
  const campos = [];
  if (bloque.getFieldValue) {
    for (const nombre of ['NAME', 'VAR', 'DIR', 'OP', 'NUM', 'TEXT', 'BOOL']) {
      try { const v = bloque.getFieldValue(nombre); if (v !== null) campos.push(`${nombre}=${v}`); } catch {}
    }
  }
  if (campos.length) s += `[${campos.join(',')}]`;
  const hijos = [];
  if (bloque.inputList) {
    for (const inp of bloque.inputList) {
      const t = bloque.getInputTargetBlock(inp.name); 
      if (t) hijos.push(serializar(t));
    }
  }
  const next = bloque.getNextBlock?.();
  if (next) hijos.push('>' + serializar(next));
  return s + '(' + hijos.join('|') + ')';
}

function contarBloques(bloque, visitados){
  if (!bloque || visitados.has(bloque.id)) return 0;
  visitados.add(bloque.id);
  let n = 1;
  if (bloque.inputList) for (const inp of bloque.inputList){
    n += contarBloques(bloque.getInputTargetBlock(inp.name), visitados);
  }
  n += contarBloques(bloque.getNextBlock?.(), visitados);
  return n;
}

/**
 * @param {Object} workspace — Blockly.Workspace
 * @returns {{definiciones:Object[], funcionesReutilizadas:number, maxLlamadas:number,
 *            duplicados:number, nombresClaros:boolean, paramsUsados:boolean}}
 */
export function analizarCalidad(workspace){
  const defs = new Map();   // nombre → {params, llamadas, usadoEnCuerpo}
  const llamadas = new Map();
  const serializados = new Map();

  for (const b of workspace.getAllBlocks(false)){
    if (b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn'){
      const nombre = b.getFieldValue('NAME') || 'función';
      defs.set(nombre, { nombre, params: b.getVars?.() ?? [], llamadas: 0 });
    }
    if (b.type === 'procedures_callnoreturn' || b.type === 'procedures_callreturn'){
      const nombre = b.getProcedureCall?.() ?? b.getFieldValue?.('NAME') ?? '';
      llamadas.set(nombre, (llamadas.get(nombre) ?? 0) + 1);
    }
    // duplicados: subtrees de sentencias con tamaño ≥ umbral
    if (b.type.startsWith('procedures_call') || ['mover_adelante','girar','recolectar','colocar_bloque','poner_puerta','ponerVentana','variables_set','mover_adelante'].includes(b.type)){
      const s = serializar(b);
      const n = contarBloques(b, new Set());
      if (n >= CALIDAD_NIVEL2.tamanoMinimoDuplicado)
        serializados.set(s, (serializados.get(s) ?? 0) + 1);
    }
  }

  let maxLlamadas = 0, funcionesReutilizadas = 0;
  const definiciones = [];
  for (const [nombre, def] of defs){
    const n = llamadas.get(nombre) ?? 0;
    def.llamadas = n;
    maxLlamadas = Math.max(maxLlamadas, n);
    if (n >= 2) funcionesReutilizadas++;
    definiciones.push(def);
  }
  let duplicados = 0;
  for (const [s, veces] of serializados) if (veces >= 2) duplicados += veces - 1;

  // claridad de nombres
  const nombres = [...defs.keys()];
  const nombresClaros = nombres.length === 0 || nombres.every(n =>
    n.length >= CALIDAD_NIVEL2.largoMinimoNombre &&
    CALIDAD_NIVEL2.verbosClaros.some(v => n.toLowerCase().startsWith(v)));

  // parámetros usados: alguna variable_get con el nombre del parámetro dentro de la def
  let paramsUsados = true;
  for (const b of workspace.getAllBlocks(false)){
    if (!(b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn')) continue;
    const params = b.getVars?.() ?? [];
    if (!params.length) continue;
    const cuerpo = serializar(b.getInputTargetBlock('STACK'));
    if (!params.some(p => cuerpo.includes(`VAR=${p}`))) paramsUsados = false;
  }

  return { definiciones, funcionesReutilizadas, maxLlamadas, duplicados, nombresClaros, paramsUsados };
}