import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onlineKeys,ot} from '../js/online-i18n.js';
import {credential,roomCode} from '../js/online-client.js';
import {readFile,access} from 'node:fs/promises';
test('online UI translations resolve every declared key in all four languages',()=>{
 for(const lang of ['ko','ja','en','zh-CN']) for(const key of onlineKeys){const value=ot(lang,key);assert.equal(typeof value,'string');assert.ok(value.length>0);assert.notEqual(value,key);}
 assert.equal(ot('missing','ready'),ot('ko','ready'));assert.equal(ot('ja','UNKNOWN_SERVER_CODE'),ot('ja','error'));
});
test('online credentials and invitation codes use their exact separate public/secret formats',()=>{
 const tokens=new Set(),codes=new Set();for(let i=0;i<100;i++){const token=credential(),code=roomCode();assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.match(code,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);tokens.add(token);codes.add(code);}assert.equal(tokens.size,100);assert.equal(codes.size,100);
});
test('online Pages entry and its entire hashed module graph resolve under a project subpath',async()=>{
 const root=new URL('../../docs/',import.meta.url),html=await readFile(new URL('online.html',root),'utf8');
 const entry=html.match(/src="\.\/(js\/online-main\.[a-f0-9]{12}\.js)"/)[1];
 const css=html.match(/href="\.\/(css\/style\.[a-f0-9]{12}\.css)"/)[1];await access(new URL(css,root));
 const seen=new Set();async function visit(file){if(seen.has(file))return;seen.add(file);const code=await readFile(new URL(file,root),'utf8');for(const m of code.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)){assert.match(m[1],/\.[a-f0-9]{12}\.js$/);await visit('js/'+m[1]);}}
 await visit(entry);assert.ok(seen.size>=5);assert.ok(!html.includes('/server/'));
});
