
import { type Core, type EdgeCollection, type EdgeSingular } from 'cytoscape';

export function collapseInteriorNodesWithCompoundSupport(cy: Core, keepNodeIds: string[]) : void {
  const keepSet = new Set(keepNodeIds);
  let graphChanged = true;

  cy.batch(() => {
    while (graphChanged) {
      graphChanged = false;

      // Filter for simple nodes that are NOT in your keep list
      const interiorNodes = cy.nodes().filter(node => !node.isParent() && !keepSet.has(node.id()));

      for (let i = 0; i < interiorNodes.length; i++) {
        const node = interiorNodes[i];
        
        // Exclude loops from flow determination
        const inEdges = (node.incomers().filter(e => e.isEdge()) as EdgeCollection)
            .filter(e => e.source().id() !== e.target().id());
        const outEdges = (node.outgoers().filter(e => e.isEdge()) as EdgeCollection)
            .filter(e => e.source().id() !== e.target().id());

        if (inEdges.length === 0 || outEdges.length === 0) continue;

        // Group incoming sources by edge type
        const incomingByType = new Map<string, { sourceId: string, edge: EdgeSingular }[]>();
        inEdges.forEach(edge => {
          const type = edge.data('_edge_type');
          if (!incomingByType.has(type)) incomingByType.set(type, []);
          incomingByType.get(type)!.push({ sourceId: edge.source().id(), edge: edge });
        });

        // Group outgoing targets by edge type
        const outgoingByType = new Map<string, { targetId: string, edge: EdgeSingular }[]>();
        outEdges.forEach(edge => {
          const type = edge.data('_edge_type')!;
          if (!outgoingByType.has(type)) outgoingByType.set(type, []);
          outgoingByType.get(type)!.push({ targetId: edge.target().id(), edge: edge });
        });

        const collapsedEdgesToRemove: EdgeSingular[] = [];
        let pathsWereCollapsed = false;

        // Find types that match on both incoming and outgoing sets
        incomingByType.forEach((inList, type) => {
          if (outgoingByType.has(type)) {
            const outList = outgoingByType.get(type)!;

            // Establish direct connections for this specific type
            inList.forEach(inItem => {
              outList.forEach(outItem => {
                if (inItem.sourceId === outItem.targetId) return; // Skip self-loops

                // Check for existing direct edges of this exact type to avoid duplicates
                const sourceNode = cy.getElementById(inItem.sourceId);
                const targetNode = cy.getElementById(outItem.targetId);
                const existing = sourceNode.edgesTo(targetNode).filter(e => e.data('_edge_type') === type);

                if (existing.length === 0) {
                  cy.add({
                    group: 'edges',
                    data: {
                      id: `collapsed-${inItem.sourceId}-${outItem.targetId}-${type}-${Math.random().toString(36).substr(2, 5)}`,
                      source: inItem.sourceId,
                      target: outItem.targetId,
                      type: type
                    }
                  });
                }
              });

              // Mark incoming edge for removal
              collapsedEdgesToRemove.push(inItem.edge);
            });

            // Mark outgoing edges for removal
            outList.forEach(outItem => collapsedEdgesToRemove.push(outItem.edge));
            pathsWereCollapsed = true;
          }
        });

        if (pathsWereCollapsed) {
          // Remove the specific edges that were successfully bypassed
          collapsedEdgesToRemove.forEach(edge => {
            if (edge.inside()) edge.remove();
          });

          // If the node now has zero non-loop connections left, it's fully collapsed and can be deleted
          const remainingIn = (node.incomers().filter(e => e.isEdge()) as EdgeCollection)
            .filter(e => e.source().id() !== e.target().id());
          const remainingOut = (node.outgoers().filter(e => e.isEdge()) as EdgeCollection)
            .filter(e => e.source().id() !== e.target().id());

          if (remainingIn.length === 0 && remainingOut.length === 0) {
            node.remove();
          }

          graphChanged = true;
          break; // Break the inner loop to refresh current node collections
        }
      }
    }
  });

  // 4. Run a compound-aware layout algorithm to recalculate parent bounds smoothly
//   const layout = cy.layout({
//     name: "fcose",
//     // animate: true,
//     // animationDuration: 500,
//     // Configuration properties optimized specifically for fCoSE / CoSE compound setups
//     // randomize: false, // Keeps the nodes relative to their current orientation
//     // fit: true
//   });
  
//   layout.run();
}

