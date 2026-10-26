import {get} from '@vercel/blob';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {reply,allowed,ready,sql,userFrom,safeError,validateId} from './_lib/core.js';

export default async function handler(req,res){
 try{
  if(!allowed(req,res,['GET']))return;
  if(!ready())return reply(res,503,{error:'Archivio non configurato'});
  const id=String(req.query.id||'');if(!validateId(id))return reply(res,400,{error:'File non valido'});
  const user=await userFrom(req);
  const found=await sql(`SELECT f.blob_path,f.file_name,f.mime_type,f.file_size FROM project_files f
   JOIN projects p ON p.id=f.project_id WHERE f.id=? AND (p.is_public=1 OR p.owner_id=? OR ?='owner') LIMIT 1`,
   [id,user?.id||'',user?.role||'']);
  // No private metadata leaked, and checking the project is mandatory before calling Blob.
  if(!found.length)return reply(res,404,{error:'File non trovato'});
  const row=found[0],file=await get(row.blob_path,{access:'private'});
  if(!file||file.statusCode!==200||!file.stream)return reply(res,404,{error:'File non presente in Blob'});
  res.setHeader('Content-Type',row.mime_type||'application/octet-stream');
  res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  await pipeline(Readable.fromWeb(file.stream),res);
 }catch(e){safeError(res,e)}
}
