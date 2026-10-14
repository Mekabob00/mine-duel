import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { CpuBrain, cpuStep } from '../js/ai.js';
import { SIDE as S, PHASE as P } from '../js/config.js';
import { started, seeded } from './helpers.js';

test('Q01 all markers has priority even with removable markers, and cannot be undone',()=>{
  const g=started({initialMines:0,width:3,height:2,markersPerTurn:4});
  for(const i of [1,2,3,4])assert.equal(g.addMarker(S.PLAYER,i).ok,true);
  assert.equal(g.result,'draw');assert.equal(g.reason,'noExplore');
  assert.ok(g.explorationOptions(S.PLAYER).removableMarkers.length);
  assert.equal(g.removeMarker(S.PLAYER,1).ok,false);assert.equal(g.reason,'noExplore');
});
test('Q02 common candidates match detached own-only observations for both sides',()=>{
  const g=started();g.addMarker(S.PLAYER,20);
  for(const side of [S.PLAYER,S.CPU]){
    const b=g.observe(side), o=g.explorationOptions(side);
    assert.deepEqual(o.candidates,b.cells.flatMap((c,i)=>!c.revealed&&!c.ownMine&&!c.marker?[i]:[]));
    assert.deepEqual(o.removableMarkers,b.cells.flatMap((c,i)=>!c.revealed&&!c.ownMine&&c.marker===side?[i]:[]));
    assert.equal(Object.isFrozen(o.candidates),true);
  }
});
test('Q02 player exhaustion ends at turn entry when every hidden cell is own or shared',()=>{
  const g=started({width:5,height:2,initialMines:0,minesPerTurn:2});
  g.explore(S.PLAYER,1);g.placeMine(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.endTurn(S.PLAYER);
  g.explore(S.CPU,8);g.placeMine(S.CPU,4);g.placeMine(S.CPU,5);g.endTurn(S.CPU);
  g.explore(S.PLAYER,6);g.placeMine(S.PLAYER,4);g.placeMine(S.PLAYER,5);g.endTurn(S.PLAYER);
  g.explore(S.CPU,7);g.placeMine(S.CPU,2);g.placeMine(S.CPU,3);g.endTurn(S.CPU);
  assert.equal(g.current,S.PLAYER);assert.equal(g.result,'draw');assert.equal(g.reason,'explorationExhausted');
  assert.equal(g.explore(S.PLAYER,2).ok,false);
});
test('Q02 CPU exhaustion uses the same reason before any AI callback',()=>{
  const g=started({width:3,height:2,markersPerTurn:2});
  g.explore(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.addMarker(S.PLAYER,1);g.addMarker(S.PLAYER,3);g.endTurn(S.PLAYER);
  assert.equal(g.current,S.CPU);assert.equal(g.result,'draw');assert.equal(g.reason,'explorationExhausted');
  assert.equal(cpuStep(g,new CpuBrain()).ok,false);
});
test('Q02 player marker recovery preserves phase and allowance, including an enemy mine',()=>{
  const g=new Game({width:3,height:2,initialMines:2,markersPerTurn:2});
  g.explore(S.PLAYER,0);g.explore(S.CPU,5);
  g.placeMine(S.PLAYER,1);g.placeMine(S.CPU,4);g.placeMine(S.PLAYER,2);g.placeMine(S.CPU,3);
  g.addMarker(S.PLAYER,3);g.addMarker(S.PLAYER,4);
  assert.equal(g.result,null);assert.deepEqual(g.explorationOptions(S.PLAYER).candidates,[]);
  assert.deepEqual(g.explorationOptions(S.PLAYER).removableMarkers,[3,4]);
  g.removeMarker(S.PLAYER,3);assert.equal(g.phase,P.EXPLORE);assert.equal(g.observe(S.PLAYER).markersUsed,2);
  assert.deepEqual(g.explorationOptions(S.PLAYER).candidates,[3]);
  assert.equal(g.addMarker(S.PLAYER,3).ok,false);g.explore(S.PLAYER,3);assert.equal(g.result,'loss');
});
test('Q02 CPU marker recovery is finite and does not refund its quota',()=>{
  const g=started({width:3,height:2,markersPerTurn:2});g.explore(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.endTurn(S.PLAYER);
  g.addMarker(S.CPU,1);g.addMarker(S.CPU,3);assert.equal(g.result,null);
  cpuStep(g,new CpuBrain(0));assert.equal(g.observe(S.CPU).cells[1].marker,null);assert.equal(g.observe(S.CPU).markersUsed,2);
  assert.equal(g.phase,P.EXPLORE);cpuStep(g,new CpuBrain(0));assert.equal(g.result,'draw');assert.equal(g.reason,'cpuCertainMines');
});
test('Q02 own-marker-on-own-mine is not a recoverable exploration cell',()=>{
  const g=started();g.addMarker(S.PLAYER,1);
  assert.ok(!g.explorationOptions(S.PLAYER).removableMarkers.includes(1));
  g.removeMarker(S.PLAYER,1);g.explore(S.PLAYER,1);assert.equal(g.result,'loss');
});
test('Q02 hidden enemy layouts cannot affect progress candidates',()=>{
  for(const viewer of [S.PLAYER,S.CPU]){
    const make=mine=>{const g=new Game();g.explore(S.PLAYER,0);g.explore(S.CPU,63);g.placeMine(S.PLAYER,viewer===S.CPU?mine:20);g.placeMine(S.CPU,viewer===S.PLAYER?mine:62);return g;};
    const [a,b]=viewer===S.PLAYER?[make(54),make(62)]:[make(20),make(21)];
    assert.deepEqual(a.observe(viewer),b.observe(viewer));assert.deepEqual(a.explorationOptions(viewer),b.explorationOptions(viewer));
  }
});
function inferenceBoard(){
  const cells=Array.from({length:15},()=>({revealed:false,ownMine:false,number:-1,marker:null}));
  for(const i of [0,5,6])cells[i]={revealed:true,ownMine:false,number:1,marker:null};
  cells[12]={revealed:true,ownMine:false,number:0,marker:null};
  return{width:5,height:3,cells,phase:P.EXPLORE,viewer:S.CPU,markersUsed:0,markerLimit:1};
}
test('Q03 normal and mistake choices never include inferred mines',()=>{
  const b=inferenceBoard(), d=new CpuBrain().deduce(b);assert.ok(d.dangerous.has(1));
  for(const chance of [0,.05,.2,.4,1])for(let seed=0;seed<100;seed++){
    const chosen=new CpuBrain(chance,seeded(seed),seeded(seed+100)).chooseExplore(b);
    assert.ok(chosen>=0);assert.ok(!d.dangerous.has(chosen));
    if(chance===0)assert.ok(d.safe.has(chosen));if(chance===1)assert.ok(!d.safe.has(chosen));
  }
});
test('Q03 uncertain fallback and safe fallback ignore definite mines',()=>{
  const b=inferenceBoard(), brain=new CpuBrain(1,()=>0,()=>0), d=brain.deduce(b);
  const safeOnly={...b,cells:b.cells.map((c,i)=>({...c,marker:!c.revealed&&!d.safe.has(i)?S.PLAYER:null}))};
  assert.ok(d.safe.has(brain.chooseExplore(safeOnly)));
  const uncertainOnly={...b,cells:b.cells.map((c,i)=>({...c,marker:d.safe.has(i)?S.PLAYER:null}))};
  const choice=new CpuBrain(0,()=>0).chooseExplore(uncertainOnly);assert.ok(choice>=0&&!d.safe.has(choice)&&!d.dangerous.has(choice));
});
test('Q03 all inferred-mine candidates ends without exploring or repeating CPU actions',()=>{
  const g=started({width:3,height:2});g.explore(S.PLAYER,2);g.placeMine(S.PLAYER,3);g.endTurn(S.PLAYER);
  const brain=new CpuBrain(1), before=g.observe(S.CPU);assert.equal(brain.chooseExplore(before),-1);
  assert.equal(g.result,null);cpuStep(g,brain);assert.equal(g.result,'draw');assert.equal(g.reason,'cpuCertainMines');
  assert.deepEqual(g.observe(S.CPU).cells,before.cells);assert.equal(g.observe(S.CPU).exploded,-1);
  assert.equal(cpuStep(g,brain).ok,false);assert.equal(g.explore(S.CPU,1).ok,false);
});
test('Q03 immediate draw takes priority over removing an own marker on a confirmed safe cell',()=>{
  const g=started({width:4,height:2,markersPerTurn:2});
  g.explore(S.PLAYER,4);g.placeMine(S.PLAYER,5);g.endTurn(S.PLAYER);
  g.addMarker(S.CPU,2);g.addMarker(S.CPU,3);
  const brain=new CpuBrain(1), before=g.observe(S.CPU), inference=brain.deduce(before);
  assert.ok(inference.safe.has(2)&&inference.safe.has(3));
  assert.deepEqual(g.explorationOptions(S.CPU).removableMarkers,[2,3]);
  assert.ok(g.explorationOptions(S.CPU).candidates.every(i=>inference.dangerous.has(i)));
  cpuStep(g,brain);assert.equal(g.result,'draw');assert.equal(g.reason,'cpuCertainMines');
  assert.deepEqual(g.observe(S.CPU).cells,before.cells);assert.equal(g.observe(S.CPU).markersUsed,2);
  assert.equal(g.removeMarker(S.CPU,2).ok,false);
});
test('Q03 inconsistent constraints raise an explicit error, not a random exploration',()=>{
  const b={width:2,height:2,phase:P.EXPLORE,cells:[{revealed:true,number:0},{revealed:false},{revealed:false},{revealed:true,number:1}]};
  assert.throws(()=>new CpuBrain().chooseExplore(b),/inferenceContradiction/);
  const contradictory=new CpuBrain();contradictory.deduce=()=>({safe:new Set([1]),dangerous:new Set([1])});
  assert.throws(()=>contradictory.chooseExplore(inferenceBoard()),/inferenceContradiction/);
});
test('Q03 difficulty mistake rates are uncertain-only even with definite mines present',()=>{
  const b=inferenceBoard(), d=new CpuBrain().deduce(b);
  for(const [name,chance] of [['easy',.4],['normal',.2],['hard',.05]]){
    const brain=new CpuBrain(chance,seeded(22),seeded(789));let uncertain=0;
    for(let i=0;i<10000;i++){const target=brain.chooseExplore(b);assert.ok(!d.dangerous.has(target));if(!d.safe.has(target))uncertain++;}
    assert.ok(Math.abs(uncertain/10000-chance)<.02);console.log('Q03',name,uncertain+'/10000');
  }
});
test('600 seeded games with player markers preserve sound, disjoint inference and terminate',()=>{
  const counts={win:0,loss:0,draw:0};let observations=0,maxSteps=0;
  for(const chance of [.4,.2,.05])for(let seed=0;seed<200;seed++){
    const random=seeded(seed+1200), brain=new CpuBrain(chance,random,seeded(seed+800));const g=new Game();let steps=0;
    while(!g.result&&steps++<500){
      const cpu=g.observe(S.CPU), human=g.observe(S.PLAYER), {safe,dangerous}=brain.deduce(cpu);observations++;
      const occupied=i=>cpu.cells[i].ownMine||human.cells[i].ownMine;
      for(const i of safe){assert.ok(!dangerous.has(i));assert.ok(!occupied(i));}
      for(const i of dangerous)assert.ok(occupied(i));
      if(g.current===S.CPU){cpuStep(g,brain);continue;}
      if([P.EXPLORE,P.MINE,P.END].includes(g.phase)&&human.markersUsed<1&&random()<.15){
        const choices=human.cells.flatMap((c,i)=>!c.revealed&&!c.marker?[i]:[]);
        if(choices.length&&g.addMarker(S.PLAYER,choices[Math.floor(random()*choices.length)]).ok)continue;
      }
      if(g.phase===P.END){g.endTurn(S.PLAYER);continue;}
      const choices=human.cells.flatMap((c,i)=>!c.revealed&&!c.marker&&!c.ownMine?[i]:[]);
      if(!choices.length){const i=human.cells.findIndex(c=>!c.revealed&&!c.ownMine&&c.marker===S.PLAYER);assert.ok(i>=0);g.removeMarker(S.PLAYER,i);continue;}
      const i=choices[Math.floor(random()*choices.length)];
      if([P.EXPLORE,P.OPEN_REVEAL].includes(g.phase))g.explore(S.PLAYER,i);else g.placeMine(S.PLAYER,i);
    }
    assert.ok(g.result);counts[g.result]++;maxSteps=Math.max(maxSteps,steps);
  }
  console.log({Q03SoundnessGames:600,observations,counts,maxSteps});
});
