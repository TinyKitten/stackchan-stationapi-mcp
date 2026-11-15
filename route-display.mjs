// Plain text is passed verbatim to the device; never truncate a route.
export function routeDisplayText(route) {
 if (!route || !Array.isArray(route.legs) || !route.legs.length || route.legs.length > 30) return null;
 const clean = value => typeof value === 'string' && value.trim() && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : null;
 const rows=[];
 for (const [i,leg] of route.legs.entries()) {
  const from=clean(leg.fromStation?.name), to=clean(leg.toStation?.name);
  if (!from || !to) return null;
  const type=leg.trainTypes?.find(t=>t.groupId===leg.recommendedGroupId);
  const lines=[...new Set((type?.lines ?? []).map(l=>clean(l.nameShort)).filter(Boolean))];
  rows.push(`${i+1}. ${from} → ${to}\n${lines.join(' / ') || '路線情報なし'}${clean(type?.name) ? `（${clean(type.name)}）` : ''}`);
 }
 const seconds=route.totalSeconds;
 const duration=Number.isFinite(seconds) && seconds>=0 ? `約${Math.ceil(seconds/60)}分` : '所要時間不明';
 const result=`${duration}・${route.legs.length-1}回乗換\n推定時間・時刻表未反映\n\n${rows.join('\n\n')}`;
 return Buffer.byteLength(result,'utf8')<=4096 ? result : null;
}
