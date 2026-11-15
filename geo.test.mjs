import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeoLocator} from './geo.mjs';
import {callTool,createSession} from './core.mjs';
const geo={success:true,latitude:35.68,longitude:139.76,country_code:'JP',region:'Tokyo',city:'Tokyo',ip:'192.0.2.1'};
const json=data=>({ok:true,status:200,json:async()=>data});
test('automatic nearby lookup forwards only validated GeoIP coordinates and uses rail by default',async()=>{
 const logs=[], requests=[];
 const fetcher=async(url,request)=>{
  requests.push(url);
  if(url==='https://ipwho.is/')return json(geo);
  assert.equal(url,'https://gql-stg.trainlcd.app');
  const {query,variables}=JSON.parse(request.body);
  assert.ok(query.includes('stationsNearby'));
  assert.deepEqual(variables,{limit:10,transportType:'Rail',latitude:35.68,longitude:139.76});
  return json({data:{stationsNearby:[{id:1,name:'テスト駅',distance:120}]}});
 };
 const result=await callTool('nearby_stations_here',{}, {loadLocation:async()=>null,fetcher,log:(e,d)=>logs.push([e,d])});
 assert.equal(requests.length,2);assert.equal(result.results[0].name,'テスト駅');
 assert.equal(result.location.approximate,true);assert.match(result.distanceBasis,/推定/);
 assert.ok(!JSON.stringify(result).includes(geo.ip));
 assert.ok(!JSON.stringify(logs).includes(String(geo.latitude)));
});
test('bus selection and limit survive automatic location lookup',async()=>{
 await callTool('nearby_stations_here',{limit:2,transportType:'Bus'},{loadLocation:async()=>null,fetcher:async(url,request)=>{
  if(url==='https://ipwho.is/')return json(geo);
  const {variables}=JSON.parse(request.body);assert.equal(variables.transportType,'Bus');assert.equal(variables.limit,2);
  return json({data:{stationsNearby:[]}});
 }});
});
test('invalid or foreign location does not query StationAPI or guess a known home station',async()=>{
 for(const data of [{success:false}, {...geo,latitude:null},{...geo,longitude:181},{...geo,latitude:'35.68'},{...geo,country_code:'US'}]){
  let calls=0;
  await assert.rejects(callTool('nearby_stations_here',{}, {loadLocation:async()=>null,fetcher:async(url)=>{calls++;assert.equal(url,'https://ipwho.is/');return json(data);}}),/GeoIP/);
  assert.equal(calls,1);
 }
});
test('cached location expires after ten minutes; no persistence of raw IP',async()=>{
 let time=1000000,calls=0;
 const locate=createGeoLocator({now:()=>time});
 const fetcher=async()=>{calls++;return json(geo);};
 assert.equal((await locate({loadLocation:async()=>null,fetcher})).cached,false);
 time+=599999;assert.equal((await locate({loadLocation:async()=>null,fetcher})).cached,true);assert.equal(calls,1);
 time+=1;assert.equal((await locate({loadLocation:async()=>null,fetcher})).cached,false);assert.equal(calls,2);
});
test('HTTP and transport failures are explicit and are not cached',async()=>{
 const locate=createGeoLocator();let calls=0;
 const fetcher=async()=>{calls++;return calls===1?{ok:false,status:429}:json(geo);};
 await assert.rejects(locate({loadLocation:async()=>null,fetcher}),/GeoIP HTTP 429/);
 assert.equal((await locate({loadLocation:async()=>null,fetcher})).cached,false);
 await assert.rejects(locate({loadLocation:async()=>null,fetcher:async()=>{throw Error('secret transport detail');}}),/GeoIPの位置取得に失敗/);
});
test('explicit coordinate tool never contacts GeoIP',async()=>{
 await callTool('nearby_stations',{latitude:34,longitude:135},{loadLocation:async()=>null,fetcher:async(url)=>{assert.notEqual(url,'https://ipwho.is/');return json({data:{stationsNearby:[]}});}});
});
test('MCP advertises automatic tool and reports GeoIP failures with actionable text',async()=>{
 const session=createSession({loadLocation:async()=>null,fetcher:async()=>json({success:false})});
 const send=(method,params={})=>session.receive(JSON.stringify({jsonrpc:'2.0',id:1,method,params}));
 await send('initialize');
 assert.ok((await send('tools/list')).result.tools.some(t=>t.name==='nearby_stations_here'));
 const reply=await send('tools/call',{name:'nearby_stations_here',arguments:{}});
 assert.equal(reply.result.isError,true);assert.match(reply.result.content[0].text,/GeoIP/);
});
test('cancelling a GeoIP request aborts it and does not query StationAPI',async()=>{
 const controller=new AbortController();let calls=0;
 const locate=createGeoLocator();
 const task=locate({signal:controller.signal,fetcher:async(url,{signal})=>{calls++;return new Promise((r,j)=>signal.addEventListener('abort',()=>j(signal.reason),{once:true}));}});
 controller.abort();await assert.rejects(task,{name:'AbortError'});assert.equal(calls,1);
});
