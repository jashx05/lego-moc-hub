import crypto from 'node:crypto';
import {reply,allowed,checkMutation,ready,sql,execSql,emailOf,hashPassword,checkPassword,issueSession,userFrom,cookies,cookieName,digest,putCookie,safeError} from './_lib/core.js';
const LIMIT=5,WINDOW=15*60000;
export default async function handler(req,res){try{const action=String(req.query?.action||'me');if(!ready())return reply(res,503,{error:'Cloud non ancora configurato'});
 if(action==='me'){if(!allowed(req,res,['GET']))return;const user=await userFrom(req);const n=await sql('SELECT COUNT(*) AS n FROM users');return reply(res,200,{authenticated:!!user,user,setupRequired:Number(n[0]?.n||0)===0,cloudConfigured:true,version:'V11'});}
 if(!allowed(req,res,['POST'])||!checkMutation(req,res))return;
 if(action==='logout'){const token=cookies(req)[cookieName()];if(token)await execSql('DELETE FROM user_sessions WHERE token_hash=?',[digest(token)]);putCookie(res,'',0);return reply(res,200,{ok:true})}
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};const email=emailOf(body.email),password=body.password;
 if(!email||typeof password!=='string'||password.length<12||password.length>256)return reply(res,400,{error:'Inserisci un’email valida e una password di almeno 12 caratteri'});
 if(action==='setup'){
  const count=await sql('SELECT COUNT(*) AS n FROM users');if(Number(count[0].n)!==0)return reply(res,403,{error:'Registrazione iniziale già completata'});
  const secret=process.env.MOC_HUB_SETUP_KEY||'';if(secret.length<24||typeof body.setupCode!=='string')return reply(res,503,{error:'Codice di attivazione non disponibile'});
  const x=Buffer.from(crypto.createHash('sha256').update(body.setupCode).digest()),y=Buffer.from(crypto.createHash('sha256').update(secret).digest());if(!crypto.timingSafeEqual(x,y))return reply(res,403,{error:'Codice di attivazione non valido'});
  const pw=await hashPassword(password),id=crypto.randomUUID();await execSql('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)',[id,email,pw,'owner']);await issueSession(id,res);return reply(res,201,{ok:true,user:{id,email,role:'owner'}});
 }
 if(action==='login'){
  const key=digest(email),history=(await sql('SELECT failures,locked_until FROM login_attempts WHERE id=?',[key]))[0];if(history?.locked_until && history.locked_until>new Date().toISOString())return reply(res,429,{error:'Troppi tentativi. Riprova tra 15 minuti.'});
  const found=(await sql('SELECT id,email,password_hash,role FROM users WHERE email=?',[email]))[0];const ok=found?await checkPassword(password,found.password_hash):await checkPassword(password,process.env.MOC_DUMMY_HASH||'scrypt:16384:00000000000000000000000000000000:'+'0'.repeat(128));
  if(!found||!ok){const fails=(Number(history?.failures||0)+1),locked=fails>=LIMIT?new Date(Date.now()+WINDOW).toISOString():null;await execSql('INSERT INTO login_attempts(id,failures,locked_until,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until,updated_at=CURRENT_TIMESTAMP',[key,fails,locked]);return reply(res,401,{error:'Email o password non validi'})}
  await execSql('DELETE FROM login_attempts WHERE id=?',[key]);await issueSession(found.id,res);return reply(res,200,{ok:true,user:{id:found.id,email:found.email,role:found.role}});
 }
 return reply(res,404,{error:'Operazione non riconosciuta'});
}catch(e){safeError(res,e)}}
