# GitHub Actionsでのビルド

`ESP-IDF firmware build` ワークフローは、`firmware/**` またはワークフローの変更を含むPRと、masterへのpushで実行されます。masterへマージ後はActions画面の **Run workflow** から手動実行もできます。

既存の `bash firmware/build.sh` をUbuntu 24.04上で実行します。ESP-IDF v6.1、公式StackChanの固定コミット `28b9f0c8bd6acd81cb3c70f1a93c3e373b39d400`、全画面経路表示パッチ、日本語設定を使用します。追加のSecretsは不要です。

## 成果物

成功した実行の **Artifacts** から `stackchan-esp32s3-ja-<commit>` をダウンロードします。保存期間は14日です。

- `flasher_args.json` に記載された全バイナリ（ブートローダー、パーティションテーブル、アプリ、データパーティションなど）。相対パスを維持します。
- `flasher_args.json` と `flash_args`
- ELF・mapファイル
- 日本語ビルド設定 `sdkconfig.route`
- ESP-IDF・公式ソース・パッチのリビジョンを記した `BUILD.txt`

書き込み時は成果物を展開し、対応するESP-IDF環境で `flash_args` と機種の手順を確認してください。CIはビルドのみを実施し、実機への書き込みや動作確認は行いません。

失敗時には生成済みのESP-IDF・CMakeログを別の成果物として7日間保存します。依存の取得前など、ログがまだ存在しない段階の失敗はActionsの実行ログで確認してください。
