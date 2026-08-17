
import type { Apps } from "../bevy_types/app_data";
import type { ScheduleGraph, ScheduleList } from "../bevy_types/systems_graph_types";

let main_schedules = [
    "First",
    "PreStartup",
    "SpawnScene",
    "FixedMain",
    "Update",
    "RunFixedMainLoop",
    "Last",
    "StateTransition",
    "FixedPostUpdate",
    "FixedFirst",
    "FixedLast",
    "PostUpdate",
    "PreUpdate",
    "Startup",
    "PostStartup"
];

let render_graph_schedules = [
    "RenderStartup",
    "ExtractSchedule",
    "Core3d",
    "RenderGraph",
    "Render",
    "Core2d"
];



const _main_list = () => import('./main.json');
const main_list : ScheduleList = await _main_list();

const _render_list = () => import('./render.json');
const render_list : ScheduleList = await _render_list();

export type AppLabel = "main" | "render";

async function loadGraph(folder: AppLabel, scheduleList : ScheduleList) : Promise<{ [schedule: string] : ScheduleGraph }> {
    let data : { [schedule: string] : ScheduleGraph } = {};

    for(let schedule of scheduleList.result.schedule_labels) {
        let _graph = () => import(`./${folder}/${schedule}.json`);
        let graph : ScheduleGraph = await _graph();

        data[schedule] = graph;
    }


    return data;
}


export async function readApps() : Promise<Apps> {
    return {
        main: {
            scheduleList: main_list,
            scheduleGraphs: await loadGraph("main", main_list),
        },
        render: {
            scheduleList: render_list,
            scheduleGraphs: await loadGraph("render", render_list),
        },
    };
}
