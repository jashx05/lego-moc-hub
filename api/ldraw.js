import {canonicalGeometryPath,geometryUrl} from './_lib/ldraw-path.js';

const MAX_BYTES=1024*1024;
// Public geometry files only; no user files, database credentials or Blob content are exposed.
export default async function handler(req,res) {
 res.setHeader('X-Content-Type-Options','nosniff');
 if (req.method !== 'GET') {
  res.setHeader('Allow','GET');res.statusCode=405;return res.end('Metodo non consentito');
 }
 const path=canonicalGeometryPath(req.query?.path);
 if(!path){res.statusCode=400;return res.end('Percorso LDraw non valido')}
 const sources=['raw','cdn'];let lastStatus=502;
 for(const source of sources){
  try {
   const upstream=await fetch(geometryUrl(path,source),{
    headers:{Accept:'text/plain'},signal:AbortSignal.timeout(9000)
   });
   if(upstream.status===404){res.statusCode=404;return res.end('Geometria non trovata nella libreria LDraw')}
   if(!upstream.ok){lastStatus=upstream.status;continue}
   const length=Number(upstream.headers.get('content-length')||0);
   if(length>MAX_BYTES){res.statusCode=413;return res.end('Geometria eccessivamente grande')}
   const bytes=Buffer.from(await upstream.arrayBuffer());
   if(bytes.length>MAX_BYTES){res.statusCode=413;return res.end('Geometria eccessivamente grande')}
   res.statusCode=200;
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   res.setHeader('Cache-Control','public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400');
   res.setHeader('X-LDraw-Source',source);
   return res.end(bytes);
  }catch{lastStatus=502}
 }
 res.statusCode=502;res.setHeader('Cache-Control','no-store');
 return res.end('La libreria LDraw non risponde ('+lastStatus+')');
}
