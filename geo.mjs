// Only called when the user asks for nearby places. Never persist an IP address.
export function createGeoLocator({now=Date.now, ttlMs=600000}={}) {
  const cache=new WeakMap();
  return async function locate({fetcher=fetch, signal, log=()=>{}}={}) {
    signal?.throwIfAborted();
    const cached=cache.get(fetcher);
    if(cached && now()-cached.time<ttlMs) return {...cached.location,cached:true};
    let response;
    try {
      response=await fetcher('https://ipwho.is/', {
        headers:{Accept:'application/json'},
        signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000)
      });
    } catch(e) {
      if(signal?.aborted) throw e;
      throw Error('GeoIPの位置取得に失敗しました。位置を推測せず、地域名か駅名を確認してください。');
    }
    log('geoip.response',{status:response.status??200});
    if(!response.ok) throw Error(`GeoIP HTTP ${response.status}。位置を取得できませんでした。`);
    let data;
    try {data=await response.json();} catch {throw Error('GeoIPの応答形式が不正です。');}
    if(!data || data.success!==true || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude) || Math.abs(data.latitude)>90 || Math.abs(data.longitude)>180)
      throw Error('GeoIPから有効な位置を取得できませんでした。地域名か駅名を確認してください。');
    // StationAPI only contains Japanese stations; foreign VPN exit nodes are not
    // a usable fallback for this PC's location.
    if(data.country_code!=='JP') throw Error('GeoIPの推定位置が日本国外です。VPN等の影響があり得るため、地域名か駅名を確認してください。');
    const short=value=>typeof value==='string'?value.slice(0,100):null;
    const time=now();
    const location={source:'ipwho.is',method:'GeoIP',approximate:true,
      latitude:data.latitude,longitude:data.longitude,
      countryCode:data.country_code,region:short(data.region),city:short(data.city),
      observedAt:new Date(time).toISOString(),
      caveat:'このPCの外向きIPアドレスに基づく推定位置。GPSやStackChan本体の位置ではなく、実際の最寄り駅と異なる場合があります。'};
    cache.set(fetcher,{time,location});
    return {...location,cached:false};
  };
}
export const locateByIp=createGeoLocator();
