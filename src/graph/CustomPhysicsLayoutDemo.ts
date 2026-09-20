
import { type Core } from 'cytoscape';
import type cytoscapeProxy from 'cytoscape';

import { CustomPhysicsFactory, type CustomPhysicsOptions } from './CustomPhysicsLayout.ts';
import { buildSystemsStyle } from './impl/systems_graph.ts';

export function initCustomGraph(container: HTMLDivElement, cytoscape: typeof cytoscapeProxy) : {cy: Core} {
    // Register the layout extension with Cytoscape
    cytoscape('layout', 'customPhysics', CustomPhysicsFactory);

    let style = buildSystemsStyle();

    const cy = cytoscape({
        container,
        style,
        elements: [
            // Nodes
            { data: { id: 'A', _node_type: "system_set", chain: "true" } },
            { data: { id: 'B', _node_type: "system_set", chain: "true" } },
            { data: { id: 'C', _node_type: "system_set", chain: "true" } },
            { data: { id: 'D', _node_type: "system_set", chain: "false" } },
            { data: { id: 'E', _node_type: "system_set", chain: "false" } },

            { data: { id: 'S1', _node_type: "system", chain: "false" } },
            { data: { id: 'S2', _node_type: "system", chain: "false" } },

            // Edges
            { data: { id: 'e1', source: 'A', target: 'B', _edge_type: 'dependency', chain: "true", dependency_kind: "Weak" } },
            { data: { id: 'e2', source: 'B', target: 'C', _edge_type: 'dependency', chain: "true", dependency_kind: "Weak" } },

            { data: { id: 'e3', source: 'B', target: 'S1', _edge_type: 'hierarchy', chain: "false" } },
            { data: { id: 'e4', source: 'C', target: 'D', _edge_type: 'hierarchy', chain: "false" } },
            { data: { id: 'e5', source: 'S1', target: 'S2', _edge_type: 'dependency', chain: "false", dependency_kind: "Strict" } },
            { data: { id: 'e6', source: 'D', target: 'E', _edge_type: 'dependency', chain: "false", dependency_kind: "BuildPass" } },
            { data: { id: 'e7', source: 'E', target: 'S2', _edge_type: 'hierarchy', chain: "false" } },
        ]
    });

    // Run layout via configuration options
    let t1 = cy.layout({
        name: 'customPhysics',
        dependencyWeakSpacing: 1000,
        dependencyStrictSpacing: 500,
        dependencyBuildPassSpacing: 300,
        dependencyChainSpacing: 800,
        hierarchySpacing: 200,
        iterations: 250,
        repulsion: 400
    } as CustomPhysicsOptions);
    
    let t2 = t1.run();

    return {cy};
}

