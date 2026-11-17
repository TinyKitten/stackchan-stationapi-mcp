import {routeDisplayText,routeDisplayData} from './route-display.mjs';
import {locateByIp} from './geo.mjs';
import {loadRuntimeLocation} from './runtime-location.mjs';
const text = { type: 'string', minLength: 1, maxLength: 100 };
const id = { type: 'integer', minimum: 1, maximum: 2147483647 };
const limit = { type: 'integer', minimum: 1, maximum: 30, default: 10 };
const transportType = { type: 'string', enum: ['Rail', 'Bus', 'RailAndBus'], default: 'RailAndBus' };
const stationFields = 'id groupId name nameKatakana prefectureId address latitude longitude platformCode transportType lines { id nameShort }';
const tool = (name, description, properties, required) => ({ name, description, inputSchema: {type:'object', properties, required, additionalProperties:false} });
export const tools = [
 tool('search_stations','日本の駅・バス停を名前で検索する。同名候補は所在地・路線を確認し、勝手に選ばない。', {name:text, limit, transportType}, ['name']),
 tool('nearby_stations','指定座標に近い駅・バス停を取得する。ユーザーが指定した座標を使う。座標が不明で「ここ・近く・最寄り」を尋ねられたらnearby_stations_hereを使う。', {latitude:{type:'number',minimum:-90,maximum:90},longitude:{type:'number',minimum:-180,maximum:180},limit,transportType}, ['latitude','longitude']),
 tool('nearby_stations_here','「近くの駅」「ここの最寄り駅」を設定済みの設置座標で検索する。ローカル実行では保存したブラウザ測位、未保存ならPCのGeoIPを使う。クラウド実行では設置座標が必須。座標指定不要。既定は鉄道駅。バス停はtransportType=Bus。location.methodがGeoIPなら「IPからの推定では」、BrowserGeolocationなら「保存した設置位置では」、ConfiguredLocationなら「設定した設置位置では」と伝え、実際の最寄り駅とは断定しない。位置取得失敗時は駅を作り上げず地域名を確認する。', {limit,transportType:{...transportType,default:'Rail'}}, []),
 tool('search_lines','路線名から路線IDを検索する。同名候補はユーザーの意図を確認する。', {name:text,limit}, ['name']),
 tool('line_stations','検索で得た路線IDの駅・バス停一覧を取得する。バスの方向が必要な場合はdirectionIdを指定する。', {lineId:id,directionId:{type:'integer',minimum:0,maximum:1},transportType}, ['lineId']),
 tool('connected_routes','駅検索のgroupIdを用いて乗換経路を検索する。駅IDと取り違えない。画面表示を求められ、self.screen.show_route_cardが利用可能なら選択した経路のdisplayDataを改変せずdata引数に渡す（nullなら表示不可）。旧本体のself.screen.show_routeのみ利用可能なら、選択した経路のdisplayTextを改変せずtext引数に渡す。displayTextがnullの場合は表示不可。所要時間は推定で、時刻表・リアルタイムの発車時刻や遅延情報ではない。', {fromStationGroupId:id,toStationGroupId:id,sortBy:{type:'string',enum:['Recommended','ArrivalTime','TransferCount'],default:'Recommended'}}, ['fromStationGroupId','toStationGroupId'])
];
export function validate(schema, args) {
 if (!args || typeof args !== 'object' || Array.isArray(args)) throw Error('引数はオブジェクトで指定してください');
 const out = {...args};
 for (const key of Object.keys(out)) if (!Object.hasOwn(schema.properties,key)) throw Error(`未対応の引数: ${key}`);
 for (const key of schema.required) if (!(key in out)) throw Error(`必須の引数: ${key}`);
 for (const [key, rule] of Object.entries(schema.properties)) {
  if (!(key in out)) { if ('default' in rule) out[key] = rule.default; else continue; }
  const v=out[key];
  if (rule.type==='string' && (typeof v!=='string' || (rule.minLength && v.trim().length<rule.minLength) || v.length>(rule.maxLength??Infinity))) throw Error(`文字列が不正: ${key}`);
  if (['integer','number'].includes(rule.type) && (typeof v!=='number' || !Number.isFinite(v) || (rule.type==='integer' && !Number.isInteger(v)) || v<rule.minimum || v>rule.maximum)) throw Error(`数値が不正: ${key}`);
  if (rule.enum && !rule.enum.includes(v)) throw Error(`値が不正: ${key}`);
 }
 return out;
}
export async function callTool(name, args, {fetcher=fetch, endpoint=process.env.STATIONAPI_URL || 'https://gql-stg.trainlcd.app', signal, log=()=>{}, loadLocation=loadRuntimeLocation}={}) {
 const definition=tools.find(t=>t.name===name);
 if (!definition) throw Error('未対応のツール');
 const v=validate(definition.inputSchema,args);
 if(name==='nearby_stations_here') {
  signal?.throwIfAborted();
  const location=await loadLocation() ?? await locateByIp({fetcher,signal,log});
  signal?.throwIfAborted();
  const nearby=await callTool('nearby_stations',{...v,latitude:location.latitude,longitude:location.longitude},{fetcher,endpoint,signal,log});
  return {...nearby,location,distanceBasis:location.method==='GeoIP'?'距離はGeoIP推定座標からの距離で、実際の現在地からの距離ではありません。':location.method==='ConfiguredLocation'?'距離は設定されたStackChanの設置座標からの距離です。設定後の移動は反映されません。':'距離は保存された設置位置からの距離です。ブラウザ測位の誤差と保存後の移動は反映されません。'};
 }
 let query, field;
 switch(name) {
 case 'search_stations': field='stationsByName'; query=`query($name:String!,$limit:Int,$transportType:TransportType){${field}(name:$name,limit:$limit,transportType:$transportType){${stationFields}}}`; break;
 case 'nearby_stations': field='stationsNearby'; query=`query($latitude:Float!,$longitude:Float!,$limit:Int,$transportType:TransportType){${field}(latitude:$latitude,longitude:$longitude,limit:$limit,transportType:$transportType){${stationFields} distance}}`; break;
 case 'search_lines': field='linesByName'; query=`query($name:String!,$limit:Int){${field}(name:$name,limit:$limit){id nameShort nameFull transportType company{name}}}`; break;
 case 'line_stations': field='lineStations'; query=`query($lineId:Int!,$directionId:Int,$transportType:TransportType){${field}(lineId:$lineId,directionId:$directionId,transportType:$transportType){${stationFields} stopCondition}}`; break;
 case 'connected_routes': field='connectedRoutes'; query=`query($fromStationGroupId:Int!,$toStationGroupId:Int!,$sortBy:ConnectedRouteSort){${field}(fromStationGroupId:$fromStationGroupId,toStationGroupId:$toStationGroupId,sortBy:$sortBy){totalSeconds legs{recommendedGroupId fromStation{id groupId name} toStation{id groupId name} trainTypes{groupId name lines{id nameShort color}}}}}`; break;
 }
 const timeout=AbortSignal.timeout(20000);
 const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables:v}),signal:signal ? AbortSignal.any([signal,timeout]) : timeout});
 log('stationapi.response',{tool:name,status:response.status??200});
 if (!response.ok) throw Error(`StationAPI HTTP ${response.status}`);
 const body=await response.json();
 if (body.errors?.length) {
  log('stationapi.graphql_error',{tool:name,messages:body.errors.map(e=>String(e.message).replace(/(?:https?|wss?):\/\/\S+/g,'[URL]').slice(0,500))});
  throw Error('StationAPIがGraphQLエラーを返しました。空の検索結果ではありません。');
 }
 if (!body.data || !Array.isArray(body.data[field])) throw Error('StationAPIの応答形式が不正です');
 return {source:'StationAPI', ...(name==='connected_routes'?{timeBasis:'推定所要時間。時刻表・運行状況は未反映。',selectionRule:'各区間のrecommendedGroupIdが評価済み種別。trainTypesは選択可能な代替種別を含む。'}:{}), results:name==='connected_routes'?body.data[field].map(route=>({...route,displayText:routeDisplayText(route),displayData:routeDisplayData(route)})):body.data[field]};
}
export function createSession(options={}) {
 let initialized=false;
 const log=options.log??(()=>{});
 const pending=new Map();
 const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
 return {abort(){for(const c of pending.values())c.abort();pending.clear();}, async receive(raw) {
 let m;
 try {m=JSON.parse(raw);} catch {log('mcp.parse_error',{});return error(null,-32700,'Parse error');}
 if(!m || Array.isArray(m) || m.jsonrpc!=='2.0' || typeof m.method!=='string' || ('id' in m && typeof m.id!=='string' && typeof m.id!=='number')) return error(null,-32600,'Invalid Request');
 log('mcp.request',{method:m.method,tool:tools.some(t=>t.name===m.params?.name)?m.params.name:undefined});
 if(!('id' in m)) {if(m.method==='notifications/cancelled')pending.get(m.params?.requestId)?.abort();return;}
 const reply=result=>({jsonrpc:'2.0',id:m.id,result});
 if(m.method==='ping')return reply({});
 if(m.method==='initialize') {initialized=true;return reply({protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'stationapi-stackchan',version:'0.3.0'},instructions:'駅名はsearch_stationsで検索してgroupIdを取得する。同名駅は確認する。「近く・ここ・最寄り」の駅はnearby_stations_hereで自動検索し、位置の取得方法（保存した設置位置またはIP推定）と精度の限界を伝える。座標を作り上げない。時刻表・遅延・運賃は提供しない。'});}
 if(!initialized)return error(m.id,-32002,'Initialize first');
 if(m.method==='tools/list')return reply({tools});
 if(m.method!=='tools/call')return error(m.id,-32601,'Method not found');
 const d=tools.find(t=>t.name===m.params?.name);
 if(!d)return error(m.id,-32602,'Unknown tool');
 try{validate(d.inputSchema,m.params?.arguments??{});}catch(e){log('mcp.invalid_arguments',{tool:d.name,reason:e.message});return error(m.id,-32602,e.message);}
 if(pending.has(m.id))return error(m.id,-32600,'Duplicate request ID');
 if(pending.size>=4)return reply({isError:true,content:[{type:'text',text:'処理中です。少し待って再試行してください。'}]});
 const controller=new AbortController();pending.set(m.id,controller);
 try{return reply({content:[{type:'text',text:JSON.stringify(await callTool(d.name,m.params?.arguments??{},{...options,signal:controller.signal}))}]});}
 catch(e){log('mcp.tool_error',{tool:d.name,type:e.name,code:e.cause?.code??e.code??null});return reply({isError:true,content:[{type:'text',text:e.name==='AbortError'||e.name==='TimeoutError'?'問い合わせを中断しました。':e.message.startsWith('StationAPI')||e.message.startsWith('GeoIP')||e.message.startsWith('位置情報')?e.message:'StationAPIに接続できませんでした。'}]});}
 finally{pending.delete(m.id);}
 }};
}
