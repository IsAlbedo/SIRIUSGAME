// ═══════════════════════════════════════════════════════════
// mundo/liberar.js — libera geometría, material y textura de
// un Group de elementos dinámicos. Evita fugas entre sub-retos.
// ═══════════════════════════════════════════════════════════
export function liberarGrupo(grupo){
  while (grupo.children.length){
    const hijo = grupo.children.pop();
    liberar(hijo);
  }
}
function liberar(obj){
  if (!obj) return;
  if (obj.children?.length) while (obj.children.length) liberar(obj.children.pop());
  if (obj.geometry?.dispose) obj.geometry.dispose();
  if (obj.material){
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats){
      if (m.map?.dispose) m.map.dispose();
      if (m.emissiveMap?.dispose) m.emissiveMap.dispose();
      if (m.dispose) m.dispose();
    }
  }
}