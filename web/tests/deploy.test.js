import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VERSION } from '../js/config.js';
test('deployment relative resources exist, hashes used, source version matches; no Service Worker',async()=>{
  const root=new URL('../../docs/',import.meta.url), html=await readFile(new URL('index.html',root),'utf8');
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));assert.equal(manifest.version,VERSION);
  const resources=[...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m=>m[1]);
  assert.equal(resources.length,2);
  for(const res of resources){assert.match(res,/\.[a-f0-9]{12}\.(js|css)$/);await readFile(new URL(res,root));}
  for(const file of manifest.files.filter(f=>f.endsWith('.js'))) {
    const js=await readFile(new URL(file,root),'utf8');assert.doesNotMatch(js,/serviceWorker/);
    for(const match of js.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) await readFile(new URL(match[1],new URL(file,root)));
  }
});
import { createHash } from 'node:crypto';

test('current entry graph filenames match normalized content hashes',async()=>{
 const root=new URL('../../docs/',import.meta.url),seen=new Set();
 async function visit(url){if(seen.has(url.href))return;seen.add(url.href);const text=await readFile(url,'utf8');const expected=/\.([a-f0-9]{12})\.(?:js|css)$/.exec(url.pathname)?.[1];assert.equal(createHash('sha256').update(text).digest('hex').slice(0,12),expected,url.pathname);for(const m of text.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))await visit(new URL(m[1],url));}
 for(const entry of ['index.html','online.html']){const html=await readFile(new URL(entry,root),'utf8');for(const m of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await visit(new URL(m[1],root));}
});
