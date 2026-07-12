// import { initScheduleGraph } from './schedule/schedule_graph.ts';
import './style.css';
import type { System, SystemSet } from './bevy_types/systems_graph_types.ts';
import { collectAll } from './remote/remote.ts';
import { readApps } from './data/index.ts';
import { readMockApps } from './data_mock/index.ts';
import { Controller } from './graph/controller.ts';

import { initComponentsGraph } from './graph/impl/components_graph.ts';
import { initSchedulesGraph } from './graph/impl/schedules_graph.ts';
import { initSystemsGraph } from './graph/impl/systems_graph.ts';

import type { Apps } from './bevy_types/app_data.ts';


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

    let controller = new Controller(appData, renderSystemsDetail);

    document.querySelector<HTMLButtonElement>('#simplify-systems')!.addEventListener('click', (ev: PointerEvent) => {
        controller.toggleSimplifySystems();
        console.log('click', ev);

        let button = ev.target! as HTMLButtonElement;
        button.textContent = controller.isSystemsSimplified() ? "Unsimplify" : "Simplify";
    });

    const componentsContainer = document.querySelector<HTMLDivElement>('#components-graph')!;
    const schedulesContainer = document.querySelector<HTMLDivElement>('#schedules-graph')!;
    const systemsContainer = document.querySelector<HTMLDivElement>('#systems-graph')!;

    let comp = initComponentsGraph(componentsContainer, controller);
    let sched = initSchedulesGraph(schedulesContainer, controller);
    let sys = initSystemsGraph(systemsContainer, controller);

    comp.cy.on("select unselect boxselect", (ev) => {
        console.log("" + ev.type + " ", ev.target);

        ev.cy.$(":selected").forEach(function (ele) {
            console.log("" + ev.type + ": " + ele.id(), ele.data());
        });
    });
}


function renderSystemsDetail(systems: System[], system_sets: SystemSet[]): void {
    // get `foo`, change innerHTML to render content
    let output = `<ul>`;

    for (let system of systems) {
        output += `<li>${system.name}<li>`;
    }
    for (let system_set of system_sets) {
        output += `<li>${system_set.name}</li>`;
    }

    output += '</ul>';
    document.querySelector<HTMLDivElement>('#foo')!.innerHTML = output;
}



init();
