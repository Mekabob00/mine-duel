import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction, timeout, checkProgress, score, observe, TURN_MS, GRACE_MS, DAY_MS } from '../src/game.js';
import { makeRoom, join, connect, command, settle, start, snapshot } from '../src/state.js';
const opening = first => { const g = newGame(first, 0); applyAction(g, first, 'explore', 0, 1); applyAction(g, 1-first, 'explore', 63, 2); applyAction(g, first, 'mine', 1, 3); applyAction(g, 1-first, 'mine', 62, 4); return g; };
const room = () => { const r = makeRoom('ABCDEFGHJK','a',0); join(r,'b',0); connect(r,0,0); connect(r,1,0); return r; };
const request = (r,seat,type,extra={}) => ({ type, requestId: crypto.randomUUID(), seq:r.seats[seat].seq+1, revision:r.revision, gameId:r.game?.id??null, turnId:r.game?.turnId, ...extra });

test('opening order, first-seat symmetry and initial overlap count occupied cells once',()=>{
 for(const first of [0,1]){const g=newGame(first,0);assert.equal(g.current,first);applyAction(g,first,'explore',0,1);applyAction(g,1-first,'explore',63,2);applyAction(g,first,'mine',1,3);const n=g.cells[0].number;assert.equal(applyAction(g,1-first,'mine',1,4),null);assert.equal(g.cells[0].number,n);assert.equal(g.cells[1].owners,3);assert.equal(g.current,first);assert.equal(g.phase,'explore');assert.equal(g.deadline,20004);}
});
test('entire normal turn keeps one deadline after explore and mine; early end resets once',()=>{
 const g=opening(0),d=g.deadline;applyAction(g,0,'explore',20,10);assert.equal(g.deadline,d);applyAction(g,0,'mine',21,11);assert.equal(g.deadline,d);applyAction(g,0,'end',undefined,12);assert.equal(g.current,1);assert.equal(g.deadline,20012);
});
test('explore-only timeout keeps reveal and skips missing mine',()=>{
 const g=opening(0);applyAction(g,0,'explore',20,100);timeout(g,g.deadline);assert.equal(g.current,1);assert.equal(g.phase,'explore');assert.equal(g.cells[20].revealed,true);assert.deepEqual(g.counts,[1,1]);
});
test('explore+mine timeout keeps both and resets marker quota',()=>{
 const g=opening(0);applyAction(g,0,'explore',20,10);applyAction(g,0,'mine',21,11);applyAction(g,0,'marker',22,12);timeout(g,g.deadline);assert.equal(g.cells[21].owners,1);assert.equal(g.cells[22].marker,0);assert.equal(g.markersUsed,0);assert.equal(g.current,1);
});
test('all four opening actions auto-complete on their own deadlines without missing initial actions',()=>{
 const g=newGame(1,0);for(let n=1;n<=4;n++){assert.equal(timeout(g,n*TURN_MS,()=>0),true);assert.equal(g.deadline,(n+1)*TURN_MS);}assert.equal(g.phase,'explore');assert.equal(g.current,1);assert.equal(g.cells.filter(c=>c.revealed).length,2);assert.deepEqual(g.counts,[1,1]);
});
test('timeout is idempotent at old deadline and does not roll back markers',()=>{
 const g=opening(0);applyAction(g,0,'marker',20,10);const old=g.deadline;assert.ok(timeout(g,old));const before=structuredClone(g);assert.equal(timeout(g,old),false);assert.deepEqual(g,before);
});
test('last safe cell revealed or marked ends immediately by score',()=>{
 for(const kind of ['explore','marker']){const g=opening(0);g.cells.forEach((c,i)=>{c.revealed=i!==30;c.owners=0;c.marker=null;});assert.equal(applyAction(g,0,kind,30,10),null);assert.equal(g.result.reason,'noSafeCells');assert.equal(g.phase,'finished');assert.equal(g.result.winner,kind==='marker'?1:null);}
});
test('full marker blockade ends even if own safe marker could be removed',()=>{
 const g=opening(0);g.cells.forEach(c=>{c.revealed=false;c.marker=0;c.owners=0;});checkProgress(g,10);assert.equal(g.result.reason,'noSafeCells');assert.equal(applyAction(g,0,'remove',20,11),'NOT_YOUR_TURN');
});
test('final scoring covers opponent, shared, own-only, empty and negative totals',()=>{
 const g=opening(0);g.cells.forEach(c=>{c.marker=null;c.owners=0;});[2,3,1,0,0].forEach((owners,i)=>Object.assign(g.cells[i],{owners,marker:0}));assert.deepEqual(score(g,0),{correct:2,incorrect:3,score:-1});Object.assign(g.cells[10],{owners:0,marker:1});Object.assign(g.cells[11],{owners:0,marker:1});g.cells.forEach(c=>{if(!c.owners&&c.marker===null)c.revealed=true;});checkProgress(g,12);assert.equal(g.result.winner,0);
});
test('removed markers excluded; quota never refunded; opponent cannot remove marker',()=>{
 const g=opening(0);applyAction(g,0,'marker',20,10);assert.equal(applyAction(g,1,'remove',20,11),'NOT_YOUR_TURN');assert.equal(applyAction(g,0,'remove',20,12),null);assert.equal(g.markersUsed,1);assert.equal(applyAction(g,0,'marker',21,13),'INVALID_MARKER');assert.deepEqual(score(g,0),{correct:0,incorrect:0,score:0});
});
test('tied negative marker scores draw',()=>{
 const g=opening(0);g.cells.forEach(c=>{c.revealed=true;c.owners=0;c.marker=null;});Object.assign(g.cells[20],{revealed:false,marker:0});Object.assign(g.cells[21],{revealed:false,marker:1});checkProgress(g,10);assert.equal(g.result.winner,null);assert.deepEqual(g.result.scores.map(s=>s.score),[-1,-1]);
});
test('KO outranks scoring and terminal actions rejected; own/shared exploration rejected',()=>{
 const g=opening(0);assert.equal(applyAction(g,0,'explore',1,10),'INVALID_EXPLORE');g.cells[1].owners=3;assert.equal(applyAction(g,0,'explore',1,10),'INVALID_EXPLORE');applyAction(g,0,'explore',62,11);assert.equal(g.result.reason,'mineHit');assert.equal(g.result.winner,1);assert.equal(g.result.scores,undefined);const before=structuredClone(g);applyAction(g,0,'marker',20,12);assert.deepEqual(g,before);
});
test('active snapshots never expose enemy mines or hidden numbers; final snapshot exposes owners and marker judgment',()=>{
 const g=opening(0);applyAction(g,0,'marker',62,10);const a=observe(g,0),b=observe(g,1);assert.equal(a.cells[62].ownMine,false);assert.equal(b.cells[62].ownMine,true);assert.equal(a.cells[62].owners,undefined);assert.equal(a.cells[62].number,-1);a.cells[0].number=99;assert.notEqual(g.cells[0].number,99);applyAction(g,0,'explore',62,11);assert.equal(g.result,null);applyAction(g,0,'remove',62,12);applyAction(g,0,'explore',62,13);const final=observe(g,0);assert.equal(final.cells[62].owners,2);assert.equal(final.result.reason,'mineHit');
});
test('same public view for enemy-only hidden changes that do not affect revealed numbers',()=>{
 const a=opening(0),b=structuredClone(a);a.cells[40].owners=2;b.cells[41].owners=2;assert.deepEqual(observe(a,0),observe(b,0));
});
test('both ready required, random first, bilateral rematch alternates and clears board',()=>{
 const r=room();command(r,0,request(r,0,'ready'),1,()=>1);assert.equal(r.game,null);command(r,1,request(r,1,'ready'),2,()=>1);assert.equal(r.game.first,1);command(r,0,request(r,0,'resign'),3);assert.equal(r.game.result.reason,'resigned');command(r,0,request(r,0,'rematch'),4);assert.equal(r.status,'finished');command(r,1,request(r,1,'rematch'),5);assert.equal(r.game.first,0);assert.equal(r.game.cells.some(c=>c.owners||c.marker!==null||c.revealed),false);assert.equal(r.game.markersUsed,0);
});
test('duplicate request is idempotent and conflicting payload rejected',()=>{
 const r=room(),m=request(r,0,'ready');const first=command(r,0,m,1);const before=structuredClone(r);assert.deepEqual(command(r,0,m,2),first);assert.deepEqual(r,before);assert.equal(command(r,0,{...m,type:'resign'},3).code,'REQUEST_CONFLICT');
});
test('old game, stale turn, forged seat and deadline race cannot act on a new turn',()=>{
 const r=room();start(r,0,()=>0);r.game=opening(0);const m=request(r,0,'action',{kind:'explore',index:20});settle(r,r.game.deadline,()=>0);const before=r.game.cells[20].revealed;assert.equal(command(r,0,m,20005).accepted,false);assert.equal(r.game.cells[20].revealed,before);assert.equal(command(r,0,request(r,0,'action',{gameId:'old',kind:'explore',index:20}),20006).code,'STALE_GAME');
});
test('seat authentication projection does not include credentials, request history or internal state',()=>{
 const r=room();start(r,0,()=>0);const view=snapshot(r,0,1);const text=JSON.stringify(view);assert.equal(text.includes('hash'),false);assert.equal(view.seats[0].epoch,undefined);assert.equal(view.game.cells[0].owners,undefined);
});
test('reconnect before deadline succeeds; expired single player loses without marker scoring',()=>{
 const r=room();start(r,0,()=>0);r.game=opening(0);r.seats[0].disconnectedAt=100;r.seats[1].lastSeen=100+GRACE_MS;connect(r,0,100+GRACE_MS-1);assert.equal(r.seats[0].disconnectedAt,null);r.seats[0].disconnectedAt=200;settle(r,200+GRACE_MS);assert.equal(r.game.result.reason,'disconnectLoss');assert.equal(r.game.result.winner,1);assert.equal(r.game.result.scores,undefined);
});
test('both absent waits for both grace periods then voids; presence recovery yields single loss',()=>{
 const r=room();start(r,0,()=>0);r.game=opening(0);r.seats[0].disconnectedAt=100;r.seats[1].disconnectedAt=1000;settle(r,100+GRACE_MS);assert.equal(r.game.result,null);settle(r,1000+GRACE_MS);assert.equal(r.game.result.reason,'bothDisconnected');assert.equal(r.game.result.winner,null);
 const a=room();start(a,0,()=>0);a.game=opening(0);a.seats[0].disconnectedAt=100;a.seats[1].disconnectedAt=1000;connect(a,1,100+GRACE_MS+1);settle(a,100+GRACE_MS+2);assert.equal(a.game.result.reason,'disconnectLoss');assert.equal(a.game.result.winner,1);
});
test('serialization roundtrip survives server recreation including request dedup and deadlines',()=>{
 const r=room();start(r,0,()=>0);const m=request(r,0,'action',{kind:'explore',index:0});command(r,0,m,1);const restored=JSON.parse(JSON.stringify(r));assert.deepEqual(snapshot(restored,0,2),snapshot(r,0,2));assert.deepEqual(command(restored,0,m,2),r.seats[0].replies.at(-1).reply);
});
test('waiting room and finished result expire after 24h, active room ignores creation age',()=>{
 const waiting=makeRoom('ABCDEFGHJK','a',0);settle(waiting,DAY_MS);assert.equal(waiting.status,'expired');const r=room();start(r,DAY_MS,()=>0);r.seats.forEach(s=>s.lastSeen=DAY_MS);settle(r,DAY_MS+1);assert.equal(r.status,'playing');command(r,0,request(r,0,'resign'),DAY_MS+2);settle(r,DAY_MS*2+2);assert.equal(r.status,'expired');
});
test('malformed action index/phase and opponent marker removal cannot change state',()=>{
 const g=opening(0);for(const index of [-1,64,1.5,{},null]){const before=structuredClone(g);assert.equal(applyAction(g,0,'explore',index,10),'INVALID_EXPLORE');assert.deepEqual(g,before);}g.cells[20].marker=1;assert.equal(applyAction(g,0,'remove',20,10),'INVALID_REMOVAL');
});
test('room is limited to two seats; repeated same bootstrap secret is idempotent',()=>{
 const r=makeRoom('ABCDEFGHJK','a',0);assert.equal(join(r,'a',1),0);assert.equal(join(r,'b',2),1);assert.equal(join(r,'b',3),1);assert.throws(()=>join(r,'c',4),/ROOM_FULL/);
});
test('rematch retains final result reference for 24 hours and schedules independent history expiry',()=>{
 const r=room();start(r,0,()=>0);command(r,0,request(r,0,'resign'),1);const id=r.game.id;
 command(r,0,request(r,0,'rematch'),2);command(r,1,request(r,1,'rematch'),3);
 assert.deepEqual(r.pastResults,[{id,until:DAY_MS+1}]);assert.notEqual(r.game.id,id);
 settle(r,DAY_MS+1);assert.deepEqual(r.pastResults,[]);
});
test('ready or rematch consents retained across disconnection cannot deadlock the waiting room',()=>{
 const r=room();r.seats[0].disconnectedAt=1;
 command(r,0,request(r,0,'ready'),2);command(r,1,request(r,1,'ready'),3);assert.equal(r.status,'waiting');
 connect(r,0,4);assert.equal(r.status,'playing');
 command(r,0,request(r,0,'resign'),5);r.seats[0].disconnectedAt=6;
 command(r,0,request(r,0,'rematch'),7);command(r,1,request(r,1,'rematch'),8);assert.equal(r.status,'finished');
 connect(r,0,9);assert.equal(r.status,'playing');
});
test('long server outage cannot restore a result beyond its 24-hour retention',()=>{
 const r=room();start(r,0,()=>0);settle(r,DAY_MS*2,()=>0);assert.equal(r.status,'expired');
});
