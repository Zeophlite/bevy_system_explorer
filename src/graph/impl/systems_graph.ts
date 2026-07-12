
import { type Core, type EdgeDataDefinition, type ElementDefinition, type NodeDataDefinition, type StylesheetJson } from 'cytoscape';
import { load_cytoscape } from '../load_cytoscape';


import type { ComponentDetail, Controller } from '../controller';
import type { System, SystemOrSetWrap, SystemSet } from "../../bevy_types/systems_graph_types";

const cytoscape = await load_cytoscape();


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

function systemOrSetWrapToNodeId(input : SystemOrSetWrap) : string {
    if("System" in input) {
        return makeSystemId(input.System);
    }
    if("SystemSet" in input) {
        return makeSystemSetId(input.SystemSet);
    }
    return "unknown";
}

function makeSystemId(index: number) : string {
    return `system-${index}`;
}
function makeSystemSetId(index: number) : string {
    return `systemset-${index}`;
}


function makeSystemNode(index: number, system: System) : NodeData {
    return {
        id: makeSystemId(index),
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

function makeSystemSetNode(systemSetsLookup: SystemSetsTitleToIdLookup, index: number, system_set: SystemSet) : NodeData {
    let id = makeSystemSetId(index);
    let title = system_set.name.split("::").at(-1) || "unknown";

    // console.log("Title ", title, id);

    let lookup = systemSetsLookup.get(title);
    if(lookup == undefined) {
        lookup = [];
        systemSetsLookup.set(title, lookup)
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

function fixSystemSetNode(elements: Elements, systemSetsLookup: SystemSetsTitleToIdLookup, title: string, pos: {x: number, y: number}) {
    let ids = systemSetsLookup.get(title);
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

function makeDependencyEdge(index: number, a: SystemOrSetWrap, b: SystemOrSetWrap) : EdgeData {

    let from = systemOrSetWrapToNodeId(a);
    let to = systemOrSetWrapToNodeId(b);

    return {
        id: "dependency-" + index,
        source: from,
        target: to,
        _edge_type: "dependency",
    };
}

function makeHierarchyEdge(index: number, a: number, b : SystemOrSetWrap) : EdgeData {

    let from = makeSystemSetId(a);
    let to =  systemOrSetWrapToNodeId(b);

    return {
        id: "hierarchy-" + index,
        source: from,
        target: to,
        _edge_type: "hierarchy",
    };
}

function buildChain(elements: Elements, systemSetsLookup: SystemSetsTitleToIdLookup, origin: {x: number, y: number}, offset: {x: number, y: number}, system_sets: string[]) {
    let idx = 0;
    for(let system_set of system_sets) {
        let x = origin.x + 1.0 * idx * offset.x;
        let y = origin.y + 1.0 * idx * offset.y;

        fixSystemSetNode(elements, systemSetsLookup, system_set, {x, y});
        idx += 1;
    }
}


export function initSystemsGraph(container: HTMLDivElement, controller: Controller) : {cy: Core, elements: Elements} {
    let systemSetsLookup: SystemSetsTitleToIdLookup = new Map();
    let elements: Elements = { nodes: {}, edges: {} };

    // TODO: remove hard coding
    let RG = controller.getData("main", "Update");

    for(let [index, system_set] of RG.result.schedule_data.system_sets.entries()) {
        elements_add_node(elements, makeSystemSetNode(systemSetsLookup, index, system_set));
    }
    for(let [index, system] of RG.result.schedule_data.systems.entries()) {
        try {
            elements_add_node(elements, makeSystemNode(index, system));
        } catch(ex) {
            console.log(ex);
        }
    }

    for(let [index, dep] of RG.result.schedule_data.dependency.entries()) {
        let a = dep[0];
        let b = dep[1];

        elements_add_edge(elements, makeDependencyEdge(index, a, b));
    }

    for(let [index, hie] of RG.result.schedule_data.hierarchy.entries()) {
        let a = hie[0] as number;
        let b = hie[1] as SystemOrSetWrap;

        elements_add_edge(elements, makeHierarchyEdge(index, a, b));
    }


    // Add chains to give some structure to the graph
    // edges already exist, this is just about starting locations

    buildChain(elements, systemSetsLookup, { x: -5000, y: -4000}, { x: 1000, y: 0}, [
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

    buildChain(elements, systemSetsLookup, { x: 0, y: -2000}, { x: 1000, y: 0}, [
        "QueueMeshes",
        "QueueSweep"
    ]);

    buildChain(elements, systemSetsLookup, { x: -5000, y: 0}, { x: 1000, y: 0}, [
        "ExtractCommands",
        "PrepareAssets",
        "PrepareMeshes",
        "Prepare"
    ]);

    buildChain(elements, systemSetsLookup, { x: 1000, y: 1000}, { x: 400, y: 0}, [
        "PrepareResources",
        "PrepareResourcesBatchPhases",
        "PrepareResourcesWritePhaseBuffers",
        "PrepareResourcesCollectPhaseBuffers",
        "PrepareResourcesFlush",
        "PrepareBindGroups",
    ]);    

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
