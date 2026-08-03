
import { type Core, type EdgeDataDefinition, type EdgeSingular, type ElementDefinition, type NodeDataDefinition, type NodeSingular, type StylesheetJson } from 'cytoscape';
import type cytoscapeProxy from 'cytoscape';


import type { ComponentDetail, Controller } from '../controller';
import type { System, SystemOrSetWrap, SystemSet } from "../../bevy_types/systems_graph_types";



interface NodeData extends NodeDataDefinition {
    id: string,
    label: string,
    title: string,
    _node_type: "system" | "system_set",
    _data: System | SystemSet,
}

interface EdgeData extends EdgeDataDefinition {
    id: string,
    source: string,
    target: string,
    _edge_type: "dependency" | "hierarchy",
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

function parseSystemName(componentName : string) {
    return componentName.split("::").at(-1)!;
}

type SystemSetsTitleToIdLookup = Map<string, string[]>;

function systemOrSetWrapToNodeId(input : SystemOrSetWrap, app: "main" | "render", schedule: string) : string {
    if("System" in input) {
        return makeSystemId(input.System, app, schedule);
    }
    if("SystemSet" in input) {
        return makeSystemSetId(input.SystemSet, app, schedule);
    }
    return "unknown";
}

function makeSystemId(index: number, app: "main" | "render", schedule: string) : string {
    return `system-${app}-${schedule}-${index}`;
}
function makeSystemSetId(index: number, app: "main" | "render", schedule: string) : string {
    return `systemset-${app}-${schedule}-${index}`;
}


function makeSystemNode(index: number, system: System, app: "main" | "render", schedule: string) : NodeData {
    return {
        id: makeSystemId(index, app, schedule),
        label: system.name,
        title: parseSystemName(system.name),
        shape: 'ellipse',
        color: {background: '#aabbcc', border: '#aa0000' },
        opacity: 1.0,
        font: {size: 14, multi: true},
        borderWidth: 2,
        // margin: 10,
        _node_type: "system",
        _data: system,
    };
}

function makeSystemSetNode(systemSetsLookup: SystemSetsTitleToIdLookup, index: number, system_set: SystemSet, app: "main" | "render", schedule: string) : NodeData {
    let id = makeSystemSetId(index, app, schedule);
    let title = system_set.name.split("::").at(-1) || "unknown";

    // console.log("Title ", title, id);

    let lookup = systemSetsLookup.get(app + "-" + schedule + "-" + title);
    if(lookup == undefined) {
        lookup = [];
        systemSetsLookup.set(app + "-" + schedule + "-" + title, lookup)
    }
    lookup.push(id);

    return {
        id,
        label: system_set.name,
        title,
        _node_type: "system_set",
        _data: system_set,
    };
}

function fixSystemSetNode(elements: Elements, systemSetsLookup: SystemSetsTitleToIdLookup, title: string, pos: {x: number, y: number}, app: "main" | "render", schedule: string) {
    let ids = systemSetsLookup.get(app + "-" + schedule + "-" + title);
    if(ids == undefined) {
        console.log("No title", title);
        return;
    } else if(ids.length != 1) {
        console.log("Multiple titles", title, ids);
        return;
    }

    let node = elements.nodes[ids[0]];
    if(node != undefined) {
        if(pos != null) {
            node.position = { x: pos.x, y: pos.y };
            // node.physics = true;
            // node.fixed = {x: true, y: true};
            // nodeDataSet.update(node);
        }
    } else {
        console.log("Yes title, but no node", title, ids);
    }
}

function makeDependencyEdge(index: number, a: SystemOrSetWrap, b: SystemOrSetWrap, app: "main" | "render", schedule: string) : EdgeData {

    let from = systemOrSetWrapToNodeId(a, app, schedule);
    let to = systemOrSetWrapToNodeId(b, app, schedule);

    return {
        id: "dependency-" + app + "-" + schedule + "-" + index,
        source: from,
        target: to,
        _edge_type: "dependency",
    };
}

function makeHierarchyEdge(index: number, a: number, b : SystemOrSetWrap, app: "main" | "render", schedule: string) : EdgeData {

    let from = makeSystemSetId(a, app, schedule);
    let to =  systemOrSetWrapToNodeId(b, app, schedule);

    return {
        id: "hierarchy-" + app + "-" + schedule + "-" + index,
        source: from,
        target: to,
        _edge_type: "hierarchy",
    };
}

function buildChain(elements: Elements, systemSetsLookup: SystemSetsTitleToIdLookup, app: "main" | "render", schedule: string, origin: {x: number, y: number}, offset: {x: number, y: number}, system_sets: string[]) {
    let idx = 0;
    for(let system_set of system_sets) {
        let x = origin.x + 1.0 * idx * offset.x;
        let y = origin.y + 1.0 * idx * offset.y;

        fixSystemSetNode(elements, systemSetsLookup, system_set, {x, y}, app, schedule);
        idx += 1;
    }
}


export function loadSystemsGraph(controller: Controller, cy: Core, app: "main" | "render", schedule: string) : Elements {
    let systemSetsLookup: SystemSetsTitleToIdLookup = new Map();
    let elements: Elements = { nodes: {}, edges: {} };

    let RG = controller.getData(app, schedule);
    if(RG === undefined) {
        return elements;
    }

    for(let [index, system_set] of RG.result.schedule_data.system_sets.entries()) {
        elements_add_node(elements, makeSystemSetNode(systemSetsLookup, index, system_set, app, schedule));
    }
    for(let [index, system] of RG.result.schedule_data.systems.entries()) {
        try {
            elements_add_node(elements, makeSystemNode(index, system, app, schedule));
        } catch(ex) {
            console.log(ex);
        }
    }

    for(let [index, dep] of RG.result.schedule_data.dependency.entries()) {
        let a = dep[0];
        let b = dep[1];

        elements_add_edge(elements, makeDependencyEdge(index, a, b, app, schedule));
    }

    for(let [index, hie] of RG.result.schedule_data.hierarchy.entries()) {
        let a = hie[0] as number;
        let b = hie[1] as SystemOrSetWrap;

        elements_add_edge(elements, makeHierarchyEdge(index, a, b, app, schedule));
    }


    // Add chains to give some structure to the graph
    // edges already exist, this is just about starting locations

    buildChain(elements, systemSetsLookup, app, schedule, { x: -5000, y: -4000}, { x: 1000, y: 0}, [
        "ExtractCommands",
        "PrepareMeshes",
        "CreateViews",
        "Specialize",
        "PrepareViews",
        "Queue",
        "PhaseSort",
        "Prepare",
        "Render",
        "Cleanup",
        "PostCleanup",
    ]);

    buildChain(elements, systemSetsLookup, app, schedule, { x: 0, y: -2000}, { x: 1000, y: 0}, [
        "QueueMeshes",
        "QueueSweep"
    ]);

    buildChain(elements, systemSetsLookup, app, schedule, { x: -5000, y: 0}, { x: 1000, y: 0}, [
        "ExtractCommands",
        "PrepareAssets",
        "PrepareMeshes",
        "Prepare"
    ]);

    buildChain(elements, systemSetsLookup, app, schedule, { x: 1000, y: 1000}, { x: 400, y: 0}, [
        "PrepareResources",
        "PrepareResourcesBatchPhases",
        "PrepareResourcesWritePhaseBuffers",
        "PrepareResourcesCollectPhaseBuffers",
        "PrepareResourcesFlush",
        "PrepareBindGroups",
    ]);    

    cy.add([...Object.values(elements.nodes), ...Object.values(elements.edges)]);

    // NOTE: main/PreUpdate/Assets<A>::asset_events in AssetTrackingSystems per A

    cy.nodes().filter(node => ["apply_deferred", "Propagate", "AssetEventSystems"].indexOf(node.data('title')) !== -1).remove();
    // cy.nodes().filter(node => node.degree() > 3).remove();

    // NOTE: main calls layout
    // systemsLayout(cy);

    return elements;
}

export function findSystemSetsChains(cy: Core): void {
    console.log('findSystemSetsChains');

    // 1. Get the filtered nodes
    const matchedNodes = cy.nodes().filter(node => node.data('_node_type') == 'system_set');

    // 2. Get the filtered edges that connect ONLY those nodes
    const matchedEdges = matchedNodes.edgesWith(matchedNodes).filter('edge[_edge_type = "dependency"]');

    // 3. Combine them into the final subgraph
    const strictSubgraph = matchedNodes.union(matchedEdges);

    let res = strictSubgraph.components().filter(r => r.length > 1);

    let tt: string[] = [];

    for(let r of res) {
        console.log("# comp");
        r.forEach((ne) => {
            console.log("-- ", ne.data());
            tt.push(ne.id());
        });
    }

    cy.nodes().filter(node => tt.indexOf(node.id()) === -1).remove();

    console.log('findSystemSetsChains end');
}

export function parentSoleSystems(cy: Core) : EdgeSingular[] {
    // cy.nodes()
    //     .filter(node =>
    //         node.data('_node_type') == "system" &&
    //         node.incomers().length == 2 &&
    //         node.outgoers().length == 0
    //     ).remove();

    let parentableSystems = cy
        .nodes()
        .filter(node =>
            node.data('_node_type') == 'system' &&
            node.parent().length == 0 &&
            node.incomers().length == 2
        );

    let edges = parentableSystems.map((system) => {
        let edge = (system as NodeSingular).incomers().filter(i => i.isEdge()) as EdgeSingular;
        let systemset = edge.source();

        if(system.data('title') != systemset.data('title')) {
            return null;
        }

        system.move({
            parent: systemset.id()
        });

        return edge;
    }).filter(e => e !== null);

    return edges;
    
    // cy.nodes().forEach((node) => {
    //     if(node.data('title') != 'draw_lights') { return; }
    //     console.log("" + node.id() + " " + node.data('title') + ":", node.incomers().map(i => i.data()), node.outgoers().map(o => o.data()));
    // });

    // let ss = cy
    //     .nodes()
    //     .filter(node =>
    //         node.data('_node_type') == 'system_set' &&
    //         node.data('title') == "draw_lights"
    //     ).id();

    // let s = cy
    //     .nodes()
    //     .filter(node =>
    //         node.data('_node_type') == 'system' &&
    //         node.data('title') == "draw_lights"
    //     );

    // cy.edges().filter(edge => edge.source().id() == ss && edge.target().id() == s.id()).remove();

    // s.move({
    //     parent: ss
    // });
}

export function initSystemsGraph(container: HTMLDivElement, cytoscape: typeof cytoscapeProxy) : Core {
    let style : StylesheetJson = [

        // TODO: selectors
        {
            selector: 'node[_node_type = "system"]',
            style: {
                'background-color': '#1a5fad',
                'label': 'data(title)', // id, label, title
                'text-wrap': 'wrap',      // Enables text wrapping
                'text-max-width': '80px'
            }
        },

        {
            selector: 'node[_node_type = "system_set"]',
            style: {
                'background-color': '#1aad1f',
                'label': 'data(title)', // id, label, title
                'text-wrap': 'wrap',      // Enables text wrapping
                'text-max-width': '80px'
            }
        },

        {
            selector: ':unselected',
            style: {
                'background-opacity': 0.333
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

        {
            selector: 'edge[_edge_type = "dependency"]',
            style: {
                'width': 3,
                'line-color': '#1a9cad',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#999',
                'arrow-scale': 1.2
            }
        },
        {
            selector: 'edge[_edge_type = "hierarchy"]',
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

    // Register the layout extension with Cytoscape
    cytoscape('layout', 'customPhysics', CustomPhysicsLayout);
    let cy = cytoscape({
        elements: [],
        container,
        style,
        selectionType: "additive",
    });

    return cy;
}

export function systemsLayout(cy: Core) : void {
    cy.layout({
        // animate: true,
        // gravity: 1.0,
        // name: 'cola',
        name: 'cose',
        // name: 'cose-bilkent',
        // avoidOverlap: true,
        // nodeDimensionsIncludeLabels: true
    }).run();

    // cy.layout(
    //     {
    //         name: 'customPhysics',
    //         hSpacing: 180,
    //         vSpacing: 140,
    //         iterations: 250,
    //         repulsion: 400
    //     } as CustomPhysicsOptions
    // ).run();
}

import { CustomPhysicsLayout, type CustomPhysicsOptions } from '../CustomPhysicsLayout.ts';
