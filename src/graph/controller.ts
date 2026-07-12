import type { AppData, Apps } from "../bevy_types/app_data";
import type { ScheduleGraph, System, SystemSet } from "../bevy_types/systems_graph_types";

export type RenderSystemsDetail = (systems: System[], system_sets: SystemSet[]) => void;

export interface ComponentDetail {
    encountered: {
        appName: string,
        schedule: string,
        idx: number,
    }[],
    required: string[],
}

export class Controller {

    apps: Apps;
    _isSystemsSimplified: boolean = false;
    allSchedules: string[] = [];
    allComponents: {[componentName: string] : ComponentDetail } = {};

//     for(let [index, system_set] of RG.result.schedule_data.system_sets.entries()) {
//     for(let [index, system] of RG.result.schedule_data.systems.entries()) {
//     for(let [index, dep] of RG.result.schedule_data.dependency.entries()) {
//     for(let [index, hie] of RG.result.schedule_data.hierarchy.entries()) {

    constructor(
        apps: Apps,
        renderSystemsDetail: RenderSystemsDetail,
    ) {
        this.apps = apps;

        this._isSystemsSimplified = false;
        this.allSchedules = [];
        this.allComponents = {};
        this.build(this.apps.main, "main");
        this.build(this.apps.render, "render");

        console.log(this.allComponents);
    }

    getData(app: "main" | "render", schedule: string) : ScheduleGraph {
        return this.apps[app].scheduleGraphs[schedule];
    }

    build(app: AppData, appName: string) {
        let mainSchedules = app.scheduleList.result.schedule_labels;
        this.allSchedules = this.allSchedules.concat(mainSchedules);
        
        for(let scheduleName of mainSchedules) {
            let schedule = app.scheduleGraphs[scheduleName].result.schedule_data;

            for(let idx = 0; idx < schedule.components.length; idx++) {
                let component = schedule.components[idx]!;

                if(!(component.name in this.allComponents)) {
                    this.allComponents[component.name] = {
                        encountered: [],
                        required: [],
                    };

                    for(let req of component.required) {
                        let reqComp = schedule.components[req]!.name;

                        this.allComponents[component.name]!.required.push(reqComp);
                    }
                }

                this.allComponents[component.name]!.encountered.push({
                    appName,
                    schedule: scheduleName,
                    idx,
                });
                
            }
        }
    }

    // Returns true if the state is simplified
    toggleSimplifySystems() {
      console.log('Method not implemented.');

      this._isSystemsSimplified = !this._isSystemsSimplified;
    }

    isSystemsSimplified(): boolean {
      return this._isSystemsSimplified;
    }
}

