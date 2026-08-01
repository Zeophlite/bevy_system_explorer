
import { type Core } from 'cytoscape';
import type cytoscapeProxy from 'cytoscape';

import { CustomPhysicsLayout, type CustomPhysicsOptions } from './CustomPhysicsLayout.ts';
import type { Controller } from './controller.ts';

export function initCustomGraph(container: HTMLDivElement, controller: Controller, cytoscape: typeof cytoscapeProxy) : {cy: Core} {
    // Register the layout extension with Cytoscape
    cytoscape('layout', 'customPhysics', CustomPhysicsLayout);

    const cy = cytoscape({
        container,
        elements: [
            // Structural Key Nodes
            { data: { id: 'A' } }, { data: { id: 'B' } }, { data: { id: 'C' } },
            // Soft Spring Nodes
            { data: { id: 'S1' } }, { data: { id: 'S2' } },

            // Edges setting structural dependencies
            { data: { id: 'e1', source: 'A', target: 'B', type: 'h' } }, // Left-to-Right
            { data: { id: 'e2', source: 'B', target: 'C', type: 'd' } }, // Top-to-Bottom    

            // Regular Spring Edges (Any type fallback string or undefined)
            { data: { id: 'e3', source: 'B', target: 'S1', type: 'spring' } },
            { data: { id: 'e4', source: 'S1', target: 'S2', type: 'spring' } }
        ]
    });

    // Run layout via configuration options
    cy.layout({
        name: 'customPhysics',
        hSpacing: 180,
        vSpacing: 140,
        iterations: 250,
        repulsion: 400
    } as CustomPhysicsOptions).run();

    return {cy};
}

