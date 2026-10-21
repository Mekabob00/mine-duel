import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { translate } from '../js/i18n.js';
const url=process.env.TEST_RESULT_URL||'http://127.0.0.1:4173/mine-duel/';
const dir=process.env.TEST_RESULTS_DIR||'web/test-results/result';await mkdir(dir,{recursive:true});let checks=0;const check=(v,m)=>{checks++;assert.ok(v,m);};const outcomes=[];
for(const [engine,type] of Object.entries({chromium,webkit})) {
 const browser=await type.launch();
 try {for(const [j,lang] of ['ko','ja','en','zh-CN'].entries()) {
  const [width,height]=[[320,568],[390,844],[1280,900],[320,568]][j];const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:width<600});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(url);await page.locator(`[data-language="${lang}"]`).click();await page.locator('#rules-action').click();
  // Actual UI actions and virtual CPU delay clock, never hidden board state injection.
  for(let n=0;n<300 && !await page.locator('#result-dialog').evaluate(d=>d.open);n++) {
   if(await page.locator('#board button:enabled').count()===0) {await page.clock.runFor(700);continue;}
   if(await page.locator('#end-turn').isEnabled()) {await page.locator('#end-turn').click();continue;}
   const options=await page.locator('.cell:not(.revealed-player):not(.revealed-cpu):not(.own-mine):not(:has(.cell-flag))').all();
   check(options.length>0,'legal public candidate exists');await options[(n*13+j)%options.length].click();
  }
  check(await page.locator('#result-dialog').evaluate(d=>d.open),'actual game ends');
  const text=await page.locator('#result-turns').textContent()+'|'+await page.locator('#result-time').textContent();check(/\d{2}:\d{2}/.test(text),'time formatted');const finalBoard=await page.locator('#board').innerHTML();
  for(let n=0;n<3;n++) {
   await page.locator('#view-board').click();check(!await page.locator('#result-dialog').isVisible(),'board review');check(await page.locator('.cell:enabled').count()===0,'read only');check(await page.locator('#view-results').textContent()===translate(lang,'viewResults'),'localized restore control');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await page.clock.runFor(90000);check(await page.locator('#board').innerHTML()===finalBoard,'no stale CPU or board mutation');
   await page.locator('#view-results').focus();await page.keyboard.press('Enter');check(await page.locator('#result-turns').textContent()+'|'+await page.locator('#result-time').textContent()===text,'frozen metrics');
  }
  await page.screenshot({path:`${dir}/cpu-result-${engine}-${lang}.png`});await page.locator('#view-board').click();await page.screenshot({path:`${dir}/cpu-board-${engine}-${lang}.png`});
  outcomes.push({engine,lang,width,height,result:await page.locator('#result-title').textContent(),record:text});check(errors.length===0,JSON.stringify(errors));await page.close();console.log('PASS result',engine,lang);
 }}finally{await browser.close();}
}
await writeFile(`${dir}/result-browser.json`,JSON.stringify({checks,url,outcomes,scope:'Actual UI with virtual CPU delays, mobile emulation not physical devices',passed:true},null,2));console.log('PASS results',checks);
