import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {hashPassword,checkPassword,digest,checkMutation,putCookie,ready,sql} from '../api/_lib/core.js';

test('password scrypt hash salted, verified, and rejects wrong password',async()=>{
 const h=await hashPassword('Long Random Password 2026!');assert.match(h,/^scrypt:16384:[a-f0-9]{32}:[a-f0-9]{128}$/);
 assert.equal(await checkPassword('Long Random Password 2026!',h),true);
 assert.equal(await checkPassword('incorrect password',h),false);
 assert.notEqual(await hashPassword('Long Random Password 2026!'),h);
});
test('session token is not plaintext',()=>{const k=crypto.randomBytes(32).toString('base64url');assert.notEqual(k,digest(k));const h={};const res={setHeader(k,v){h[k]=v}};putCookie(res,k,600);assert.match(h['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);});
test('CSRF rejects foreign origin and missing custom header',()=>{
 const result={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(b){this.body=b}};
 assert.equal(checkMutation({headers:{origin:'https://evil.test',host:'lego-moc-hub.vercel.app','x-moc-request':'1'}},result),false);
 assert.equal(result.statusCode,403);
 assert.equal(checkMutation({headers:{origin:'https://lego-moc-hub.vercel.app',host:'lego-moc-hub.vercel.app'}},result),false);
 assert.equal(checkMutation({headers:{origin:'https://lego-moc-hub.vercel.app',host:'lego-moc-hub.vercel.app','x-moc-request':'1'}},result),true);
});
test('Turso requests send parameterized statements and parse rows',async()=>{
 const old=globalThis.fetch;process.env.TURSO_DATABASE_URL='libsql://example.turso.io';process.env.TURSO_AUTH_TOKEN='fake';try{
 globalThis.fetch=async (u,o)=>{assert.equal(u,'https://example.turso.io/v2/pipeline');const x=JSON.parse(o.body);assert.equal(x.requests[0].stmt.sql,'SELECT ? AS number, ? AS title');assert.deepEqual(x.requests[0].stmt.args,[{type:'integer',value:'3'},{type:'text',value:'hello'}]);return {ok:true,json:async()=>({results:[{type:'ok',response:{result:{cols:[{name:'number'},{name:'title'}],rows:[[{type:'integer',value:'3'},{type:'text',value:'hello'}]]}}},{type:'ok'}]})}};
 assert.deepEqual(await sql('SELECT ? AS number, ? AS title',[3,'hello']),[{number:'3',title:'hello'}]);
 }finally{globalThis.fetch=old;delete process.env.TURSO_DATABASE_URL;delete process.env.TURSO_AUTH_TOKEN;}
});
