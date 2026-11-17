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

import {routeDisplayData} from './route-display.mjs';
test('rich data uses evaluated service, real colors and ordered endpoints',()=>{
 const selected={...leg,trainTypes:[...leg.trainTypes.slice(0,1),{...leg.trainTypes[1],lines:[{nameShort:'大江戸線',color:'#b6007a'}]}]};
 const data=JSON.parse(routeDisplayData({totalSeconds:601,legs:[selected]}));
 assert.deepEqual(data,{version:1,minutes:11,legs:[{from:'光が丘',to:'練馬',line:'大江戸線',type:'各停',color:'B6007A'}]});
});
test('rich data has neutral fallback, never invents service or time',()=>{
 const data=JSON.parse(routeDisplayData({legs:[{...leg,recommendedGroupId:999}]}));
 assert.equal(data.minutes,null);assert.equal(data.legs[0].color,'B9CCD7');assert.equal(data.legs[0].line,'路線情報なし');
 const multi={...leg,trainTypes:[{groupId:2,name:'各停',lines:[{nameShort:'A',color:'FF0000'},{nameShort:'B',color:'0000FF'}]}]};
 assert.equal(JSON.parse(routeDisplayData({legs:[multi]})).legs[0].color,'B9CCD7');
});
test('rich payload rejects invalid bounds and preserves all thirty legs',()=>{
 for(const route of [null,{legs:[]},{legs:[{}]},{legs:[{...leg,toStation:{name:'駅\u0000'}}]},{legs:[{...leg,toStation:{name:'駅'.repeat(86)}}]},{legs:Array(31).fill(leg)}])assert.equal(routeDisplayData(route),null);
 const data=JSON.parse(routeDisplayData({legs:Array(30).fill(leg)}));assert.equal(data.legs.length,30);
 assert.equal(routeDisplayData({totalSeconds:6000000,legs:[leg]}),null);
});
test('connected_routes queries color and exposes both protocols',async()=>{
 const route={totalSeconds:600,legs:[leg]};
 const result=await callTool('connected_routes',{fromStationGroupId:1,toStationGroupId:2},{fetcher:async(url,options)=>{
  assert.match(JSON.parse(options.body).query,/lines\{id nameShort color\}/);
  return {ok:true,json:async()=>({data:{connectedRoutes:[route]}})};
 }});
 assert.equal(result.results[0].displayData,routeDisplayData(route));assert.equal(result.results[0].displayText,routeDisplayText(route));assert.equal(route.displayData,undefined);
});

test('invalid or missing durations preserve a valid route with unknown minutes',()=>{
 for(const totalSeconds of [Infinity,-Infinity,NaN,-1,undefined]) {
  const data=JSON.parse(routeDisplayData({totalSeconds,legs:[leg]}));
  assert.equal(data.minutes,null);assert.equal(data.legs.length,1);
 }
});
