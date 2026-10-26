// motor/apiMundo.js — registro de funciones del mundo, por nivel.
export class RegistroAPI {
  constructor(){ /** @type {Map<string,{fn:Function,descripcion:string}>} */ this.funciones = new Map(); }
  /** @param {string} nombre @param {Function} fn @param {string} [descripcion] */
  registrar(nombre, fn, descripcion = ''){ this.funciones.set(nombre, { fn, descripcion }); }
  tiene(nombre){ return this.funciones.has(nombre); }
  /** @param {string} nombre @param {any[]} args */
  llamar(nombre, args){
    const f = this.funciones.get(nombre);
    if (!f) throw new Error(`API «${nombre}» no registrada`);
    return f.fn(...args);
  }
  limpiar(){ this.funciones.clear(); }
}