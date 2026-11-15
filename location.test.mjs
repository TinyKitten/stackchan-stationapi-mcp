import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {saveLocation,loadSavedLocation,clearSavedLocation,validateLocation} from './location-store.mjs';
import {createLocationHandler} from './location-ui.mjs';
import {callTool} from './core.mjs';
const point={latitude:35.75,longitude:139.62,accuracy:50,timestamp:Date.now()};
test('saved browser position persists with private permissions and deletion restores unset state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'stationapi-location-'));const file=join(dir,'position.json');
 try{
  assert.equal(await loadSavedLocation(file),null);
  await saveLocation(point,file);
  const saved=await loadSavedLocation(file);assert.equal(saved.method,'BrowserGeolocation');assert.equal(saved.accuracyMeters,50);assert.equal(saved.latitude,point.latitude);
  assert.equal((await stat(file)).mode&0o777,0o600);
  await clearSavedLocation(file);assert.equal(await loadSavedLocation(file),null);
  await writeFile(file,'invalid');await assert.rejects(loadSavedLocation(file),/位置情報/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid coordinates or accuracy never become saved locations',()=>{
 for(const p of [null,{...point,latitude:91},{...point,longitude:'139'},{...point,accuracy:-1},{...point,timestamp:0}])assert.throws(()=>validateLocation(p),/位置情報/);
});
test('nearby tool uses saved position without contacting GeoIP',async()=>{
 const location={method:'BrowserGeolocation',latitude:35.75,longitude:139.62,accuracyMeters:50};
 const result=await callTool('nearby_stations_here',{}, {loadLocation:async()=>location,fetcher:async(url,req)=>{
  assert.equal(url,'https://gql-stg.trainlcd.app');const args=JSON.parse(req.body).variables;assert.equal(args.latitude,35.75);assert.equal(args.longitude,139.62);
  return {ok:true,json:async()=>({data:{stationsNearby:[]}})};
 }});assert.equal(result.location.method,'BrowserGeolocation');assert.match(result.distanceBasis,/保存/);
});
test('failed location load does not silently change to GeoIP',async()=>{
 await assert.rejects(callTool('nearby_stations_here',{}, {loadLocation:async()=>{throw Error('位置情報の保存ファイルを読み込めません。');},fetcher:()=>assert.fail('network called')}),/位置情報/);
});
async function request(handler,path,{method='GET',headers={},body}={}){
 const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method,url:path,headers:{host:'127.0.0.1:18765',...headers}});
 let status,responseHeaders,text;
 await handler(req,{writeHead(s,h){status=s;responseHeaders=h;},end(t){text=t;}});
 return {status,headers:responseHeaders,text,json:()=>JSON.parse(text)};
}
test('local UI preview save and delete work; saving is explicit',async()=>{
 let saved=null,saves=0;
 const handler=createLocationHandler({load:async()=>saved,save:async value=>{saved=value;saves++;},clear:async()=>{saved=null;},preview:async args=>{assert.equal(args.latitude,point.latitude);return {results:[{name:'候補駅'}]};}});
 const page=await request(handler,'/');assert.equal(page.status,200);assert.match(page.text,/位置情報を取得/);
 const state=(await request(handler,'/api/state')).json();assert.equal(state.location,null);
 const headers={origin:'http://127.0.0.1:18765','x-location-token':state.token,'content-type':'application/json'};
 const preview=await request(handler,'/api/preview',{method:'POST',headers,body:point});assert.equal(preview.status,200);assert.equal(saves,0);
 assert.equal((await request(handler,'/api/location',{method:'POST',headers,body:point})).status,200);assert.equal(saves,1);
 assert.equal((await request(handler,'/api/location',{method:'DELETE',headers})).status,200);assert.equal(saved,null);
});
test('UI rejects other origins, hosts, missing token, and invalid data',async()=>{
 let saves=0;const handler=createLocationHandler({load:async()=>null,save:async()=>saves++});
 const state=(await request(handler,'/api/state')).json();
 for(const headers of [{origin:'https://example.com'},{host:'evil.example:18765'},{origin:'http://127.0.0.1:18765'}]){
  assert.equal((await request(handler,'/api/location',{method:'POST',headers,body:point})).status,403);
 }
 const valid={origin:'http://127.0.0.1:18765','x-location-token':state.token,'content-type':'application/json'};
 assert.equal((await request(handler,'/api/location',{method:'POST',headers:valid,body:{latitude:91}})).status,400);assert.equal(saves,0);
 assert.equal((await request(handler,'/api/state',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
});
