
export const load_cytoscape = async () => {
    const _cytoscape = () => import('cytoscape');
    const cytoscape = (await _cytoscape()).default;

    const _coseBilkent = () => import('cytoscape-cose-bilkent');
    const coseBilkentLoad = await _coseBilkent();
    const coseBilkent = coseBilkentLoad.default;

    const _cola = () => import('cytoscape-cola');
    const colaLoad = await _cola();
    const cola = colaLoad.default;

    cytoscape.use( coseBilkent );
    cytoscape.use( cola );

    return cytoscape;
};

