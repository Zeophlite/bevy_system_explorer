import type { AppData, Apps } from "../bevy_types/app_data";
import type { Dependency, Hierarchy, ScheduleGraph, System, SystemSet } from "../bevy_types/systems_graph_types";
import type { AppLabel } from "../data";
import { parseComponentName, parseSystemName, parseSystemSetName } from "./impl/name";

export type RenderDetailFn = (
    detail: Details,
) => void;

// render detail
export interface Details {
    // these are all full names
    selectedComponents: string[],
    selectedSchedules: string[],
    selectedSystems: string[],
    selectedSystemSets: string[],

    focusedComponents: string[],
    focusedSchedules: string[],
    focusedSystems: string[],
    focusedSystemSets: string[],

    getComponentShortName: (name: string) => string,
    getSystemShortName: (name: string) => string,
    getSystemSetShortName: (name: string) => string,
}


// Internal detail
export interface ComponentDetail {
    shortName: string,
    required: Set<string>,

    schedules: Set<string>,
    systems: Set<string>,
}

export interface ScheduleDetail {
    app: string,
    schedule: string,

    components: Set<string>,
    systems: Set<string>,
}

export interface SystemDetail {
    shortName: string,

    components: Set<string>,
    schedules: Set<string>,
}

export interface SystemSetDetail {
    shortName: string,
}

/// We use a two tiers, "select" and "focus"
/// User input is select
/// Related items are focus
///
/// e.g. User selects a Component
///      focus is on Systems that have that Component as arguments
///      and Schedules that have those focused Systems
///
/// Select and Focus is additive
/// e.g. User selects a Component and a Schedule
///      focus is on Systems that have that Component as arguments
///      and Schedules that have those focused Systems
///      and systems in the 
///
/// Select overrides Focus
export class Controller implements Details {

    apps: Apps;
    _isSystemsSimplified: boolean = false;

    // allComponents[gah].systems[bah] = {} // can store more info if needed
    // component gah focuses Object.keys( allComponents[gah].systems )
    // gah is an argument to system bah
    // conversely allSystems[bah].components[gah] must exist
    // similarly for schedule foo
    allComponents: {[componentName: string] : ComponentDetail } = {};
    allSchedules: {[schedule: string] : ScheduleDetail } = {};
    allSystems: {[system: string] : SystemDetail } = {};
    allSystemSets: {[systemSet: string] : SystemSetDetail } = {};

    renderDetail: RenderDetailFn;

    constructor(
        apps: Apps,
        renderDetail: RenderDetailFn,
    ) {
        this.apps = apps;

        this._isSystemsSimplified = false;
        this.allComponents = {};

        this.renderDetail = renderDetail;

        this.build(this.apps.main, "main");
        this.build(this.apps.render, "render");

        // console.log("allComponents", this.allComponents);
        // console.log("allSchedules", this.allSchedules);
        // console.log("allSystems", this.allSystems);
    }

    getData(app: AppLabel, schedule: string) : ScheduleGraph {
        let SG = this.apps[app].scheduleGraphs[schedule];
        return SG;
    }

    getComponentShortName(name: string) : string {
        return this.allComponents[name].shortName;
    }
    getSystemShortName(name: string) : string {
        return this.allSystems[name].shortName;
    }
    getSystemSetShortName(name: string) : string {
        return this.allSystemSets[name].shortName;
    }

    build(app: AppData, appName: string) {
        let mainSchedules = app.scheduleList.result.schedule_labels;

        for(let foo of mainSchedules) {
            if(foo in this.allSchedules) {
                // console.log("Already have schedule " + foo);
            } else {
                this.allSchedules[foo] = {
                    app: appName,
                    schedule: foo,

                    components: new Set(),
                    systems: new Set(),
                };
            }

            let schedule_data = app.scheduleGraphs[foo].result.schedule_data;

            for(let component of schedule_data.components) {
                let gah = component.name;

                if(gah in this.allComponents) {
                    // console.log("Already have component " + gah);
                } else {
                    this.allComponents[gah] = {
                        shortName: parseComponentName(gah),
                        required: new Set(),

                        schedules: new Set(),
                        systems: new Set(),
                    };

                    for(let req of component.required) {
                        let reqComp = schedule_data.components[req]!.name;

                        this.allComponents[gah]!.required.add(reqComp);
                    }
                }

                this.allSchedules[foo].components.add(gah);
            }
          
            // TODO: determine if also repeat for schedule_data.system_sets ?
            // system_sets can't have components, but are in schedules
            for(let system of schedule_data.systems) {
                let bah = system.name;

                if(bah in this.allSystems) {
                    // console.log("Already have system " + bah);
                } else {
                    this.allSystems[bah] = {
                        shortName: parseSystemName(bah),
                        components: new Set(),
                        schedules: new Set(),
                    };
                }

                this.allSchedules[foo].systems.add(bah);
                this.allSystems[bah].schedules.add(foo);

                for(let fa of system.filtered_accesses) {
                    let add = (component: number) => {
                        let gah = schedule_data.components[component].name;

                        this.allSystems[bah].components.add(gah);
                        this.allComponents[gah].systems.add(bah);
                        this.allComponents[gah].schedules.add(foo);
                    };

                    for(let archetypal of fa.access.archetypal) {
                        add(archetypal);
                    }
                    for(let read of fa.access.reads) {
                        let r_i = fa.access.reads_inverted;
                        add(read);
                    }
                    for(let write of fa.access.writes) {
                        let w_i = fa.access.writes_inverted;
                        add(write);
                    }
                    for(let filter_set of fa.filter_sets) {
                        for(let w of filter_set.with) {
                            add(w);
                        }

                        for(let wo of filter_set.without) {
                            add(wo);
                        }
                    }
                }
            }

            for(let systemSet of schedule_data.system_sets) {
                let bah = systemSet.name;

                if(bah in this.allSystemSets) {
                    // console.log("Already have system set " + bah);
                } else {
                    this.allSystemSets[bah] = {
                        shortName: parseSystemName(bah),
                    };
                }
            }
        }
    }

    // Returns true if the state is simplified
    toggleSimplifySystems() {
      this._isSystemsSimplified = !this._isSystemsSimplified;
    }

    isSystemsSimplified(): boolean {
      return this._isSystemsSimplified;
    }

    selectedComponents: string[] = [];
    selectedSchedules: string[] = [];
    selectedSystems: string[] = [];
    selectedSystemSets: string[] = [];

    focusedComponents: string[] = [];
    focusedSchedules: string[] = [];
    focusedSystems: string[] = [];
    focusedSystemSets: string[] = [];

    setSelectedComponents(selectedComponents: string[]): void {
        this.selectedComponents = selectedComponents;
    }

    setSelectedSchedules(selectedSchedules: string[]): void {
        this.selectedSchedules = selectedSchedules;
    }

    setSelectedSystems(selectedSystems: string[], selectedSystemSets: string[]): void {
        this.selectedSystems = selectedSystems;
        this.selectedSystemSets = selectedSystemSets;
    }

    focusedForSelected(): Details {
        let fCompA = new Set<string>();
        let fSchedA = new Set<string>();
        let fSysA = new Set<string>();

        let fCompB = new Set<string>();
        let fSchedB = new Set<string>();
        let fSysB = new Set<string>();

        for(let selectedComponent of this.selectedComponents) {
            fSchedA = fSchedA.union(this.allComponents[selectedComponent].schedules);
            fSysA = fSysA.union(this.allComponents[selectedComponent].systems);
        }
        for(let selectedSystem of this.selectedSystems) {
            fCompA = fCompA.union(this.allSystems[selectedSystem].components);
            fSchedB = fSchedB.union(this.allSystems[selectedSystem].schedules);
        }
        for(let selectedSchedule of this.selectedSchedules) {
            // TODO: focus components from selected schedules is **heaps** of information, need a config
            // fCompB = fCompB.union(this.allSchedules[selectedSchedule].components);

            // TODO: selecting a schedule DISPLAYS all the systems in it, so no meaningful "focus"
            // fSysB = fSysB.union(this.allSchedules[selectedSchedule].systems);
        }

        let fComp = intersectionIfBothNonEmpty(fCompA, fCompB);
        let fSched = intersectionIfBothNonEmpty(fSchedA, fSchedB);
        let fSys = intersectionIfBothNonEmpty(fSysA, fSysB);

        this.focusedComponents = Array.from(fComp.values()).sort();
        this.focusedSchedules = Array.from(fSched.values()).sort();
        this.focusedSystems = Array.from(fSys.values()).sort();

        this.renderDetail(this);

        // TODO: replace with read only
        return this;
    }
}

function intersectionIfBothNonEmpty<T>(a: Set<T>, b: Set<T>) : Set<T> {
    if(a.size == 0) {
        return b;
    }

    if(b.size == 0) {
        return a;
    }

    return a.intersection(b);
}
