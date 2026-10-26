import test from 'node:test';
import assert from 'node:assert/strict';
import projectsHandler from '../api/projects.js';
import galleryHandler from '../api/gallery.js';
import fs from 'node:fs';
import authHandler from '../api/auth.js';

function mockResponse(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body},write(x){this.chunks=(this.chunks||[]).concat(x)}}}
function request(method='GET',opts={}){return {method,query:opts.query||{},body:opts.body||{},headers:{host:'preview.vercel.app', ...(method!=='GET'?{'x-moc-request':'1'}:{}),...(opts.auth?{'cookie':'__Host-moc_session='+'x'.repeat(43)}:{}),...opts.headers}}}
// Stub only the Turso SQL pipeline; never contact the user's actual database in tests.
async function withSql(role,fn){const old=global.fetch,env={url:process.env.TURSO_DATABASE_URL,token:process.env.TURSO_AUTH_TOKEN,blob:process.env.BLOB_READ_WRITE_TOKEN};
 process.env.TURSO_DATABASE_URL='libsql://fixture.turso.io';process.env.TURSO_AUTH_TOKEN='example-token';process.env.BLOB_READ_WRITE_TOKEN='example-blob-token';
 const statements=[];
 global.fetch=async(url,init)=>{assert.match(url,/fixture\.turso\.io/);const input=JSON.parse(init.body);return {ok:true,json:async()=>({results:input.requests.map(r=>{
  if(r.type==='close')return {type:'ok'};const q=r.stmt.sql;statements.push({q,args:r.stmt.args.map(x=>x.value)});
  let rows=[],cols=[];
  if(q.includes('FROM user_sessions')){cols=['id','email','role'];rows=[[{type:'text',value:'user123'},{type:'text',value:'test@example.test'},{type:'text',value:role}]];}
  else if(q.includes('FROM projects WHERE id=? AND owner_id=?')){cols=['id'];rows=[];}
  else if(q.includes('SELECT id,owner_id FROM projects WHERE id=?')){cols=['id'];rows=role==='owner'?[[{type:'text',value:'found'}]]:[];}
  else if(q.includes('FROM projects WHERE id=?')){cols=['id'];rows=(r.stmt.args?.[0]?.value==='11111111-1111-1111-1111-111111111111')?[[{type:'text',value:'found'}]]:[];}
  else if(q.includes('FROM users')&&q.includes('COUNT(')){cols=['n'];rows=[[{type:'integer',value:'1'}]];}
  return {type:'ok',response:{result:{cols:cols.map(name=>({name})),rows,affected_row_count:1}}};
 })})};};
 try{return await fn(statements)}finally{global.fetch=old;for(const [k,v] of Object.entries({TURSO_DATABASE_URL:env.url,TURSO_AUTH_TOKEN:env.token,BLOB_READ_WRITE_TOKEN:env.blob})){if(v===undefined)delete process.env[k];else process.env[k]=v}}
}
test('visitors can read public gallery without session; SQL filters private projects',async()=>withSql('member',async log=>{
 const res=mockResponse();await galleryHandler(request(),res);
 assert.equal(res.statusCode,200);assert.ok(log.filter(x=>/FROM projects|JOIN projects/.test(x.q)).every(x=>x.q.includes('p.is_public=1')));
}));
test('member cannot change visibility through PATCH',async()=>withSql('member',async log=>{
 const res=mockResponse();await projectsHandler(request('PATCH',{auth:true,body:{projectId:'11111111-1111-1111-1111-111111111111',isPublic:false}}),res);
 assert.equal(res.statusCode,403);assert.ok(!log.some(x=>x.q.startsWith('UPDATE projects')));
}));
test('owner can change any project visibility',async()=>withSql('owner',async log=>{
 const res=mockResponse();await projectsHandler(request('PATCH',{auth:true,body:{projectId:'11111111-1111-1111-1111-111111111111',isPublic:false}}),res);
 assert.equal(res.statusCode,200);assert.ok(log.some(x=>x.q.includes('SET is_public=?')&&x.args[0]==='0'));
}));
test('new member project is public even if malicious client requests private',async()=>withSql('member',async log=>{
 const res=mockResponse();await projectsHandler(request('POST',{auth:true,body:{title:'New MOC',isPublic:false}}),res);
 assert.equal(res.statusCode,201);assert.ok(log.some(x=>x.q.includes('INSERT INTO projects')&&x.q.includes('1)')));
}));
test('private Blob files require visibility check before download',()=>{
 const s=fs.readFileSync(new URL('../api/files.js', import.meta.url),'utf8');
 assert.match(s,/p\.is_public=1 OR p\.owner_id=\?/);
 assert.ok(s.indexOf('if(!found.length)') < s.indexOf('get(row.blob_path'));
});
test('registration endpoint is present and ensures role member',async()=>withSql('member',async log=>{
 const res=mockResponse();await authHandler(request('POST',{query:{action:'register'},body:{email:'friend@example.test',password:'A safe password 2026!'}}),res);
 assert.equal(res.statusCode,201);assert.ok(log.some(x=>x.q.includes('INSERT INTO users')&&x.args.includes('member')));
}));

test("member cannot delete another person's project or its Blob files",async()=>withSql('member',async log=>{
 const res=mockResponse();await projectsHandler(request('DELETE',{auth:true,query:{id:'11111111-1111-1111-1111-111111111111'}}),res);
 assert.equal(res.statusCode,404);assert.ok(!log.some(x=>x.q.startsWith('DELETE')));
}));
test('owner deletion removes all dependent SQL rows with project scope',async()=>withSql('owner',async log=>{
 const id='11111111-1111-1111-1111-111111111111';const res=mockResponse();
 await projectsHandler(request('DELETE',{auth:true,query:{id}}),res);
 assert.equal(res.statusCode,200);const deletes=log.filter(x=>x.q.startsWith('DELETE'));
 assert.equal(deletes.length,5);assert.ok(deletes.every(x=>x.args.includes(id)));
 assert.match(deletes.at(-1).q,/owner_id/);
}));
test('download handler uses private Blob Web stream, not an invalid stream() call',()=>{
 const source=fs.readFileSync(new URL('../api/files.js', import.meta.url),'utf8');
 assert.match(source,/Readable.fromWeb\(file.stream\)/);
 assert.doesNotMatch(source,/file\.stream\(\)/);
 assert.match(source,/JOIN projects p/);
});
test('cloud and local delete buttons require explicit confirmation',()=>{
 const ui=fs.readFileSync(new URL('../public/cloud.js', import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
 assert.match(ui,/data-cloud-delete/);assert.match(ui,/confirm\(/);
 assert.match(html,/data-local-delete/);assert.match(html,/confirm\(/);
});
