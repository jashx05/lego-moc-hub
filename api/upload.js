import crypto from 'node:crypto';
import {put,del} from '@vercel/blob';
import {reply,allowed,checkMutation,sql,execSql,requireUser,validateId,safeError} from './_lib/core.js';
const CAP=4*1024*1024; // Vercel Function hard limit 4.5 MB
export default async function handler(req,res){try{if(!allowed(req,res,['POST']))return;if(!checkMutation(req,res))return;const user=await requireUser(req,res);if(!user)return;
 const projectId=String(req.query.projectId||''),versionId=String(req.query.versionId||'');if(!validateId(projectId)||!validateId(versionId))return reply(res,400,{error:'Identificativi non validi'});const permitted=await sql('SELECT v.id FROM project_versions v JOIN projects p ON p.id=v.project_id WHERE v.id=? AND p.id=? AND p.owner_id=?',[versionId,projectId,user.id]);if(!permitted.length)return reply(res,403,{error:'Accesso al progetto negato'});
 const rawName=String(req.headers['x-file-name']||'file.ldr');const name=rawName.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,128);if(!/\.(ldr|mpd|io|zip|png|jpg|jpeg|webp|pdf|csv|xml|md)$/i.test(name))return reply(res,400,{error:'Formato file non supportato'});
 const expected=Number(req.headers['content-length']||0);if(expected>CAP)return reply(res,413,{error:'Questo file supera 4 MB. Mantienilo nel catalogo locale: non è stato sincronizzato.'});let chunks=[],n=0;const raw=Buffer.isBuffer(req.body)?req.body:Buffer.isBuffer(req.rawBody)?req.rawBody:null;if(raw){n=raw.length;chunks=[raw]}else{for await(const chunk of req){n+=chunk.length;if(n>CAP)return reply(res,413,{error:'File oltre il limite di 4 MB'});chunks.push(chunk)}}if(n>CAP)return reply(res,413,{error:'File oltre il limite di 4 MB'});if(!n)return reply(res,400,{error:'File vuoto'});
 const duplicate=await sql('SELECT id FROM project_files WHERE version_id=? AND file_name=?',[versionId,name]);if(duplicate.length)return reply(res,200,{id:duplicate[0].id,existing:true});
 const id=crypto.randomUUID(),path=`users/${user.id}/projects/${projectId}/versions/${versionId}/${id}/${name}`,mime=String(req.headers['content-type']||'application/octet-stream').slice(0,100);const blob=await put(path,Buffer.concat(chunks),{access:'private',contentType:mime,addRandomSuffix:false});
 try{await execSql('INSERT INTO project_files(id,project_id,version_id,file_name,blob_path,mime_type,file_size,file_role) VALUES(?,?,?,?,?,?,?,?)',[id,projectId,versionId,name,blob.pathname,mime,n,'attachment'])}catch(err){await del(blob.pathname).catch(()=>{});throw err}
 return reply(res,201,{id,fileName:name,size:n});
}catch(e){safeError(res,e)}}
