// motor/analizar.js — fase semántica previa a la ejecución.
import { ErrorMotor, Categorias } from './errores.js';

/** @returns {ErrorMotor[]} lista de problemas (vacía = ok) */
export function analizar(ast){
  const errores = [];
  const clases = new Map(), interfaces = new Map();
  for (const d of ast.cuerpo){
    if (d.tipo === 'DeclClase') clases.set(d.nombre, d);
    if (d.tipo === 'DeclInterfaz') interfaces.set(d.nombre, d);
  }
  for (const d of ast.cuerpo){
    if (d.tipo === 'DeclFuncion' && d.retorno && d.retorno !== 'void' && !tieneRetorno(d.cuerpo)){
      errores.push(new ErrorMotor(Categorias.MISSING_RETURN,
        `La función «${d.nombre}» promete devolver un valor pero no tiene return`, d.linea));
    }
    if (d.tipo !== 'DeclClase') continue;
    if (d.extiende){
      if (interfaces.has(d.extiende)){
        errores.push(new ErrorMotor(Categorias.INVALID_INHERITANCE,
          `«${d.nombre}» intenta extender la interfaz «${d.extiende}»; las interfaces se implementan, no se extienden`, d.linea));
      } else if (!clases.has(d.extiende)){
        errores.push(new ErrorMotor(Categorias.INVALID_INHERITANCE,
          `«${d.nombre}» extiende de «${d.extiende}», que no existe`, d.linea));
      }
    }
    for (const nombreItf of d.implementa){
      const itf = interfaces.get(nombreItf);
      if (!itf){
        errores.push(new ErrorMotor(Categorias.INVALID_INHERITANCE,
          `La interfaz «${nombreItf}» no existe`, d.linea));
        continue;
      }
      for (const firma of itf.metodos){
        const tiene = d.metodos.some(m => m.nombre === firma.nombre);
        if (!tiene){
          errores.push(new ErrorMotor(Categorias.INTERFACE_NOT_IMPLEMENTED,
            `«${d.nombre}» firma «${nombreItf}» pero no implementa ${firma.nombre}()`, d.linea));
        }
      }
    }
    for (const m of d.metodos){
      if (m.retorno && m.retorno !== 'void' && m.cuerpo && !tieneRetorno(m.cuerpo)){
        errores.push(new ErrorMotor(Categorias.MISSING_RETURN,
          `El método «${d.nombre}.${m.nombre}» no tiene return`, m.linea));
      }
    }
  }
  return errores;
}

function tieneRetorno(bloque){
  if (!bloque) return false;
  const recorrer = s => {
    if (!s) return false;
    switch (s.tipo){
      case 'Retornar': return true;
      case 'Bloque': return s.sentencias.some(recorrer);
      case 'Si': return recorrer(s.ent) || recorrer(s.sino);
      case 'Mientras': return recorrer(s.cuerpo);
      case 'Para': return recorrer(s.cuerpo);
      case 'Switch': return s.casos.some(c => c.cuerpo.some(recorrer)) || (s.porDefecto ?? []).some(recorrer);
      default: return false;
    }
  };
  return recorrer(bloque);
}