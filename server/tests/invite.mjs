import {chromium,webkit} from '../../web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const b=await chromium.launch();let old;
try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:4173/web/online.html');await p.locator('#create-room').click();await p.waitForFunction(()=>document.getElementById('online-room-code').textContent.length>10);
 const code=(await p.locator('#online-room-code').textContent()).split(': ').at(-1);
 const profile='invite-'+crypto.randomUUID()+'-webkit-profile';
 old=await webkit.launchPersistentContext('test-results/'+profile,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});let q=old.pages()[0];
 await q.goto('http://127.0.0.1:4173/web/online.html');await q.locator('#create-room').click();await q.waitForFunction(()=>document.getElementById('online-ready').disabled===false);
 const oldCode=(await q.locator('#online-room-code').textContent()).split(': ').at(-1);
 const buddy=await b.newPage();await buddy.goto('http://127.0.0.1:4173/web/online.html?room='+oldCode);await buddy.locator('#join-room').click();await buddy.waitForFunction(()=>document.getElementById('online-ready').disabled===false);
 await q.locator('#online-ready').click();await buddy.waitForTimeout(150);await buddy.locator('#online-ready').click();await buddy.waitForFunction(()=>!document.getElementById('online-ready').offsetParent);
 await buddy.locator('#online-leave').click();await buddy.locator('#online-confirm-leave').click();await q.waitForFunction(()=>!document.getElementById('online-result').hidden);
 await old.close();old=await webkit.launchPersistentContext('test-results/'+profile,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});q=old.pages()[0];
 await q.goto('http://127.0.0.1:4173/web/online.html?room='+code);await q.waitForFunction(()=>!document.getElementById('online-result').hidden);assert.equal(await q.locator('#online-lobby').isVisible(),true);
 await q.locator('#join-room').click();await q.waitForFunction(code=>document.getElementById('online-room-code').textContent.includes(code),code);await q.waitForFunction(()=>document.getElementById('online-ready').disabled===false);
 await fs.writeFile('test-results/invite.json',JSON.stringify({passed:true,scope:'Old browser profile with a finished match joins a new invitation through actual UI and server'},null,2));console.log('PASS existing-profile invitation');
}finally{await b.close();await old?.close();}
