import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadRuntimeLocation} from './runtime-location.mjs';
import {callTool} from './core.mjs';

test('cloud hosting without installation coordinates never uses server GeoIP', async () => {
  await assert.rejects(callTool('nearby_stations_here', {}, {
    loadLocation:()=>loadRuntimeLocation({STATIONAPI_CLOUD:'1'}),
    fetcher:()=>assert.fail('must not contact GeoIP or StationAPI')
  }), /位置情報が未設定/);
});

test('configured installation coordinates reach StationAPI and retain their source', async () => {
  const result=await callTool('nearby_stations_here', {}, {
    loadLocation:()=>loadRuntimeLocation({STATIONAPI_CLOUD:'1',STACKCHAN_LOCATION:'{"latitude":35.75,"longitude":139.62}'}),
    fetcher:async (url, request)=>{
      assert.equal(url,'https://gql-stg.trainlcd.app');
      const {variables}=JSON.parse(request.body);
      assert.equal(variables.latitude,35.75);
      assert.equal(variables.longitude,139.62);
      return {ok:true,json:async()=>({data:{stationsNearby:[]}})};
    }
  });
  assert.equal(result.location.method,'ConfiguredLocation');
  assert.match(result.distanceBasis,/設定されたStackChan/);
});

test('invalid configuration fails instead of falling back to GeoIP', async () => {
  for (const value of ['broken','null','{}','{"latitude":91,"longitude":0}','{"latitude":0,"longitude":181}','{"latitude":"35","longitude":139}']) {
    await assert.rejects(loadRuntimeLocation({STACKCHAN_LOCATION:value}), /位置情報/);
  }
});
