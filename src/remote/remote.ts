
import type { Apps, AppData } from "../bevy_types/app_data";
import type { ScheduleList, ScheduleGraph } from "../bevy_types/systems_graph_types";

const host = "127.0.0.1";
const main_port = 15702, render_port = 15703;

export async function collectAll() : Promise<Apps> {
    let mainList = await remoteScheduleList(host, main_port, 1);
    console.log("main", mainList);
    let main = await collect(mainList, host, main_port, mainList.id as number);


    let renderList = await remoteScheduleList(host, render_port, main.last_id + 1);
    console.log("render", renderList);
    let render = await collect(renderList, host, render_port, renderList.id as number);

    return { main, render };
}

export async function collect(scheduleList: ScheduleList, host: string, port: number, last_id: number) : Promise<AppData & {last_id: number}> {
    let scheduleGraphs: { [schedule: string]: ScheduleGraph } = {};

    let id = last_id;

    for(let a of scheduleList.result.schedule_labels) {
        id = id + 1;
        let graph = await remoteScheduleGraph(a, host, port, id);
        console.log("graph " + a, graph);

        scheduleGraphs[a] = graph;
    }

    return {
        scheduleList,
        scheduleGraphs,
        last_id: id,
    };
}


export async function remoteScheduleList(host: string, port: number, id: number) : Promise<ScheduleList> {
    let post = {
        "jsonrpc":"2.0",
        "method":"schedule.list",
        "id":id,
        "params":{}
    };

    const data = await fetch(`http://${host}:${port}/`, {
        body: JSON.stringify(post),
        method: "POST",
        headers: [
          ["Accept",  "applcation/json"],
          ["Content-Type", "application/json"],
        ],
    });

    return data.json();
}

export async function remoteScheduleGraph(schedule_label: string, host: string, port: number, id: number) : Promise<ScheduleGraph> {

    let post = {
        "jsonrpc": "2.0",
        "method": "schedule.graph",
        "id": id,
        "params": {
            "schedule_label": schedule_label,
        }
    };

    const data = await fetch(`http://${host}:${port}/`, {
        body: JSON.stringify(post),
        method: "POST",
        headers: [
          ["Accept",  "applcation/json"],
          ["Content-Type", "application/json"],
        ],
    });

    return data.json();
}


