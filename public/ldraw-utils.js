/* Pure LDraw model helpers; no CDN or DOM dependency. */
export function canonicalPartName(raw) {
  const name=String(raw||'').trim().replace(/\\/g,'/').toLowerCase();
  if(!/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.dat$/.test(name) || name.includes('..')) throw new Error('Riferimento pezzo LDraw non valido: '+name);
  return name;
}
export function serializeModel(parts) {
  if(!Array.isArray(parts) || !parts.length) throw new Error('Modello LDraw vuoto');
  const lines=['0 LEGO MOC Hub | LDraw source-based mesh rendering'];
  for(const p of parts){
    const coord=[p.x,p.y,p.z];const r=p.rotation;
    if(!Array.isArray(r)||r.length!==9||!coord.concat(r).every(Number.isFinite)) throw new Error('Coordinate/rotazioni non valide');
    const col=String(p.color??'16');
    if(!/^(?:\d+|0x2[0-9a-fA-F]{6})$/.test(col)) throw new Error('Colore LDraw non valido');
    lines.push(`1 ${col} ${coord.join(' ')} ${r.join(' ')} ${canonicalPartName(p.id)}`);
  }
  return lines.join('\n')+'\n';
}
export function countByPart(parts) {
  const result=new Map();for(const p of parts){const id=canonicalPartName(p.id);result.set(id,(result.get(id)||0)+1)}return result;
}
