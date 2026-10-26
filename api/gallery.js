import {reply,allowed,ready,sql,safeError} from './_lib/core.js';

// Public browsing requires no login; private projects and their file IDs never leave the backend.
export default async function handler(req,res){
 try{
  if(!allowed(req,res,['GET']))return;
  if(!ready())return reply(res,503,{error:'Galleria non disponibile'});
  const projects=await sql(`SELECT p.id,p.title,p.description,p.category,p.status,p.updated_at,p.is_public,CASE WHEN u.role='owner' THEN 'Amministratore' ELSE 'Membro' END AS author,
   (SELECT MAX(v.parts_total) FROM project_versions v WHERE v.project_id=p.id) AS parts_total
   FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.is_public=1 ORDER BY p.updated_at DESC LIMIT 200`);
  const versions=await sql(`SELECT v.id,v.project_id,v.version_number,v.version_label,v.parts_total,v.steps_total,v.created_at
   FROM project_versions v JOIN projects p ON p.id=v.project_id WHERE p.is_public=1 ORDER BY v.version_number DESC LIMIT 1000`);
  const files=await sql(`SELECT f.id,f.project_id,f.version_id,f.file_name,f.mime_type,f.file_size,f.file_role
   FROM project_files f JOIN projects p ON p.id=f.project_id WHERE p.is_public=1 ORDER BY f.created_at DESC LIMIT 1200`);
  return reply(res,200,{projects,versions,files});
 }catch(e){safeError(res,e)}
}
