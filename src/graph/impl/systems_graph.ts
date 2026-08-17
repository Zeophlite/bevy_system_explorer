
import { type Core, type EdgeDataDefinition, type EdgeSingular, type ElementDefinition, type NodeDataDefinition, type NodeSingular, type StylesheetJson } from 'cytoscape';
import type cytoscapeProxy from 'cytoscape';


import type { Controller } from '../controller';
import type { System, SystemOrSetWrap, SystemSet } from "../../bevy_types/systems_graph_types";



interface NodeData extends NodeDataDefinition {
    id: string,
    shortName: string,
    fullName: string,
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

type SystemSetsShortNameToIdLookup = Map<string, string[]>;

function systemOrSetWrapToNodeId(input : SystemOrSetWrap, app: AppLabel, schedule: string) : string {
    if("System" in input) {
        return makeSystemId(input.System, app, schedule);
    }
    if("SystemSet" in input) {
        return makeSystemSetId(input.SystemSet, app, schedule);
    }
    return "unknown";
}

function makeSystemId(index: number, app: AppLabel, schedule: string) : string {
    return `system-${app}-${schedule}-${index}`;
}
function makeSystemSetId(index: number, app: AppLabel, schedule: string) : string {
    return `systemset-${app}-${schedule}-${index}`;
}


function makeSystemNode(index: number, system: System, app: AppLabel, schedule: string) : NodeData {
    return {
        id: makeSystemId(index, app, schedule),
        fullName: system.name,
        shortName: parseSystemName(system.name),
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

function makeSystemSetNode(systemSetsLookup: SystemSetsShortNameToIdLookup, index: number, system_set: SystemSet, app: AppLabel, schedule: string) : NodeData {
    let id = makeSystemSetId(index, app, schedule);
    let shortName = parseSystemSetName(system_set.name);

    let lookup = systemSetsLookup.get(app + "-" + schedule + "-" + shortName);
    if(lookup == undefined) {
        lookup = [];
        systemSetsLookup.set(app + "-" + schedule + "-" + shortName, lookup)
    }
    lookup.push(id);

    return {
        id,
        fullName: system_set.name,
        shortName: shortName,
        _node_type: "system_set",
        _data: system_set,
    };
}

function fixSystemSetNode(elements: Elements, systemSetsLookup: SystemSetsShortNameToIdLookup, shortName: string, pos: {x: number, y: number}, app: AppLabel, schedule: string) {
    let ids = systemSetsLookup.get(app + "-" + schedule + "-" + shortName);
    if(ids == undefined) {
        console.log("No shortName", shortName);
        return;
    } else if(ids.length != 1) {
        console.log("Multiple shortNames", shortName, ids);
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
        console.log("Yes shortName, but no node", shortName, ids);
    }
}

function makeDependencyEdge(index: number, a: SystemOrSetWrap, b: SystemOrSetWrap, app: AppLabel, schedule: string) : EdgeData {

    let from = systemOrSetWrapToNodeId(a, app, schedule);
    let to = systemOrSetWrapToNodeId(b, app, schedule);

    return {
        id: "dependency-" + app + "-" + schedule + "-" + index,
        source: from,
        target: to,
        _edge_type: "dependency",
    };
}

function makeHierarchyEdge(index: number, a: number, b : SystemOrSetWrap, app: AppLabel, schedule: string) : EdgeData {

    let from = makeSystemSetId(a, app, schedule);
    let to =  systemOrSetWrapToNodeId(b, app, schedule);

    return {
        id: "hierarchy-" + app + "-" + schedule + "-" + index,
        source: from,
        target: to,
        _edge_type: "hierarchy",
    };
}

function buildChain(elements: Elements, systemSetsLookup: SystemSetsShortNameToIdLookup, app: AppLabel, schedule: string, origin: {x: number, y: number}, offset: {x: number, y: number}, systemSetShortNames: string[]) {
    let idx = 0;
    for(let systemSetShortName of systemSetShortNames) {
        let x = origin.x + 1.0 * idx * offset.x;
        let y = origin.y + 1.0 * idx * offset.y;

        fixSystemSetNode(elements, systemSetsLookup, systemSetShortName, {x, y}, app, schedule);
        idx += 1;
    }
}


export function loadSystemsGraph(controller: Controller, cy: Core, app: AppLabel, schedule: string) : Elements {
    let systemSetsLookup: SystemSetsShortNameToIdLookup = new Map();
    let elements: Elements = { nodes: {}, edges: {} };

    let scheduleData = controller.getData(app, schedule);
    if(scheduleData === undefined) {
        return elements;
    }

    let scheduleGraph = scheduleData.result.schedule_data;

    for(let [index, system_set] of scheduleGraph.system_sets.entries()) {
        elements_add_node(elements, makeSystemSetNode(systemSetsLookup, index, system_set, app, schedule));
    }
    for(let [index, system] of scheduleGraph.systems.entries()) {
        try {
            elements_add_node(elements, makeSystemNode(index, system, app, schedule));
        } catch(ex) {
            console.log(ex);
        }
    }

    for(let [index, dep] of scheduleGraph.dependency.entries()) {
        let a = dep[0];
        let b = dep[1];

        elements_add_edge(elements, makeDependencyEdge(index, a, b, app, schedule));
    }

    for(let [index, hie] of scheduleGraph.hierarchy.entries()) {
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

    cy.nodes().filter(node => ["apply_deferred", "Propagate", "AssetEventSystems"].indexOf(node.data('shortName')) !== -1).remove();
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
    console.log("track_assets");
    cy.nodes().filter(node => {
            let t: string | undefined = node.data('shortName');
            if(t === undefined) {
                return false;
            } else {
                return t.includes("track_assets");
            }
        }).forEach((node) => {
        console.log(node.id(), node.data());
    });

    // cy.nodes()
    //     .filter(node =>
    //         node.data('_node_type') == "system" &&
    //         node.incomers().length == 2 &&
    //         node.outgoers().length == 0
    //     ).remove();

    let parentableSystems = cy
        .nodes()
        .filter(node =>
            node.parent().length == 0 &&
            ((node.incomers().length == 2 && node.outgoers().length == 0) ||
            (node.incomers().length == 0 && node.outgoers().length == 2))
        );

    let edges = parentableSystems.map((system) => {
        let edge;
        let other;

        if((system as NodeSingular).incomers().length == 2) {
            edge = (system as NodeSingular).incomers().filter(i => i.isEdge()) as EdgeSingular;
            other = edge.source();
        } else {
            edge = (system as NodeSingular).outgoers().filter(i => i.isEdge()) as EdgeSingular;
            other = edge.target();
        }

        if(system.data('shortName') != other.data('shortName')) {
            return null;
        }

        system.move({
            parent: other.id()
        });

        return edge;
    }).filter(e => e !== null);

    return edges;
    
    // cy.nodes().forEach((node) => {
    //     if(node.data('shortName') != 'draw_lights') { return; }
    //     console.log("" + node.id() + " " + node.data('shortName') + ":", node.incomers().map(i => i.data()), node.outgoers().map(o => o.data()));
    // });

    // let ss = cy
    //     .nodes()
    //     .filter(node =>
    //         node.data('_node_type') == 'system_set' &&
    //         node.data('shortName') == "draw_lights"
    //     ).id();

    // let s = cy
    //     .nodes()
    //     .filter(node =>
    //         node.data('_node_type') == 'system' &&
    //         node.data('shortName') == "draw_lights"
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
                'label': 'data(shortName)',
                'text-wrap': 'wrap',      // Enables text wrapping
                'text-max-width': '80px'
            }
        },

        {
            selector: 'node[_node_type = "system_set"]',
            style: {
                'background-color': '#1aad1f',
                'label': 'data(shortName)',
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
            selector: 'node[focused = "true"]',
            style: {
                'outline-width': "3px",
                'outline-style': "dotted",
                'outline-color': '#e23939',
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

import { CustomPhysicsLayout, type CustomPhysicsOptions } from '../CustomPhysicsLayout.ts';import type { AppLabel } from '../../data/index.ts';
import { parseSystemName, parseSystemSetName } from './name.ts';

