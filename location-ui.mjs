import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {loadSavedLocation,saveLocation,clearSavedLocation,validateLocation} from './location-store.mjs';
import {callTool} from './core.mjs';
export function createLocationHandler({port=18765,load=loadSavedLocation,save=saveLocation,clear=clearSavedLocation,preview=(args)=>callTool('nearby_stations',args)}={}) {
 const token=randomBytes(32).toString('hex');
 const origin=`http://127.0.0.1:${port}`;
 return async(req,res)=>{
  const reply=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",'Permissions-Policy':'geolocation=(self)'});res.end(type==='application/json'?JSON.stringify(data):data);};
  if(req.headers.host!==`127.0.0.1:${port}`)return reply(403,{error:'接続先が不正です。127.0.0.1で開いてください。'});
  if(req.headers.origin && req.headers.origin!==origin)return reply(403,{error:'別のサイトからの操作は受け付けません。'});
  if(req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'別のサイトからの操作は受け付けません。'});
  try {
   if(req.method==='GET' && ['/','/location.js','/location.css'].includes(req.url)) {
    const file=req.url==='/'?'location.html':req.url.slice(1);
    return reply(200,await readFile(new URL(file,import.meta.url),'utf8'),file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'text/css');
   }
   if(req.method==='GET' && req.url==='/api/state')return reply(200,{token,location:await load()});
   if(['POST','DELETE'].includes(req.method)) {
    if(req.headers.origin!==origin || req.headers['x-location-token']!==token)return reply(403,{error:'画面を再読み込みしてください。'});
    if(req.method==='DELETE' && req.url==='/api/location'){await clear();return reply(200,{ok:true});}
    if(req.method==='POST' && ['/api/location','/api/preview'].includes(req.url)) {
     if(req.headers['content-type']!=='application/json')return reply(415,{error:'JSONを指定してください。'});
     let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(413,{error:'データが大きすぎます。'});}
     let value;try{value=validateLocation(JSON.parse(body));}catch{return reply(400,{error:'位置情報の形式が不正です。'});}
     if(req.url==='/api/location'){await save(value);return reply(200,{ok:true,location:await load()});}
     const result=await preview({latitude:value.latitude,longitude:value.longitude,limit:5,transportType:'Rail'});
     return reply(200,{stations:result.results});
    }
   }
   return reply(404,{error:'見つかりません。'});
  }catch{return reply(502,{error:'処理に失敗しました。通信状態または保存先を確認してください。'});}
 };
}
export async function startLocationUI({port=18765}={}) {
 const server=createServer(createLocationHandler({port}));
 server.requestTimeout=30000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return server;
}
