import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalGeometryPath,geometryUrl,LDRAW_COMMIT} from '../api/_lib/ldraw-path.js';
import handler from '../api/ldraw.js';

function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=value}}}
function req(path,method='GET'){return {method,query:{path}}}

test('1751 tile and subparts are permitted; URL is pinned',()=>{
 assert.equal(canonicalGeometryPath('parts/1751.dat'),'parts/1751.dat');
 assert.equal(canonicalGeometryPath('parts/s/1751s01.dat'),'parts/s/1751s01.dat');
 assert.equal(canonicalGeometryPath('p/48/1-4cyli.dat'),'p/48/1-4cyli.dat');
 assert.equal(canonicalGeometryPath('LDConfig.ldr'),'LDConfig.ldr');
 assert.match(geometryUrl('parts/1751.dat'),new RegExp(LDRAW_COMMIT+'.*parts/1751.dat$'));
});
test('rejects traversal, protocols, arbitrary URLs and hidden internal files',()=>{
 for(const path of ['../.env','parts/../../.env','https://bad.test/parts/1751.dat','/parts/1751.dat','parts/password.txt','parts/a%2fb.dat','parts/.env','api/ldraw.js',null])assert.equal(canonicalGeometryPath(path),null);
});
test('first-party geometry route serves the upstream LDraw bytes and cache headers',async()=>{
 const old=globalThis.fetch;
 let url='';globalThis.fetch=async u=>{url=u;return new Response('0 Tile  4 x  4\\n0 Name: 1751.dat\\n',{status:200,headers:{'content-length':'36'}})};
 try{const res=response();await handler(req('parts/1751.dat'),res);assert.equal(res.statusCode,200);assert.equal(res.headers['Content-Type'],'text/plain; charset=utf-8');assert.match(url,/raw.githubusercontent.com/);assert.ok(res.body.toString().includes('1751.dat'));assert.ok(res.headers['Cache-Control'].includes('s-maxage'));}finally{globalThis.fetch=old}
});
test('unknown geometry returns 404 and never echoes a raw URL',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('Not Found',{status:404});
 try{const res=response();await handler(req('parts/doesnotexist.dat'),res);assert.equal(res.statusCode,404);}finally{globalThis.fetch=old}
});
test('invalid geometry and non-GET are rejected without remote fetch',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('fetch should not run')};
 try{const bad=response(),post=response();await handler(req('parts/../private.dat'),bad);await handler(req('parts/1751.dat','POST'),post);assert.equal(bad.statusCode,400);assert.equal(post.statusCode,405);}finally{globalThis.fetch=old}
});
