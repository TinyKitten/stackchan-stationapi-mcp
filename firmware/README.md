# StackChan 全画面経路表示（実機未検証）

公式 m5stack/StackChan のコミット `28b9f0c8bd6acd81cb3c70f1a93c3e373b39d400` に適用するパッチです。ファームウェアのビルド・書き込みが必要です。PC側MCPの更新だけでは画面は変わりません。

## 画面と連携

- Figmaの[リッチ表示案](https://www.figma.com/design/qdzSgWwaMPM1fDuJaeQdyz?node-id=8-3)をもとに、320×240の概要・区間詳細・戻る／次へ・閉じるをLVGLで表示します。
- 路線色は評価済み種別のStationAPIデータを使用します。色なし・複数の異なる路線色は中立色にし、実在しない色を割り当てません。暗い路線色の文字は明るく補正します。
- 概要は縦スクロール、長い駅名・路線名は横スクロール。最大30区間を省略しません。
- `connected_routes` の `displayData` を、AIが選んだ経路のまま本体ツール `self.screen.show_route_card` の `data` 引数に渡します。PCから本体への直接プッシュではありません。
- データ形式はJSON文字列 `{version:1,minutes:number|null,legs:[{from,to,line,type,color}]}`。時間は推定、色は6桁のHEXです。最大16384 UTF-8バイト・各文字列256バイト。不完全・過大な経路は `displayData: null` にし、途中で切った経路を表示しません。本体も検証し、不正入力で表示中の経路を置換しません。
- 旧本体向けの `displayText` → `self.screen.show_route(text)` も維持します。どちらも `self.screen.hide_route` で顔へ戻ります。
- 本体に導入済みの日本語フォントを拡縮・太字補正して使います。FigmaのNoto Sans JP Boldと完全に同じ字形ではありません。テーマ変更時にも白文字を維持します。

## 適用

このリポジトリの隣に公式ソースを取得する例です。既存の開発用チェックアウトには適用しません。

```sh
git clone https://github.com/m5stack/StackChan.git ../StackChan-route
cd ../StackChan-route
git checkout 28b9f0c8bd6acd81cb3c70f1a93c3e373b39d400
git apply --check ../stackchan-stationapi-mcp/firmware/fullscreen-route.patch
git apply ../stackchan-stationapi-mcp/firmware/fullscreen-route.patch
cp -R ../stackchan-stationapi-mcp/firmware/route firmware/main/hal/board/
```

以後は公式ソースの手順でESP-IDF v6.1と依存リポジトリを準備し、対象ボード・日本語フォント設定を確認してビルドします。書き込み前にビルド成功を確認してください。

PC側は更新後に `systemctl --user restart stationapi-mcp.service` を実行します。本体側も更新・再接続し、ツール一覧に `self.screen.show_route_card`、`self.screen.show_route`、`self.screen.hide_route` が現れることを確認します。

## 検証状況

Nodeの34テスト、共通C++パーサーとページ遷移、ホストLVGLの3画面描画・ボタン操作・長い経路のスクロールを検証しています（[再現手順](tests/README.md)）。ESP-IDF v6.1・ESP32-S3・日本語設定でもビルド確認します。リッチ表示版の実機での描画・タッチ操作は未検証です。

実機確認項目：直通と乗換経路、長い駅名、縦スクロール、閉じて再表示、音声応答中の表示維持、テーマ変更、日本語の欠字。本体表示が確認できるまでは導入完了扱いにしません。

## ESP-IDF導入からビルドまで

Ubuntuではシステム依存を用意してから `bash firmware/build.sh` を実行します。必要なaptパッケージはスクリプトの不足検出時に表示します。ESP-IDF v6.1とツールチェーンを `firmware/.build/` に導入し、専用ソースへパッチを適用、日本語設定でESP32-S3向けにビルドします。旧文章表示パッチからは `upgrade-route-v1.patch` で更新します。独自の変更に競合する場合は変更せず停止するため、新しい `STACKCHAN_BUILD_ROOT` を指定してください。再実行可能で、既存ファームウェアのソースや本体は変更しません。ネットワーク接続が必要です。

スクリプトの構文と不足依存の検出を確認済みです。依存導入後、同じビルド設定でバイナリ生成とパーティションサイズ検証の完了を確認しました。

## GitHub Actionsによるビルド

[Build ESP-IDF firmware](../.github/workflows/build-firmware.yml) は、ファームウェアやワークフロー自身を変更するPR、`master`へのpush、手動実行で起動します。ESP-IDF v6.1 / ESP32-S3 / StackChan / 日本語設定のビルドと書き込み用バイナリの生成を検証します。

成功した実行のArtifactsから `stackchan-esp32s3-esp-idf-v6.1` を取得できます（保存期間14日）。`build-route/` 以下の書き込み用バイナリ・メタデータと `sdkconfig.route` を収録します。CIでは実機への書き込みや表示動作の確認は行いません。

master上のビルド成功後は、`firmware-<実行番号>` タグのGitHub Releaseを自動公開します。リリースには書き込み用ファイル一式の `stackchan-esp32s3-ja.zip` と `SHA256SUMS` を添付します。PRのビルドからは公開しません。
