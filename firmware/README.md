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

Nodeの29テストとパッチの適用チェック済み。ESP-IDFが実行環境にないため、ファームウェアのコンパイル・書き込み・実機での日本語表示は未検証です。

実機確認項目：直通と乗換経路、長い駅名、縦スクロール、閉じて再表示、音声応答中の表示維持、テーマ変更、日本語の欠字。本体表示が確認できるまでは導入完了扱いにしません。
