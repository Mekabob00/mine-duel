import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BaseHtmlCacheRefresher} from '../js/html-cache.js';
import {isNewerVersion,UpdateChecker} from '../js/updates.js';
const current='0.2.3-web',base='https://example.org/mine-duel/';
const html=()=>new Response('<!doctype html><title>Mine Duel</title>',{headers:{'content-type':'text/html; charset=utf-8'}});
test('cache: numeric release ordering rejects equal/older/malformed/unsafe versions',()=>{
 for(const [next,running,expected]of [['0.2.4-web',current,true],['0.10.0-web','0.9.9-web',true],['1.0.0-web',current,true],['0.2.2-web',current,false],[current,current,false],['0.02.3-web',current,false],['v0.2.4-web',current,false],['999999999999999999999.2.3-web',current,false],[null,current,false]])assert.equal(isNewerVersion(next,running),expected);
});
test('cache: checker does not offer a downgrade and skips network when offline',async()=>{
 let online=false,requests=0,version='0.2.2-web',notices=[];const checker=new UpdateChecker(v=>notices.push(v),{current,base,online:()=>online,fetcher:async()=>{requests++;return{ok:true,json:async()=>({version})};}});
 await checker.check();assert.equal(requests,0);online=true;await checker.check();assert.deepEqual(notices,[]);version='0.2.4-web';await checker.check();assert.deepEqual(notices,[version]);checker.dismiss(version);await checker.check();assert.equal(notices.length,1);
});
test('cache: versioned arrival refreshes bare project HTML using reload, once including concurrent calls',async()=>{
 const calls=[];const refresh=new BaseHtmlCacheRefresher({current,projectBase:base,href:base+'?v='+current+'&language=ja#board',fetcher:async(...args)=>{calls.push(args);return html();}});
 assert.deepEqual(await Promise.all([refresh.refresh(),refresh.refresh()]),[true,false]);assert.equal(calls.length,1);assert.equal(calls[0][0],base);assert.equal(calls[0][1].cache,'reload');assert.equal(calls[0][1].mode,'same-origin');assert.equal(calls[0][1].redirect,'error');assert.ok(calls[0][1].signal instanceof AbortSignal);
});
test('cache: bare/new users and unrelated project, origin, protocol or release never trigger refresh',async()=>{
 let calls=0;for(const href of [base,base+'?v=0.2.2-web',base+'?v=0.2.4-web','https://example.org/another-game/?v='+current,'https://elsewhere.test/mine-duel/?v='+current,'file:///mine-duel/?v='+current,'not a url']){let r=new BaseHtmlCacheRefresher({current,projectBase:base,href,fetcher:async()=>{calls++;return html();}});assert.equal(await r.refresh(),false);}assert.equal(calls,0);
});
test('cache: index.html update bookmark refreshes only its own project root',async()=>{
 let fetched;let r=new BaseHtmlCacheRefresher({current,projectBase:base,href:base+'index.html?v='+current,fetcher:async url=>{fetched=url;return html();}});assert.equal(await r.refresh(),true);assert.equal(fetched,base);
});
test('cache: initially offline arrival can refresh on recovery without repeated requests',async()=>{
 let online=false,calls=0;let r=new BaseHtmlCacheRefresher({current,projectBase:base,href:base+'?v='+current,online:()=>online,fetcher:async()=>{calls++;return html();}});assert.equal(await r.refresh(),false);assert.equal(r.attempted,false);online=true;assert.equal(await r.refresh(),true);assert.equal(await r.refresh(),false);assert.equal(calls,1);
});
test('cache: network failure, HTTP error and non-HTML do not retry or affect gameplay',async()=>{
 for(const fetcher of [async()=>{throw Error('offline');},async()=>new Response('',{status:503}),async()=>new Response('{}',{headers:{'content-type':'application/json'}})]){let calls=0;let r=new BaseHtmlCacheRefresher({current,projectBase:base,href:base+'?v='+current,fetcher:async(...args)=>{calls++;return fetcher(...args);}});assert.equal(await r.refresh(),false);assert.equal(await r.refresh(),false);assert.equal(calls,1);}
});
test('cache: timed-out refresh is aborted and not rescheduled',async()=>{
 let aborted=false;const r=new BaseHtmlCacheRefresher({current,projectBase:base,href:base+'?v='+current,timeout:5,fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('abort'));}))});assert.equal(await r.refresh(),false);assert.equal(aborted,true);assert.equal(await r.refresh(),false);
});
