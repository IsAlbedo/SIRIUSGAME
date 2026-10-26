// ═══════════════════════════════════════════════════════════
// motor/interprete.js — evaluador generador, paso a paso.
// Cada yield = un paso {tipo:'visit'|'assign'|'call'|'return'|'mundo', nodo, extra}.
// Sin eval/Function. Límites los aplica motorEjecucion.
// ═══════════════════════════════════════════════════════════
import { ErrorMotor, Categorias } from './errores.js';

const C = Categorias;

class Entorno {
  constructor(padre = null){ this.padre = padre; this.vals = new Map(); this.tipos = new Map(); }
  declarar(nombre, valor, tipo = null){ this.vals.set(nombre, valor); if (tipo) this.tipos.set(nombre, tipo); }
  buscar(nombre){ let e = this; while (e){ if (e.vals.has(nombre)) return e; e = e.padre; } return null; }
  thisDe(){ let e = this; while (e){ if (e._this !== undefined) return e; e = e.padre; } return null; }
}

class Retorno { constructor(v){ this.valor = v; } }
class Corte {}
class Salto {}

function valorTipo(v){
  if (v === null || v === undefined) return 'nulo';
  switch (typeof v){ case 'number': return 'num'; case 'string': return 'texto'; case 'boolean': return 'bool'; }
  return 'objeto';
}
function compatible(tipo, v){
  if (!tipo || v === null || v === undefined) return true;
  if (typeof v === 'object') return true; // tipos-clase se validan ligero
  return valorTipo(v) === tipo;
}
function verdadero(v){ return !(v === false || v === null || v === undefined || v === 0); }
const paso = (tipo, nodo, extra = null) => ({ tipo, nodo, extra });

/** Valida que `i` sea un índice entero dentro de la lista. */
function indiceValido(i, lista, n){
  if (typeof i !== 'number' || !Number.isInteger(i))
    throw new ErrorMotor(C.TYPE_ERROR, 'El índice debe ser un num entero', n.linea, n.id);
  if (i < 0 || i >= lista.length)
    throw new ErrorMotor(C.RUNTIME, `Índice ${i} fuera de rango (longitud ${lista.length})`, n.linea, n.id);
}

/* ─────────── evaluador de expresiones (generador) ─────────── */
function* expr(n, env, ctx){
  switch (n.tipo){
    case 'Literal': return n.valor;
    case 'Ident': {
      const e = env.buscar(n.nombre);
      if (!e) throw new ErrorMotor(C.UNDECLARED_VARIABLE, `La variable «${n.nombre}» no fue declarada`, n.linea, n.id);
      return e.vals.get(n.nombre);
    }
    case 'Este': {
      const e = env.thisDe();
      if (!e) throw new ErrorMotor(C.RUNTIME, '«this» solo existe dentro de una clase', n.linea, n.id);
      return e._this;
    }
    case 'Unaria': {
      const v = yield* expr(n.expr, env, ctx);
      if (n.op === '-') {
        if (typeof v !== 'number') throw new ErrorMotor(C.TYPE_ERROR, 'Solo se puede negar un num', n.linea, n.id);
        return -v;
      }
      return !verdadero(v);
    }
    case 'Logica': {
      const izq = yield* expr(n.izq, env, ctx);
      if (n.op === '&&') return verdadero(izq) ? yield* expr(n.der, env, ctx) : izq;
      return verdadero(izq) ? izq : yield* expr(n.der, env, ctx);
    }
    case 'Binaria': {
      const a = yield* expr(n.izq, env, ctx);
      const b = yield* expr(n.der, env, ctx);
      const op = n.op;
      if (op === '+'){
        if (typeof a === 'number' && typeof b === 'number') return a + b;
        if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
        throw new ErrorMotor(C.TYPE_ERROR, `No se puede sumar ${valorTipo(a)} con ${valorTipo(b)}`, n.linea, n.id);
      }
      if (op === '==' ) return a === b;
      if (op === '!=') return a !== b;
      if (['-','*','/','%','<','<=','>','>='].includes(op)){
        if (typeof a !== 'number' || typeof b !== 'number')
          throw new ErrorMotor(C.TYPE_ERROR, `«${op}» necesita num a ambos lados`, n.linea, n.id);
        if (op === '-') return a - b;
        if (op === '*') return a * b;
        if (op === '/'){
          if (b === 0) throw new ErrorMotor(C.RUNTIME, 'División por cero: la red se marea', n.linea, n.id);
          return a / b;
        }
        if (op === '%') return a % b;
        if (op === '<') return a < b;
        if (op === '<=') return a <= b;
        if (op === '>') return a > b;
        return a >= b;
      }
      throw new ErrorMotor(C.RUNTIME, `Operador desconocido «${op}»`, n.linea, n.id);
    }
    case 'Acceso': {
      const obj = yield* expr(n.obj, env, ctx);
      if (Array.isArray(obj)){
        if (n.prop === 'longitud') return obj.length;
        throw new ErrorMotor(C.RUNTIME, `Las listas no tienen propiedad «${n.prop}»`, n.linea, n.id);
      }
      if (!obj || typeof obj !== 'object')
        throw new ErrorMotor(C.TYPE_ERROR, 'Solo los objetos tienen propiedades', n.linea, n.id);
      const campo = obj.__clase ? buscarCampo(obj.__clase, n.prop) : null;
      if (campo){
        if (campo.privado && env.thisDe()?._this !== obj)
          throw new ErrorMotor(C.TYPE_ERROR, `El campo «${n.prop}» es privado`, n.linea, n.id);
        return obj.campos.get(n.prop);
      }
      const metodo = obj.__clase ? buscarMetodo(obj.__clase, n.prop) : null;
      if (metodo) return { __bound: { obj, def: metodo } };
      throw new ErrorMotor(C.RUNTIME, `«${n.prop}» no existe en ese objeto`, n.linea, n.id);
    }
    case 'Nuevo': {
      const cont = env.buscar(n.clase);
      const def = cont?.vals.get(n.clase);
      if (!def?.__clase) throw new ErrorMotor(C.TYPE_ERROR, `«${n.clase}» no es una clase`, n.linea, n.id);
      if (def.__clase.abstracta)
        throw new ErrorMotor(C.TYPE_ERROR, `«${n.clase}» es abstracta: no se puede instanciar`, n.linea, n.id);
      return yield* instanciar(def.__clase, n.args, env, ctx, n);
    }
    case 'Llamar': return yield* evaluarLlamada(n, env, ctx, 0);
    case 'Super': return yield* evaluarSuper(n, env, ctx);
    case 'Lista': {
      const arr = [];
      for (const e of n.elementos) arr.push(yield* expr(e, env, ctx));
      return arr;
    }
    case 'Indice': {
      const obj = yield* expr(n.obj, env, ctx);
      const i = yield* expr(n.indice, env, ctx);
      if (!Array.isArray(obj)) throw new ErrorMotor(C.TYPE_ERROR, 'Solo las listas se indexan con [ ]', n.linea, n.id);
      indiceValido(i, obj, n);
      return obj[i];
    }

    default:
      throw new ErrorMotor(C.RUNTIME, `Expresión no soportada: ${n.tipo}`, n.linea, n.id);
  }
}

/* ─────────── clases ─────────── */
function construirClase(d){
  return {
    __clase: {
      nombre: d.nombre, abstracta: d.abstracta, padreNombre: d.extiende ?? null,
      campos: d.campos, metodos: new Map(d.metodos.map(m => [m.nombre, m])),
      constructorDef: d.constructorDef ?? null, declaracion: d,
    },
  };
}
function clasePadre(def, ctx){
  if (!def.padreNombre) return null;
  const cont = ctx.global.buscar(def.padreNombre);
  const v = cont?.vals.get(def.padreNombre);
  if (!v?.__clase) throw new ErrorMotor(C.INVALID_INHERITANCE, `La clase padre «${def.padreNombre}» no existe`, def.declaracion.linea);
  return v.__clase;
}
function buscarMetodo(def, nombre){
  let c = def;
  while (c){ if (c.metodos.has(nombre)) return c.metodos.get(nombre); c = c._padreRef ?? null; }
  return null;
}
function buscarCampo(def, nombre){
  let c = def;
  while (c){ const f = c.campos.find(x => x.nombre === nombre); if (f) return f; c = c._padreRef ?? null; }
  return null;
}

function* instanciar(def, args, env, ctx, n){
  const obj = { __clase: def, campos: new Map() };
  // cadena padre→hijo para campos
  const cadena = [];
  let c = def;
  while (c){ cadena.unshift(c); c = c._padreRef ?? null; }
  for (const clase of cadena){
    for (const campo of clase.campos){
      obj.campos.set(campo.nombre, campo.valor ? yield* expr(campo.valor, envThis(env, obj), ctx) : null);
    }
  }
  if (def.constructorDef){
    const valores = [];
    for (const a of args) valores.push(yield* expr(a, env, ctx));
    const sub = new Entorno(env);
    sub._this = obj; sub._clase = def;
    if (valores.length !== def.constructorDef.params.length)
      throw new ErrorMotor(C.RUNTIME, `El constructor de «${def.nombre}» espera ${def.constructorDef.params.length} argumento(s)`, n.linea, n.id);
    def.constructorDef.params.forEach((p, i) => sub.declarar(p.nombre, valores[i], p.tipo));
    try { yield* ejecutar(def.constructorDef.cuerpo, sub, ctx, 0); }
    catch (s){ if (!(s instanceof Retorno)) throw s; }
  }
  return obj;
}

function envThis(env, obj){ const e = new Entorno(env); e._this = obj; return e; }

function* evaluarSuper(n, env, ctx){
  const base = env.thisDe();
  if (!base) throw new ErrorMotor(C.RUNTIME, '«super» solo existe dentro de una clase', n.linea, n.id);
  const def = base._clase;
  const padre = def._padreRef;
  if (!padre) throw new ErrorMotor(C.INVALID_INHERITANCE, '«super» necesita una clase padre', n.linea, n.id);
  const args = [];
  for (const a of n.args) args.push(yield* expr(a, env, ctx));
  if (n.metodo){
    const m = buscarMetodo(padre, n.metodo);
    if (!m) throw new ErrorMotor(C.RUNTIME, `La clase padre no tiene el método «${n.metodo}»`, n.linea, n.id);
    return yield* ejecutarMetodo(m, base._this, args, env, ctx, n, 0);
  }
  if (padre.constructorDef){
    const sub = new Entorno(env);
    sub._this = base._this; sub._clase = padre;
    padre.constructorDef.params.forEach((p, i) => sub.declarar(p.nombre, args[i], p.tipo));
    try { yield* ejecutar(padre.constructorDef.cuerpo, sub, ctx, 0); }
    catch (s){ if (!(s instanceof Retorno)) throw s; }
  }
  return null;
}

/* ─────────── llamadas ─────────── */
function* evaluarLlamada(n, env, ctx, prof){
  const args = [];
  for (const a of n.args) args.push(yield* expr(a, env, ctx));
  // ¿API del mundo?
  if (n.callee.tipo === 'Ident' && ctx.api?.tiene(n.callee.nombre)){
    yield paso('call', n, { nombre: n.callee.nombre, args });
    const resultado = ctx.api.llamar(n.callee.nombre, args);
    yield paso('mundo', n, { nombre: n.callee.nombre, args, resultado });
    return resultado;
  }
  const fn = yield* expr(n.callee, env, ctx);
  if (fn?.__funcion) return yield* llamarFuncion(fn, args, n, ctx, prof);
  if (fn?.__bound){
    const { obj, def } = fn.__bound;
    if (def.privado && env.thisDe()?._this !== obj)
      throw new ErrorMotor(C.TYPE_ERROR, `El método «${def.nombre}» es privado`, n.linea, n.id);
    return yield* ejecutarMetodo(def, obj, args, env, ctx, n, prof);
  }
  throw new ErrorMotor(C.TYPE_ERROR, 'Eso no es una función', n.linea, n.id);
}

function* llamarFuncion(fn, args, n, ctx, prof){
  const d = fn.__funcion;
  if (prof + 1 > ctx.limites.maxProfundidad)
    throw new ErrorMotor(C.RUNTIME, 'Demasiadas llamadas anidadas: la recursión se hunde', n.linea, n.id);
  if (args.length !== d.params.length)
    throw new ErrorMotor(C.RUNTIME, `«${d.nombre}» espera ${d.params.length} argumento(s) y recibió ${args.length}`, n.linea, n.id);
  const sub = new Entorno(fn.entorno);
  d.params.forEach((p, i) => {
    if (p.tipo && !compatible(p.tipo, args[i]))
      throw new ErrorMotor(C.TYPE_ERROR, `«${d.nombre}»: el parámetro «${p.nombre}» esperaba ${p.tipo}`, n.linea, n.id);
    sub.declarar(p.nombre, args[i], p.tipo);
  });
  let retornoVisto = false, valor = null;
  try {
    // Se ejecutan las sentencias directamente en `sub` (sin pasar por Bloque)
    // para que retornoExpr vea las variables locales del cuerpo.
    for (const s of d.cuerpo.sentencias) yield* ejecutar(s, sub, ctx, prof + 1);
  }
  catch (s){ if (s instanceof Retorno){ retornoVisto = true; valor = s.valor; } else throw s; }

  if (!retornoVisto && d.retornoExpr){
    valor = yield* expr(d.retornoExpr, sub, ctx);
    yield paso('return', d.retornoExpr, { valor });
    retornoVisto = true;
  }
  if (!retornoVisto && d.retorno && d.retorno !== 'void')
    throw new ErrorMotor(C.MISSING_RETURN, `«${d.nombre}» terminó sin return`, n.linea, n.id);
  return valor;
}

function* ejecutarMetodo(def, obj, args, env, ctx, n, prof){
  if (!def.cuerpo) throw new ErrorMotor(C.TYPE_ERROR, `El método abstracto «${def.nombre}» no tiene cuerpo`, n.linea, n.id);
  if (prof + 1 > ctx.limites.maxProfundidad)
    throw new ErrorMotor(C.RUNTIME, 'Demasiadas llamadas anidadas', n.linea, n.id);
  if (args.length !== def.params.length)
    throw new ErrorMotor(C.RUNTIME, `«${def.nombre}» espera ${def.params.length} argumento(s)`, n.linea, n.id);
  const sub = new Entorno(env);
  sub._this = obj; sub._clase = def.__claseDeclarante ?? obj.__clase;
  def.params.forEach((p, i) => sub.declarar(p.nombre, args[i], p.tipo));
  try { yield* ejecutar(def.cuerpo, sub, ctx, prof + 1); return null; }
  catch (s){ if (s instanceof Retorno) return s.valor; throw s; }
}

/* ─────────── sentencias ─────────── */
function* ejecutar(n, env, ctx, prof){
  switch (n.tipo){
    case 'Bloque': {
      const sub = new Entorno(env);
      for (const s of n.sentencias) yield* ejecutar(s, sub, ctx, prof);
      return;
    }
    case 'DeclVar': {
      yield paso('visit', n);
      const v = n.valor ? yield* expr(n.valor, env, ctx) : null;
      const tipoVar = n.tipoDato ?? null;   // n.tipo es el tipo del NODO, no el de la variable
      if (tipoVar && !compatible(tipoVar, v))
        throw new ErrorMotor(C.TYPE_ERROR, `«${n.nombre}» es de tipo ${tipoVar} y recibió ${valorTipo(v)}`, n.linea, n.id);
      env.declarar(n.nombre, v, tipoVar);
      yield paso('assign', n, { nombre: n.nombre, valor: v });
      return;
    }
    case 'Asignar': {
      yield paso('visit', n);
      const v = yield* expr(n.valor, env, ctx);
      if (n.objetivo.tipo === 'Ident'){
        let e = env.buscar(n.objetivo.nombre);
        if (!e){
          if (n.autoDeclarar){ env.declarar(n.objetivo.nombre, v); yield paso('assign', n, { nombre: n.objetivo.nombre, valor: v }); return; }
          throw new ErrorMotor(C.UNDECLARED_VARIABLE, `La variable «${n.objetivo.nombre}» no fue declarada`, n.linea, n.id);
        }
        const tipo = e.tipos.get(n.objetivo.nombre);
        if (tipo && !compatible(tipo, v))
          throw new ErrorMotor(C.TYPE_ERROR, `«${n.objetivo.nombre}» es de tipo ${tipo} y recibió ${valorTipo(v)}`, n.linea, n.id);
        e.vals.set(n.objetivo.nombre, v);
        yield paso('assign', n, { nombre: n.objetivo.nombre, valor: v });
        return;
      }
      // elemento de lista: lista[i] = x
      if (n.objetivo.tipo === 'Indice'){
        const lista = yield* expr(n.objetivo.obj, env, ctx);
        const i = yield* expr(n.objetivo.indice, env, ctx);
        if (!Array.isArray(lista))
          throw new ErrorMotor(C.TYPE_ERROR, 'Solo las listas se indexan con [ ]', n.linea, n.id);
        indiceValido(i, lista, n);
        lista[i] = v;
        yield paso('assign', n, { nombre: `[${i}]`, valor: v });
        return;
      }
      // acceso a campo
      const obj = yield* expr(n.objetivo.obj, env, ctx);
      if (!obj || typeof obj !== 'object' || !obj.campos)
        throw new ErrorMotor(C.TYPE_ERROR, 'Solo los objetos reciben campos', n.linea, n.id);
      const campo = obj.__clase ? buscarCampo(obj.__clase, n.objetivo.prop) : null;
      if (campo?.privado && env.thisDe()?._this !== obj)
        throw new ErrorMotor(C.TYPE_ERROR, `El campo «${n.objetivo.prop}» es privado`, n.linea, n.id);
      obj.campos.set(n.objetivo.prop, v);
      yield paso('assign', n, { nombre: n.objetivo.prop, valor: v });
      return;
    }
    case 'Si': {
      yield paso('visit', n);
      const c = yield* expr(n.cond, env, ctx);
      if (verdadero(c)) yield* ejecutar(n.ent, env, ctx, prof);
      else if (n.sino) yield* ejecutar(n.sino, env, ctx, prof);
      return;
    }
    case 'Mientras': {
      for (;;){
        yield paso('visit', n);
        const c = yield* expr(n.cond, env, ctx);
        if (!verdadero(c)) break;
        try { yield* ejecutar(n.cuerpo, env, ctx, prof); }
        catch (s){ if (s instanceof Corte) break; if (!(s instanceof Salto)) throw s; }
      }
      return;
    }
    case 'Para': {
      const sub = new Entorno(env);
      if (n.init) yield* ejecutar(n.init, sub, ctx, prof);
      for (;;){
        yield paso('visit', n);
        if (n.cond){
          const c = yield* expr(n.cond, sub, ctx);
          if (!verdadero(c)) break;
        }
        try { yield* ejecutar(n.cuerpo, sub, ctx, prof); }
        catch (s){ if (s instanceof Corte) break; if (!(s instanceof Salto)) throw s; }
        if (n.paso){
          const v = yield* expr(n.paso.valor, sub, ctx);
          const e = sub.buscar(n.paso.objetivo.nombre) ?? env.buscar(n.paso.objetivo.nombre);
          if (e) e.vals.set(n.paso.objetivo.nombre, v);
        }
      }
      return;
    }
    case 'Switch': {
      yield paso('visit', n);
      const v = yield* expr(n.expr, env, ctx);
      let ejecutado = false, saltado = false;
      for (const caso of n.casos){
        const vc = yield* expr(caso.valor, env, ctx);
        if (!saltado && vc !== v) continue;
        saltado = true; ejecutado = true;
        try { for (const s of caso.cuerpo) yield* ejecutar(s, env, ctx, prof); break; }
        catch (s){ if (s instanceof Corte) break; throw s; }
      }
      if (!ejecutado && n.porDefecto){
        try { for (const s of n.porDefecto) yield* ejecutar(s, env, ctx, prof); }
        catch (s){ if (!(s instanceof Corte)) throw s; }
      }
      return;
    }
    case 'Retornar': {
      const v = n.valor ? yield* expr(n.valor, env, ctx) : null;
      yield paso('return', n, { valor: v });
      throw new Retorno(v);
    }
    case 'Romper': throw new Corte();
    case 'Continuar': throw new Salto();
    case 'Llamar': yield* evaluarLlamada(n, env, ctx, prof); return;
    default:
      yield paso('visit', n);
      yield* expr(n, env, ctx); // expresión como sentencia
  }
}

/* ─────────── programa completo ─────────── */
/**
 * @param {Object} ast — Programa
 * @param {{api?:Object, limites:{maxPasos:number,maxProfundidad:number,tiempoMaxMs:number}, global?:Entorno}} ctx
 */
export function* evaluarPrograma(ast, ctx){
  const global = ctx.global ?? new Entorno();
  ctx.global = global;
  // hoisting de funciones y clases
  for (const d of ast.cuerpo){
    if (d.tipo === 'DeclFuncion') global.declarar(d.nombre, { __funcion: d, entorno: global });
    if (d.tipo === 'DeclClase'){
      const cont = construirClase(d);
      global.declarar(d.nombre, cont);
    }
    if (d.tipo === 'DeclInterfaz') global.declarar(d.nombre, { __interfaz: d });
  }
  // resolver padres
  for (const d of ast.cuerpo){
    if (d.tipo !== 'DeclClase' || !d.extiende) continue;
    const cont = global.vals.get(d.nombre);
    const e = global.buscar(d.extiende);
    const padre = e?.vals.get(d.extiende);
    if (!padre?.__clase)
      throw new ErrorMotor(C.INVALID_INHERITANCE, `«${d.nombre}» extiende de «${d.extiende}», que no existe`, d.linea, d.id);
    cont.__clase._padreRef = padre.__clase;
  }
  for (const d of ast.cuerpo){
    if (['DeclFuncion','DeclClase','DeclInterfaz'].includes(d.tipo)) continue;
    yield* ejecutar(d, global, ctx, 0);
  }
}