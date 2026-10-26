import crypto from 'node:crypto';
import {del} from '@vercel/blob';
import {reply,allowed,checkMutation,sql,execSql,batch,requireUser,validateId,safeError} from './_lib/core.js';

function validVisibility(b) { return b && typeof b.isPublic === 'boolean'; }
export default async function handler(req,res){
 try {
  if(!allowed(req,res,['GET','POST','PATCH','DELETE']))return;
  const user=await requireUser(req,res);if(!user)return;
  const admin=user.role==='owner';
  if(req.method==='GET'){
   // Owners administer visibility across every account; ordinary members manage only their own projects.
   const selector=admin?'1=1':'p.owner_id=?';const args=admin?[]:[user.id];
   const p=await sql(`SELECT p.id,p.owner_id,u.email AS author,p.title,p.description,p.category,p.status,p.is_public,p.favorite,p.created_at,p.updated_at FROM projects p JOIN users u ON u.id=p.owner_id WHERE ${selector} ORDER BY p.updated_at DESC LIMIT 300`,args);
   const v=await sql(`SELECT v.id,v.project_id,v.version_number,v.version_label,v.parts_total,v.steps_total,v.created_at FROM project_versions v JOIN projects p ON p.id=v.project_id WHERE ${selector} ORDER BY v.created_at DESC LIMIT 1000`,args);
   const f=await sql(`SELECT f.id,f.project_id,f.version_id,f.file_name,f.mime_type,f.file_size,f.file_role,f.created_at FROM project_files f JOIN projects p ON p.id=f.project_id WHERE ${selector} ORDER BY f.created_at DESC LIMIT 1500`,args);
   return reply(res,200,{projects:p,versions:v,files:f,role:user.role});
  }
  if(!checkMutation(req,res))return;
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(req.method==='DELETE'){
   const id=String(req.query?.id||'');
   if(!validateId(id))return reply(res,400,{error:'Identificativo progetto non valido'});
   // Auth is enforced before any file deletion; members can delete only their own projects.
   const matches=await sql("SELECT id,owner_id FROM projects WHERE id=? AND (owner_id=? OR ?='owner') LIMIT 1",[id,user.id,user.role]);
   if(!matches.length)return reply(res,404,{error:'Progetto non trovato o accesso negato'});
   const fileRows=await sql('SELECT blob_path FROM project_files WHERE project_id=?',[id]);
   const paths=[...new Set(fileRows.map(f=>f.blob_path).filter(Boolean))];
   // Keep SQL rows intact if private Blob deletion fails; users can safely retry.
   for(let i=0;i<paths.length;i+=25)await del(paths.slice(i,i+25));
   await batch([
    {sql:'DELETE FROM version_parts WHERE version_id IN (SELECT id FROM project_versions WHERE project_id=?)',args:[id]},
    {sql:'DELETE FROM build_steps WHERE version_id IN (SELECT id FROM project_versions WHERE project_id=?)',args:[id]},
    {sql:'DELETE FROM project_files WHERE project_id=?',args:[id]},
    {sql:'DELETE FROM project_versions WHERE project_id=?',args:[id]},
    {sql:"DELETE FROM projects WHERE id=? AND (owner_id=? OR ?='owner')",args:[id,user.id,user.role]}
   ]);
   return reply(res,200,{deleted:true,id,filesRemoved:paths.length});
  }
  if(req.method==='PATCH'){
   // Changing visibility, even on another member's project, is reserved exclusively to the owner.
   if(!admin)return reply(res,403,{error:'Solo il proprietario del sito può cambiare la visibilità'});
   if(!validateId(b.projectId)||!validVisibility(b))return reply(res,400,{error:'Identificativo o flag pubblico non valido'});
   const exists=await sql('SELECT id FROM projects WHERE id=?',[b.projectId]);
   if(!exists.length)return reply(res,404,{error:'Progetto non trovato'});
   await execSql('UPDATE projects SET is_public=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[b.isPublic?1:0,b.projectId]);
   return reply(res,200,{id:b.projectId,isPublic:b.isPublic});
  }
  if(typeof b.title!=='string'||!b.title.trim()||b.title.length>180)return reply(res,400,{error:'Titolo non valido'});
  const id=validateId(b.id)?String(b.id):crypto.randomUUID();
  const exists=await sql('SELECT id FROM projects WHERE id=? AND owner_id=?',[id,user.id]);
  if(exists.length){
   await execSql('UPDATE projects SET title=?,description=?,category=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?',[
    b.title.trim(),String(b.description||'').slice(0,3000),String(b.category||'Altro').slice(0,80),String(b.status||'In corso').slice(0,60),id,user.id]);
   return reply(res,200,{id,existing:true});
  }
  const collision=await sql('SELECT id FROM projects WHERE id=?',[id]);
  if(collision.length)return reply(res,409,{error:'ID già utilizzato da un altro utente'});
  // New projects always start PUBLIC, even when a non-owner sends a fake isPublic=false.
  await execSql('INSERT INTO projects(id,owner_id,title,description,category,status,is_public) VALUES(?,?,?,?,?,?,1)',[
   id,user.id,b.title.trim(),String(b.description||'').slice(0,3000),String(b.category||'Altro').slice(0,80),String(b.status||'In corso').slice(0,60)]);
  return reply(res,201,{id,existing:false,isPublic:true});
 }catch(e){safeError(res,e)}
}
