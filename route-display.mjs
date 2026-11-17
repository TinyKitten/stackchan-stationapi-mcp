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

// Versioned JSON is passed verbatim to show_route_card. Keep text for older devices.
export function routeDisplayData(route) {
 if (!route || !Array.isArray(route.legs) || !route.legs.length || route.legs.length > 30) return null;
 const clean = value => typeof value === 'string' && value.trim() && !/[\x00-\x1f\x7f]/.test(value) && Buffer.byteLength(value.trim()) <= 256 ? value.trim() : null;
 const legs=[];
 for (const leg of route.legs) {
  const from=clean(leg.fromStation?.name), to=clean(leg.toStation?.name);
  if (!from || !to) return null;
  const type=leg.trainTypes?.find(t=>t.groupId===leg.recommendedGroupId);
  const lines=[...new Set((type?.lines ?? []).map(l=>clean(l.nameShort)).filter(Boolean))].join(' / ') || '路線情報なし';
  if (!clean(lines)) return null;
  // Multiple through-service lines have no single route color. Use neutral instead.
  const colors=[...new Set((type?.lines ?? []).map(l=>l.color))];
  const color=colors.length===1 && /^#?[0-9a-f]{6}$/i.test(colors[0] ?? '') ? colors[0].replace(/^#/, '').toUpperCase() : 'B9CCD7';
  legs.push({from,to,line:lines,type:clean(type?.name) || '種別情報なし',color});
 }
 const minutes=Number.isFinite(route.totalSeconds) && route.totalSeconds>=0 ? Math.ceil(route.totalSeconds/60) : null;
 if (minutes !== null && (!Number.isSafeInteger(minutes) || minutes>99999)) return null;
 const data=JSON.stringify({version:1,minutes,legs});
 return Buffer.byteLength(data)<=16384 ? data : null;
}
