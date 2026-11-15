#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ -n "${STATIONAPI_NODE_BIN:-}" ]]; then
  node_path="$STATIONAPI_NODE_BIN"
  if [[ ! -x "$node_path" ]]; then
    echo 'STATIONAPI_NODE_BINには実行可能なNode.jsの絶対パスを指定してください。'
    exit 1
  fi
elif command -v node >/dev/null 2>&1; then
  node_path="$(command -v node)"
else
  nodenv_path="$(command -v nodenv || true)"
  if [[ ! -x "$nodenv_path" ]]; then
    for candidate in "${NODENV_ROOT:-$HOME/.nodenv}/bin/nodenv" "$HOME/.nodenv/bin/nodenv"; do
      if [[ -x "$candidate" ]]; then nodenv_path="$candidate"; break; fi
    done
  fi
  if [[ ! -x "$nodenv_path" ]]; then
    echo 'このスクリプトの環境ではNode.jsを検出できません。普段の端末から STATIONAPI_NODE_BIN="$(node -p '\''process.execPath'\'')" bash setup.sh と実行してください。'
    exit 1
  fi
  node_path="$("$nodenv_path" which node)" || { echo 'nodenvで使用するNode.jsを選択してください。'; exit 1; }
fi
# Resolve shims now: systemd does not load interactive shell initialization.
node_path="$("$node_path" -p 'process.execPath')"
"$node_path" -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 4)) process.exit(1)' || { echo 'Node.js 22.4以上が必要です'; exit 1; }
if [[ "${1:-}" == '--check' ]]; then
  printf 'Node.js: %s\n' "$node_path"
  "$node_path" core.test.mjs
  "$node_path" geo.test.mjs
  "$node_path" location.test.mjs
  exit 0
fi
if [[ ! -f .env ]]; then
  read -r -s -p 'StackChanアプリのMCP接続URLを貼り付けてEnter: ' endpoint
  printf '\n'
  MCP_ENDPOINT="$endpoint" "$node_path" --input-type=module -e 'const u=new URL(process.env.MCP_ENDPOINT); if(u.protocol!=="wss:" || /[\r\n"\x27]/.test(process.env.MCP_ENDPOINT))process.exit(1)' || { echo '接続URLが不正です'; exit 1; }
  (umask 077; printf 'MCP_ENDPOINT="%s"\nSTATIONAPI_URL=https://gql-stg.trainlcd.app\n' "$endpoint" > .env)
  unset endpoint
fi
"$node_path" core.test.mjs
  "$node_path" geo.test.mjs
  "$node_path" location.test.mjs
project_dir="$PWD"
if [[ "$project_dir" == *'%'* || "$project_dir" == *'"'* || "$project_dir" == *'\\'* ]]; then echo 'パスに使えない文字があります'; exit 1; fi
mkdir -p "$HOME/.config/systemd/user"
unit="$HOME/.config/systemd/user/stationapi-mcp.service"
if [[ -e "$unit" ]]; then echo '既存のstationapi-mcp.serviceがあります。上書きせず終了します。'; exit 1; fi
cat > "$unit" <<UNIT
[Unit]
Description=StationAPI MCP for StackChan
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$project_dir
ExecStart="$node_path" --env-file=.env server.mjs
Restart=on-failure
RestartSec=10
UMask=0077

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now stationapi-mcp.service
systemctl --user --no-pager status stationapi-mcp.service
