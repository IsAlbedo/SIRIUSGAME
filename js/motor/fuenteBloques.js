// ═══════════════════════════════════════════════════════════
// motor/fuenteBloques.js — workspace Blockly → MISMO AST.
// También: descriptor → XML (para el programa corrupto del jefe).
// ═══════════════════════════════════════════════════════════
import { nodo } from './ast.js';
import { ErrorMotor, Categorias } from './errores.js';

const OP_CMP = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
const OP_MAT = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', MODULO: '%' };
const nombreVar = (b, id) => b.workspace?.getVariableById?.(id)?.name ?? id;

let lineaSeq = 0;

/** @param {Object} workspace — Blockly.Workspace */
export function bloquesAAST(workspace){
  lineaSeq = 0;
  const cuerpo = [];
  for (const top of workspace.getTopBlocks(true)){
    if (top.isInsertionMarker?.()) continue;
    apilar(top, cuerpo);
  }
  return nodo('Programa', { cuerpo });
}

function apilar(bloque, salida){
  let b = bloque;
  while (b){
    salida.push(bloqueANodo(b));
    b = b.getNextBlock();
  }
}

function valor(b, entrada, requerido = true, msg = ''){
  const v = b.getInputTargetBlock(entrada);
  if (!v){
    if (requerido) throw new ErrorMotor(Categorias.SYNTAX, msg || `Falta un valor en el bloque`, lineaSeq, b.id);
    return nodo('Literal', { valor: null, tipoDato: 'nulo' }, ++lineaSeq, b.id);
  }
  return exprANodo(v);
}

function bloqueANodo(b){
  const L = () => ++lineaSeq;
  const llamar = (nombre, args = []) =>
    nodo('Llamar', { callee: nodo('Ident', { nombre }, L(), b.id), args }, L(), b.id);
  switch (b.type){
    case 'mover_adelante': return llamar('moverAdelante');
    case 'girar': return llamar('girar', [nodo('Literal', { valor: b.getFieldValue('DIR'), tipoDato: 'texto' }, L(), b.id)]);
    case 'recolectar': return llamar('recolectar');
    case 'mostrar_valor': return llamar('mostrar', [valor(b, 'VALOR')]);
    case 'abrir_puerta': return llamar('abrirPuerta', [valor(b, 'CODIGO', true, 'abrir_puerta necesita un código')]);
    case 'variables_set':
      return nodo('Asignar', {
        objetivo: nodo('Ident', { nombre: nombreVar(b, b.getFieldValue('VAR')) }, L(), b.id),
        valor: valor(b, 'VALUE'), autoDeclarar: true,
      }, L(), b.id);
    case 'controls_if': {
      const cond = valor(b, 'IF0', true, 'Al bloque «si» le falta la condición (¡Error de Sintaxis!)');
      const ent = []; apilar(b.getInputTargetBlock('DO0') ?? null, ent);
      let sino = null;
      const elseBlock = b.getInputTargetBlock('ELSE');
      if (elseBlock){ sino = []; apilar(elseBlock, sino); sino = sino.length === 1 ? sino[0] : nodo('Bloque', { sentencias: sino }, L(), b.id); }
      return nodo('Si', { cond, ent: nodo('Bloque', { sentencias: ent }, L(), b.id), sino }, L(), b.id);
    }
    case 'controls_repeat_ext': {
      const veces = valor(b, 'TIMES');
      const cuerpo = []; apilar(b.getInputTargetBlock('DO'), cuerpo);
      const i = `_i${b.id.replace(/[^a-zA-Z0-9]/g, '')}`;
      return nodo('Para', {
        init: nodo('DeclVar', { nombre: i, tipoDato: 'num', valor: nodo('Literal', { valor: 0, tipoDato: 'num' }) }, L(), b.id),
        cond: nodo('Binaria', { op: '<', izq: nodo('Ident', { nombre: i }), der: veces }, L(), b.id),
        paso: nodo('Asignar', { objetivo: nodo('Ident', { nombre: i }), valor: nodo('Binaria', { op: '+', izq: nodo('Ident', { nombre: i }), der: nodo('Literal', { valor: 1, tipoDato: 'num' }) }) }, L(), b.id),
        cuerpo: nodo('Bloque', { sentencias: cuerpo }, L(), b.id),
      }, L(), b.id);
    }
    case 'controls_for': {
      const nombre = nombreVar(b, b.getFieldValue('VAR'));
      const desde = valor(b, 'FROM'), hasta = valor(b, 'TO');
      const cuerpo = []; apilar(b.getInputTargetBlock('DO'), cuerpo);
      return nodo('Para', {
        init: nodo('DeclVar', { nombre, tipoDato: 'num', valor: desde }, L(), b.id),
        cond: nodo('Binaria', { op: '<=', izq: nodo('Ident', { nombre }), der: hasta }, L(), b.id),
        paso: nodo('Asignar', { objetivo: nodo('Ident', { nombre }), valor: nodo('Binaria', { op: '+', izq: nodo('Ident', { nombre }), der: nodo('Literal', { valor: 1, tipoDato: 'num' }) }) }, L(), b.id),
        cuerpo: nodo('Bloque', { sentencias: cuerpo }, L(), b.id),
      }, L(), b.id);
    }
    case 'controls_whileUntil': {
      let cond = valor(b, 'BOOL');
      if (b.getFieldValue('MODE') === 'UNTIL') cond = nodo('Unaria', { op: '!', expr: cond }, L(), b.id);
      const cuerpo = []; apilar(b.getInputTargetBlock('DO'), cuerpo);
      return nodo('Mientras', { cond, cuerpo: nodo('Bloque', { sentencias: cuerpo }, L(), b.id) }, L(), b.id);
    }
    case 'switch_codigo': {
      const casos = [];
      for (let i = 1; i <= 3; i++){
        const cuerpo = []; apilar(b.getInputTargetBlock(`CASO${i}`), cuerpo);
        casos.push({ valor: nodo('Literal', { valor: i, tipoDato: 'num' }, L(), b.id), cuerpo });
      }
      return nodo('Switch', { expr: llamar('leerCodigo'), casos, porDefecto: null }, L(), b.id);
    }

    case 'colocar_bloque': {
      const alto = b.getInputTargetBlock('ALTO') ? valor(b, 'ALTO') : nodo('Literal', { valor: 1, tipoDato: 'num' }, L(), b.id);
      return llamar('colocarBloque', [alto]);
    }
    case 'poner_puerta': return llamar('ponerPuerta');
    case 'poner_ventana': return llamar('ponerVentana');
    case 'pedir_recursos': return llamar('pedirRecursos', [valor(b, 'CANTIDAD', true, 'pedirRecursos necesita una cantidad')]);
    case 'agregar_material': return llamar('agregarMaterial', [valor(b, 'NOMBRE', true, 'agregarMaterial necesita un nombre')]);
    case 'materiales': return llamar('materiales');

    case 'procedures_defnoreturn':
    case 'procedures_defreturn': {
      const nombre = b.getFieldValue('NAME');
      const params = (b.getVars ? b.getVars() : []).map(v => ({ nombre: v, tipo: null }));
      const cuerpo = []; apilar(b.getInputTargetBlock('STACK'), cuerpo);
      let retornoExpr = null;
      if (b.type === 'procedures_defreturn' && b.getInputTargetBlock('RETURN'))
        retornoExpr = valor(b, 'RETURN');
      return nodo('DeclFuncion', {
        nombre, retorno: null, retornoExpr, params,
        cuerpo: nodo('Bloque', { sentencias: cuerpo }, L(), b.id), visibilidad: null,
      }, L(), b.id);
    }





    case 'procedures_callnoreturn': return llamarProc(b);
    default:
      throw new ErrorMotor(Categorias.SYNTAX, `Bloque «${b.type}» no reconocido`, lineaSeq, b.id);
  }
}

function exprANodo(v){
  const L = () => ++lineaSeq;
  switch (v.type){
    case 'math_number': return nodo('Literal', { valor: Number(v.getFieldValue('NUM')), tipoDato: 'num' }, L(), v.id);
    case 'text': return nodo('Literal', { valor: v.getFieldValue('TEXT'), tipoDato: 'texto' }, L(), v.id);
    case 'logic_boolean': return nodo('Literal', { valor: v.getFieldValue('BOOL') === 'TRUE', tipoDato: 'bool' }, L(), v.id);
    case 'logic_compare': {
      const op = OP_CMP[v.getFieldValue('OP')];
      return nodo('Binaria', { op, izq: valor(v, 'A'), der: valor(v, 'B') }, L(), v.id);
    }
    case 'math_arithmetic': {
      const op = OP_MAT[v.getFieldValue('OP')];
      return nodo('Binaria', { op, izq: valor(v, 'A'), der: valor(v, 'B') }, L(), v.id);
    }
    case 'logic_negate': return nodo('Unaria', { op: '!', expr: valor(v, 'BOOL') }, L(), v.id);
    case 'leer_sensor': return nodo('Llamar', { callee: nodo('Ident', { nombre: 'leerSensor' }, L(), v.id), args: [] }, L(), v.id);
    case 'leer_panel': return nodo('Llamar', { callee: nodo('Ident', { nombre: 'leerPanel' }, L(), v.id), args: [] }, L(), v.id);
    case 'leer_codigo': return nodo('Llamar', { callee: nodo('Ident', { nombre: 'leerCodigo' }, L(), v.id), args: [] }, L(), v.id);
    case 'variables_get': return nodo('Ident', { nombre: nombreVar(v, v.getFieldValue('VAR')) }, L(), v.id);
    case 'procedures_callreturn': return llamarProc(v);
    default:
      throw new ErrorMotor(Categorias.SYNTAX, `Bloque de valor «${v.type}» no reconocido`, lineaSeq, v.id);
  }
}

function llamarProc(b){
  const nombre = b.getProcedureCall ? b.getProcedureCall() : (b.getFieldValue?.('NAME') ?? '');
  const args = [];
  for (let i = 0; i < 10; i++){
    const v = b.getInputTargetBlock('ARG' + i);
    if (!v) break;
    args.push(exprANodo(v));
  }
  return nodo('Llamar', { callee: nodo('Ident', { nombre }, ++lineaSeq, b.id), args }, ++lineaSeq, b.id);
}

/* ── descriptor → XML de Blockly (programa corrupto del jefe) ── */
function valorXml(d){
  if (!d) return '';
  switch (d.t){
    case 'lit':
      if (typeof d.v === 'number') return `<block type="math_number"><field name="NUM">${d.v}</field></block>`;
      if (typeof d.v === 'boolean') return `<block type="logic_boolean"><field name="BOOL">${d.v ? 'TRUE' : 'FALSE'}</field></block>`;
      return `<block type="text"><field name="TEXT">${d.v}</field></block>`;
    case 'sensor': return '<block type="leer_sensor"></block>';
    case 'panel': return '<block type="leer_panel"></block>';
    case 'codigo': return '<block type="leer_codigo"></block>';
    case 'var': return `<block type="variables_get"><field name="VAR">${d.nombre}</field></block>`;
    case 'cmp': {
      const opMap = { '==':'EQ', '!=':'NEQ', '<':'LT', '<=':'LTE', '>':'GT', '>=':'GTE' };
      return `<block type="logic_compare"><field name="OP">${opMap[d.op]}</field>
        <value name="A">${valorXml(d.a)}</value><value name="B">${valorXml(d.b)}</value></block>`;
    }
    case 'llamarExpr': {
      const mut = `<mutation name="${d.nombre}">${(d.args ?? []).map(() => '<arg name="_"></arg>').join('')}</mutation>`;
      const vals = (d.args ?? []).map((a, i) => `<value name="ARG${i}">${valorXml(a)}</value>`).join('');
      return `<block type="procedures_callreturn">${mut}${vals}</block>`;
    }
    default: return '';
  }
}
function stackXml(lista){
  let xml = '';
  for (let i = lista.length - 1; i >= 0; i--){
    const s = descXml(lista[i]);
    if (!s) continue;
    // mete la pila ya armada dentro de <next> del bloque actual
    xml = xml ? s.replace(/<\/block>\s*$/, `<next>${xml}</next></block>`) : s;
  }
  return xml;
}

function descXml(d){
  switch (d.t){
    case 'mover': return '<block type="mover_adelante"></block>';
    case 'girar': return `<block type="girar"><field name="DIR">${d.dir}</field></block>`;
    case 'recolectar': return '<block type="recolectar"></block>';
    case 'abrir': return `<block type="abrir_puerta">${d.valor ? `<value name="CODIGO">${valorXml(d.valor)}</value>` : ''}</block>`;
    case 'mostrar': return `<block type="mostrar_valor">${d.valor ? `<value name="VALOR">${valorXml(d.valor)}</value>` : ''}</block>`;
    case 'set': return `<block type="variables_set"><field name="VAR">${d.nombre}</field><value name="VALUE">${valorXml(d.valor)}</value></block>`;
    case 'si':
      return `<block type="controls_if"><value name="IF0">${valorXml(d.cond)}</value>
        <statement name="DO0">${stackXml(d.ent)}</statement>
        ${d.sino ? `<statement name="ELSE">${stackXml(d.sino)}</statement>` : ''}</block>`;
    case 'for':
      return `<block type="controls_repeat_ext"><value name="TIMES">${valorXml({ t:'lit', v:d.veces })}</value>
        <statement name="DO">${stackXml(d.cuerpo)}</statement></block>`;
    case 'while':
      return `<block type="controls_whileUntil"><field name="MODE">WHILE</field>
        <value name="BOOL">${valorXml(d.cond)}</value><statement name="DO">${stackXml(d.cuerpo)}</statement></block>`;
    case 'switch':
      return `<block type="switch_codigo">
        <statement name="CASO1">${stackXml(d.casos[0] ?? [])}</statement>
        <statement name="CASO2">${stackXml(d.casos[1] ?? [])}</statement>
        <statement name="CASO3">${stackXml(d.casos[2] ?? [])}</statement></block>`;

    case 'def': {
      const tipo = d.retorno ? 'procedures_defreturn' : 'procedures_defnoreturn';
      const mut = (d.params ?? []).map(p => `<arg name="${p}"></arg>`).join('');
      return `<block type="${tipo}"><field name="NAME">${d.nombre}</field><mutation>${mut}</mutation>
        <statement name="STACK">${stackXml(d.cuerpo)}</statement>
        ${d.retorno ? `<value name="RETURN">${valorXml(d.retorno)}</value>` : ''}</block>`;
    }
    case 'llamar': {
      const mut = `<mutation name="${d.nombre}">${(d.args ?? []).map(() => '<arg name="_"></arg>').join('')}</mutation>`;
      const vals = (d.args ?? []).map((a, i) => `<value name="ARG${i}">${valorXml(a)}</value>`).join('');
      return `<block type="procedures_callnoreturn">${mut}${vals}</block>`;
    }
    case 'bloque':
      return `<block type="colocar_bloque">${d.alto ? `<value name="ALTO">${valorXml({ t: 'lit', v: d.alto })}</value>` : ''}</block>`;
    case 'puertaPoner': return '<block type="poner_puerta"></block>';
    case 'ventanaPoner': return '<block type="poner_ventana"></block>';
    case 'recursos': return `<block type="pedir_recursos"><value name="CANTIDAD">${valorXml(d.valor)}</value></block>`;
    default: return '';
  }
}

/** @param {Object[]} descriptores @returns {string} XML <xml>…</xml> */
export function descriptorAXml(descriptores){
  return `<xml xmlns="https://developers.google.com/blockly/xml">${stackXml(descriptores)}</xml>`;
}