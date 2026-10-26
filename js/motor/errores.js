// ═══════════════════════════════════════════════════════════
// motor/errores.js — categorías de error y ErrorMotor.
// ═══════════════════════════════════════════════════════════

/** @readonly @enum {string} */
export const Categorias = Object.freeze({
  SYNTAX: 'SYNTAX',
  UNDECLARED_VARIABLE: 'UNDECLARED_VARIABLE',
  INFINITE_LOOP: 'INFINITE_LOOP',
  MISSING_RETURN: 'MISSING_RETURN',
  INVALID_INHERITANCE: 'INVALID_INHERITANCE',
  INTERFACE_NOT_IMPLEMENTED: 'INTERFACE_NOT_IMPLEMENTED',
  TYPE_ERROR: 'TYPE_ERROR',
  RUNTIME: 'RUNTIME',
});

export class ErrorMotor extends Error {
  /**
   * @param {string} categoria — una de Categorias
   * @param {string} mensaje
   * @param {number} [linea]
   * @param {string|null} [nodoId]
   */
  constructor(categoria, mensaje, linea = 0, nodoId = null){
    super(mensaje);
    this.mensaje = mensaje; // los editores leen err.mensaje
    this.categoria = categoria;
    this.linea = linea;
    this.nodoId = nodoId;
  }
}