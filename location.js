const $=id=>document.getElementById(id);
let token,candidate;
const showSaved=location=>{$('saved').textContent=location?`ブラウザで保存済み · 精度の目安 ${Math.round(location.accuracyMeters)} m · ${new Date(location.savedAt).toLocaleString()}`:'未保存 · GeoIPの推定位置を使用します。';$('clear').disabled=!location;};
async function api(path,method='GET',body){const response=await fetch(path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Location-Token':token},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}
api('/api/state').then(data=>{token=data.token;showSaved(data.location);$('locate').disabled=false;}).catch(e=>{$('status').textContent=e.message;});
$('locate').onclick=()=>{
 candidate=null;$('save').disabled=true;$('locate').disabled=true;$('stations').replaceChildren();$('coordinates').textContent='';$('accuracy').textContent='';$('status').textContent='位置情報を取得しています…';
 const fail=message=>{$('status').textContent=message;$('locate').disabled=false;};
 if(!navigator.geolocation)return fail('このブラウザでは位置情報を取得できません。');
 navigator.geolocation.getCurrentPosition(async position=>{
  candidate={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp};
  $('coordinates').textContent=`緯度 ${candidate.latitude.toFixed(6)} / 経度 ${candidate.longitude.toFixed(6)}`;
  $('accuracy').textContent=`精度の目安：半径 ${Math.round(candidate.accuracy)} m${candidate.accuracy>1000?'。誤差が大きいため、駅の候補を確認してください。':''}`;
  $('status').textContent='取得しました。周辺駅を確認しています…';
  try{const data=await api('/api/preview','POST',candidate);for(const station of data.stations){const li=document.createElement('li');li.textContent=[station.name,(station.lines??[]).map(l=>l.nameShort).filter(Boolean).join('・')].filter(Boolean).join(' — ');$('stations').append(li);}$('status').textContent=data.stations.length?'この位置でよければ保存してください。':'近くの駅が見つかりませんでした。座標を確認してください。';}
  catch(e){$('status').textContent=`駅の確認に失敗しました。位置の保存は可能です。${e.message}`;}
  $('save').disabled=false;$('locate').disabled=false;
 },error=>fail(({1:'位置情報が許可されませんでした。ブラウザのサイト設定から許可してください。',2:'位置を取得できませんでした。Wi-FiやOSの位置情報設定を確認してください。',3:'測位がタイムアウトしました。もう一度お試しください。'})[error.code]??'測位に失敗しました。'),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
};
$('save').onclick=async()=>{if(!candidate)return;$('save').disabled=true;try{const data=await api('/api/location','POST',candidate);showSaved(data.location);$('status').textContent='保存しました。次の「近くの駅は？」からこの位置を使います。再起動は不要です。';}catch(e){$('status').textContent=e.message;$('save').disabled=false;}};
$('clear').onclick=async()=>{$('clear').disabled=true;try{await api('/api/location','DELETE');showSaved(null);$('status').textContent='保存位置を削除しました。GeoIPに戻りました。';}catch(e){$('status').textContent=e.message;$('clear').disabled=false;}};
