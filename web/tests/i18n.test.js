import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES, TRANSLATIONS, loadLanguage, saveLanguage, translate, LANGUAGE_KEY } from '../js/i18n.js';
import { UpdateChecker } from '../js/updates.js';
import { VERSION } from '../js/config.js';

test('four complete dictionaries, placeholders match and all UI/model keys resolve', async () => {
  const keys = Object.keys(TRANSLATIONS.ko);
  assert.equal(Object.keys(LANGUAGES).length, 4);
  for (const lang of Object.keys(LANGUAGES)) {
    assert.deepEqual(Object.keys(TRANSLATIONS[lang]), keys);
    for (const key of keys) {
      assert.ok(TRANSLATIONS[lang][key]?.trim(), `${lang}.${key}`);
      const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      assert.deepEqual(params(TRANSLATIONS[lang][key]), params(TRANSLATIONS.ko[key]), `${lang}.${key}`);
    }
  }
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) assert.ok(keys.includes(m[1]), m[1]);
  for (const file of ['game','ai']) {
    const code = await readFile(new URL(`../js/${file}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /[가-힣]/, 'model contains message identifiers, not presentation strings');
  }
  assert.equal(translate('unknown','start'),TRANSLATIONS.ko.start);
  const warnings = []; const previous = console.warn; console.warn = msg => warnings.push(msg);
  try { translate('unknown','start',{},true); } finally { console.warn = previous; }
  assert.equal(warnings.length,1);
});
test('stored language validation and unavailable localStorage', () => {
  const values = new Map(), storage = {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.equal(loadLanguage(storage),null);
  for (const lang of Object.keys(LANGUAGES)) { saveLanguage(storage,lang); assert.equal(values.get(LANGUAGE_KEY),lang); assert.equal(loadLanguage(storage),lang); }
  for (const invalid of ['fr','__proto__','constructor','',null]) { storage.setItem(LANGUAGE_KEY,invalid); assert.equal(loadLanguage(storage),null); }
  const broken = {getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(loadLanguage(broken),null); assert.doesNotThrow(()=>saveLanguage(broken,'en')); assert.equal(loadLanguage(null),null);
});
test('release checker uses relative no-store request, defers duplicates and survives offline/malformed data', async () => {
  const notices=[],requests=[]; let release='0.2.4-web', fail=false, bad=false;
  const checker = new UpdateChecker(v=>notices.push(v),{base:'https://example.org/mine-duel/',fetcher:async(url,options)=>{
    requests.push({url,options}); if(fail) throw Error('offline');
    return {ok:true,json:async()=>bad?{}:{version:release}};
  }});
  await checker.check(); assert.deepEqual(notices,['0.2.4-web']); assert.equal(requests[0].options.cache,'no-store');
  assert.equal(new URL(requests[0].url).pathname,'/mine-duel/version.json');
  checker.dismiss(release); await checker.check(); assert.equal(notices.length,1);
  fail=true; await checker.check(); fail=false;bad=true;await checker.check();bad=false;
  release=VERSION;await checker.check();assert.equal(notices.length,1);
  release='0.2.5-web';await checker.check();assert.equal(notices.length,2);
});
test('release document and immutable old/new module graphs are deployed together', async () => {
  const root = new URL('../../docs/',import.meta.url);
  assert.equal(JSON.parse(await readFile(new URL('version.json',root),'utf8')).version,VERSION);
  const {files} = JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.ok(files.some(f=>f.startsWith('js/i18n.'))); assert.ok(files.some(f=>f.startsWith('js/updates.')));
  const configs=files.filter(f=>f.startsWith('js/config.'));
  assert.ok(configs.length>=2,'previous release retained for cached HTML');
});
