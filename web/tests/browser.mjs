import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { seeded } from './helpers.js';

const base=process.env.TEST_URL||'http://127.0.0.1:4173';
const gameEntry=process.env.TEST_ARTIFACT==='docs'?'/mine-duel/':'/web/';
const results=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(results,{recursive:true});
let checks=0;const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const tap=async(page,selector)=> {const element=page.locator(selector).first();await element.tap();if(selector==='#help'||selector==='#result-help') await page.locator('[data-menu=rules]').tap();if(selector==='#restart')await page.locator('#confirm-restart').tap();};
const state=page=>page.evaluate(()=>['turn','phase','mine-counts','marker-budget','feedback'].map(id=>document.getElementById(id).textContent).concat([...document.querySelectorAll('.cell')].map(c=>c.className+':'+c.innerHTML+':'+c.getAttribute('aria-label'))).concat([...document.querySelectorAll('[data-mode]')].map(c=>c.getAttribute('aria-pressed'))).join('|'));
const outcomes={};
const specs=[{name:'chromium-320x568',type:chromium,width:320,height:568}, {name:'chromium-360x640',type:chromium,width:360,height:640}, {name:'chromium-390x844',type:chromium,width:390,height:844}, {name:'chromium-desktop',type:chromium,width:1280,height:900}, {name:'webkit-390x844',type:webkit,width:390,height:844}];
for(const spec of specs) {
  const browser=await spec.type.launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:true,isMobile:spec.width<600});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.clock.install();
    await page.goto(`${base}/mine-duel/`);await tap(page,'[data-language=ko]');
    check(await page.locator('#rules-dialog').evaluate(d=>d.open),'startup modal');
    check(await page.locator('input[value=normal]').isChecked(),'default normal');
    await page.mouse.click(2,2);check(await page.locator('#rules-dialog').evaluate(d=>d.open),'startup outside locked');
    await page.keyboard.press('Escape');check(await page.locator('#rules-dialog').evaluate(d=>d.open),'startup Escape locked');
    await tap(page,'input[value=easy]');check(await page.locator('input[value=easy]').isChecked(),'easy selection');
    await tap(page,'input[value=hard]');check(await page.locator('input[value=hard]').isChecked(),'hard selection');
    await tap(page,'input[value=normal]');
    const startScroll=page.locator('#rules-scroll');
    await startScroll.evaluate(e=>{e.scrollTop=300;});
    const footerBefore=await page.locator('#rules-action').boundingBox();
    await startScroll.evaluate(e=>{e.scrollTop=e.scrollHeight;});
    const footerAfter=await page.locator('#rules-action').boundingBox();check(footerBefore.y===footerAfter.y,'footer fixed');
    await startScroll.evaluate(e=>{e.scrollTop=0;});
    const modalBox=await page.locator('#rules-dialog').boundingBox();check(modalBox.y>=0&&modalBox.y+modalBox.height<=spec.height+1,'modal fits viewport');
    await page.screenshot({path:`${results}/${spec.name}-start.png`});
    await tap(page,'#rules-action');
    check(!await page.locator('#rules-dialog').evaluate(d=>d.open),'start closes');
    const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:window.innerHeight, board:document.getElementById('board').getBoundingClientRect().toJSON(),end:document.getElementById('end-turn').getBoundingClientRect().toJSON()}));
    check(layout.width<=spec.width,'no horizontal overflow');check(layout.end.bottom<=spec.height+1,'all controls fit without scroll');check(Math.abs(layout.board.width-layout.board.height)<1,'square board');
    check(await page.locator('.footer').evaluate(e=>e.getBoundingClientRect().bottom)<=spec.height+1,'version footer fits viewport');
    await tap(page,'.cell[data-index="0"]');
    check(await page.locator('.cell[data-index="0"]').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(187, 215, 255)','human blue');
    await page.clock.runFor(200);await tap(page,'#help');
    const before=await state(page);check(await page.locator('#difficulty-picker').isHidden(),'help hides difficulty');
    await page.clock.runFor(5000);check(await state(page)===before,'CPU state frozen while help open');
    await tap(page,'#rules-scroll');check(await page.locator('#rules-dialog').evaluate(d=>d.open),'inside tap does not close');
    await page.mouse.click(2,2);check(!await page.locator('#rules-dialog').evaluate(d=>d.open),'outside dismisses help');
    await page.clock.runFor(300);check((await page.locator('#mine-counts').textContent()).includes('CPU 지뢰 0'),'remaining delay preserved');
    await page.clock.runFor(600);
    check(await page.locator('.revealed-cpu').count()===1,'CPU initial reveal');
    check(await page.locator('.revealed-cpu').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(255, 189, 189)','CPU red');
    // Place own opening mine and intentionally trigger it. Full UI route, not a mocked game.
    const safeMine=await page.locator('.cell:not(.revealed-player):not(.revealed-cpu)').first().getAttribute('data-index');
    await tap(page,`.cell[data-index="${safeMine}"]`);await page.clock.runFor(800);
    check(await page.locator('.own-mine').count()===1,'own mine shown');
    check(await page.locator('.own-mine svg').count()===1,'mine icon rendered');
    check(await page.locator('.cell').first().evaluate(c=>c.getBoundingClientRect().width)<60 || spec.width>600,'8 columns remain square after icon rendering');
    check(await page.evaluate(()=>document.documentElement.scrollWidth)<=spec.width,'mine icons do not overflow page');
    await page.screenshot({path:`${results}/${spec.name}-board.png`});
    await tap(page,'#help');const preserved=await state(page);await tap(page,'#rules-action');check(await state(page)===preserved,'close button preserves state');
    await tap(page,`.cell[data-index="${safeMine}"]`);
    check((await page.locator('#result-title').textContent())==='패배!','own-mine loss modal');
    check(await page.locator('#board button:enabled').count()===0,'terminal board disabled');
    await tap(page,'#result-help');check(await page.locator('#rules-dialog').evaluate(d=>d.open),'help available after result');await tap(page,'#rules-action');
    await tap(page,'#restart');check(await page.locator('#rules-dialog').evaluate(d=>d.open),'restart startup');check(await page.locator('input[value=normal]').isChecked(),'restart default');
    // Fit remains valid when browser toolbar contracts the visual viewport.
    if(spec.width<600) {await page.setViewportSize({width:spec.width,height:spec.height-50});await page.clock.runFor(100);await page.screenshot({path:`${results}/${spec.name}-resize.png`});const r=await page.locator('#rules-dialog').boundingBox();check(r.y>=0&&r.y+r.height<=spec.height-49,'toolbar resize popup fits');await page.setViewportSize({width:spec.width,height:spec.height});}
    check(errors.length===0,`no resource/JS errors ${errors}`);
    await context.close();
  } catch(error) {
    for(const ctx of browser.contexts()) for(const page of ctx.pages()) {
      await page.screenshot({path:`${results}/${spec.name}-failure.png`});
      console.log(await page.evaluate(()=>Object.fromEntries(['rules-dialog','rules-action','rules-scroll'].map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()]))));
    }
    throw error;
  } finally {await browser.close();}
  console.log('PASS',spec.name);
}

// Browser-native timers must also work: clock shims can conceal WebIDL receiver errors.
for (const type of [chromium, webkit]) {
  const realBrowser = await type.launch({headless:true});
  try {
    const ctx = await realBrowser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const realPage = await ctx.newPage(), realErrors = [];
    realPage.on('pageerror',e=>realErrors.push(String(e)));
    await realPage.goto(`${base}/mine-duel/`);await tap(realPage,'[data-language=ko]');await tap(realPage,'#rules-action');await tap(realPage,'.cell[data-index="0"]');
    await tap(realPage,'#help');const paused = await state(realPage);
    await new Promise(resolve=>setTimeout(resolve,900));
    check(await state(realPage)===paused,'native timer remains paused during help');
    await tap(realPage,'#rules-action');
    await realPage.waitForFunction(()=>document.querySelector('#phase').textContent.includes('첫 지뢰 설치'));
    check(await realPage.locator('.revealed-cpu').count()===1,'native CPU reveal resumes');
    const candidate=await realPage.locator('.cell:not(.revealed-player):not(.revealed-cpu)').first().getAttribute('data-index');
    await tap(realPage,`.cell[data-index="${candidate}"]`);
    await realPage.waitForFunction(()=>document.querySelector('#phase').textContent.includes('한 칸 탐색'));
    check((await realPage.locator('#mine-counts').textContent()).includes('CPU 지뢰 1'),'native CPU mine placement');
    check(realErrors.length===0,`native timers have no JS error: ${realErrors}`);
    await ctx.close();
  } finally {await realBrowser.close();}
}
// Repeat actual turns through touch/mouse UI; accelerate only the clock, not rules.
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await page.clock.install();await page.goto(`${base}${gameEntry}`);await tap(page,'[data-language=ko]');
  const rng=seeded(93);
  for(let round=0;round<12;round++) {
    if(round) await tap(page,'#restart');
    const difficulty=['easy','normal','hard'][round%3];await tap(page,`input[value=${difficulty}]`);await tap(page,'#rules-action');
    check((await page.locator('#difficulty').textContent()).includes({easy:'쉬움',normal:'보통',hard:'어려움'}[difficulty]),'chosen difficulty applied');
    let actions=0;
    while(!await page.locator('#result-dialog').evaluate(d=>d.open)&&actions++<250) {
      if((await page.locator('#turn').textContent()).includes('CPU')) {await page.clock.runFor(750);continue;}
      if(await page.locator('#end-turn').isEnabled()) {await tap(page,'#end-turn');continue;}
      if((await page.locator('#phase').textContent()).includes('한 칸 탐색')&&await page.locator('[data-mode=marker]').isEnabled()) {
        const candidate=await page.locator('.cell:not(.revealed-player):not(.revealed-cpu):not(:has(.cell-flag))').first().getAttribute('data-index');
        await tap(page,'[data-mode=marker]');await tap(page,`.cell[data-index="${candidate}"]`);
        check(!await page.locator('[data-mode=marker]').isEnabled(),'marker allowance consumed');
        await tap(page,'[data-mode=remove]');await tap(page,`.cell[data-index="${candidate}"]`);
        check(!await page.locator('[data-mode=marker]').isEnabled(),'removal no refund');
        await tap(page,'[data-mode=explore]');
      }
      const available=await page.locator('.cell:not(.revealed-player):not(.revealed-cpu):not(.own-mine):not(:has(.cell-flag))').evaluateAll(cells=>cells.map(c=>c.dataset.index));
      check(available.length>0,'human candidate available');const target=available[Math.floor(rng()*available.length)];await tap(page,`.cell[data-index="${target}"]`);
    }
    check(actions<250,'full game terminates');const result=await page.locator('#result-title').textContent();outcomes[result]=(outcomes[result]||0)+1;
  }
  await context.close();
} finally {await browser.close();}
const report={checks,viewports:specs.map(s=>s.name),completeGames:12,outcomes,note:'Chromium/WebKit touch emulation, not physical Android/iOS devices.'};
await writeFile(`${results}/browser.json`,JSON.stringify(report,null,2));console.log(report);
