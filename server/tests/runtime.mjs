import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';
const base=process.env.TEST_BACKEND_URL||'http://127.0.0.1:8787',origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4173',dir=process.env.TEST_RESULTS_DIR||'test-results';await fs.mkdir(dir,{recursive:true});
let checks=0;const check=(v,m)=>{checks++;assert.ok(v,m);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function post(code,action,token){const r=await fetch(`${base}/rooms/${code}/${action}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});return {status:r.status,data:await r.json()};}
class Client{
 constructor(code,token){this.code=code;this.token=token;this.frames=[];}
 async connect(){this.ws=new WebSocket(`${base.replace('http','ws')}/rooms/${this.code}/socket`,{headers:{Origin:origin}});this.ws.on('message',data=>{const m=JSON.parse(data);this.frames.push(m);if(m.type==='snapshot')this.state=m;});await new Promise((res,rej)=>{this.ws.once('open',res);this.ws.once('error',rej);});this.ws.send(JSON.stringify({type:'auth',protocol:1,token:this.token}));await this.wait(s=>s);this.heartbeat=setInterval(()=>{if(this.ws.readyState===1)this.ws.send(JSON.stringify({type:'ping'}));},10000);return this;}
 async wait(fn,ms=10000){const until=Date.now()+ms;while(Date.now()<until){if(this.state&&fn(this.state))return this.state;await pause(40);}throw Error('runtime snapshot timeout');}
 async send(type,extra={}){const s=this.state;const msg={type,requestId:crypto.randomUUID(),seq:s.seq+1,revision:s.revision,gameId:s.game?.id??null,turnId:s.game?.turnId,...extra};this.ws.send(JSON.stringify(msg));for(let n=0;n<200;n++){const ack=this.frames.find(m=>m.type==='ack'&&m.requestId===msg.requestId);if(ack){await this.wait(s=>s.seq>=msg.seq);return {msg,ack};}await pause(30);}throw Error('ack timeout');}
 close(){clearInterval(this.heartbeat);this.ws.close();}
}
async function pair(){const code=[...randomBytes(10)].map(n=>alphabet[n&31]).join(''),tokens=[randomBytes(32).toString('base64url'),randomBytes(32).toString('base64url')];assert.equal((await post(code,'create',tokens[0])).status,200);assert.equal((await post(code,'join',tokens[1])).status,200);const a=await new Client(code,tokens[0]).connect(),b=await new Client(code,tokens[1]).connect();await a.wait(s=>s.seats.every(p=>p?.connected));return [a,b];}
const pairs=[];
try{
 const p=await pair();pairs.push(p);const[a,b]=p;
 const full=await post(a.code,'join',randomBytes(32).toString('base64url'));check(full.data.code==='ROOM_FULL','third player rejected');
 const unauth=new WebSocket(`${base.replace('http','ws')}/rooms/${a.code}/socket`,{headers:{Origin:origin}}),badFrames=[];unauth.on('message',x=>badFrames.push(JSON.parse(x)));await new Promise(r=>unauth.once('open',r));unauth.send(JSON.stringify({type:'auth',protocol:1,token:randomBytes(32).toString('base64url')}));await pause(250);check(badFrames.every(x=>x.type!=='snapshot'),'invalid token sees no snapshot');unauth.close();
 const one=await a.send('ready');await b.wait(s=>s.revision>=one.ack.revision);await b.send('ready');await a.wait(s=>s.game);await b.wait(s=>s.game);
 const first=a.state.game.first,clients=p;
 for(const [kind,index]of [['explore',0],['explore',63],['mine',1],['mine',62]]){const seat=clients[0].state.game.current,c=clients[seat];await c.wait(s=>s.game.current===seat);const result=await c.send('action',{kind,index});check(result.ack.accepted,'opening command accepted');await clients[1-seat].wait(s=>s.revision>=result.ack.revision);}
 const active=clients[first],other=clients[1-first],before=active.state.game.id;
 const mineCell=62; // Opening actions above assign index 62 to the second actor, regardless of seat.
 check(active.state.game.cells[mineCell].ownMine===false,'enemy mine hidden');check(active.state.game.cells.every(c=>c.owners===undefined),'owners never in active frame');
 const safe=await active.send('action',{kind:'explore',index:20});check(safe.ack.accepted,'safe explore');active.ws.send(JSON.stringify(safe.msg));await pause(150);check(active.frames.filter(x=>x.type==='ack'&&x.requestId===safe.msg.requestId).length===2,'duplicate acknowledged');check(active.state.game.phase==='place-mine','duplicate explore not applied to next phase');active.ws.send(JSON.stringify({...safe.msg,index:21}));await pause(150);check(active.frames.some(x=>x.code==='REQUEST_CONFLICT'),'same ID new payload rejected');
 active.ws.send('{malformed');await pause(100);check(active.frames.some(x=>x.code==='BAD_MESSAGE'),'invalid JSON safely rejected');
 if(process.env.TEST_RESTART==='1'){
   await fs.writeFile(dir+'/restart.request','ready');console.log('WAIT actual backend restart');
   let done=false;for(let n=0;n<240;n++){try{await fs.access(dir+'/restart.done');done=true;break;}catch{}await pause(500);}check(done,'backend restart signal received');
   for(const c of clients){c.close();c.state=null;await c.connect();}
   check(a.state.game.id===before&&a.state.game.cells[20].revealed,'actual persisted game survives backend process restart');
   // Exact same old command re-acknowledged from persisted dedup history, even across restart.
   const frameCount=active.frames.length;
   active.ws.send(JSON.stringify(safe.msg));await pause(250);
   const reack=active.frames.slice(frameCount).find(x=>x.type==='ack'&&x.requestId===safe.msg.requestId);
   check(reack?.accepted===safe.ack.accepted&&reack?.revision===safe.ack.revision,'persisted dedup replays the exact prior acknowledgment after restart');
 }
 // Old turn action must be rejected after real wall-clock deadline passes.
 await active.wait(s=>s.game.turnId!==safe.msg.turnId,26000);const late=await active.send('action',{kind:'mine',index:21,turnId:safe.msg.turnId});check(!late.ack.accepted,'late command rejected');
 await other.wait(s=>s.revision>=late.ack.revision);await other.send('resign');await active.wait(s=>s.status==='finished');check(active.state.game.cells.some(c=>c.owners>0),'final mine ownership revealed');
 const endedId=active.state.game.id;
 await active.send('rematch');await other.wait(s=>s.seats[first].rematch);await other.send('rematch');await active.wait(s=>s.game.id!==endedId);
 const historyStart=active.frames.length;active.ws.send(JSON.stringify({type:'history',gameId:endedId}));await pause(150);
 const history=active.frames.slice(historyStart).find(m=>m.type==='history');check(history?.game?.id===endedId&&history.game.result!==null,'prior result remains retrievable after rematch');
 for(const c of clients)c.close();
 if(process.env.TEST_GRACE==='0') {
   await fs.writeFile(dir+'/runtime-short.json',JSON.stringify({checks,passed:true,backendRestart:process.env.TEST_RESTART==='1',scope:'Actual runtime protocol + restart; long grace tests intentionally omitted in this additional run'},null,2));console.log('PASS runtime short',checks);
 } else {
 console.log('Testing actual 2-minute single and bilateral disconnect alarms concurrently.');
 const single=await pair(),both=await pair();pairs.push(single,both);
 for(const cs of [single,both]){await cs[0].send('ready');await cs[1].wait(s=>s.seats[0].ready);await cs[1].send('ready');await cs[0].wait(s=>s.game);}
 const started=Date.now();single[0].close();both.forEach(c=>c.close());
 await single[1].wait(s=>s.game.result?.reason==='disconnectLoss',135000);check(single[1].state.game.result.winner===1,'single disconnect loses after grace');
 both[0].state=null;await both[0].connect();await both[0].wait(s=>s.game.result?.reason==='bothDisconnected');check(both[0].state.game.result.winner===null,'bilateral disconnect is void');check(Date.now()-started>=120000,'actual 120 second grace elapsed');
 const result={checks,passed:true,backendRestart:process.env.TEST_RESTART==='1',disconnectElapsedMs:Date.now()-started,backend:base,scope:'Real backend WebSocket/alarms; adversarial messages are explicit protocol fixtures, not UI play',at:new Date().toISOString()};await fs.writeFile(dir+'/runtime.json',JSON.stringify(result,null,2));console.log('PASS runtime',checks);
 }
}finally{for(const cs of pairs)for(const c of cs)try{c.close();}catch{}}
