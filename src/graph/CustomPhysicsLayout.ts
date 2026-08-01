import { type Core, type Collection, type SingularElementReturnValue, type SingularElementArgument, type CoseLayoutOptions, type EdgeDataDefinition, type ElementDefinition, type NodeDataDefinition, type NodeSingular, type StylesheetJson, type NodeCollection, type EdgeCollection } from 'cytoscape';

interface BaseOptions {
    cy:  Core;
    eles:  Collection< SingularElementReturnValue,  SingularElementArgument>;
}

export interface CustomPhysicsOptions {
    name: 'customPhysics';
    hSpacing?: number;      // Horizontal distance for 'hierarchy' edges
    vSpacing?: number;      // Vertical distance for 'dependency' edges
    stiffness?: number;     // Hooke's spring constant
    repulsion?: number;     // Coulomb's repulsion constant
    damping?: number;       // Velocity friction (0 to 1)
    restLength?: number;    // Ideal spring length
    iterations?: number;    // Max steps for the physics phase
}

interface NodePhysicsState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    isFixed: boolean; // True for structural nodes, False for soft spring nodes
}

export class CustomPhysicsLayout {
    private options: Required<CustomPhysicsOptions>;
    private cy:  Core;
    private eles:  Collection;

    public run: () => CustomPhysicsLayout;
    public stop: () => CustomPhysicsLayout;

    constructor(options: CustomPhysicsOptions & BaseOptions) {
        console.log("Startup");
        const defaults: Omit<Required<CustomPhysicsOptions>, 'name'> = {
            hSpacing: 150,
            vSpacing: 120,
            stiffness: 0.05,
            repulsion: 300,
            damping: 0.85,
            restLength: 80,
            iterations: 200,
        };
        
        this.options = { ...defaults, ...options } as Required<CustomPhysicsOptions>;
        this.cy = options.cy;
        this.eles = options.eles;

        this.run = this.execute.bind(this);
        this.stop = () => { this.emit('layoutstop'); return this; };
    }

    private emit(type: string) {
        this.eles.emit(type);
        this.cy.emit(type, [ { layout: this } ]);
    }

    private execute(): CustomPhysicsLayout {
        this.emit('layoutready');

        const nodes = this.eles.nodes();
        const edges = this.eles.edges();

        // Initialize scratch storage for all nodes
        nodes.forEach(node => {
            node.scratch('_physics', { x: 0, y: 0, vx: 0, vy: 0, isFixed: false } as NodePhysicsState);
        });

        // =========================================================================
        // PHASE 1: BROAD FEATURES (Structural Layout Processing)
        // =========================================================================
        const visited = new Set<string>();

        // Filter structural edges
        const hEdges = edges.filter(e => e.data('_edge_type') === 'hierarchy');
        const dEdges = edges.filter(e => e.data('_edge_type') === 'dependency');

        let options = this.options;
        console.log("Setup")

        // Simple topological/grid propagation algorithm to calculate broad features
        function processStructure(node:  NodeSingular, currX: number, currY: number) {
            const id = node.id();
            if (visited.has(id)) return;
            visited.add(id);

            const state = node.scratch('_physics') as NodePhysicsState;
            state.x = currX;
            state.y = currY;
            state.isFixed = true; // Pin this down so it guides the soft springs

            // Cascade Left-to-Right via 'hierarchy' type edges pointing out of this node
            hEdges.filter(e => (e as any).source().id() === id).forEach(edge => {
                processStructure(edge.target(), currX + options.hSpacing, currY);
            });

            // Cascade Top-to-Bottom via 'dependency' type edges pointing out of this node
            dEdges.filter(e => (e as any).source().id() === id).forEach(edge => {
                processStructure(edge.target(), currX, currY + options.vSpacing);
            });
        }

        // Run structural pass from any root nodes detected in 'hierarchy' or 'dependency' links
        nodes.forEach(node => {
            const id = node.id();
            const isTargetOfHOrD = edges.some(e => (e as any).target().id() === id && (e.data('_edge_type') === 'hierarchy' || e.data('_edge_type') === 'dependency'));
            
            // Start tree traversal only from structural roots to preserve alignment direction
            if (!isTargetOfHOrD && !visited.has(id)) {
                const connectedHOrD = node.connectedEdges().filter(e => e.data('_edge_type') === 'hierarchy' || e.data('_edge_type') === 'dependency');
                if (connectedHOrD.length > 0) {
                    processStructure.call(this, node, 100, 100);
                }
            }
        });

        // Assign fallback positions to unlinked/floating spring nodes around the center
        nodes.forEach(node => {
            const state = node.scratch('_physics') as NodePhysicsState;
            if (!state.isFixed) {
                state.x = 200 + Math.random() * 100;
                state.y = 200 + Math.random() * 100;
            }
        });

        // =========================================================================
        // PHASE 2: SOFT SPRING PLACEMENT (Iterative Force Simulation)
        // =========================================================================
        for (let step = 0; step < this.options.iterations; step++) {
            this.calculateForces(nodes, edges);

            // Apply velocities and integrate positions
            nodes.forEach(node => {
                const state = node.scratch('_physics') as NodePhysicsState;
                
                // Key backbone nodes stay rigid; only move floating soft-spring elements
                if (!state.isFixed) {
                    state.vx *= this.options.damping;
                    state.vy *= this.options.damping;
                    state.x += state.vx;
                    state.y += state.vy;
                }
            });
        }

        // Apply calculated coordinate matrix back into Cytoscape
        nodes.positions(node => {
            const state = node.scratch('_physics') as NodePhysicsState;
            return { x: state.x, y: state.y };
        });

        this.emit('layoutstop');
        return this;
    }

    private calculateForces(nodes:  NodeCollection, edges:  EdgeCollection) {
        // 1. Hooke's Law: Soft spring attraction for remaining connected relations
        edges.forEach(edge => {
            const s1 = edge.source().scratch('_physics') as NodePhysicsState;
            const s2 = edge.target().scratch('_physics') as NodePhysicsState;

            const dx = s2.x - s1.x;
            const dy = s2.y - s1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

            const force = (dist - this.options.restLength) * this.options.stiffness;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            // Only distribute physics delta load to non-fixed nodes
            if (!s1.isFixed) { s1.vx += fx; s1.vy += fy; }
            if (!s2.isFixed) { s2.vx -= fx; s2.vy -= fy; }
        });

        // 2. Coulomb's Law: Universal repulsion to keep independent elements separated
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const s1 = nodes[i].scratch('_physics') as NodePhysicsState;
                const s2 = nodes[j].scratch('_physics') as NodePhysicsState;

                const dx = s2.x - s1.x;
                const dy = s2.y - s1.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

                const force = this.options.repulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (!s1.isFixed) { s1.vx -= fx; s1.vy -= fy; }
                if (!s2.isFixed) { s2.vx += fx; s2.vy += fy; }
            }
        }
    }
}

