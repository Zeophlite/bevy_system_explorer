import type { AppData, Apps } from "../bevy_types/app_data";
import type { ScheduleGraph, System, SystemSet } from "../bevy_types/systems_graph_types";

export interface ComponentsDetails {
    components: string[],
}

export type RenderComponentsDetail = (detail: ComponentsDetails) => void;

export interface SchedulesDetail {
    schedules: string[],
}

export type RenderSchedulesDetail = (detail: SchedulesDetail) => void;

export interface SystemsDetail {
    systems: System[],
    system_sets: SystemSet[],
}

export type RenderSystemsDetail = (detail: SystemsDetail) => void;

export interface ComponentDetail {
    encountered: { // Where this component has been encountered
        appName: string,
        schedule: string,
        idx: number, // index into schedule.components
    }[],
    required: string[],
}

export class Controller {

    apps: Apps;
    _isSystemsSimplified: boolean = false;
    allSchedules: string[] = [];
    allComponents: {[componentName: string] : ComponentDetail } = {};

    renderComponentsDetail: RenderComponentsDetail;
    renderSchedulesDetail: RenderSchedulesDetail;
    renderSystemsDetail: RenderSystemsDetail;

//     for(let [index, system_set] of RG.result.schedule_data.system_sets.entries()) {
//     for(let [index, system] of RG.result.schedule_data.systems.entries()) {
//     for(let [index, dep] of RG.result.schedule_data.dependency.entries()) {
//     for(let [index, hie] of RG.result.schedule_data.hierarchy.entries()) {

    constructor(
        apps: Apps,
        renderComponentsDetail: RenderComponentsDetail,
        renderSchedulesDetail: RenderSchedulesDetail,
        renderSystemsDetail: RenderSystemsDetail,
    ) {
        this.apps = apps;

        this._isSystemsSimplified = false;
        this.allSchedules = [];
        this.allComponents = {};

        this.renderSystemsDetail = renderSystemsDetail;
        this.renderComponentsDetail = renderComponentsDetail;
        this.renderSchedulesDetail = renderSchedulesDetail;

        this.build(this.apps.main, "main");
        this.build(this.apps.render, "render");
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

    selectedComponents(selectedComponents: string[]) {
        console.log("TODO: Selected Components: " + selectedComponents.join(", "));

        let focusSchedules = new Set<string>();

        for(let component of selectedComponents) {
            console.log("Component " + component + " encountered in");
            for(let enc of this.allComponents[component].encountered) {
                console.log("-- " + enc.appName + " " + enc.schedule);

                focusSchedules.add(enc.schedule);
            }
        }

        this.renderComponentsDetail({ components: selectedComponents });
    }

    selectedSchedules(selectedSchedules: string[]) {
        console.log("TODO: Selected Schedules: " + selectedSchedules.join(", "));

        this.renderSchedulesDetail({ schedules: selectedSchedules });
    }

    selectedSystems(selectedSystems: System[], selectedSystemSets: SystemSet[]) {
        console.log("TODO: Selected Systems: " + selectedSystems.map((s) => s.name).join(", ") + " " + selectedSystemSets.map((s) => s.name).join(", "));

        this.renderSystemsDetail({ systems: selectedSystems, system_sets: selectedSystemSets });
    }
}

