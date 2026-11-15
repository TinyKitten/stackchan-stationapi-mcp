import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export const locationFile=new URL('./.location.json',import.meta.url);
export function validateLocation(value) {
 if(!value || !Number.isFinite(value.latitude) || Math.abs(value.latitude)>90 || !Number.isFinite(value.longitude) || Math.abs(value.longitude)>180 || !Number.isFinite(value.accuracy) || value.accuracy<0 || !Number.isFinite(value.timestamp) || value.timestamp<=0 || value.timestamp>8640000000000000) throw Error('位置情報の形式が不正です。');
 return {latitude:value.latitude,longitude:value.longitude,accuracy:value.accuracy,timestamp:value.timestamp};
}
export async function saveLocation(value,file=locationFile) {
 const valid=validateLocation(value);
 const record={...valid,savedAt:new Date().toISOString()};
 const target=file instanceof URL?file:new URL(`file://${file}`);
 const temporary=new URL(target.href+'.'+randomUUID()+'.tmp');
 try {await writeFile(temporary,JSON.stringify(record)+'\n',{mode:0o600,flag:'wx'});await rename(temporary,target);}
 finally {await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 return record;
}
export async function loadSavedLocation(file=locationFile) {
 let data;
 try {data=JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT')return null;throw Error('位置情報の保存ファイルを読み込めません。設定画面で再保存してください。');}
 validateLocation(data);
 return {source:'browser',method:'BrowserGeolocation',approximate:true,latitude:data.latitude,longitude:data.longitude,accuracyMeters:data.accuracy,observedAt:new Date(data.timestamp).toISOString(),savedAt:data.savedAt,caveat:'ブラウザで取得して保存した設置位置。現在の位置を継続測位しているわけではありません。移動した場合は再取得してください。'};
}
export async function clearSavedLocation(file=locationFile) {await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
