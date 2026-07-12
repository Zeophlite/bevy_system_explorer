
import { type Core, type EdgeDataDefinition, type ElementDefinition, type NodeDataDefinition, type StylesheetJson } from 'cytoscape';
import { load_cytoscape } from '../load_cytoscape';


import type { ComponentDetail, Controller } from '../controller';

const cytoscape = await load_cytoscape();


interface NodeData extends NodeDataDefinition {
    id: string,
    label: string,
    title: string,
    _node_type: "schedule" | "system" | "resource" | "plugin",
}

interface EdgeData extends EdgeDataDefinition {
    id: string,
    source: string,
    target: string,
    _edge_type: "runs" | "executes" | "triggers" | "adds",
}

interface Node extends ElementDefinition {
    data: NodeData,
}
interface Edge extends ElementDefinition {
    data: EdgeData,
}

interface Elements {
    nodes: { [id: string] : Node },
    edges: { [id: string] : Edge },
}


function elements_add_node(elements: Elements, node : NodeData): void {
    elements.nodes[node.id] = { data: node };
}

function elements_add_edge(elements: Elements, edge : EdgeData): void {
    elements.edges[edge.id] = { data: edge };
}



// NOTE: this is slightly different - make* returns the NodeData, create* returns the NodeId

function createApp(elements: Elements, name: string, pos: {x: number, y: number} | null = null) : string {
    let id = `app-${name}`;

    let node = elements.nodes[id];
    if(node !== undefined) {
        if(pos != null) {
            let nd = node.data;
            // nd["x"] = pos.x;
            // nd["y"] = pos.y;
            // nd["fixed"] = {x: true, y: true};
        }

        return id;
    }

    let app: NodeData = {
        id: id,
        label: name,
        title: name,
        _node_type: "schedule",
    }
    if (pos != null) {
        let nd = app;
        // nd["x"] =  pos.x;
        // nd["y"] =  pos.y;
        // nd["fixed"] = {x: true, y: true};
    }

    elements_add_node(elements, app);

    return id;
}

function createSchedule(elements: Elements, name: string, pos: {x: number, y: number} | null = null) : string {
    let id = `schedule-${name}`;

    let node = elements.nodes[id];
    if(node != null) {
        if(pos != null) {
            let nd = node.data;
            // nd["x"] = pos.x;
            // nd["y"] = pos.y;
            // nd["physics"] = true;
            // nd["fixed"] = {x: true, y: true};
        }

        return id;
    }

    let sched: NodeData = {
        id: id,
        label: name,
        title: name,
        _node_type: "schedule",
    };

    if (pos != null) {
        // sched["x"] =  pos.x;
        // sched["y"] =  pos.y;
        // sched["fixed"] = {x: true, y: true};
    }

    elements_add_node(elements, sched);

    return id;
}

function createSystem(elements: Elements, name: string, pos: {x: number, y: number} | null = null) : string {
    let id = `system-${name}`;

    let node: NodeData = {
        id: id,
        label: name,
        title: name,
        _node_type: "system",
    };

    if (pos != null) {
        // node["x"] =  pos.x;
        // node["y"] =  pos.y;
        // node["fixed"] = {x: true, y: true};
    }

    elements_add_node(elements, node);

    return id;
}

function createResource(elements: Elements, name: string) : string {
    let id = `resource-${name}`;

    let res: NodeData = {
        id: id,
        label: name,
        title: name,
        _node_type: "resource",
    }
    elements_add_node(elements, res);

    return id;
}

function createPlugin(elements: Elements, name: string, pos: {x: number, y: number} | null = null) : string {
    let id = `plugin-${name}`;

    let node: NodeData = {
        id: id,
        label: name,
        title: name,
        _node_type: "plugin",
    };

    if (pos != null) {
        // node["x"] =  pos.x;
        // node["y"] =  pos.y;
        // node["fixed"] = {x: true, y: true};
    }

    elements_add_node(elements, node);

    return id;
}


function makeEdge(elements: Elements, from: string, to: string, label: string) : void {
    let id = "edge-" + from + '-' + to;
    if(elements.edges[id] != null) {
        return;
    }

    let edge: EdgeData = {
        id: id,
        source: from,
        target: to,
        label: label,
        _edge_type: "adds", // TODO: this is wrong
    };

    elements_add_edge(elements, edge);
}

type ScheduleToNodeId = {[key:string] : string};

function createScheduleChain(elements: Elements, resource: string, origin: {x: number, y: number}, offset: {x: number, y: number}, schedules: string[]): ScheduleToNodeId {
    let prevSchedule = null;

    let scheduleData : {[key:string] : string} = {};
    let idx = 0;
    for(let schedule of schedules) {
        let x = origin.x + 1.0 * idx * offset.x;
        let y = origin.y + 1.0 * idx * offset.y;

        let id = createSchedule(elements, schedule, {x, y});
        scheduleData[schedule] = id;

        if(prevSchedule == null) {
            makeEdge(elements, resource, id, "triggers")
        } else {
            makeEdge(elements, prevSchedule, id, "");
        }

        prevSchedule = id;
        idx += 1;
    }
    return scheduleData;
}









export function initSchedulesGraph(container: HTMLDivElement, controller: Controller) : {cy: Core, elements: Elements} {
    let elements: Elements = { nodes: {}, edges: {} };

    
    let Main = createSchedule(elements, "Main");
    let run_main = createSystem(elements, "run_main");

    makeEdge(elements, Main, run_main, "runs");

    let MainScheduleOrder = createResource(elements, "MainScheduleOrder");
    makeEdge(elements, run_main, MainScheduleOrder, "executes");

    let main_startup_order = createScheduleChain(elements, MainScheduleOrder, { x: -200, y: -500}, { x: 200, y: 0}, [
        "StateTransition (1)",
        "PreStartup",
        "Startup",
        "PostStartup"
    ]);

    let StatesPlugin = createPlugin(elements, "StatesPlugin");
    makeEdge(elements, StatesPlugin, main_startup_order["StateTransition (1)"], "adds")

    // main_startup_order runs once, then main_order
    let main_order = createScheduleChain(elements, MainScheduleOrder, { x: -200, y: -300}, { x: 200, y: 0}, [
        "First",
        "PreUpdate",
        "StateTransition (2)",
        "RunFixedMainLoop",
        "Update",
        "SpawnScene",
        "PostUpdate",
        "Last",

        "RemoteLast",
    ]);

    makeEdge(elements, StatesPlugin, main_order["StateTransition (2)"], "adds")

    let RemotePlugin = createPlugin(elements, "RemotePlugin");
    makeEdge(elements, RemotePlugin, main_order["RemoteLast"], "adds")

    let run_fixed_main_schedule = createSystem(elements, "run_fixed_main_schedule");
    makeEdge(elements, main_order["RunFixedMainLoop"], run_fixed_main_schedule, "runs");

    let FixedMainScheduleOrder = createResource(elements, "FixedMainScheduleOrder");
    makeEdge(elements, run_fixed_main_schedule, FixedMainScheduleOrder, "executes");

    let fixed_order = createScheduleChain(elements, FixedMainScheduleOrder, { x: -200, y: -100}, { x: 200, y: 0}, [
        "FixedFirst",
        "FixedPreUpdate",
        "FixedUpdate",
        "FixedPostUpdate",
        "FixedLast",
    ]);

    let RenderRecovery = createSchedule(elements, "RenderRecovery", { x: -212 , y: 222});
    let run_render_schedule = createSystem(elements, "run_render_schedule", { x: 117 , y: 224});
    makeEdge(elements, RenderRecovery, run_render_schedule, "runs");


    // RenderRecovery checks RenderState::Ready, and if so, runs RenderScheduleOrder
    let RenderScheduleOrder = createResource(elements, "RenderScheduleOrder");
    makeEdge(elements, run_render_schedule, RenderScheduleOrder, "executes");

    let render_order = createScheduleChain(elements, RenderScheduleOrder, { x: -200, y: 400}, { x: 200, y: 0}, [
        "Render",

        "RenderLast",
    ]);
    let Render = render_order["Render"];

    makeEdge(elements, RemotePlugin, render_order["RenderLast"], "adds")

    // TODO: all these are on RenderApp
    let ExtractSchedule = createSchedule(elements, "ExtractSchedule");
    let RenderStartup = createSchedule(elements, "RenderStartup");
    let RenderGraph = createSchedule(elements, "RenderGraph", {x: -400, y: 800});
    let Core2d = createSchedule(elements, "Core2d");
    let Core3d = createSchedule(elements, "Core3d");

    let App = createApp(elements, "App", {x: -1000, y: -300});
    let MainSchedulePlugin = createPlugin(elements, "MainSchedulePlugin");

    makeEdge(elements, App, MainSchedulePlugin, "adds");

    makeEdge(elements, MainSchedulePlugin, MainScheduleOrder, "adds");
    makeEdge(elements, MainSchedulePlugin, FixedMainScheduleOrder, "adds");

    let MainApp = createApp(elements, "MainApp", {x: -900, y: -550});
    makeEdge(elements, App, MainApp, "contains");
    makeEdge(elements, MainApp, Main, "update_schedule");

    let RenderApp = createApp(elements, "RenderApp", {x: -900, y: 600});
    makeEdge(elements, App, RenderApp, "contains");
    makeEdge(elements, RenderApp, RenderRecovery, "update_schedule");

    let WinitAppRunnerState = createApp(elements, "WinitAppRunnerState", {x: -1400.0, y: -300.0}); // it's not an app, but we're running out of shapes
    makeEdge(elements, WinitAppRunnerState, App, "triggers");
    makeEdge(elements, WinitAppRunnerState, MainApp, "run_default_schedule()");
    makeEdge(elements, WinitAppRunnerState, RenderApp, "extract()");
    makeEdge(elements, WinitAppRunnerState, RenderApp, "run_default_schedule()");
    // WinitAppRunnerState calls App::update()
    // main subapp run_default_schedule()
    // iters other subapps
        // sub_app.extract(&mut self.main.world);
        // sub_app.update() (which calls run_default_schedule)

    let RenderPlugin = createPlugin(elements, "RenderPlugin");
    makeEdge(elements, App, RenderPlugin, "adds");

    let ExtractPlugin = createPlugin(elements, "ExtractPlugin", { x: -755 , y: 102});
    makeEdge(elements, RenderPlugin, ExtractPlugin, "adds");
    makeEdge(elements, ExtractPlugin, RenderApp, "creates");

    makeEdge(elements, ExtractPlugin, ExtractSchedule, "adds");
    makeEdge(elements, ExtractPlugin, Render, "adds");
    makeEdge(elements, RenderApp, Render, "contains");

    let extract = createSystem(elements, "extract");
    makeEdge(elements, ExtractPlugin, extract, "runs");

    let pre_extract = createSystem(elements, "pre_extract");
    makeEdge(elements, extract, pre_extract, "runs");

    // error_handler updates RenderState, and may run RenderStartup
    let error_handler = createSystem(elements, "error_handler");
    makeEdge(elements, pre_extract, error_handler, "calls");
    makeEdge(elements, error_handler, RenderStartup, "executes");

    let entity_sync_system = createSystem(elements, "entity_sync_system");
    makeEdge(elements, extract, entity_sync_system, "runs");
    makeEdge(elements, extract, ExtractSchedule, "executes");


    makeEdge(elements, RenderApp, RenderGraph, "adds");
    let render_system = createSystem(elements, "render_system");
    makeEdge(elements, Render, render_system, "runs");
    makeEdge(elements, render_system, RenderGraph, "executes");


    let CorePipelinePlugin = createPlugin(elements, "CorePipelinePlugin", {x: 92, y: 833});

    let Core2dPlugin = createPlugin(elements, "Core2dPlugin");
    makeEdge(elements, CorePipelinePlugin, Core2dPlugin, "adds");
    makeEdge(elements, Core2dPlugin, Core2d, "adds");

    let Core3dPlugin = createPlugin(elements, "Core3dPlugin");
    makeEdge(elements, CorePipelinePlugin, Core3dPlugin, "adds");
    makeEdge(elements, Core3dPlugin, Core3d, "adds");

    // Core2dPlugin registers Camera2d, CameraRenderGraph(Core2d)
    // Core3dPlugin registers Camera3d, CameraRenderGraph(Core3d)

    // extract_cameras extracts Camera*d as ExtractedCamera
    let extract_cameras = createSystem(elements, "extract_cameras");
    makeEdge(elements, ExtractSchedule, extract_cameras, "runs");

    let camera_driver = createSystem(elements, "camera_driver");
    makeEdge(elements, RenderGraph, camera_driver, "runs");

    // camera_driver looks at ExtractedCamera, and if needed insert CurrentView, and executes the schedule
    makeEdge(elements, camera_driver, Core2d, "executes");
    makeEdge(elements, camera_driver, Core3d, "executes");


    let PipelinedRenderingPlugin = createPlugin(elements, "PipelinedRenderingPlugin");
    makeEdge(elements, App, PipelinedRenderingPlugin, "adds");

    let RenderExtractApp = createApp(elements, "RenderExtractApp", {x: -1150, y: -200});
    makeEdge(elements, PipelinedRenderingPlugin, RenderExtractApp, "creates");
    makeEdge(elements, App, RenderExtractApp, "contains");

    // RenderExtractApp sends the RenderApp back and forth between the main thread and render thread
    makeEdge(elements, PipelinedRenderingPlugin, RenderApp, "update()"); // in render thread
    makeEdge(elements, PipelinedRenderingPlugin, RenderApp, "extract()"); // in main thread





    let style : StylesheetJson = [

        // "schedule" | "system" | "resource" | "plugin"
        {
            selector: 'node[_node_type = "schedule"]',
            style: {
                'background-color': '#1a5fad',
                'label': 'data(title)', // id, label, title
                'text-wrap': 'wrap',      // Enables text wrapping
                'text-max-width': '80px'
            }
        },
        {
            selector: 'node[_node_type = "resource"]',
            style: {
                'background-color': '#1aad1f',
                'label': 'data(title)', // id, label, title
                'text-wrap': 'wrap',      // Enables text wrapping
                'text-max-width': '80px'
            }
        },

        {
            selector: ':selected',
            style: {
                'border-width': "3px",
                'border-style': "dashed",
                'border-color': '#adb0ae',
            }
        },

        {
            selector: ':parent',
            style: {
                'background-opacity': 0.333
            }
        },

        // "runs": "#ff0000",
        // "executes": "#00ff00",
        // "triggers": "#0000ff",
        // "adds": "#ffff00",
        // "": "#00ffff",
        {
            selector: 'edge',
            style: {
                'width': 3,
                'line-color': '#ad1a66',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#999',
                'arrow-scale': 1.2
            }
        }
    ];

    let cy = cytoscape({
        elements: [...Object.values(elements.nodes), ...Object.values(elements.edges)],
        container,
        style,
        layout: {
            name: 'cose',
            avoidOverlap: true,
            nodeDimensionsIncludeLabels: true
        },
    });

    return {cy, elements};
}
