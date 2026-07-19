
import { type Core, type EdgeDataDefinition, type ElementDefinition, type NodeDataDefinition, type StylesheetJson } from 'cytoscape';
import { load_cytoscape } from '../load_cytoscape';


import type { ComponentDetail, Controller } from '../controller';

const cytoscape = await load_cytoscape();


interface NodeData extends NodeDataDefinition {
    id: string,
    label: string,
    title: string,
    _node_type: "resource" | "component",
}

interface EdgeData extends EdgeDataDefinition {
    id: string,
    source: string,
    target: string,
    _edge_type: "required",
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

// TODO: handle generics
function parseComponentName(componentName : string) : string {
    return componentName.split("::").at(-1)!;
}

function makeComponentId(name: string) : string {
    return `component-${name}`;
}

function makeComponent(componentName: string, component: ComponentDetail) : NodeData {
    // if(componentName == "bevy_anti_alias::contrast_adaptive_sharpening::CasPipeline") {
    //     console.log(componentName, component);
    // }
    let isResource = component.required.includes("bevy_ecs::resource::IsResource");
    // if(isResource) {
    //     console.log("" + componentName + " isResource=" + isResource)
    // }

    return {
        id: makeComponentId(componentName),
        label: componentName,
        title: parseComponentName(componentName),
        _node_type: isResource ? "resource" : "component",
    };
}

function makeRequiredEdge(componentName: string, component: ComponentDetail, requiredName: string, required: ComponentDetail) : EdgeData {

    let from = makeComponentId(componentName);
    let to = makeComponentId(requiredName);

    return {
        id: "required-" + from + "-" + to,
        source: from,
        target: to,
        _edge_type: "required",
    };
}

export function initComponentsGraph(container: HTMLDivElement, controller: Controller) : {cy: Core, elements: Elements} {
    let elements: Elements = { nodes: {}, edges: {} };

    for(let componentName of Object.keys(controller.allComponents)) {
        let component = controller.allComponents[componentName]!;

        elements_add_node(elements, makeComponent(componentName, component));
    }

    for(let componentName of Object.keys(controller.allComponents)) {
        let component = controller.allComponents[componentName]!;

        for(let req of component.required) {
            if(req != "bevy_ecs::resource::IsResource") {
                let required = controller.allComponents[req]!;

                elements_add_edge(elements, makeRequiredEdge(componentName, component, req, required));
            }
        }
    }
    

    let style : StylesheetJson = [

        {
            selector: 'node[_node_type = "component"]',
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
            selector: ':unselected',
            style: {
                'background-opacity': 0.333
            }
        },

        {
            selector: ':parent',
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
            selector: 'node[_foo = "resource"]',
            style: {
                'outline-width': "3px",
                'outline-style': "dotted",
                'outline-color': '#545454',
            }
        },

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
            animate: true,
            gravity: 1.0,
            name: 'cose',
            avoidOverlap: true,
            nodeDimensionsIncludeLabels: true
        },
        selectionType: "additive",
    });

    cy.nodes().filter(node => node.degree() === 0).remove();

    return {cy, elements};
}
