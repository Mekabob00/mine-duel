import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VERSION } from '../js/config.js';

const source = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(source, '../docs');
const hash = text => createHash('sha256').update(text).digest('hex').slice(0,12);
const generated = new Set(['index.html','.nojekyll','manifest.json','version.json']);
const names = new Map();
await mkdir(path.join(destination,'js'), { recursive:true });
await mkdir(path.join(destination,'css'), { recursive:true });
let old = [];
try { old = JSON.parse(await readFile(path.join(destination,'manifest.json'),'utf8')).files; } catch (e) { if (e.code !== 'ENOENT') throw e; }
async function moduleFile(name) {
  if (names.has(name)) return names.get(name);
  const raw = await readFile(path.join(source,'js',name),'utf8');
  const imports = [...raw.matchAll(/from\s+(['"])(\.\/[^'"]+\.js)\1/g)];
  let compiled = raw;
  for (const match of imports) compiled = compiled.replace(match[0], `from '${await moduleFile(match[2].slice(2))}'`);
  const result = `${name.slice(0,-3)}.${hash(compiled)}.js`;
  await writeFile(path.join(destination,'js',result),compiled);
  generated.add(`js/${result}`); names.set(name,`./${result}`); return `./${result}`;
}
const main = await moduleFile('main.js');
const css = await readFile(path.join(source,'css/style.css'),'utf8');
const cssName = `css/style.${hash(css)}.css`;
await writeFile(path.join(destination,cssName),css); generated.add(cssName);
const html = (await readFile(path.join(source,'index.html'),'utf8')).replace('./css/style.css',`./${cssName}`).replace('./js/main.js',`./js/${main.slice(2)}`);
await writeFile(path.join(destination,'index.html'),html);
const onlineMain = await moduleFile('online-main.js');
const onlineHtml = (await readFile(path.join(source,'online.html'),'utf8')).replace('./css/style.css',`./${cssName}`).replace('./js/online-main.js',`./js/${onlineMain.slice(2)}`);
await writeFile(path.join(destination,'online.html'),onlineHtml); generated.add('online.html');
await writeFile(path.join(destination,'.nojekyll'),'');
await writeFile(path.join(destination,'version.json'),JSON.stringify({version:VERSION})+'\n');
await writeFile(path.join(source,'version.json'),JSON.stringify({version:VERSION})+'\n');
// Keep immutable prior hashes: a cached HTML/module graph remains internally consistent.
// Their small files are intentionally retained rather than broken by deployment cleanup.
const retained = old.filter(file => /^(js\/[^/]+\.[a-f0-9]{12}\.js|css\/[^/]+\.[a-f0-9]{12}\.css)$/.test(file));
await writeFile(path.join(destination,'manifest.json'),JSON.stringify({ version:VERSION, files:[...new Set([...generated,...retained])].sort() },null,2)+'\n');
console.log(`Mine Duel v${VERSION}: ${generated.size} deployment files -> ${destination}`);
