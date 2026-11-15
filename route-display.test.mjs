import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeDisplayText} from './route-display.mjs';
import {callTool} from './core.mjs';
const leg={fromStation:{name:'光が丘'},toStation:{name:'練馬'},recommendedGroupId:2,trainTypes:[{groupId:1,name:'誤選択',lines:[{nameShort:'別路線'}]},{groupId:2,name:'各停',lines:[{nameShort:'大江戸線'}]}]};
test('display follows evaluated train type, preserves endpoints and marks estimated time',()=>{
 const text=routeDisplayText({totalSeconds:601,legs:[leg]});
 assert.match(text,/約11分・0回乗換/);assert.match(text,/光が丘 → 練馬/);assert.match(text,/大江戸線（各停）/);assert.doesNotMatch(text,/誤選択|別路線/);assert.match(text,/時刻表未反映/);
});
test('multiple legs retain their order and destination',()=>{
 const text=routeDisplayText({totalSeconds:1200,legs:[leg,{...leg,fromStation:{name:'練馬'},toStation:{name:'池袋'}}]});
 assert.match(text,/1回乗換/);assert.ok(text.indexOf('1. 光が丘')<text.indexOf('2. 練馬'));assert.match(text,/池袋/);
});
test('missing recommendation never falls back to an arbitrary alternative',()=>{
 const text=routeDisplayText({legs:[{...leg,recommendedGroupId:999}]});assert.match(text,/路線情報なし/);assert.doesNotMatch(text,/別路線|大江戸線/);
});
test('incomplete, control-bearing and oversized routes are not silently truncated',()=>{
 for(const route of [null,{legs:[]},{legs:[{}]},{legs:[{...leg,fromStation:{name:'駅\n偽情報'}}]},{legs:[{...leg,toStation:{name:'駅'.repeat(2000)}}]}])assert.equal(routeDisplayText(route),null);
});
test('connected_routes exposes display text without mutating source results',async()=>{
 const route={totalSeconds:600,legs:[leg]};
 const result=await callTool('connected_routes',{fromStationGroupId:1,toStationGroupId:2},{fetcher:async()=>({ok:true,json:async()=>({data:{connectedRoutes:[route]}})})});
 assert.equal(result.results[0].displayText,routeDisplayText(route));assert.equal(route.displayText,undefined);assert.deepEqual(result.results[0].legs,route.legs);
});
