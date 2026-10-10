import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { SIDE as S, PHASE as P, DIFFICULTIES } from '../js/config.js';
import { CpuBrain, cpuStep } from '../js/ai.js';
import { started, seeded } from './helpers.js';

test('opening: safe cells, distinct first mines, actors and phase restrictions', () => {
  const g = new Game(); assert.equal(g.placeMine(S.PLAYER,1).ok,false);
  assert.equal(g.explore(S.CPU,0).ok,false); assert.equal(g.explore(S.PLAYER,0).ok,true);
  assert.equal(g.explore(S.CPU,0).ok,false); g.explore(S.CPU,63);
  assert.equal(g.placeMine(S.PLAYER,0).ok,false); g.placeMine(S.PLAYER,1);
  assert.equal(g.placeMine(S.CPU,1).ok,false); g.placeMine(S.CPU,62);
  assert.equal(g.phase,P.EXPLORE); assert.equal(g.current,S.PLAYER);
  assert.equal(g.observe(S.PLAYER).cells[0].revealedBy,S.PLAYER);
  assert.equal(g.observe(S.PLAYER).cells[63].revealedBy,S.CPU);
  assert.equal(g.observe(S.PLAYER).cells.filter(c=>c.revealed).length,2);
  assert.equal(g.endTurn(S.PLAYER).ok,false);
  assert.equal(g.explore(S.PLAYER,1.5).ok,false); assert.equal(g.explore(S.PLAYER,-1).ok,false);
});
test('numbers update without flood fill and preserve explorers and old snapshots', () => {
  const g = started(), old = g.observe(S.PLAYER);
  g.explore(S.PLAYER,9); g.placeMine(S.PLAYER,8);
  assert.equal(g.observe(S.CPU).cells[0].number,2); assert.equal(old.cells[0].number,1);
  assert.equal(g.observe(S.PLAYER).cells[0].revealedBy,S.PLAYER);
  assert.equal(g.observe(S.PLAYER).cells.filter(c=>c.revealed).length,3);
  assert.equal(g.phase,P.END); g.endTurn(S.PLAYER); g.explore(S.CPU,20);
  assert.equal(g.observe(S.PLAYER).cells[20].revealedBy,S.CPU);
});
test('normal overlaps own enemy mines but count occupied cells once; no special notice', () => {
  const g = started({minesPerTurn:2}); g.explore(S.PLAYER,61);
  const ordinary = g.placeMine(S.PLAYER,10); const before = g.observe(S.PLAYER).cells[61].number;
  const overlap = g.placeMine(S.PLAYER,62);
  assert.equal(overlap.ok,true); assert.equal(overlap.message,ordinary.message);
  assert.equal(g.observe(S.PLAYER).cells[61].number,before);
  assert.equal(g.observe(S.PLAYER).cells[62].ownMine,true); assert.equal(g.observe(S.CPU).cells[62].ownMine,true);
  assert.equal(g.observe(S.PLAYER).playerMines,3);
});
test('own mine cannot be placed again even within multi-mine turn', () => {
  const g = started({minesPerTurn:2}); g.explore(S.PLAYER,20); g.placeMine(S.PLAYER,62);
  assert.equal(g.placeMine(S.PLAYER,62).ok,false); assert.equal(g.placeMine(S.PLAYER,1).ok,false);
});
test('markers block both actions; removal does not refund quota; ownership enforced', () => {
  const g = started(); assert.equal(g.addMarker(S.PLAYER,62).ok,true);
  assert.equal(g.explore(S.PLAYER,62).ok,false); assert.equal(g.removeMarker(S.CPU,62).ok,false);
  g.removeMarker(S.PLAYER,62); assert.equal(g.addMarker(S.PLAYER,30).ok,false);
  g.explore(S.PLAYER,20); g.placeMine(S.PLAYER,30); g.endTurn(S.PLAYER);
  g.addMarker(S.CPU,31); g.explore(S.CPU,40); assert.equal(g.placeMine(S.CPU,31).ok,false);
  g.placeMine(S.CPU,41); g.endTurn(S.CPU);
  assert.equal(g.removeMarker(S.PLAYER,31).ok,false); assert.equal(g.explore(S.PLAYER,31).ok,false);
  assert.equal(g.addMarker(S.PLAYER,20).ok,false);
});
test('own, enemy and shared mines are lethal, with terminal input blocked', () => {
  for (const cell of [1,62]) {
    const g = started(); g.explore(S.PLAYER,cell); assert.equal(g.result,'loss');
    assert.equal(g.explore(S.PLAYER,20).ok,false); assert.equal(g.addMarker(S.PLAYER,30).ok,false);
  }
  const shared = started(); shared.explore(S.PLAYER,61); shared.placeMine(S.PLAYER,62); shared.endTurn(S.PLAYER);
  shared.explore(S.CPU,62); assert.equal(shared.result,'win');
  const own = started(); own.explore(S.PLAYER,20); own.placeMine(S.PLAYER,21); own.endTurn(S.PLAYER);
  own.explore(S.CPU,62); assert.equal(own.result,'win');
});
test('draw when all hidden cells are marked', () => {
  const g = started({initialMines:0,markersPerTurn:62});
  for(let i=1;i<63;i++) g.addMarker(S.PLAYER,i);
  assert.equal(g.result,'draw');
});
test('no mandatory mine placement remains => draw; own marker can restore progress', () => {
  const noPlace = started({width:2,height:2,initialMines:0,minesPerTurn:2});
  noPlace.explore(S.PLAYER,1); noPlace.placeMine(S.PLAYER,2);
  assert.equal(noPlace.result,'draw'); assert.match(noPlace.reason,/설치할 수/);
  const restore = started({width:3,height:2,markersPerTurn:2});
  restore.addMarker(S.PLAYER,3); restore.addMarker(S.PLAYER,4); restore.explore(S.PLAYER,2);
  assert.equal(restore.phase,P.MINE); restore.removeMarker(S.PLAYER,3); assert.equal(restore.placeMine(S.PLAYER,3).ok,true);
});
test('CPU own-only candidate exhaustion ends without infinite loop', () => {
  const g = started({width:3,height:2,markersPerTurn:2});
  g.explore(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.addMarker(S.PLAYER,1);g.addMarker(S.PLAYER,3);g.endTurn(S.PLAYER);
  assert.equal(new CpuBrain().chooseExplore(g.observe(S.CPU)),-1);
  cpuStep(g,new CpuBrain());assert.equal(g.result,'draw');
});
test('observations are immutable and do not contain hidden enemy state', () => {
  const g = started(), p = g.observe(S.PLAYER), c = g.observe(S.CPU);
  assert.equal(p.cells[62].ownMine,false); assert.equal(c.cells[1].ownMine,false);
  assert.deepEqual(Object.keys(c.cells[1]).sort(),['marker','number','ownMine','revealed','revealedBy']);
  assert.equal(c.cells[1].number,-1); assert.equal(Object.isFrozen(c.cells),true);
  assert.throws(()=>{c.cells[1].ownMine=true;},TypeError);
  assert.equal(Object.keys(g).length,0);
});
test('1500 seeded complete games finish with each CPU difficulty', () => {
  const counts={win:0,loss:0,draw:0}; let maxSteps=0;
  for(const difficulty of Object.values(DIFFICULTIES)) for(let seed=0;seed<500;seed++) {
    const rng=seeded(seed), brain=new CpuBrain(difficulty.mistake,rng,seeded(seed+800)), g=new Game(); let step=0;
    while(g.phase!==P.FINISHED && step++<500) {
      if(g.current===S.CPU) {cpuStep(g,brain);continue;}
      const board=g.observe(S.PLAYER);
      if(g.phase===P.END) {g.endTurn(S.PLAYER);continue;}
      const options=board.cells.flatMap((c,i)=>!c.revealed&&!c.marker&&!c.ownMine?[i]:[]);
      if(!options.length) {
        const marked=board.cells.findIndex(c=>c.marker===S.PLAYER&&!c.ownMine);
        if(marked>=0) {g.removeMarker(S.PLAYER,marked);continue;}
        // Human can still choose their own mine, as required by rules.
        const own=board.cells.findIndex(c=>!c.revealed&&!c.marker);
        assert.ok(own>=0);g.explore(S.PLAYER,own);continue;
      }
      const target=options[Math.floor(rng()*options.length)];
      if([P.OPEN_REVEAL,P.EXPLORE].includes(g.phase)) g.explore(S.PLAYER,target); else g.placeMine(S.PLAYER,target);
    }
    assert.ok(g.result,`seed ${seed} failed to terminate`); counts[g.result]++; maxSteps=Math.max(step,maxSteps);
  }
  console.log({simulatedGames:1500,counts,maxSteps});
});
