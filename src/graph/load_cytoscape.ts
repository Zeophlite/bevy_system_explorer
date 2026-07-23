// import coseBilkent from 'cytoscape-cose-bilkent';
import cola from 'cytoscape-cola';

export const load_cytoscape = async () => {
    const _cytoscape = () => import('cytoscape');

    const cytoscapeLoad = await _cytoscape();

    // cytoscapeLoad.default.use( coseBilkent );
    cytoscapeLoad.default.use( cola );

    return cytoscapeLoad.default;
};

