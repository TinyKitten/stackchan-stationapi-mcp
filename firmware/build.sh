#!/usr/bin/env bash
set -eo pipefail
root="$(cd -- "$(dirname -- "$0")" && pwd)"
build_root="${STACKCHAN_BUILD_ROOT:-$root/.build}"
mkdir -p "$build_root"
build_root="$(cd "$build_root" && pwd)"
for command in git python3 cmake ninja; do
  if ! command -v "$command" >/dev/null; then
    echo "不足: $command。Ubuntuでは次を実行後、再実行してください。" >&2
    echo 'sudo apt-get install git wget flex bison gperf python3 python3-pip python3-venv cmake ninja-build ccache libffi-dev libssl-dev dfu-util libusb-1.0-0' >&2
    exit 1
  fi
done
idf="$build_root/esp-idf"
export IDF_TOOLS_PATH="$build_root/idf-tools"
if [[ ! -d "$idf" ]]; then
  git clone --recursive --branch v6.1 --depth 1 https://github.com/espressif/esp-idf.git "$idf"
fi
if [[ "$(git -C "$idf" describe --tags --exact-match HEAD)" != v6.1 ]]; then
  echo 'ESP-IDFの取得先がv6.1ではありません。別のSTACKCHAN_BUILD_ROOTを指定してください。' >&2
  exit 1
fi
"$idf/install.sh" esp32s3
source "$idf/export.sh"
source_dir="$build_root/StackChan"
revision=28b9f0c8bd6acd81cb3c70f1a93c3e373b39d400
if [[ ! -d "$source_dir" ]]; then
  git clone https://github.com/m5stack/StackChan.git "$source_dir"
  git -C "$source_dir" checkout --detach "$revision"
fi
if [[ "$(git -C "$source_dir" rev-parse HEAD)" != "$revision" ]]; then
  echo 'StackChanのリビジョンが対象と異なります。既存ソースは変更しません。' >&2
  exit 1
fi
if git -C "$source_dir" apply --reverse --check "$root/fullscreen-route.patch" 2>/dev/null; then
  echo '経路表示パッチは適用済みです。'
else
  git -C "$source_dir" apply --check "$root/fullscreen-route.patch"
  git -C "$source_dir" apply "$root/fullscreen-route.patch"
fi
cd "$source_dir/firmware"
python fetch_repos.py
# Keep the upstream defaults unchanged and use a separate Japanese build config.
python - <<'PY'
from pathlib import Path
text=Path('sdkconfig.defaults').read_text()
text=text.replace('CONFIG_LANGUAGE_EN_US=y', 'CONFIG_LANGUAGE_JA_JP=y')
Path('sdkconfig.route.defaults').write_text(text)
PY
idf.py -B build-route -D SDKCONFIG="$PWD/sdkconfig.route" -D SDKCONFIG_DEFAULTS="$PWD/sdkconfig.route.defaults" build
printf '\nビルド成功: %s/build-route\n本体への書き込みは実行していません。\n' "$PWD"
