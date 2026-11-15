# StackChan StationAPI MCP

[StationAPI](https://github.com/TrainLCD/StationAPI)を使い、StackChanとの会話から日本の駅・バス停・路線・乗換経路を検索するMCPサーバーです。XiaozhiのMCP接続先へWebSocketで接続します。

## 必要なもの

- Node.js 22.4以上（外部npmパッケージ不要）
- StackChanアプリのMCP接続URL
- 自動起動にはLinuxのsystemdユーザーサービス

## セットアップ

```sh
git clone https://github.com/TinyKitten/stackchan-stationapi-mcp.git
cd stackchan-stationapi-mcp
bash setup.sh
```

**sudoは不要です。** 初回は接続URLを入力します。入力は非表示で、権限600の`.env`に保存します。nodenvも検出します。サービスはその場で起動し、以後ログイン時に自動起動します。PCの電源オフ・スリープ中は利用できません。

手動で起動する場合は`.env.example`を`.env`へコピーして接続URLを設定します。

```sh
npm start
```

設定を変更せずNode.js検出とテストだけ行うには`bash setup.sh --check`を使います。PATHで検出できない場合は、普段の端末で次を実行します。

```sh
STATIONAPI_NODE_BIN="$(node -p 'process.execPath')" bash setup.sh
```

既存サービスを更新した後は次を実行します。`setup.sh`は既存のサービス定義を上書きしません。

```sh
systemctl --user restart stationapi-mcp.service
journalctl --user -u stationapi-mcp.service -n 20 --no-pager
```

停止と自動起動の解除:

```sh
systemctl --user disable --now stationapi-mcp.service
```

## 使い方

- 「東京駅には何線がある？」
- 「山手線の駅を教えて」
- 「東京から渋谷への乗換を調べて」
- 「近くの駅は？」
- 「近くのバス停は？」

| ツール | 内容 |
| --- | --- |
| `search_stations` | 駅・バス停の名前検索 |
| `nearby_stations` | 指定座標からの近隣検索 |
| `nearby_stations_here` | 保存した設置位置、未保存ならGeoIPで近隣検索 |
| `search_lines` | 路線名検索 |
| `line_stations` | 路線IDから駅・バス停一覧を取得 |
| `connected_routes` | 駅グループID間の乗換経路検索 |

同名駅は路線や所在地を確認します。乗換には`search_stations`の`groupId`を使用します。所要時間は推定値で、時刻表・リアルタイムの遅延・運賃は提供しません。

## 設置場所をブラウザで保存

1. サービスを起動して、このPCのブラウザで http://127.0.0.1:18765/ を開く。
2. 「位置情報を取得」を押し、ブラウザの位置情報を許可する。
3. 座標・精度・周辺駅を確認して「この位置を設置場所として保存」を押す。

保存後の再起動は不要です。ブラウザを閉じても保存位置を使います。PCを移動したら再取得してください。連続追跡はしません。保存位置を削除するとGeoIPに戻ります。

未保存時は https://ipwho.is/ でこのPCの外向きIPに対応する座標を取得し、10分間メモリにキャッシュします。VPNやプロバイダーの拠点付近を示す場合があり、最寄り駅の精度は保証しません。日本国外の推定や取得失敗では、固定の駅に置き換えずエラーを返します。

### 位置情報と接続情報

- `.env`に秘密のMCP接続URLを保存します。Gitには含めません。
- `.location.json`にブラウザ測位の座標・精度・取得日時を保存します（権限600）。Gitには含めません。
- GeoIPの接続先には外向きIPが伝わりますが、取得したIPをファイル・ログ・MCP応答へ保存しません。
- 駅検索では座標をStationAPIへ送信します。MCPの応答には座標・測位方法・精度の情報を含むため、接続先のAIにも渡ります。
- 設定画面は`127.0.0.1`のみで待ち受け、別サイトからの書き込みを拒否します。

## 接続設定

既定のStationAPIはステージングの`https://gql-stg.trainlcd.app`です。`.env`の`STATIONAPI_URL`で変更できます。スキーマの互換性を確認してから切り替えてください。

MCP 2024-11-05の初期化・ping・tools/list・tools/call・キャンセルに対応します。Xiaozhiとの接続は切断後1〜60秒の間隔で再試行します。stdio接続は`npm run stdio`でも利用できます。

## テストと診断

```sh
npm test
node --env-file=.env diagnose.mjs
node --env-file=.env diagnose.mjs --here
```

29件のテストで、入力検証・GraphQL問い合わせ・エラー処理・MCP・GeoIP・位置情報の保存/削除・設定画面のリクエスト処理を確認します。自動テストは実際の測位許可や外部APIの可用性を保証するものではありません。

サービスログにはMCPメソッド、既知のツール名、HTTPステータス、GraphQLエラーを記録します。接続URLや検索引数は記録しません。

## 本体の全画面経路表示

[ファームウェアパッチと導入手順](firmware/README.md)を追加しています。経路検索結果の `displayText` を本体ツールへ渡し、縦スクロール可能な全画面で表示します。**ファームウェアのビルド・実機検証は未完了**です。PC側の更新だけでは表示されません。
