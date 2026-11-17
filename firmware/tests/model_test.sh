#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cjson="${1:?Pass the managed_components/espressif__cjson/cJSON directory}"
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
node --input-type=module - "$root" > "$output/route.json" <<'JS'
const {routeDisplayData}=await import(`${process.argv[2]}/route-display.mjs`);
const legs=[['光が丘','練馬','大江戸線','B6007A'],['練馬','池袋','西武池袋線','EF810F']].map(([from,to,line,color])=>({fromStation:{name:from},toStation:{name:to},recommendedGroupId:1,trainTypes:[{groupId:1,name:'各停',lines:[{nameShort:line,color}]}]}));
process.stdout.write(routeDisplayData({totalSeconds:1500,legs}));
JS
cc -c "$cjson/cJSON.c" -o "$output/cJSON.o"
c++ -std=c++17 -Wall -Wextra -Werror -I "$cjson" -I "$root/firmware/route" "$root/firmware/tests/model_test.cpp" "$output/cJSON.o" -o "$output/model_test"
"$output/model_test" "$output/route.json"
