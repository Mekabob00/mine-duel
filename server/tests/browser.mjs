// Run against local Wrangler + built docs. No route stubs or server state injection.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, webkit } from '../../web/node_modules/playwright/index.mjs';
const entry=process.env.TEST_ONLINE_URL||'http://127.0.0.1:4173/mine-duel/online.html';
const dir=path.resolve(process.env.TEST_RESULTS_DIR||'test-results');await fs.mkdir(dir,{recursive:true});
const run=crypto.randomUUID();
const profiles=[path.join(dir,run+'-chromium-profile'),path.join(dir,run+'-webkit-profile')];
const contexts=[],pages=[],errors=[],snapshots=[null,null];let checks=0;
const check=(v,m)=>{checks++;assert.ok(v,m);};
async function open(i){const type=i===0?chromium:webkit;const ctx=await type.launchPersistentContext(profiles[i],{viewport:{width:390,height:844},hasTouch:true,isMobile:true});contexts[i]=ctx;const p=pages[i]=ctx.pages()[0]||await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const m=JSON.parse(payload);if(m.type==='snapshot'){snapshots[i]=m;if(m.game&&!m.game.result)check(m.game.cells.every(c=>c.owners===undefined&&c.markerCorrect===undefined&&(!c.revealed?c.number===-1:true)),'private information absent from active WS frames');}}catch(e){if(e instanceof assert.AssertionError)errors.push(e.message);}}));await p.goto(entry);await p.locator('#online-language').selectOption('en');return p;}
async function sync(i,predicate,timeout=15000){const until=Date.now()+timeout;while(Date.now()<until){if(snapshots[i]&&predicate(snapshots[i]))return snapshots[i];await new Promise(r=>setTimeout(r,80));}throw Error('snapshot timeout player '+i);}
async function idle(i){await sync(i,()=>true);await pages[i].waitForFunction(()=>!document.querySelector('#online-feedback').textContent.includes('Awaiting'));}
async function clickCell(i,index){await pages[i].locator(`.cell[data-index="${index}"]`).click();await idle(i);}
try{
 await open(0);await open(1);
 await pages[0].locator('#create-room').click();const a=await sync(0,s=>s.status==='waiting');
 await pages[1].locator('#room-input').fill(a.code);await pages[1].locator('#join-room').click();await sync(1,s=>s.status==='waiting');await sync(0,s=>s.seats[1]);
 await pages[0].locator('#online-ready').click();await sync(0,s=>s.seats[0].ready);check(!snapshots[0].game,'one ready cannot start');await pages[1].locator('#online-ready').click();const firstGame=await sync(0,s=>s.status==='playing');const first=firstGame.game.first;
 console.log('Both browsers ready; testing actual opening alarms (40 seconds).');
 await sync(0,s=>s.game.cells.filter(c=>c.revealed).length===1,26000);check(snapshots[0].game.phase==='opening-reveal','first timeout opens safe cell');
 await sync(0,s=>s.game.cells.filter(c=>c.revealed).length===2,26000);check(snapshots[0].game.phase==='opening-mine','second timeout opens distinct safe cell');
 const mine=snapshots[0].game.cells.findIndex(c=>!c.revealed);await sync(first,s=>s.game.current===first);await clickCell(first,mine);await sync(1-first,s=>s.game.current===1-first&&s.game.phase==='opening-mine');await clickCell(1-first,mine);await sync(0,s=>s.game.phase==='explore');await sync(1,s=>s.game.phase==='explore');check(snapshots[0].game.cells[mine].ownMine&&snapshots[1].game.cells[mine].ownMine,'opening overlap and both own views');
 // Full browser process/profile restart, not a fresh context mislabeled as reconnect.
 const savedId=snapshots[0].game.id;await contexts[0].close();snapshots[0]=null;await open(0);await sync(0,s=>s.game?.id===savedId&&s.status==='playing');check(snapshots[0].game.cells[mine].ownMine,'browser restart restores persisted token and board');
 if(process.env.TEST_RESTART==='1'){
  await fs.writeFile(path.join(dir,'restart.request'),'restart Wrangler now');console.log('WAIT backend restart.request');
  for(let n=0;n<180;n++){try{await fs.access(path.join(dir,'restart.done'));break;}catch{}await new Promise(r=>setTimeout(r,500));}
  await pages[0].locator('#online-reconnect').evaluate(b=>b.click());await pages[1].locator('#online-reconnect').evaluate(b=>b.click());
  await sync(0,s=>s.game?.id===savedId&&s.game.cells[mine].ownMine);check(snapshots[0].game.id===savedId,'actual backend restart preserves game');
 }
 // Use whichever player's normal turn is current after reconnect; no hidden state is read.
 const current=snapshots[0].game.current;await sync(current,s=>s.game.current===current&&s.game.phase==='explore');
 let target=snapshots[current].game.cells.findIndex(c=>!c.revealed&&!c.ownMine&&c.marker===null);await clickCell(current,target);await sync(current,s=>s.game.phase==='place-mine');const revealed=snapshots[current].game.cells.filter(c=>c.revealed).length,turnId=snapshots[current].game.turnId;
 console.log('Testing explore-only normal timeout (20 seconds).');await sync(1-current,s=>s.game.turnId!==turnId,26000);check(snapshots[1-current].game.cells.filter(c=>c.revealed).length===revealed,'explore retained after timeout');check(snapshots[1-current].game.counts.every(n=>n===1),'missing mine skipped on timeout');
 const other=1-current;await sync(other,s=>s.game.current===other);target=snapshots[other].game.cells.findIndex(c=>!c.revealed&&!c.ownMine&&c.marker===null);await clickCell(other,target);await sync(other,s=>s.game.phase==='place-mine');
 const enemyOnly=snapshots[other].game.cells.findIndex(c=>!c.revealed&&!c.ownMine&&c.marker===null);await clickCell(other,enemyOnly);await sync(other,s=>s.game.phase==='end-turn');const turn2=snapshots[other].game.turnId;
 console.log('Testing explore+mine normal timeout (20 seconds).');await sync(current,s=>s.game.turnId!==turn2,26000);check(snapshots[current].game.cells[enemyOnly].ownMine===false,'opponent-only mine remains hidden');
 await clickCell(current,enemyOnly);await sync(0,s=>s.game.result);await sync(1,s=>s.game.result);check(snapshots[0].game.result.reason==='mineHit','actual KO');check(snapshots[0].game.cells[enemyOnly].owners!==undefined,'all ownership revealed after KO');check(snapshots[1].game.result.winner===other,'both clients agree result');await pages[0].screenshot({path:path.join(dir,'online-result.png')});
 const record=snapshots[0].game.result.record;check(record.turns===3,'KO includes third general turn; opening excluded');check(record.durationMs>=80000,'server elapsed includes opening and two turn deadlines');check(JSON.stringify(record)===JSON.stringify(snapshots[1].game.result.record),'both players share server record');
 for(let i=0;i<2;i++) {
  const finalBoard=await pages[i].locator('#online-board').innerHTML();
  for(let n=0;n<3;n++) {await pages[i].locator('#online-view-board').click();check(!await pages[i].locator('#online-result').isVisible(),'result collapses for review');check(await pages[i].locator('#online-board button:enabled').count()===0,'online finished board disabled');await pages[i].locator('#online-board button').first().evaluate(b=>b.click());await pages[i].waitForTimeout(300);check(await pages[i].locator('#online-board').innerHTML()===finalBoard,'review preserves revealed final board');await pages[i].locator('#online-view-results').focus();await pages[i].keyboard.press('Enter');check(await pages[i].locator('#online-result').isVisible(),'result restored by keyboard');}
  for(const lang of ['ko','ja','en','zh-CN'])for(const [width,height] of [[320,568],[390,844],[1280,900]]) {await pages[i].setViewportSize({width,height});await pages[i].locator('#online-language').selectOption(lang);check(await pages[i].evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'result layout has no horizontal overflow');check((await pages[i].locator('#online-result-time').textContent()).match(/\d/),'translated duration displayed');}
  await pages[i].locator('#online-language').selectOption('en');
 }
 snapshots[0]=null;await pages[0].reload();await sync(0,s=>s.game.result);check(JSON.stringify(snapshots[0].game.result.record)===JSON.stringify(record),'ended reconnect restores identical record');

 await pages[0].locator('#online-rematch').click();await sync(0,s=>s.seats[0].rematch);check(snapshots[0].status==='finished','unilateral rematch cannot start');await pages[1].locator('#online-rematch').click();await sync(0,s=>s.game.id!==savedId&&s.status==='playing');await sync(1,s=>s.game.id!==savedId&&s.status==='playing');check(snapshots[0].game.first===1-first,'rematch alternates first');check(snapshots[0].game.counts.every(n=>n===0),'rematch resets mines');
 await pages[0].locator('#online-leave').click();await pages[0].locator('#online-confirm-leave').click();await sync(1,s=>s.game.result?.reason==='resigned');check(snapshots[1].game.result.winner===1,'explicit leave forfeits');check(snapshots[1].game.result.record.turns===0,'opening resignation has zero general turns');
 check(errors.length===0,JSON.stringify(errors));await fs.writeFile(path.join(dir,'browser.json'),JSON.stringify({checks,engines:['Chromium','WebKit'],entry,scope:'Real backend and WebSockets with persistent browser profiles, wall-clock alarms; browser emulation, not physical mobile',first,backendRestart:process.env.TEST_RESTART==='1',errors,passed:true},null,2));console.log('PASS online browser',checks);
}finally{for(const ctx of contexts)try{await ctx.close();}catch{}}
