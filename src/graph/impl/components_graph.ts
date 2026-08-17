
import { type Core, type CoseLayoutOptions, type EdgeDataDefinition, type ElementDefinition, type NodeDataDefinition, type NodeSingular, type StylesheetJson } from 'cytoscape';
import type cytoscapeProxy from 'cytoscape';

import type { ComponentDetail, Controller } from '../controller';


interface NodeData extends NodeDataDefinition {
    id: string,
    shortName: string,
    fullName: string,
    requiredShortName: string[],
    _node_type: "resource" | "component",
}

const FooRequired = [
    "bevy_transform::components::transform::Transform",
    "bevy_render::sync_world::SyncToRenderWorld",
    "bevy_ui::ui_node::Node",
    "bevy_camera::visibility::Visibility",
    "bevy_camera::visibility::VisibilityClass",
];

let Foo2Required : { [key: string] : { longName: string, shortName: string } } = {};
for(let foo of FooRequired) {
    Foo2Required[foo] = {
        longName: foo,
        shortName: parseComponentName(foo),
    }
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

function makeComponentId(name: string) : string {
    return `component-${name}`;
}

function makeComponent(componentName: string, component: ComponentDetail) : NodeData {
    // if(componentName == "bevy_anti_alias::contrast_adaptive_sharpening::CasPipeline") {
    //     console.log(componentName, component);
    // }
    let isResource = component.required.has("bevy_ecs::resource::IsResource");
    if(isResource) {
        console.log("" + componentName + " isResource=" + isResource)
    }

    return {
        id: makeComponentId(componentName),
        fullName: componentName,
        shortName: parseComponentName(componentName),
        _node_type: isResource ? "resource" : "component",
        requiredShortName: [],
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

export function loadComponentsGraph(controller: Controller, cy: Core) : Elements {
    let elements: Elements = { nodes: {}, edges: {} };

    for(let componentName of Object.keys(controller.allComponents)) {
        let component = controller.allComponents[componentName]!;

        elements_add_node(elements, makeComponent(componentName, component));
    }

    for(let componentName of Object.keys(controller.allComponents)) {
        let component = controller.allComponents[componentName]!;

        for(let req of component.required) {
            let required = controller.allComponents[req]!;

            if(req == "bevy_ecs::resource::IsResource") {
                // do nothing
                console.log("resource");
            } else if(FooRequired.indexOf(req) != -1) {
                let r = Foo2Required[req];

                let n = elements.nodes[makeComponentId(componentName)];

                n.data.requiredShortName.push(r.shortName);
            } else {
                elements_add_edge(elements, makeRequiredEdge(componentName, component, req, required));
            }
        }
    }

    cy.add([...Object.values(elements.nodes), ...Object.values(elements.edges)]);

    cy.nodes().filter(node => node.degree() === 0).remove();

    componentsLayout(cy);

    return elements;
}

export function initComponentsGraph(container: HTMLDivElement, cytoscape: typeof cytoscapeProxy) : Core {

    let style : StylesheetJson = [

        {
            selector: 'node',
            style: {
                'background-color': '#1a5fad',
                'label': function(element : NodeSingular) {
                    let d = element.data() as NodeData;
                    if(d.requiredShortName.length == 0) {
                        return d.shortName;
                    }
                    return d.shortName + "\n" + "( " + d.requiredShortName.join(", ") + " )";
                },
                'color': '#b5b5b5',
                'text-wrap': 'wrap',
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
            selector: 'node[focused = "true"]',
            style: {
                'outline-width': "3px",
                'outline-style': "dotted",
                'outline-color': '#e23939',
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

    cytoscape('layout', 'customPhysics', CustomPhysicsLayout);
    let cy = cytoscape({
        elements: [],
        container,
        style,
        selectionType: "additive",
    });

    return cy;
}

function componentsLayout(cy: Core) : void {
    cy.layout({
        animate: true,
        gravity: 1.0,
        // name: 'cola',
        name: 'cose',
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true
    } as any //  as CoseLayoutOptions,
    ).run();

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

import { CustomPhysicsLayout, type CustomPhysicsOptions } from '../CustomPhysicsLayout.ts';import { parseComponentName } from './name.ts';

