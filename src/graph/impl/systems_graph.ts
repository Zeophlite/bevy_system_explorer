
import { type Core, type EdgeDataDefinition, type EdgeSingular, type ElementDefinition, type NodeDataDefinition, type NodeSingular, type StylesheetJson } from 'cytoscape';
import type cytoscapeProxy from 'cytoscape';


import type { Controller } from '../controller';
import type { DependencyKind, System, SystemOrSetWrap, SystemSet } from "../../bevy_types/systems_graph_types";

import { CustomPhysicsFactory, type CustomPhysicsOptions } from '../CustomPhysicsLayout.ts';import type { AppLabel } from '../../data/index.ts';
import { parseSystemName, parseSystemSetName } from './name.ts';


interface NodeData extends NodeDataDefinition {
    id: string,
    shortName: string,
    fullName: string,
    _node_type: "system" | "system_set",
    chain: "true" | "false",
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
        chain: "false",
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
        chain: "false",
        _node_type: "system_set",
        _data: system_set,
    };
}

function fixSystemSetNode(elements: Elements, systemSetsLookup: SystemSetsShortNameToIdLookup, shortName: string, pos: {x: number, y: number}, app: AppLabel, schedule: string) {
    let ids = systemSetsLookup.get(app + "-" + schedule + "-" + shortName);
    if(ids == undefined) {
        // console.log("No shortName", shortName);
        return;
    } else if(ids.length != 1) {
        // console.log("Multiple shortNames", shortName, ids);
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
        // console.log("Yes shortName, but no node", shortName, ids);
    }
}

function makeDependencyEdge(index: number, a: SystemOrSetWrap, b: SystemOrSetWrap, app: AppLabel, schedule: string, dependencyData: { kind: DependencyKind }) : EdgeData {

    let from = systemOrSetWrapToNodeId(a, app, schedule);
    let to = systemOrSetWrapToNodeId(b, app, schedule);

    console.log("DK: " + dependencyData.kind);

    return {
        id: "dependency-" + app + "-" + schedule + "-" + index,
        source: from,
        target: to,
        _edge_type: "dependency",
        dependency_kind: dependencyData.kind,
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

    let scheduleData = controller.getScheduleGraph(app, schedule);
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
            // console.log(ex);
        }
    }

    for(let [index, dep] of scheduleGraph.dependency.entries()) {
        let a = dep[0];
        let b = dep[1];
        let c = dep[2];

        elements_add_edge(elements, makeDependencyEdge(index, a, b, app, schedule, c));
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
    let FILTER_NODES: string[] = [
        "apply_deferred",
        "Propagate",
        "AssetEventSystems",
    ];

    cy.nodes().filter(node => FILTER_NODES.indexOf(node.data('shortName')) !== -1).remove();
    // cy.nodes().filter(node => node.degree() > 3).remove();

    // NOTE: main calls layout
    // systemsLayout(cy);

    return elements;
}

export function findSystemSetsChains(cy: Core): void {
    console.log('findSystemSetsChains');

    // 1. Get the filtered nodes
    const matchedNodes = cy.nodes().filter(node => node.data('_node_type') == 'system_set');
    matchedNodes.forEach((s) => {
        // console.log("matchedNodes: " + s.id() + " " + s.data("shortName"));
    });

    // 2. Get the filtered edges that connect ONLY those nodes
    const matchedEdges = matchedNodes.edgesWith(matchedNodes).filter('edge[_edge_type = "dependency"]');
    matchedEdges.forEach((s) => {
        console.log("matchedEdges: " + s.id() + " " + s.data("shortName"));
    });

    // 3. Combine them into the final subgraph
    const strictSubgraph = matchedEdges.union(matchedEdges.sources()).union(matchedEdges.targets());

    // TODO: optimise
    cy.elements().difference(strictSubgraph).forEach((s) => {
        // console.log("no chain: " + s.id() + " " + s.data("shortName"));
        s.data("chain", "false");
    });
    strictSubgraph.forEach((s) => {
        console.log("chain: " + s.id() + " " + s.data("shortName"));
        s.data("chain", "true");
    });
    // cy.elements().difference(strictSubgraph).remove();

    let res = strictSubgraph.components().filter(r => r.length > 1);

    let tt: string[] = [];

    for(let r of res) {
        // console.log("# comp");
        r.forEach((ne) => {
            // console.log("-- ", ne.data());
            tt.push(ne.id());
        });
    }

    // cy.nodes().filter(node => tt.indexOf(node.id()) === -1).remove();

    // console.log('findSystemSetsChains end');
}

export function parentSoleSystems(cy: Core) : EdgeSingular[] {
    // Remove single components:
    // cy.elements().components().forEach((comp) => {
    //     console.log("comps");
    //     if(comp.nodes().length == 1) {
    //         console.log("comps 1");
    //         comp.nodes().remove();
    //         return;
    //     }
    //
    //     if(comp.nodes().length == 2) {
    //         console.log("comps 2");
    //         comp.nodes().parents().forEach((par) => {
    //             console.log("Par: " + par.id(), par.data());
    //         });
    //         comp.nodes().remove();
    //         return;
    //     }
    // });

    // just the biggest for testing:
    let first = true;
    let cc = cy.elements().components().sort((compA, compB) => compB.nodes().length - compA.nodes().length).forEach((comp) => {
        console.log("cc " + comp.length);
        // if(comp.length == 133) {
        //     comp.nodes().remove();
        //     return;
        // }

        // if(first) {
        //     first = false;
        //     return;
        // }
        // comp.nodes().remove();
    });

    let compSize = 500.0;
    let inset = 0.2;

    let compId = 0;

    let comps = cy.elements().components();
    let width = Math.round( Math.sqrt(comps.length) + 0.5 );

    for(let comp of comps) {
        console.log(" comp " + comp.length, comp);
        let col = Math.floor(compId / width);
        let row = compId % width;

        let gridX = row * compSize;
        let gridY = col * compSize;

        let boxSize = (1.0 - 2.0 * inset) * compSize;
        let boxOffset = compSize * inset;

        comp.nodes().forEach((node) => {
            if(node.parent().length !== 0) { return; }

            let x = gridX + Math.random() * boxSize + boxOffset;
            let y = gridY + Math.random() * (1.0 - 2.0 * inset) * compSize + compSize * inset;

            node.position({ x, y });

            console.log("", x, y)
        });

        compId += 1;
    }


    // console.log("track_assets");
    cy.nodes().filter(node => {
            let t: string | undefined = node.data('shortName');
            if(t === undefined) {
                return false;
            } else {
                return t.includes("update_window_hits") || t.includes("update_previous_view_data");
            }
        }).forEach((node) => {
            console.log(
                "" + node.id() +
                " " + node.data('_node_type') + 
                " " + node.data('shortName') +
                " " + node.incomers().length + 
                " " + node.outgoers().length
                ,
                // node.data()
            );

            for(let inc of node.incomers()) {
                console.log(
                    "-- I:" + inc.id() +
                    " " + inc.data('_node_type') + 
                    " " + inc.data('_edge_type') + 
                    " " + inc.data('shortName') +
                    " " + inc.incomers().length + 
                    " " + inc.outgoers().length
                    ,
                    // inc.data()
                );
            }
            for(let out of node.outgoers()) {
                console.log(
                    "-- O: " + out.id() +
                    " " + out.data('_node_type') + 
                    " " + out.data('_edge_type') + 
                    " " + out.data('shortName') +
                    " " + out.incomers().length + 
                    " " + out.outgoers().length
                    ,
                    // out.data()
                );
            }
    });

    // systemset-main-PreUpdate-46 system_set 0 2
    // system-main-PreUpdate-0 system 2 0

    // systemset-main-PreUpdate-63 system_set 0 2
    // system-main-PreUpdate-37 system 4 0

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
    //     // console.log("" + node.id() + " " + node.data('shortName') + ":", node.incomers().map(i => i.data()), node.outgoers().map(o => o.data()));
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

export function buildSystemsStyle() : StylesheetJson {
    let style : StylesheetJson = [
        {
            selector: 'node[chain = "true"]',
            style: {
                'width': 30,
                'height': 30,
                // 'label': function(element : NodeSingular) {
                //     console.log("Determine style label for node chain " + element.id(), element);
                //     return '';
                // },
            }
        },
        {
            selector: 'node[chain != "true"]',
            style: {
                'width': 15,
                'height': 15,
            }
        },
        {
            selector: 'edge[chain = "true"]',
            style: {
                'width': 10,
                // 'label': function(element : NodeSingular) {
                //     console.log("Determine style label for edge chain " + element.id(), element);
                //     return '';
                // },
            }
        },
        {
            selector: 'edge[chain != "true"]',
            style: {
                'width': 5,
            }
        },

        // TODO: selectors
        {
            selector: 'node[_node_type = "system"]',
            style: {
                'background-color': '#1a5fad',
                'label': '', // 'data(shortName)',
                // 'label': function(element : NodeSingular) {
                //     console.log("Determine style label for node system " + element.id(), element);
                //     return '';
                // },
                'text-wrap': 'wrap',      // Enables text wrapping
                'text-max-width': '80px'
            }
        },

        {
            selector: 'node[_node_type = "system_set"]',
            style: {
                'background-color': '#1aad1f',
                // 'label': '', // 'data(shortName)',
                // 'label': function(element : NodeSingular) {
                //     console.log("Determine style label for node systemset " + element.id() + " " + element.data("chain"), element);
                //     return '';
                // },
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
                // 'label': function(element : NodeSingular) {
                //     console.log("Determine style label for node selected " + element.id(), element);
                //     return '';
                // },
            }
        },

        {
            selector: 'node[focused = "true"]',
            style: {
                'outline-width': "3px",
                'outline-style': "dotted",
                'outline-color': '#e23939',
                // 'label': function(element : NodeSingular) {
                //     console.log("Determine style label for node focused " + element.id(), element);
                //     return '';
                // },
            }
        },

        {
            selector: ':parent',
            style: {
                'background-opacity': 0.333,
                // 'label': function(element : NodeSingular) {
                //     // console.log("Determine style label for :parent " + element.id(), element);
                //     return '';
                // },
            }
        },

        {
            selector: 'edge[_edge_type = "dependency"][dependency_kind = "Strict"]',
            style: {
                'line-color': '#1a9cad',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#1a9cad',
                'arrow-scale': 1.2
            }
        },
        {
            selector: 'edge[_edge_type = "dependency"][dependency_kind = "Weak"]',
            style: {
                'line-color': '#1a9cad',
                'line-style': 'dashed',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#1a9cad',
                'arrow-scale': 1.2
            }
        },
        {
            selector: 'edge[_edge_type = "dependency"][dependency_kind = "BuildPass"]',
            style: {
                'line-color': '#7c1aad',
                'line-style': 'dashed',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#7c1aad',
                'arrow-scale': 1.2
            }
        },
        {
            selector: 'edge[_edge_type = "hierarchy"]',
            style: {
                'line-color': '#ad1a66',
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#ad1a66',
                'arrow-scale': 1.2
            }
        },

    ];

    return style;
}

export function initSystemsGraph(container: HTMLDivElement, cytoscape: typeof cytoscapeProxy) : Core {

    let style = buildSystemsStyle();

    // Register the layout extension with Cytoscape
    cytoscape('layout', 'customPhysics', CustomPhysicsFactory);
    let cy = cytoscape({
        elements: [],
        container,
        style,
        selectionType: "additive",
    });

    return cy;
}

export function systemsLayout(cy: Core) : void {
    let useCustomLayout = false;

    if(useCustomLayout) {

        cy.layout(
            {
                name: 'customPhysics',
                hSpacing: 180,
                vSpacing: 140,
                iterations: 250,
                repulsion: 400
            } as CustomPhysicsOptions
        ).run();

    } else {

        cy.layout({
            // animate: true,
            // gravity: 1.0,
            randomize: false,
            name: 'cola',
            centerGraph: false,
            // name: 'cose',
            // name: 'cose-bilkent',
            // avoidOverlap: true,
            // nodeDimensionsIncludeLabels: true
        } as any).run();

    }
}
