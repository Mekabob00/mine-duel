import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PausableTimer } from '../js/timer.js';
test('CPU help pause preserves remaining delay; restart cancels stale callbacks',()=>{
  let now=0,id=0,fired=0;const events=new Map();
  const timer=new PausableTimer(()=>fired++,{now:()=>now,schedule:(cb,ms)=>{events.set(++id,{cb,ms});return id;},cancel:id=>events.delete(id)});
  timer.start(650);now=200;timer.pause();assert.equal(timer.remaining,450);assert.equal(events.size,0);
  now=5000;timer.resume();assert.equal([...events.values()][0].ms,450);
  [...events.values()][0].cb();assert.equal(fired,1);assert.equal(timer.remaining,null);events.clear();
  timer.start(650);timer.clear();assert.equal(events.size,0);assert.equal(fired,1);
  timer.pause();timer.start(650);assert.equal(events.size,0);timer.resume();assert.equal(events.size,1);
});
