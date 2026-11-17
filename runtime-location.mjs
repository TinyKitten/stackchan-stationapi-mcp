import {loadSavedLocation} from './location-store.mjs';

export async function loadRuntimeLocation(env=process.env) {
  if (env.STACKCHAN_LOCATION) {
    let point;
    try {point=JSON.parse(env.STACKCHAN_LOCATION);} catch {}
    if (!point || !Number.isFinite(point.latitude) || Math.abs(point.latitude)>90 ||
        !Number.isFinite(point.longitude) || Math.abs(point.longitude)>180) {
      throw Error('位置情報のSTACKCHAN_LOCATIONが不正です。latitudeとlongitudeを数値で指定してください。');
    }
    return {source:'configuration',method:'ConfiguredLocation',approximate:true,
      latitude:point.latitude,longitude:point.longitude,
      caveat:'設定されたStackChanの設置位置。現在位置の自動測位ではありません。移動したら設定を更新してください。'};
  }
  if (env.STATIONAPI_CLOUD==='1') {
    throw Error('位置情報が未設定です。StackChanの設置座標をSTACKCHAN_LOCATIONに設定するか、地域名・駅名を指定してください。');
  }
  return loadSavedLocation();
}
