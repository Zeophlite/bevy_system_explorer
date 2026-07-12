#!/bin/bash

# cargo run --example server --features="bevy_remote" 

mkdir -p main/
mkdir -p render/

curl -d'{"jsonrpc":"2.0","method":"schedule.list","id":1,"params":{}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15702 | jq '.' > "main.json"

main_schedules=(
    "First"
    "PreStartup"
    "SpawnScene"
    "FixedMain"
    "Update"
    "RunFixedMainLoop"
    "Last"
    "StateTransition"
    "FixedPostUpdate"
    "FixedFirst"
    "FixedLast"
    "PostUpdate"
    "PreUpdate"
    "Startup"
    "PostStartup"
)

for item in "${main_schedules[@]}"; do
    echo "main_schedules: $item"
    curl -d'{"jsonrpc":"2.0","method":"schedule.graph","id":1,"params":{"schedule_label":"'$item'"}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15702 | jq '.' > "main/$item.json"
done


curl -d'{"jsonrpc":"2.0","method":"schedule.list","id":1,"params":{}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15703 | jq '.' > "render.json"

render_schedules=(
    "RenderStartup"
    "ExtractSchedule"
    "Core3d"
    "RenderGraph"
    "Render"
    "Core2d"
)

for item in "${render_schedules[@]}"; do
    echo "render_schedules: $item"
    curl -d'{"jsonrpc":"2.0","method":"schedule.graph","id":1,"params":{"schedule_label":"'$item'"}}' -X POST -H "Accept: applcation/json" -H "Content-Type: application/json" http://127.0.0.1:15703 | jq '.' > "render/$item.json"
done
