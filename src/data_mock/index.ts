
import type { Apps } from "../bevy_types/app_data";
import type { ScheduleGraph } from "../bevy_types/systems_graph_types";

const _RG = () => import('./RenderGraph.json');
const RG = await _RG() as any as ScheduleGraph;

const _UG = () => import('./Update.json');
const UG = await _UG() as any as ScheduleGraph;

// NOTE: `as any as ScheduleGraph` required due to following error when loading from file
// Type '({ System: number; SystemSet?: undefined; } | { SystemSet: number; System?: undefined; })[]' is not assignable to type 'Dependency'.

export async function readMockApps() : Promise<Apps> {
    return {
        main: {
            scheduleList: {
                jsonrpc: "",
                id: "1",
                result: {
                    empty_schedule_labels: [],
                    schedule_labels: ["Update"],
                    unavailable_schedule_labels: [],
                },
            },
            scheduleGraphs: {
                "Update": UG,
            },
        },
        render: {
            scheduleList: {
                jsonrpc: "",
                id: "1",
                result: {
                    empty_schedule_labels: [],
                    schedule_labels: ["RenderGraph"],
                    unavailable_schedule_labels: [],
                },
            },
            scheduleGraphs: {
                "RenderGraph": RG,
            },
        },
    };
}
