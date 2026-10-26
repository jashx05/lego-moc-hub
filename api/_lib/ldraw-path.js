/* Only fixed, publicly licensed LDraw geometry. Never allow arbitrary upstream URLs. */
export const LDRAW_COMMIT = 'f3d0c2256398c28fbb682f4bb08c59eed81fd4f1';
export function canonicalGeometryPath(input) {
 if (typeof input !== 'string' || input.length > 160) return null;
 if (input === 'LDConfig.ldr') return input;
 const path = input.toLowerCase();
 if (path.includes('..') || !/^(?:parts|p|models)\/(?:[a-z0-9_-]+\/){0,5}[a-z0-9_.-]+\.(?:dat|ldr|mpd)$/.test(path)) return null;
 return path;
}
export function geometryUrl(path, origin='raw') {
 if (!canonicalGeometryPath(path)) throw new Error('Percorso LDraw non valido');
 const base = origin === 'cdn'
  ? 'https://cdn.jsdelivr.net/gh/kulits/ldraw-parts@'+LDRAW_COMMIT+'/ldraw/'
  : 'https://raw.githubusercontent.com/kulits/ldraw-parts/'+LDRAW_COMMIT+'/ldraw/';
 return base+path.split('/').map(encodeURIComponent).join('/');
}
