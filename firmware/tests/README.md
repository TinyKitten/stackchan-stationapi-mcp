# 本体と共通のパーサー・LVGLテスト

`model_test.sh` はNode側で生成したJSONを本体と同じC++パーサーに渡し、不正データを拒否して以前の経路を保持することとページ境界を検証します。

```sh
components="$PWD/firmware/.build/StackChan/firmware/managed_components"
bash firmware/tests/model_test.sh "$components/espressif__cjson/cJSON"
cmake -S firmware/tests -B firmware/.build/host-tests -G Ninja \
  -DLVGL_ROOT="$components/lvgl__lvgl" \
  -DCJSON_ROOT="$components/espressif__cjson/cJSON"
cmake --build firmware/.build/host-tests --parallel 4
cd firmware/.build/host-tests
./preview /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

ホスト側にはC/C++コンパイラー、CMake、Ninja、`fonts-noto-cjk`が必要です。実際の`route_view.h`をLVGLのソフトウェア描画で動かし、3画面をPPMへ出力します。区間ボタン、閉じる、再表示、30区間のスクロール、フォント変更を検証します。フォントはホストのNoto Sans CJKを使うため、実機のビットマップフォントとはラスタライズが異なります。実機のタッチ精度・速度・音声同時動作を保証するテストではありません。
