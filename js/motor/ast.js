// motor/ast.js — fábrica de nodos AST (id único + línea + bloque de origen)
let seq = 0;

/**
 * @param {string} tipo
 * @param {Object} props
 * @param {number} [linea]
 * @param {string|null} [bloqueId] — id del bloque Blockly de origen (niveles 1–2)
 */
export function nodo(tipo, props = {}, linea = 0, bloqueId = null){
  return Object.assign({ tipo, id: `n${++seq}`, linea, bloqueId }, props);
}
export function reiniciarIds(){ seq = 0; }