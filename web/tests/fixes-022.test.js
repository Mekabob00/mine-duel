import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/game.js';
import {CpuBrain,cpuStep} from '../js/ai.js';
import {SIDE as S,PHASE as P,DEFAULTS,DIFFICULTIES,MINE_STRATEGIES} from '../js/config.js';
import {started,seeded} from './helpers.js';

test('Fix01 initial overlap counts one occupied neighbor and emits the ordinary message',()=>{
 const g=new Game();g.explore(S.PLAYER,0);g.explore(S.CPU,63);const first=g.placeMine(S.PLAYER,1);const before=g.observe(S.CPU).cells[0].number;const second=g.placeMine(S.CPU,1);
 assert.equal(second.ok,true);assert.equal(second.message,first.message);assert.equal(g.observe(S.CPU).cells[0].number,before);assert.equal(before,1);assert.ok(g.observe(S.PLAYER).cells[1].ownMine&&g.observe(S.CPU).cells[1].ownMine);
});
test('Fix01 opening and normal placement share exactly the public legality conditions',()=>{
 for(const opening of [true,false]){const g=new Game();g.explore(S.PLAYER,0);g.explore(S.CPU,63);g.placeMine(S.PLAYER,1);if(!opening){g.placeMine(S.CPU,62);g.explore(S.PLAYER,20);g.placeMine(S.PLAYER,21);g.endTurn(S.PLAYER);g.explore(S.CPU,40);g.addMarker(S.CPU,30);}const before=g.observe(S.CPU);assert.equal(g.placeMine(S.CPU,0).ok,false);assert.deepEqual(g.observe(S.CPU),before);if(!opening)assert.equal(g.placeMine(S.CPU,30).ok,false);assert.equal(g.placeMine(S.CPU,1).ok,true);}
 const g=started({minesPerTurn:2});g.explore(S.PLAYER,20);g.placeMine(S.PLAYER,30);const b=g.observe(S.PLAYER);assert.equal(g.placeMine(S.PLAYER,30).ok,false);assert.deepEqual(g.observe(S.PLAYER),b);
});
test('Fix01 CPU opening proposals cannot distinguish hidden opponent layouts',()=>{
 const make=i=>{const g=new Game();g.explore(S.PLAYER,0);g.explore(S.CPU,63);g.placeMine(S.PLAYER,i);return g.observe(S.CPU);};const a=make(20),b=make(21);assert.deepEqual(a,b);
 for(let seed=0;seed<100;seed++){const x=new CpuBrain(.2,seeded(seed)).mineProposals(a),y=new CpuBrain(.2,seeded(seed)).mineProposals(b);assert.deepEqual(x,y);assert.ok(x.includes(20)&&x.includes(21));}
});
test('Fix02 both actors reject own and shared mines without changing any observed state',()=>{
 for(const side of [S.PLAYER,S.CPU])for(const shared of [false,true]){const g=started();if(shared){g.explore(S.PLAYER,61);g.placeMine(S.PLAYER,62);g.endTurn(S.PLAYER);if(side===S.PLAYER){g.explore(S.CPU,40);g.placeMine(S.CPU,41);g.endTurn(S.CPU);}}else if(side===S.CPU){g.explore(S.PLAYER,20);g.placeMine(S.PLAYER,21);g.endTurn(S.PLAYER);}const target=shared?62:side===S.PLAYER?1:62,before=g.observe(side);assert.equal(g.explore(side,target).ok,false);assert.deepEqual(g.observe(side),before);assert.equal(g.result,null);}
});
test('Fix02 enemy-only mine contact remains lethal for either actor',()=>{
 const player=started();assert.equal(player.explore(S.PLAYER,62).ok,true);assert.equal(player.result,'loss');const cpu=started();cpu.explore(S.PLAYER,20);cpu.placeMine(S.PLAYER,21);cpu.endTurn(S.PLAYER);assert.equal(cpu.explore(S.CPU,1).ok,true);assert.equal(cpu.result,'win');
});
test('Fix03 no marker allowance forces inferred mine and uses actual result',()=>{
 const g=started({width:3,height:2,markersPerTurn:0});g.explore(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.endTurn(S.PLAYER);cpuStep(g,new CpuBrain(0,()=>0,()=>0));assert.equal(g.result,'win');assert.equal(g.reason,'cpuHit');
 const wrong=started({width:3,height:2,initialMines:0,markersPerTurn:0});wrong.explore(S.PLAYER,2);wrong.placeMine(S.PLAYER,3);wrong.endTurn(S.PLAYER);const brain=new CpuBrain(0,()=>0,()=>0);brain.deduce=b=>({safe:new Set(),dangerous:new Set(b.cells.flatMap((c,i)=>!c.revealed?[i]:[]))});cpuStep(wrong,brain);assert.equal(wrong.result,null);assert.equal(wrong.phase,P.MINE);assert.equal(wrong.observe(S.CPU).cells[1].revealed,true);
});
test('Fix03 forced marker can trigger the shared full-blockade draw',()=>{
 const g=started({width:3,height:2,markersPerTurn:2});g.explore(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.addMarker(S.PLAYER,4);g.addMarker(S.PLAYER,1);g.endTurn(S.PLAYER);
 assert.equal(g.result,null);assert.equal(g.observe(S.CPU).markersUsed,0);cpuStep(g,new CpuBrain(0,()=>0,()=>0));assert.equal(g.result,'draw');assert.equal(g.reason,'noExplore');assert.equal(g.observe(S.CPU).cells[3].marker,S.CPU);
});
test('Fix04 end-turn marker threshold is 0.70, quota and candidates are respected',()=>{
 const cells=Array.from({length:4},()=>({revealed:false,ownMine:false,marker:null,number:-1}));cells[0]={...cells[0],revealed:true,number:3};const board={width:2,height:2,viewer:S.CPU,phase:P.END,markersUsed:0,markerLimit:1,cells};
 assert.equal(DEFAULTS.cpuMarkerChance,.7);for(const [roll,expected]of [[0,1],[.699999,1],[.7,-1],[.999,-1]]){let values=[roll,0];assert.equal(new CpuBrain(.2,()=>values.shift()??0).chooseMarker(board,DEFAULTS.cpuMarkerChance),expected);}
 assert.equal(new CpuBrain(0,()=>0).chooseMarker({...board,markersUsed:1},.7),-1);assert.equal(new CpuBrain(0,()=>0).chooseMarker({...board,cells:cells.map(c=>({...c,marker:S.PLAYER}))},.7),-1);
 const g=started();g.explore(S.PLAYER,20);g.placeMine(S.PLAYER,21);g.endTurn(S.PLAYER);g.explore(S.CPU,40);g.placeMine(S.CPU,41);let chance;cpuStep(g,{chooseMarker:(_b,c)=>{chance=c;return -1;}});assert.equal(chance,.7);
 assert.deepEqual(Object.values(DIFFICULTIES).map(d=>d.mistake),[.4,.2,.05]);assert.deepEqual(MINE_STRATEGIES,{random:.6,recent:.25,revealed:.15});
});
