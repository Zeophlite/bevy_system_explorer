// import { initScheduleGraph } from './schedule/schedule_graph.ts';
import './style.css';
import type { System, SystemSet } from './bevy_types/systems_graph_types.ts';
import { collectAll } from './remote/remote.ts';
import { readApps, type AppLabel } from './data/index.ts';
import { readMockApps } from './data_mock/index.ts';
import { Controller, type Details } from './graph/controller.ts';

import { initComponentsGraph, loadComponentsGraph } from './graph/impl/components_graph.ts';
import { initSchedulesGraph, loadSchedulesGraph } from './graph/impl/schedules_graph.ts';
import { findSystemSetsChains, initSystemsGraph, loadSystemsGraph, parentSoleSystems, systemsLayout } from './graph/impl/systems_graph.ts';

import type { Apps } from './bevy_types/app_data.ts';
import { initCustomGraph } from './graph/CustomPhysicsLayoutDemo.ts';
import { collapseInteriorNodesWithCompoundSupport } from './graph/collapse.ts';
import { load_cytoscape } from './graph/load_cytoscape';
import type { Core } from 'cytoscape';


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

    let controller = new Controller(appData, renderDetail);

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

    // TODO: this is for testing, move to arg
    let testSystem = false;
    if(testSystem) {
        // let testApp: AppLabel = "main", testSchedule = "PostUpdate";
        let testApp: AppLabel = "render", testSchedule = "RenderGraph";

        loadSystemsGraph(controller, sys, testApp, testSchedule);

        doSystemLayout(sys);
    }

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
            let component = ele.data().fullName;
            selectedComponents.push(component);
        });

        // If components are selected, the schedule and system graphs focuses to those that involve the component.
        controller.setSelectedComponents(selectedComponents);
        let {focusedSchedules, focusedSystems} = controller.focusedForSelected();

        sched.nodes().forEach((sched_node) => {
            let comp = sched_node.data("label");
            let sel = focusedSchedules.includes(comp);
            sched_node.data("focused", "" + sel);
        });
        sys.nodes().forEach((sys_node) => {
            if(sys_node.data("_node_type") == "system") {
                let comp = sys_node.data("label");
                let sel = focusedSystems.includes(comp);
                sys_node.data("focused", "" + sel);
            } else {
                sys_node.data("focused", "false");
            }
        });

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
                let schedule = data.name;

                console.log("lsg", data);
                loadSystemsGraph(controller, sys, data.app, schedule);

                selectedSchedules.push(schedule);

                console.log("Selected schedule " + schedule);
            }
        });

        doSystemLayout(sys);

        // Selecting a schedule will focus the components where that schedule is found, and show the systems of that schedule.
        controller.setSelectedSchedules(selectedSchedules);
        let {focusedComponents, focusedSystems} = controller.focusedForSelected();

        comp.nodes().forEach((comp_node) => {
            let comp = comp_node.data("label");
            let sel = focusedComponents.includes(comp);
            comp_node.data("focused", "" + sel);
        });
        sys.nodes().forEach((sys_node) => {
            if(sys_node.data("_node_type") == "system") {
                let comp = sys_node.data("label");
                let sel = focusedSystems.includes(comp);
                sys_node.data("focused", "" + sel);
            } else {
                sys_node.data("focused", "false");
            }
        });

    });

    sys.on("select unselect boxselect", (ev) => {
        console.log("sys " + ev.type + " ", ev.target);

        let selectedSystems: string[] = [];
        let selectedSystemSets: string[] = [];

        ev.cy.$(":selected").forEach(function (ele) {
            if(!ele.isNode()) {
                return;
            }

            console.log("" + ev.type + ": " + ele.id(), ele.data());

            let data = ele.data();
            let node_type = data._node_type; // "system" | "system_set"

            let fullName = data.fullName;
            let shortName = data.shortName;

            if(node_type == "system") {
                let ddata = data._data as System;
                console.log("Selected system " + shortName + " " + fullName + " " + ddata.name);
                selectedSystems.push(fullName);
            }
            if(node_type == "system_set") {
                let ddata = data._data as SystemSet;
                console.log("Selected systemset " + shortName + " " + fullName + " " + ddata.name);
                selectedSystemSets.push(fullName);
            }
        });

        // Selecting a system will focus the schedule, and the components accessed by that system.
        controller.setSelectedSystems(selectedSystems, selectedSystemSets);
        let {focusedComponents, focusedSchedules} = controller.focusedForSelected();

        comp.nodes().forEach((comp_node) => {
            let comp = comp_node.data("label");
            let sel = focusedComponents.includes(comp);
            comp_node.data("focused", "" + sel);
        });
        sched.nodes().forEach((sched_node) => {
            let comp = sched_node.data("label");
            let sel = focusedSchedules.includes(comp);
            sched_node.data("focused", "" + sel);
        });
    });
}

function clean(unclean: string) : string {
    return unclean.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)}`);
}

function renderDetail(
    details: Details,
): void {
    let selectedCompHtml = `<ul>`;
    let selectedSchedHtml = `<ul>`;
    let selectedSysHtml = `<ul>`;

    let focusedCompHtml = `<ul>`
    let focusedSchedHtml = `<ul>`;
    let focusedSysHtml = `<ul>`;

    for (let component of details.selectedComponents) {
        selectedCompHtml += `<li><b>${clean(details.getComponentShortName(component))}</b></li>`;
    }
    for (let component of details.focusedComponents) {
        focusedCompHtml += `<li><b>${clean(details.getComponentShortName(component))}</b></li>`;
    }

    for (let schedule of details.selectedSchedules) {
        selectedSchedHtml += `<li>${clean(schedule)}</li>`;
    }
    for (let schedule of details.focusedSchedules) {
        focusedSchedHtml += `<li>${clean(schedule)}</li>`;
    }

    for (let system of details.selectedSystems) {
        selectedSysHtml += `<li>${clean(details.getSystemShortName(system))}</li>`;
    }
    for (let system_set of details.selectedSystemSets) {
        selectedSysHtml += `<li>${clean(details.getSystemSetShortName(system_set))}</li>`;
    }

    for (let system of details.focusedSystems) {
        focusedSysHtml += `<li>${clean(details.getSystemShortName(system))}</li>`;
    }
    for (let system_set of details.focusedSystemSets) {
        focusedSysHtml += `<li>${clean(details.getSystemSetShortName(system_set))}</li>`;
    }

    selectedCompHtml += '</ul>';
    selectedSchedHtml += '</ul>';
    selectedSysHtml += '</ul>';

    focusedCompHtml += '</ul>';
    focusedSchedHtml += '</ul>';
    focusedSysHtml += '</ul>';

    document.querySelector<HTMLDivElement>('#selected-components')!.innerHTML = selectedCompHtml;
    document.querySelector<HTMLDivElement>('#selected-schedules')!.innerHTML = selectedSchedHtml;
    document.querySelector<HTMLDivElement>('#selected-systems')!.innerHTML = selectedSysHtml;

    document.querySelector<HTMLDivElement>('#focused-components')!.innerHTML = focusedCompHtml;
    document.querySelector<HTMLDivElement>('#focused-schedules')!.innerHTML = focusedSchedHtml;
    document.querySelector<HTMLDivElement>('#focused-systems')!.innerHTML = focusedSysHtml;
}

function doSystemLayout(sys: Core) {
    let parentedEdges = parentSoleSystems(sys);
    // findSystemSetsChains(sys);
    systemsLayout(sys);
    parentedEdges.forEach(e => e.remove());
}


init();
