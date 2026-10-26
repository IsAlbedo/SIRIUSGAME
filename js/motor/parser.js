// motor/parser.js — tokens → AST (descenso recursivo). Errores: SYNTAX con línea.
import { nodo } from './ast.js';
import { tokenizar } from './tokenizer.js';
import { ErrorMotor, Categorias } from './errores.js';

const TIPOS_SIMPLES = new Set(['num','texto','bool','void']);

class Parser {
  /** @param {{tipo:string, valor:any, linea:number}[]} tokens */
  constructor(tokens){ this.t = tokens; this.i = 0; }
  mira(k = 0){ return this.t[this.i + k]; }
  avanzar(){ return this.t[this.i++]; }
  enFin(){ return this.mira().tipo === 'fin'; }
  /** @param {string} tipo @param {string} [valor] */
  esperar(tipo, valor){
    const tk = this.mira();
    if (tk.tipo !== tipo || (valor !== undefined && tk.valor !== valor)){
      throw new ErrorMotor(Categorias.SYNTAX,
        `Se esperaba «${valor ?? tipo}» y se encontró «${tk.valor ?? tk.tipo}»`, tk.linea);
    }
    return this.avanzar();
  }
  esClave(v){ return this.mira().tipo === 'clave' && this.mira().valor === v; }
  esTipo(){
    const tk = this.mira();
    return (tk.tipo === 'clave' && TIPOS_SIMPLES.has(tk.valor)) || tk.tipo === 'ident';
  }

  programa(){
    const cuerpo = [];
    while (!this.enFin()) cuerpo.push(this.declaracion());
    return nodo('Programa', { cuerpo });
  }

  declaracion(){
    if (this.esClave('function')) return this.declFuncion(null);
    if (this.esClave('abstract') || this.esClave('class')) return this.declClase();
    if (this.esClave('interface')) return this.declInterfaz();
    // variable tipada o sentencia
    if ((this.esTipo() || this.esClave('var')) &&
        this.mira(1).tipo === 'ident' && this.mira(2).valor === '='){
      return this.declVar();
    }
    return this.sentencia();
  }

  declVar(){
    let tipo = null;
    if (this.esClave('var')) this.avanzar();
    else if (this.esTipo() && this.mira(1).tipo === 'ident') tipo = this.avanzar().valor;
    const nombre = this.esperar('ident').valor;
    this.esperar('op', '=');
    const valor = this.expresion();
    const linea = this.esperar('punct', ';').linea;
    return nodo('DeclVar', { nombre, tipoDato: tipo, valor }, linea);
  }

  declFuncion(visibilidad = null){
    const linea = this.esperar('clave', 'function').linea;
    const nombre = this.esperar('ident').valor;
    const params = this.params();

    // Retorno por expresión: function f(a) -> a + 1 { ... }
    // Acepta «->» como un solo token o como «-» seguido de «>».
    let retornoExpr = null;
    if (this.mira().valor === '->'){
      this.avanzar();
      retornoExpr = this.expresion();
    } else if (this.mira().valor === '-' && this.mira(1).valor === '>'){
      this.avanzar(); this.avanzar();
      retornoExpr = this.expresion();
    }
    const cuerpo = this.bloque();
    return nodo('DeclFuncion', { nombre, retorno: null, retornoExpr, params, cuerpo, visibilidad }, linea);
  }

  params(){
    this.esperar('punct', '(');
    const params = [];
    while (this.mira().valor !== ')'){
      let tipo = null;
      if (this.esTipo() && this.mira(1).tipo === 'ident') tipo = this.avanzar().valor;
      params.push({ nombre: this.esperar('ident').valor, tipo });
      if (this.mira().valor === ',') this.avanzar();
    }
    this.esperar('punct', ')');
    return params;
  }

  declClase(){
    let abstracta = false;
    if (this.esClave('abstract')){ abstracta = true; this.avanzar(); }
    const linea = this.esperar('clave', 'class').linea;
    const nombre = this.esperar('ident').valor;
    let extiende = null; const implementa = [];
    if (this.esClave('extends')){ this.avanzar(); extiende = this.esperar('ident').valor; }
    if (this.esClave('implements')){
      this.avanzar();
      implementa.push(this.esperar('ident').valor);
      while (this.mira().valor === ','){ this.avanzar(); implementa.push(this.esperar('ident').valor); }
    }
    this.esperar('punct', '{');
    const campos = [], metodos = [];
    let constructorDef = null;
    while (this.mira().valor !== '}'){
      const vis = { privado: false, abstracto: false, override: false };
      while (['public','private','abstract','override'].includes(this.mira().valor)){
        const m = this.avanzar().valor;
        if (m === 'private') vis.privado = true;
        if (m === 'abstract') vis.abstracto = true;
        if (m === 'override') vis.override = true;
      }
      if (this.esClave('constructor')){
        this.avanzar();
        const params = this.params();
        constructorDef = nodo('Constructor', { params, cuerpo: this.bloque() });
        continue;
      }
      const retorno = TIPOS_SIMPLES.has(this.mira().valor) ? this.avanzar().valor : (this.esTipo() ? this.avanzar().valor : null);
      const nombreMiembro = this.esperar('ident').valor;
      if (this.mira().valor === '('){
        const params = this.params();
        if (this.mira().valor === ';'){
          this.avanzar();
          metodos.push(nodo('Metodo', { nombre: nombreMiembro, retorno, params, cuerpo: null, ...vis, abstracto: true }));
        } else {
          metodos.push(nodo('Metodo', { nombre: nombreMiembro, retorno, params, cuerpo: this.bloque(), ...vis }));
        }
      } else {
        // campo con inicializador opcional: «num energia;» o «num energia = 100;»
        let valor = null;
        if (this.mira().valor === '='){
          this.avanzar();
          valor = this.expresion();
        }
        this.esperar('punct', ';');
        campos.push(nodo('Campo', { nombre: nombreMiembro, tipo: retorno, valor, privado: vis.privado }));
      }
    }
    this.esperar('punct', '}');
    return nodo('DeclClase', { nombre, abstracta, extiende, implementa, campos, metodos, constructorDef }, linea);
  }

  declInterfaz(){
    const linea = this.esperar('clave', 'interface').linea;
    const nombre = this.esperar('ident').valor;
    this.esperar('punct', '{');
    const metodos = [];
    while (this.mira().valor !== '}'){
      const retorno = TIPOS_SIMPLES.has(this.mira().valor) ? this.avanzar().valor : null;
      const n = this.esperar('ident').valor;
      const params = this.params();
      this.esperar('punct', ';');
      metodos.push(nodo('Firma', { nombre: n, retorno, params }));
    }
    this.esperar('punct', '}');
    return nodo('DeclInterfaz', { nombre, metodos }, linea);
  }

  bloque(){
    const linea = this.esperar('punct', '{').linea;
    const sentencias = [];
    while (this.mira().valor !== '}') sentencias.push(this.sentencia());
    this.esperar('punct', '}');
    return nodo('Bloque', { sentencias }, linea);
  }

  sentencia(){
    const tk = this.mira();
    if (tk.valor === '{') return this.bloque();
    // declaración con tipo-clase: Ciudadano c = new Ciudadano(...);
    if (tk.tipo === 'ident' && this.mira(1).tipo === 'ident' && this.mira(2).valor === '=')
      return this.declVar();
    if (tk.tipo === 'clave'){
      switch (tk.valor){
        case 'if': return this.si();
        case 'switch': return this.switchSt();
        case 'while': return this.mientras();
        case 'for': return this.para();
        case 'return': {
          const linea = this.avanzar().linea;
          let valor = null;
          if (this.mira().valor !== ';') valor = this.expresion();
          this.esperar('punct', ';');
          return nodo('Retornar', { valor }, linea);
        }
        case 'break': { const l = this.avanzar().linea; this.esperar('punct', ';'); return nodo('Romper', {}, l); }
        case 'continue': { const l = this.avanzar().linea; this.esperar('punct', ';'); return nodo('Continuar', {}, l); }
        case 'var': return this.declVar();
        default:
          if (TIPOS_SIMPLES.has(tk.valor) && this.mira(1).tipo === 'ident' && this.mira(2).valor === '=')
            return this.declVar();
      }
    }
    // asignación o llamada
    const expr = this.expresion();
    if (this.mira().valor === '='){
      this.avanzar();
      const valor = this.expresion();
      this.esperar('punct', ';');
      return nodo('Asignar', { objetivo: expr, valor, autoDeclarar: false }, expr.linea);
    }
    this.esperar('punct', ';');
    return expr;
  }

  si(){
    const linea = this.esperar('clave', 'if').linea;
    this.esperar('punct', '(');
    const cond = this.expresion();
    this.esperar('punct', ')');
    const ent = this.bloque();
    let sino = null;
    if (this.esClave('else')){
      this.avanzar();
      sino = this.esClave('if') ? this.si() : this.bloque();
    }
    return nodo('Si', { cond, ent, sino }, linea);
  }

  switchSt(){
    const linea = this.esperar('clave', 'switch').linea;
    this.esperar('punct', '(');
    const expr = this.expresion();
    this.esperar('punct', ')');
    this.esperar('punct', '{');
    const casos = []; let porDefecto = null;
    while (this.mira().valor !== '}'){
      if (this.esClave('case')){
        this.avanzar();
        const valor = this.expresion();
        this.esperar('punct', ':');
        const cuerpo = [];
        while (!(this.esClave('case') || this.esClave('default') || this.mira().valor === '}'))
          cuerpo.push(this.sentencia());
        casos.push({ valor, cuerpo });
      } else if (this.esClave('default')){
        this.avanzar(); this.esperar('punct', ':');
        porDefecto = [];
        while (!(this.esClave('case') || this.mira().valor === '}'))
          porDefecto.push(this.sentencia());
      }
    }
    this.esperar('punct', '}');
    return nodo('Switch', { expr, casos, porDefecto }, linea);
  }

  mientras(){
    const linea = this.esperar('clave', 'while').linea;
    this.esperar('punct', '(');
    const cond = this.expresion();
    this.esperar('punct', ')');
    return nodo('Mientras', { cond, cuerpo: this.bloque() }, linea);
  }

  para(){
    const linea = this.esperar('clave', 'for').linea;
    this.esperar('punct', '(');
    // init: declaración (declVar ya consume ';'), asignación o vacío
    let init = null;
    if (this.mira().valor === ';'){
      this.avanzar();
    } else if ((this.esTipo() || this.esClave('var')) && this.mira(1).tipo === 'ident' && this.mira(2).valor === '='){
      init = this.declVar();
    } else {
      init = this.asignacionSimple();
      this.esperar('punct', ';');
    }
    let cond = null;
    if (this.mira().valor !== ';') cond = this.expresion();
    this.esperar('punct', ';');
    let paso = null;
    if (this.mira().valor !== ')') paso = this.asignacionSimple();
    this.esperar('punct', ')');
    return nodo('Para', { init, cond, paso, cuerpo: this.bloque() }, linea);
  }

  asignacionSimple(){
    const objetivo = this.expresion();
    this.esperar('op', '=');
    const valor = this.expresion();
    return nodo('Asignar', { objetivo, valor, autoDeclarar: false }, objetivo.linea);
  }

  /* ── expresiones ── */
  expresion(){ return this.or(); }
  or(){
    let izq = this.and();
    while (this.mira().valor === '||'){
      const op = this.avanzar().valor, linea = this.mira().linea;
      izq = nodo('Logica', { op, izq, der: this.and() }, linea);
    }
    return izq;
  }
  and(){
    let izq = this.igualdad();
    while (this.mira().valor === '&&'){
      const op = this.avanzar().valor, linea = this.mira().linea;
      izq = nodo('Logica', { op, izq, der: this.igualdad() }, linea);
    }
    return izq;
  }
  igualdad(){
    let izq = this.comparacion();
    while (['==','!='].includes(this.mira().valor)){
      const op = this.avanzar().valor, linea = this.mira().linea;
      izq = nodo('Binaria', { op, izq, der: this.comparacion() }, linea);
    }
    return izq;
  }
  comparacion(){
    let izq = this.aditiva();
    while (['<','<=','>','>='].includes(this.mira().valor)){
      const op = this.avanzar().valor, linea = this.mira().linea;
      izq = nodo('Binaria', { op, izq, der: this.aditiva() }, linea);
    }
    return izq;
  }
  aditiva(){
    let izq = this.multiplicativa();
    while (['+','-'].includes(this.mira().valor)){
      const op = this.avanzar().valor, linea = this.mira().linea;
      izq = nodo('Binaria', { op, izq, der: this.multiplicativa() }, linea);
    }
    return izq;
  }
  multiplicativa(){
    let izq = this.unaria();
    while (['*','/','%'].includes(this.mira().valor)){
      const op = this.avanzar().valor, linea = this.mira().linea;
      izq = nodo('Binaria', { op, izq, der: this.unaria() }, linea);
    }
    return izq;
  }
  unaria(){
    if (['-','!'].includes(this.mira().valor)){
      const op = this.avanzar().valor, linea = this.mira().linea;
      return nodo('Unaria', { op, expr: this.unaria() }, linea);
    }
    return this.postfix();
  }
  postfix(){
    let expr = this.primaria();
    for (;;){
      if (this.mira().valor === '('){
        const linea = this.mira().linea;
        expr = nodo('Llamar', { callee: expr, args: this.args() }, linea);
      } else if (this.mira().valor === '.'){
        const linea = this.avanzar().linea;
        expr = nodo('Acceso', { obj: expr, prop: this.esperar('ident').valor }, linea);
      } else if (this.mira().valor === '['){
        const linea = this.avanzar().linea;
        const indice = this.expresion();
        this.esperar('punct', ']');
        expr = nodo('Indice', { obj: expr, indice }, linea);
      } else break;
    }
    return expr;
  }
  args(){
    this.esperar('punct', '(');
    const args = [];
    while (this.mira().valor !== ')'){
      args.push(this.expresion());
      if (this.mira().valor === ',') this.avanzar();
    }
    this.esperar('punct', ')');
    return args;
  }
  primaria(){
    const tk = this.mira();
    if (tk.tipo === 'num'){ this.avanzar(); return nodo('Literal', { valor: tk.valor, tipoDato: 'num' }, tk.linea); }
    if (tk.tipo === 'texto'){ this.avanzar(); return nodo('Literal', { valor: tk.valor, tipoDato: 'texto' }, tk.linea); }
    if (tk.tipo === 'clave'){
      if (tk.valor === 'true' || tk.valor === 'false'){
        this.avanzar(); return nodo('Literal', { valor: tk.valor === 'true', tipoDato: 'bool' }, tk.linea);
      }
      if (tk.valor === 'null'){ this.avanzar(); return nodo('Literal', { valor: null, tipoDato: 'nulo' }, tk.linea); }
      if (tk.valor === 'this'){ this.avanzar(); return nodo('Este', {}, tk.linea); }
      if (tk.valor === 'new'){
        const linea = this.avanzar().linea;
        const clase = this.esperar('ident').valor;
        const args = this.args();
        return nodo('Nuevo', { clase, args }, linea);
      }
      if (tk.valor === 'super'){
        const linea = this.avanzar().linea;
        if (this.mira().valor === '.'){
          this.avanzar();
          const metodo = this.esperar('ident').valor;
          const args = this.args();
          return nodo('Super', { metodo, args }, linea);
        }
        const args = this.args();
        return nodo('Super', { metodo: null, args }, linea);
      }
    }
    if (tk.tipo === 'ident'){ this.avanzar(); return nodo('Ident', { nombre: tk.valor }, tk.linea); }
    if (tk.valor === '['){
      const linea = this.avanzar().linea;
      const elementos = [];
      while (this.mira().valor !== ']'){
        elementos.push(this.expresion());
        if (this.mira().valor === ',') this.avanzar();
      }
      this.esperar('punct', ']');
      return nodo('Lista', { elementos }, linea);
    }
    if (tk.valor === '('){
      this.avanzar();
      const e = this.expresion();
      this.esperar('punct', ')');
      return e;
    }
    throw new ErrorMotor(Categorias.SYNTAX, `Expresión inesperada «${tk.valor ?? tk.tipo}»`, tk.linea);
  }
}

/** @param {string} fuente @returns AST Programa */
export function parse(fuente){
  return new Parser(tokenizar(fuente)).programa();
}