import type { ScheduleGraph, ScheduleList } from "./systems_graph_types";

export interface AppData {
    scheduleList : ScheduleList,
    scheduleGraphs : { [schedule: string] : ScheduleGraph },
}

export interface Apps {
    main: AppData,
    render: AppData,
}
