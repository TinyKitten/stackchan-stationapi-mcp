import {callTool} from './core.mjs';
const log=(event,details)=>console.error(JSON.stringify({event,...details}));
try {
 const here=process.argv.includes('--here');
 const result=await callTool(here?'nearby_stations_here':'search_stations',here?{limit:3}:{name:'東京',transportType:'Rail',limit:3},{log});
 console.log(JSON.stringify({check:'StationAPI staging live',ok:true,location:result.location,stations:result.results.map(s=>({id:s.id,groupId:s.groupId,name:s.name,lines:s.lines}))},null,2));
} catch(e) {
 console.error(JSON.stringify({check:'StationAPI staging live',ok:false,type:e.name,code:e.cause?.code??e.code??null,message:(e.message.startsWith('StationAPI')||e.message.startsWith('GeoIP'))?e.message:'通信に失敗しました'}));
 process.exitCode=1;
}
