# StackChan 全画面経路表示（実機未検証）

公式 m5stack/StackChan のコミット `28b9f0c8bd6acd81cb3c70f1a93c3e373b39d400` に適用するパッチです。ファームウェアのビルド・書き込みが必要です。PC側MCPの更新だけでは画面は変わりません。

## 画面と連携

- 320×240画面全体に経路を表示。駅名、評価済み種別の路線、推定時間を表示します。
- 長い経路は縦スクロール。「閉じる」または `self.screen.hide_route` で顔に戻ります。
- `connected_routes` は各結果に `displayText` を追加します。元の経路フィールドは維持します。
- AIが選んだ経路の `displayText` を、そのまま本体ツール `self.screen.show_route` の `text` 引数に渡します。別々のMCP接続をAIが仲介するため、PCから本体への直接プッシュではありません。
- 4096 UTF-8バイトを超える経路や不完全な経路は `displayText: null` にし、途中で切れた経路を表示しません。
- 既存の会話用フォントを使います。日本語フォントの導入・表示確認は本体側で必要です。

## 適用

このリポジトリの隣に公式ソースを取得する例です。既存の開発用チェックアウトには適用しません。

```sh
git clone https://github.com/m5stack/StackChan.git ../StackChan-route
cd ../StackChan-route
git checkout 28b9f0c8bd6acd81cb3c70f1a93c3e373b39d400
git apply --check ../stackchan-stationapi-mcp/firmware/fullscreen-route.patch
git apply ../stackchan-stationapi-mcp/firmware/fullscreen-route.patch
```

以後は公式ソースの手順でESP-IDF v6.1と依存リポジトリを準備し、対象ボード・日本語フォント設定を確認してビルドします。書き込み前にビルド成功を確認してください。

PC側は更新後に `systemctl --user restart stationapi-mcp.service` を実行します。本体側も更新・再接続し、ツール一覧に `self.screen.show_route` と `self.screen.hide_route` が現れることを確認します。

## 検証状況

Nodeの29テストとパッチの適用チェック済み。2026-11-16にESP-IDF v6.1でESP32-S3・StackChan・日本語設定のビルド成功を確認しました。stack-chan.binは0x39c1d0バイトで、アプリ領域に27%の空きがあります。書き込み・実機での日本語表示は未検証です。

実機確認項目：直通と乗換経路、長い駅名、縦スクロール、閉じて再表示、音声応答中の表示維持、テーマ変更、日本語の欠字。本体表示が確認できるまでは導入完了扱いにしません。

## ESP-IDF導入からビルドまで

Ubuntuではシステム依存を用意してから `bash firmware/build.sh` を実行します。必要なaptパッケージはスクリプトの不足検出時に表示します。ESP-IDF v6.1とツールチェーンを `firmware/.build/` に導入し、専用ソースへパッチを適用、日本語設定でESP32-S3向けにビルドします。再実行可能で、既存ファームウェアのソースや本体は変更しません。ネットワーク接続が必要です。

スクリプトの構文と不足依存の検出を確認済みです。依存導入後、同じビルド設定でバイナリ生成とパーティションサイズ検証の完了を確認しました。

## GitHub Actionsでのビルド

[ESP-IDF firmware build](../.github/workflows/firmware-esp-idf.yml) は、ファームウェア関連ファイル・ワークフローの変更を含むPR、`master`へのpush、手動実行（`workflow_dispatch`）で起動します。

Ubuntu 24.04上で依存パッケージを導入し、既存の `firmware/build.sh` を使ってESP-IDF v6.1・ESP32-S3・日本語設定でビルドします。完了後は `flasher_args.json` に記載された書き込み対象のバイナリを検証します。

成功した実行の **Artifacts** から `stackchan-esp32s3-<commit SHA>` を取得できます（保存期間14日）。`build-route/` 以下にファームウェアの `.bin`、`flasher_args.json`、書き込み引数を収録し、`sdkconfig.route` も含めます。

Actionsはビルドと成果物の保存までを行い、実機への書き込み・画面表示の検証は行いません。
