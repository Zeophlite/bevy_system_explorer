import coseBilkent from 'cytoscape-cose-bilkent';

export const load_cytoscape = async () => {
    const _cytoscape = () => import('cytoscape');

    const cytoscapeLoad = await _cytoscape();

    cytoscapeLoad.default.use( coseBilkent );

    return cytoscapeLoad.default;
};

