// import { initScheduleGraph } from './schedule/schedule_graph.ts';
import './style.css';
import type { System, SystemSet } from './bevy_types/systems_graph_types.ts';
import { collectAll } from './remote/remote.ts';
import { readApps } from './data/index.ts';
import { readMockApps } from './data_mock/index.ts';
import { Controller, type ComponentsDetails, type SchedulesDetail, type SystemsDetail } from './graph/controller.ts';

import { initComponentsGraph, loadComponentsGraph } from './graph/impl/components_graph.ts';
import { initSchedulesGraph, loadSchedulesGraph } from './graph/impl/schedules_graph.ts';
import { initSystemsGraph, loadSystemsGraph, parentSoleSystems, systemsLayout } from './graph/impl/systems_graph.ts';

import type { Apps } from './bevy_types/app_data.ts';
import { initCustomGraph } from './graph/CustomPhysicsLayoutDemo.ts';
import { collapseInteriorNodesWithCompoundSupport } from './graph/collapse.ts';
import { load_cytoscape } from './graph/load_cytoscape';


function appLoader(mode: string): [string, () => Promise<Apps>] {
    switch (mode) {
        case "remote":
            return [mode, collectAll];
        case "read":
            return [mode, readApps];
        case "mock":
            return [mode, readMockApps];
    }

    return ["mock", readMockApps];
}

async function init() {
    let mode = import.meta.env.MODE;
    console.log("mode", mode);

    let [displayMode, appDataFn] = appLoader(mode);
    document.querySelector<HTMLDivElement>('#title')!.innerHTML = `<h1>${displayMode}</h1>`;

    let appData = await appDataFn();

    let controller = new Controller(appData, renderComponentsDetail, renderSchedulesDetail, renderSystemsDetail);

    const componentsContainer = document.querySelector<HTMLDivElement>('#components-graph')!;
    const schedulesContainer = document.querySelector<HTMLDivElement>('#schedules-graph')!;
    const systemsContainer = document.querySelector<HTMLDivElement>('#systems-graph')!;

    const cytoscapeModule = await load_cytoscape();
    const cytoscape = cytoscapeModule;

    // let custom = initCustomGraph(componentsContainer, controller, cytoscape);
    let comp = initComponentsGraph(componentsContainer, cytoscape);
    let sched = initSchedulesGraph(schedulesContainer, cytoscape);
    let sys = initSystemsGraph(systemsContainer, cytoscape);

    (globalThis as any).bse_comp = comp;
    (globalThis as any).bse_sched = sched;
    (globalThis as any).bse_sys = sys;

    let compEle = loadComponentsGraph(controller, comp);
    let schedEle = loadSchedulesGraph(controller, sched);
    // let sysEle = loadSystemsGraph(controller, sys);
    
    document.querySelector<HTMLButtonElement>('#simplify-systems')!.addEventListener('click', (ev: PointerEvent) => {
        controller.toggleSimplifySystems();
        console.log('click', ev);

        let ab = sys.$(":selected");
        console.log("ab");

        let ids : string[] = [];
        ab.forEach(function (ele) {
            ids.push(ele.id());
        });

        collapseInteriorNodesWithCompoundSupport(sys, ids);

        let button = ev.target! as HTMLButtonElement;
        button.textContent = controller.isSystemsSimplified() ? "Unsimplify" : "Simplify";
    });

    comp.on("select unselect boxselect", (ev) => {
        console.log("comp " + ev.type + " ", ev.target);

        let selectedComponents: string[] = [];

        ev.cy.$(":selected").forEach(function (ele) {
            if(!ele.isNode()) {
                return;
            }
            console.log("" + ev.type + ": " + ele.id(), ele.data());
            let component = ele.data().label;
            selectedComponents.push(component);
        });

        controller.selectedComponents(selectedComponents);
    });

    sched.on("select unselect boxselect", (ev) => {
        console.log("sched " + ev.type + " ", ev.target);

        // TODO: retain system positions (as initial) when removing a schedule

        let selectedSchedules: string[] = [];
        sys.nodes().remove();

        ev.cy.$(":selected").forEach(function (ele) {
            if(!ele.isNode()) {
                return;
            }

            console.log("" + ev.type + ": " + ele.id(), ele.data());
            let data = ele.data();
            let node_type = data._node_type;
            
            if(node_type == "schedule") {
                let schedule = data.title;

                console.log("lsg", data);
                loadSystemsGraph(controller, sys, data.app, schedule);

                selectedSchedules.push(schedule);

                console.log("Selected schedule " + schedule);
            }
        });

        let parentedEdges = parentSoleSystems(sys);
        systemsLayout(sys);
        parentedEdges.forEach(e => e.remove());

        controller.selectedSchedules(selectedSchedules);
    });

    // TODO: this is for testing, move to arg
    loadSystemsGraph(controller, sys, "main", "PostUpdate");
    let parentedEdges = parentSoleSystems(sys);
    systemsLayout(sys);
    parentedEdges.forEach(e => e.remove());


    sys.on("select unselect boxselect", (ev) => {
        console.log("sys " + ev.type + " ", ev.target);

        let selectedSystems: System[] = [];
        let selectedSystemSets: SystemSet[] = [];

        ev.cy.$(":selected").forEach(function (ele) {
            if(!ele.isNode()) {
                return;
            }

            console.log("" + ev.type + ": " + ele.id(), ele.data());

            let data = ele.data();
            let node_type = data._node_type; // "system" | "system_set"

            let label = data.label;
            let title = data.title;

            if(node_type == "system") {
                let ddata = data._data as System;
                console.log("Selected system " + label + " " + title + " " + ddata.name);
                selectedSystems.push(ddata);
            }
            if(node_type == "system_set") {
                let ddata = data._data as SystemSet;
                console.log("Selected systemset " + label + " " + title + " " + ddata.name);
                selectedSystemSets.push(ddata);
            }
        });

        controller.selectedSystems(selectedSystems, selectedSystemSets);
    });
}


function renderComponentsDetail(detail: ComponentsDetails): void {
    let output = `<ul>`;

    for (let component of detail.components) {
        output += `<li><b>${component}</b></li>`;
    }

    output += '</ul>';
    document.querySelector<HTMLDivElement>('#selected-components')!.innerHTML = output;
}

function renderSchedulesDetail(detail: SchedulesDetail): void {
    let output = `<ul>`;

    for (let schedule of detail.schedules) {
        output += `<li>${schedule}</li>`;
    }

    output += '</ul>';
    document.querySelector<HTMLDivElement>('#selected-schedules')!.innerHTML = output;
}

function renderSystemsDetail(detail: SystemsDetail): void {
    let output = `<ul>`;

    for (let system of detail.systems) {
        output += `<li>${system.name}</li>`;
    }
    for (let system_set of detail.system_sets) {
        output += `<li>${system_set.name}</li>`;
    }

    output += '</ul>';
    document.querySelector<HTMLDivElement>('#selected-systems')!.innerHTML = output;
}



init();
