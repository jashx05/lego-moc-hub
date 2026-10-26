import crypto from 'node:crypto';
import {reply,allowed,checkMutation,sql,execSql,batch,requireUser,validateId,safeError} from './_lib/core.js';
export default async function handler(req,res){try{if(!allowed(req,res,['POST']))return;if(!checkMutation(req,res))return;const user=await requireUser(req,res);if(!user)return;const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};if(!validateId(b.projectId))return reply(res,400,{error:'Progetto non valido'});
 const project=await sql('SELECT id FROM projects WHERE id=? AND owner_id=?',[b.projectId,user.id]);if(!project.length)return reply(res,404,{error:'Progetto inesistente'});
 let versionNo=Number(b.versionNumber||1);if(!Number.isInteger(versionNo)||versionNo<1||versionNo>1000000)return reply(res,400,{error:'Numero versione errato'});
 const prev=await sql('SELECT id FROM project_versions WHERE project_id=? AND version_number=?',[b.projectId,versionNo]);if(prev.length)return reply(res,200,{id:prev[0].id,existing:true});
 const parts=Array.isArray(b.parts)?b.parts:[],steps=Array.isArray(b.steps)?b.steps:[];if(parts.length>3000||steps.length>5000)return reply(res,413,{error:'Inventario troppo grande'});
 const id=crypto.randomUUID();let statements=[{sql:'INSERT INTO project_versions(id,project_id,version_number,version_label,notes,parts_total,steps_total) VALUES(?,?,?,?,?,?,?)',args:[id,b.projectId,versionNo,String(b.label||'').slice(0,80),String(b.notes||'').slice(0,500),Number(b.partsTotal)||0,Number(b.stepsTotal)||0]}];
 for(const part of parts){const code=String(part.id||part.part_code||'').slice(0,80),color=Number(part.color??part.color_id),qty=Number(part.qty??part.quantity);if(!/^[\w.\-/]{1,80}$/.test(code)||!Number.isInteger(color)||!Number.isInteger(qty)||qty<1)return reply(res,400,{error:'Inventario non valido'});statements.push({sql:'INSERT INTO version_parts(version_id,part_code,color_id,quantity) VALUES(?,?,?,?)',args:[id,code,color,qty]})}
 for(let i=0;i<steps.length;i++){const count=Number(steps[i].count??steps[i].added_count??0);if(!Number.isInteger(count)||count<0)return reply(res,400,{error:'Passaggio non valido'});statements.push({sql:'INSERT INTO build_steps(version_id,step_number,added_count) VALUES(?,?,?)',args:[id,i+1,count]})}
 // one Turso pipeline keeps the inserts in order; avoid issuing one remote request per part
 await batch(statements);return reply(res,201,{id,existing:false});
}catch(e){safeError(res,e)}}
