// ═══════════════════════════════════════════════════════════
// sistema/rango.js — rango final del Arquitecto según sus estrellas.
// Lo usan la pantalla de cierre y el Monumento de la Plaza de Cristales.
// ═══════════════════════════════════════════════════════════
import { TEXTOS } from '../../datos/textos.js';
import { NIVELES } from '../../datos/niveles.js';
import { progreso } from './progreso.js';

/**
 * @returns {{rango:{id:string,nombre:string,texto:string,desde:number}, estrellas:number, maxEstrellas:number}}
 */
export function rangoFinal(){
  const maxEstrellas = NIVELES.length * 3;
  const estrellas = progreso.totalEstrellas();
  const rangos = TEXTOS.cierre.rangos;
  const rango = [...rangos].reverse().find(r => estrellas / maxEstrellas >= r.desde) ?? rangos[0];
  return { rango, estrellas, maxEstrellas };
}