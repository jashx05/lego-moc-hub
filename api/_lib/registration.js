import {digest,sql,execSql} from './core.js';

// Basic request throttling on the server, without depending on a client-supplied account ID.
// Email verification and additional bot defenses remain a prerequisite for a wide public launch.
export async function allowRegistration(req){
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,100);
 const key='signup:'+digest(ip);
 const rows=await sql('SELECT failures,locked_until,updated_at FROM login_attempts WHERE id=?',[key]);
 const row=rows[0];const now=Date.now();
 if(row?.locked_until && Date.parse(row.locked_until)>now)return false;
 const updated=Date.parse(String(row?.updated_at||'').replace(' ','T')+'Z');
 const recent=Number.isFinite(updated)&&now-updated<3600000;
 const failures=recent?Number(row?.failures||0):0;
 if(failures>=4)return false;
 const count=failures+1,locked=count>=4?new Date(now+3600000).toISOString():null;
 await execSql(`INSERT INTO login_attempts(id,failures,locked_until,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
 ON CONFLICT(id) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until,updated_at=CURRENT_TIMESTAMP`,[key,count,locked]);
 return true;
}
