import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callTool,createSession,tools,validate} from './core.mjs';
const ok=data=>async()=>({ok:true,json:async()=>({data})});
test('queries use variables and preserve duplicate station candidates',async()=>{
 const rows=[{id:1,groupId:10,name:'練馬',platformCode:null},{id:2,groupId:10,name:'練馬',platformCode:'1'}];
 const r=await callTool('search_stations',{name:'練馬"}'},{fetcher:async(url,req)=>{
 const body=JSON.parse(req.body);assert.equal(body.variables.name,'練馬"}');assert.equal(body.variables.transportType,'RailAndBus');assert.equal(body.variables.limit,10);assert.ok(!body.query.includes('練馬'));
 return {ok:true,json:async()=>({data:{stationsByName:rows}})};
 }});assert.deepEqual(r.results,rows);
});
test('coordinates and limits rejected before network access',async()=>{
 for(const args of [{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:0,longitude:0,limit:31},{latitude:0,longitude:0,limit:1.1},{latitude:NaN,longitude:0}]) {
 await assert.rejects(callTool('nearby_stations',args,{fetcher:()=>assert.fail('network called')}));
 }
});
test('invalid input keys, names, enums and IDs rejected',()=>{
 const cases=[['search_stations',{name:' '}],['search_stations',{name:'駅',transportType:'boat'}],['search_stations',{name:'駅',url:'https://example.com'}],['connected_routes',{fromStationGroupId:-1,toStationGroupId:2}],['line_stations',{lineId:1,directionId:2}]];
 for(const [name,args] of cases)assert.throws(()=>validate(tools.find(t=>t.name===name).inputSchema,args));
});
test('empty results are successful',async()=>assert.deepEqual((await callTool('search_lines',{name:'none'},{fetcher:ok({linesByName:[]})})).results,[]));
test('upstream errors never become empty results',async()=>{
 for(const fetcher of [async()=>({ok:false,status:503}),async()=>({ok:true,json:async()=>({errors:[{message:'bad'}],data:{linesByName:[]}})}),ok({linesByName:null})]) await assert.rejects(callTool('search_lines',{name:'x'},{fetcher}));
});
test('routes preserve recommended service and expose estimation caveat',async()=>{
 const routes=[{totalSeconds:600,legs:[{recommendedGroupId:123,trainTypes:[{groupId:123},{groupId:456}]}]}];
 const r=await callTool('connected_routes',{fromStationGroupId:1,toStationGroupId:2},{fetcher:ok({connectedRoutes:routes})});assert.deepEqual(r.results.map(({displayText,displayData,...route})=>route),routes);assert.equal(r.results[0].displayText,null);assert.equal(r.results[0].displayData,null);assert.match(r.timeBasis,/推定/);
});
test('nearby and line station queries retain direction and transport',async()=>{
 for(const [name,args,field] of [['nearby_stations',{latitude:35,longitude:139,transportType:'Bus'},'stationsNearby'],['line_stations',{lineId:1,directionId:0,transportType:'Bus'},'lineStations']]){
 await callTool(name,args,{fetcher:async(u,r)=>{const b=JSON.parse(r.body);for(const [k,v]of Object.entries(args))assert.equal(b.variables[k],v);assert.ok(b.query.includes(field));return {ok:true,json:async()=>({data:{[field]:[]}})};}});
 }
});
const request=(method,params={},id=1)=>JSON.stringify({jsonrpc:'2.0',id,method,params});
test('MCP lifecycle, notifications, tools and unknown methods',async()=>{
 const s=createSession({fetcher:ok({linesByName:[]})});
 assert.equal((await s.receive('{')).error.code,-32700);
 assert.equal((await s.receive(request('tools/list'))).error.code,-32002);
 assert.equal((await s.receive(request('initialize',{protocolVersion:'2024-11-05'}))).result.protocolVersion,'2024-11-05');
 assert.equal(await s.receive('{"jsonrpc":"2.0","method":"notifications/initialized"}'),undefined);
 assert.equal((await s.receive(request('tools/list'))).result.tools.length,6);
 assert.equal((await s.receive(request('missing'))).error.code,-32601);
 assert.equal((await s.receive(request('tools/call',{name:'missing'}))).error.code,-32602);
 assert.equal((await s.receive(request('tools/call',{name:'search_lines',arguments:{name:'x'}}))).result.content[0].type,'text');
});
test('tool errors are MCP isError results without endpoint leakage',async()=>{
 const s=createSession({fetcher:()=>{throw Error('secret-token-url');}});await s.receive(request('initialize'));
 const r=await s.receive(request('tools/call',{name:'search_lines',arguments:{name:'x'}}));assert.equal(r.result.isError,true);assert.ok(!JSON.stringify(r).includes('secret-token'));
});
test('cancellation propagates to upstream request',async()=>{
 const s=createSession({fetcher:async(u,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}))});
 await s.receive(request('initialize'));
 const p=s.receive(request('tools/call',{name:'search_lines',arguments:{name:'x'}},22));
 await s.receive('{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":22}}');
 assert.equal((await p).result.isError,true);
});
