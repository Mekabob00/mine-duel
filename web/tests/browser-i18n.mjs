import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LANGUAGES, translate } from '../js/i18n.js';
import { VERSION } from '../js/config.js';
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
const results=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(results,{recursive:true});
let checks=0; const check=(value,label)=>{checks++;assert.ok(value,label);};
const open=(page,name)=>page.locator(`#${name}-dialog`).evaluate(d=>d.open);
const tap=(page,selector)=>page.locator(selector).first().tap();
const board=page=>page.locator('.cell').evaluateAll(c=>c.map(e=>`${e.className}:${e.innerHTML}`).join('|'));
const menu=async page=>{await tap(page,'#help');check(await open(page,'menu'),'menu opened');};
async function texts(page,lang) {
  const entries=await page.locator('[data-i18n]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.i18n,n.textContent]));
  for(const [key,value] of entries) check(value===translate(lang,key),`${lang}.${key}`);
  check(await page.locator('html').getAttribute('lang')===lang,'document language');
  check(await page.locator('#help').getAttribute('aria-label')===translate(lang,'menu'),'translated menu aria');
}
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await type.launch({headless:true});
  try {
    for(const lang of Object.keys(LANGUAGES)) {
      const ctx=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true});
      const page=await ctx.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning')errors.push(m.text());});
      await page.clock.install();await page.clock.pauseAt(new Date()); await page.goto(`${base}/mine-duel/`);
      check(await open(page,'language'),'first visit language picker');
      check(await page.locator('#language-title').textContent()==='Select Language','native initial title');
      check(await page.locator('#board button:enabled').count()===0,'initial board disabled');
      await page.mouse.click(2,2);await page.keyboard.press('Escape');check(await open(page,'language'),'initial language cannot dismiss');
      await tap(page,`[data-language="${lang}"]`);
      check(await open(page,'rules'),'language leads to rules');await texts(page,lang);
      check(await page.evaluate(()=>localStorage.getItem('mineDuel.language'))===lang,'language persisted');
      await tap(page,'input[value=hard]');await tap(page,'#rules-action');await tap(page,'.cell[data-index="0"]');
      await page.clock.runFor(200);await menu(page);const paused=await board(page);
      check(await page.locator('#board button:enabled').count()===0,'menu disables board');
      await page.clock.runFor(5000);check(await board(page)===paused,'CPU paused in menu');
      await tap(page,'#menu-title');check(await open(page,'menu'),'internal tap keeps menu');
      await page.mouse.click(2,2);check(!await open(page,'menu'),'menu outside closes');
      await menu(page);await tap(page,'[data-menu=confirm]');check(await open(page,'confirm'),'restart needs confirmation');
      await page.clock.runFor(1000);await tap(page,'#confirm-dialog [data-close]');check(await board(page)===paused,'restart cancel preserves state');
      await menu(page);await tap(page,'[data-menu=rules]');check(await page.locator('#difficulty-picker').isHidden(),'in-game rules difficulty locked');
      await page.clock.runFor(500);await tap(page,'#rules-scroll');check(await open(page,'rules'),'scroll area does not dismiss');
      await tap(page,'#rules-action');check(await board(page)===paused,'rules preserve state');
      await menu(page);await tap(page,'[data-menu=language]');
      check(await page.locator(`[data-language="${lang}"]`).getAttribute('aria-pressed')==='true','current language selected');
      const other=lang==='en'?'ja':'en';await tap(page,`[data-language="${other}"]`);await texts(page,other);
      check(await board(page)===paused,'language preserves board');check(await page.locator('#difficulty').textContent()===translate(other,'hard'),'difficulty maintained');
      check(await page.locator('#feedback').textContent()===translate(other,'safe'),'feedback translated immediately');
      await page.clock.runFor(1000);check(await board(page)===paused,'language picker pauses CPU');
      await page.screenshot({path:`${results}/${engine}-${lang}-language.png`});
      await tap(page,'#language-close');await page.clock.runFor(300);check(await board(page)===paused,'remaining CPU delay maintained');
      await page.clock.runFor(300);check(await page.locator('.revealed-cpu').count()===1,'CPU resumes once');
      const candidate=await page.locator('.cell:not(.revealed-player):not(.revealed-cpu)').first().getAttribute('data-index');
      await tap(page,`.cell[data-index="${candidate}"]`);
      await menu(page);await tap(page,'[data-menu=confirm]');await tap(page,'#confirm-restart');
      check(await open(page,'rules'),'confirmed restart shows rules');check(!await open(page,'language'),'restart keeps language');
      check(await page.locator('input[value=normal]').isChecked(),'restart reselects default difficulty');
      await page.clock.runFor(5000);check(await page.locator('.revealed-player,.revealed-cpu,.own-mine,.cell-flag').count()===0,'old CPU action cannot affect new game');
      check(await page.locator('dialog[open]').count()===1,'single modal');
      const bounds=await page.locator('#rules-dialog').boundingBox();check(bounds.y>=0&&bounds.y+bounds.height<=569,'translated rules fit short screen');
      await page.screenshot({path:`${results}/${engine}-${lang}-rules.png`});
      await tap(page,'#rules-action');const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,bottom:document.querySelector('.footer').getBoundingClientRect().bottom}));
      check(layout.width<=320&&layout.bottom<=569,'translated board controls fit');
      await page.reload();check(await open(page,'rules'),'saved language skips picker');check(await page.locator('html').getAttribute('lang')===other,'revisit saved language');
      check(errors.length===0,`no JS errors or missing translations: ${errors}`);
      await ctx.close();console.log('PASS languages/menu',engine,lang);
    }
    // Invalid and inaccessible localStorage both recover to a playable session.
    for(const blocked of [false,true]) {
      const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
      await ctx.addInitScript(blocked?()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}):()=>localStorage.setItem('mineDuel.language','fr'));
      const page=await ctx.newPage();await page.goto(`${base}/mine-duel/`);check(await open(page,'language'),'invalid/blocked storage picker');
      await tap(page,'[data-language=zh-CN]');await tap(page,'#rules-action');await tap(page,'.cell[data-index="0"]');
      await page.waitForFunction(()=>document.querySelectorAll('.revealed-cpu').length===1);
      check(await page.locator('html').getAttribute('lang')==='zh-CN','blocked storage still playable');await ctx.close();
    }
    // Version checks are optional, deferred behind existing dialogs, and never restart gameplay.
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await ctx.addInitScript(()=>localStorage.setItem('mineDuel.language','en'));
    const page=await ctx.newPage();let release=VERSION,offline=false;
    await page.route('**/version.json?*',route=>offline?route.abort():route.fulfill({json:{version:release}}));
    await page.clock.install();await page.clock.pauseAt(new Date());await page.goto(`${base}/mine-duel/`);await tap(page,'#rules-action');
    await menu(page);release='0.2.1-web';await page.clock.runFor(60001);
    check(await open(page,'menu'),'version check does not replace current popup');await tap(page,'#menu-dialog [data-close]');
    await page.waitForFunction(()=>document.getElementById('update-dialog').open);check(await page.locator('dialog[open]').count()===1,'update sole dialog');
    const original=await board(page);await tap(page,'#update-later');check(await board(page)===original,'later preserves game');
    await page.clock.runFor(60001);check(!await open(page,'update'),'dismissed version not repeated');
    offline=true;await page.clock.runFor(60001);await tap(page,'.cell[data-index="0"]');await page.clock.runFor(750);
    check(await page.locator('.revealed-cpu').count()===1,'offline check failure leaves CPU playable');
    offline=false;release='0.2.2-web';await page.clock.runFor(60001);await page.waitForFunction(()=>document.getElementById('update-dialog').open);
    await tap(page,'#update-now');await page.waitForURL('**/?v=0.2.2-web');check(await open(page,'rules'),'update reloads with saved language');await ctx.close();
  } finally {await browser.close();}
}
const report={checks,languages:Object.keys(LANGUAGES),engines:['Chromium','WebKit'],version:VERSION};
await writeFile(`${results}/i18n-browser.json`,JSON.stringify(report,null,2));console.log(report);
