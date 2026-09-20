#!/bin/bash

# cargo run --example server --features="bevy_remote" 

mkdir -p main/
mkdir -p render/

curl -d'{"jsonrpc":"2.0","method":"schedule.list","id":1,"params":{}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15702 | jq '.' > "main.json"

while IFS= read -r item; do
    echo "main_schedules: $item"
    curl -d'{"jsonrpc":"2.0","method":"schedule.graph","id":1,"params":{"schedule_label":"'$item'"}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15702 | jq '.' > "main/$item.json"
done < <(jq -r '.result.schedule_labels[]' <<< cat main.json)

curl -d'{"jsonrpc":"2.0","method":"schedule.list","id":1,"params":{}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15703 | jq '.' > "render.json"

while IFS= read -r item; do
    echo "render_schedules: $item"
    curl -d'{"jsonrpc":"2.0","method":"schedule.graph","id":1,"params":{"schedule_label":"'$item'"}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15703 | jq '.' > "render/$item.json"
done < <(jq -r '.result.schedule_labels[]' <<< cat render.json)
