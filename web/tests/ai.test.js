import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CpuBrain, cpuStep } from '../js/ai.js';
import { Game } from '../js/game.js';
import { PHASE, SIDE, DIFFICULTIES } from '../js/config.js';
import { neighbors } from '../js/board.js';
import { seeded, started } from './helpers.js';

function observation() {
  const cells=Array.from({length:9},()=>({revealed:false,number:-1,ownMine:false,marker:null}));
  cells[0]={revealed:true,number:0,ownMine:false,marker:null};cells[8].ownMine=true;cells[7].marker=SIDE.PLAYER;
  return {width:3,height:3,cells,phase:PHASE.EXPLORE,lastPlayerReveal:0,viewer:SIDE.CPU,markersUsed:0,markerLimit:1};
}
test('difficulty rates, certainty bypass, no own-mine/marker candidates',()=>{
  const board=observation(), safe=new CpuBrain().deduce(board).safe;
  for(const [key,d] of Object.entries(DIFFICULTIES)) {
    const brain=new CpuBrain(d.mistake,seeded(22),seeded(789));let mistakes=0;const selected=new Set();
    for(let i=0;i<10000;i++) {const target=brain.chooseExplore(board);assert.ok(![0,7,8].includes(target));if(!safe.has(target)) mistakes++;selected.add(target);}
    assert.ok(Math.abs(mistakes/10000-d.mistake)<0.02); assert.ok(selected.has(2),'potential enemy mine can be selected');console.log(key,mistakes+'/10000');
  }
  assert.ok(safe.has(new CpuBrain(0).chooseExplore(board)));assert.ok(!safe.has(new CpuBrain(1).chooseExplore(board)));
  const small={...board,width:2,height:2,cells:board.cells.slice(0,4)};small.cells[0].number=0;
  assert.ok(new CpuBrain(1).chooseExplore(small)>0,'no uncertain candidates fall back to safe');
});
test('different private enemy layouts have identical public AI behavior',()=>{
  const make=(mine)=>{const g=new Game();g.explore(SIDE.PLAYER,0);g.explore(SIDE.CPU,63);g.placeMine(SIDE.PLAYER,mine);g.placeMine(SIDE.CPU,62);g.explore(SIDE.PLAYER,1);g.placeMine(SIDE.PLAYER,30);g.endTurn(SIDE.PLAYER);return g;};
  const a=make(20),b=make(21);assert.deepEqual(a.observe(SIDE.CPU),b.observe(SIDE.CPU));
  for(const d of Object.values(DIFFICULTIES)) for(let seed=0;seed<100;seed++) {
    assert.equal(new CpuBrain(d.mistake,seeded(seed),seeded(seed+100)).chooseExplore(a.observe(SIDE.CPU)),new CpuBrain(d.mistake,seeded(seed),seeded(seed+100)).chooseExplore(b.observe(SIDE.CPU)));
    assert.deepEqual(new CpuBrain(d.mistake,seeded(seed)).mineProposals(a.observe(SIDE.CPU)),new CpuBrain(d.mistake,seeded(seed)).mineProposals(b.observe(SIDE.CPU)));
  }
});
test('mine strategy first picks follow 60/25/15 selection and missing pool fallback',()=>{
  const board=observation();
  const near=new Set(neighbors(0,3,3));
  for(const roll of [0.1,0.59]) {
    const values=[roll,0.99];const brain=new CpuBrain(0,()=>values.shift()??0.5);
    assert.equal(brain.mineProposals(board)[0],6,'global includes cells far from reveal');
  }
  for(const roll of [0.60,0.84,0.85,0.99]) {
    const values=[roll,0.99];const proposal=new CpuBrain(0,()=>values.shift()??0.5).mineProposals(board);
    assert.ok(near.has(proposal[0]));assert.ok(!proposal.includes(7)&&!proposal.includes(8));
  }
  const empty={...board,lastPlayerReveal:-1,cells:board.cells.map(c=>({...c,revealed:false}))};
  assert.ok(new CpuBrain(0,()=>0.75).mineProposals(empty).length,'recent missing => global');
  assert.ok(new CpuBrain(0,()=>0.95).mineProposals(empty).length,'no revealed => global');
});
test('initial hidden collision handled by arbiter; shared normal CPU placement permitted',()=>{
  const g=new Game();g.explore(SIDE.PLAYER,0);g.explore(SIDE.CPU,63);g.placeMine(SIDE.PLAYER,1);
  const brain={mineProposals:()=>[1,62]};assert.equal(cpuStep(g,brain).ok,true);assert.equal(g.observe(SIDE.CPU).cells[62].ownMine,true);
  g.explore(SIDE.PLAYER,20);g.placeMine(SIDE.PLAYER,21);g.endTurn(SIDE.PLAYER);g.explore(SIDE.CPU,40);
  const before=g.observe(SIDE.CPU).cells[20].number;cpuStep(g,{mineProposals:()=>[21]});
  assert.equal(g.observe(SIDE.CPU).cells[21].ownMine,true);assert.equal(g.observe(SIDE.PLAYER).cells[21].ownMine,true);assert.equal(g.observe(SIDE.CPU).cells[20].number,before);
});
test('deduction treats shared own mines once and does not mark own mines',()=>{
  const g=started();g.explore(SIDE.PLAYER,61);g.placeMine(SIDE.PLAYER,62);g.endTurn(SIDE.PLAYER);
  const board=g.observe(SIDE.CPU),brain=new CpuBrain(0,()=>0);const {safe,dangerous}=brain.deduce(board);
  assert.ok(dangerous.has(62));assert.ok(safe.has(54));assert.equal(brain.chooseMarker(board,1),-1);
});
