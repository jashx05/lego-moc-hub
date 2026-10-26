import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {serializeModel,canonicalPartName,countByPart} from '../public/ldraw-utils.js';
const source=new URL('./fixtures/kurumi-mock.ldr',import.meta.url);
function parseLDraw(text){return text.split(/\r?\n/).filter(line=>/^1\s/.test(line)).map(line=>{
  const a=line.trim().split(/\s+/);return {color:a[1],x:+a[2],y:+a[3],z:+a[4],rotation:a.slice(5,14).map(Number),id:a.slice(14).join(' ')};
})}
test('serializes rotations and names preserving LDraw positions',()=>{
  const content=fs.readFileSync(source,'utf8'),parts=parseLDraw(content);
  assert.equal(parts.length,6);
  const text=serializeModel(parts);
  const roundtrip=parseLDraw(text);
  assert.deepEqual(roundtrip,parts.map(p=>({...p,id:canonicalPartName(p.id)})));
  assert.equal(roundtrip.length,6);
});
test('rejects unsafe and unsupported part references',()=>{
  for(const s of ['../secrets.dat','https://api.example/file.dat','some file.dat','foo.txt']) assert.throws(()=>canonicalPartName(s));
  assert.equal(canonicalPartName('S\\3039S01.DAT'),'s/3039s01.dat');
});
test('counts sample parts rather than silently skipping new types',()=>{
  const parts=parseLDraw(fs.readFileSync(source,'utf8'));
  const totals=countByPart(parts);
  assert.ok(totals.size>=4);
  assert.equal([...totals.values()].reduce((a,b)=>a+b,0),6);
  assert.ok(totals.get('3039.dat')>0);
});
test('does not tolerate malformed coordinate matrices',()=>{
  assert.throws(()=>serializeModel([{x:0,y:0,z:0,color:15,rotation:[1,0,0],id:'3001.dat'}]));
  assert.throws(()=>serializeModel([{x:NaN,y:0,z:0,color:15,rotation:[1,0,0,0,1,0,0,0,1],id:'3001.dat'}]));
});
