import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import {createSession} from './core.mjs';
import {startLocationUI} from './location-ui.mjs';
const log=(event,details)=>console.error(JSON.stringify({event,...details}));

if(process.argv.includes('--stdio')) {
 const session=createSession({log});
 const input=createInterface({input:process.stdin});
 input.on('line',async line=>{const reply=await session.receive(line);if(reply)process.stdout.write(JSON.stringify(reply)+'\n');});
 input.on('close',()=>session.abort());
} else {
 let endpoint;
 try {endpoint=new URL(process.env.MCP_ENDPOINT);if(endpoint.protocol!=='wss:')throw Error();}
 catch {console.error('.env の MCP_ENDPOINT にStackChanアプリの wss:// 接続URLを設定してください。');process.exit(1);}
 let locationServer;
 try {locationServer=await startLocationUI();console.error('設置位置の設定: http://127.0.0.1:18765/');}
 catch(e){console.error('設置位置の画面を起動できません: '+(e.code??'unknown'));}
 const shutdown=new AbortController();
 let socket, session;
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{shutdown.abort();session?.abort();socket?.close();locationServer?.close();});
 let backoff=1000;
 while(!shutdown.signal.aborted) {
  session=createSession({log});
  const current=session;
  try {
   await new Promise(resolve=>{
    const ws=new WebSocket(endpoint); socket=ws;
    const timer=setTimeout(()=>{ws.close();resolve();},20000);
    ws.addEventListener('open',()=>{clearTimeout(timer);backoff=1000;console.error('StackChan MCPに接続しました。');});
    ws.addEventListener('message',async event=>{
     if(typeof event.data!=='string' || event.data.length>65536){ws.close(1009);return;}
     const reply=await current.receive(event.data);
     if(reply)log('mcp.response',{error:reply.error?.code??null,isError:reply.result?.isError??false});
     if(reply && ws.readyState===WebSocket.OPEN) {try{ws.send(JSON.stringify(reply));}catch{ws.close();}}
    });
    ws.addEventListener('error',()=>{clearTimeout(timer);ws.close();resolve();});
    ws.addEventListener('close',()=>{clearTimeout(timer);resolve();});
   });
  } catch { /* Never log the credential-bearing URL or raw network errors. */ }
  finally {current.abort();socket?.close();}
  if(shutdown.signal.aborted)break;
  console.error(`接続が切れました。${backoff/1000}秒後に再接続します。`);
  try{await delay(backoff,undefined,{signal:shutdown.signal});}catch{break;}
  backoff=Math.min(backoff*2,60000);
 }
}
