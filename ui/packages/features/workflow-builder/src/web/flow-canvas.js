import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
export const FlowCanvas = memo(function FlowCanvas({ nodes, edges }) {
    const resolvedNodes = useMemo(() => Array.from(nodes), [nodes]);
    const resolvedEdges = useMemo(() => Array.from(edges), [edges]);
    return (_jsxs(ReactFlow, { fitView: true, edges: resolvedEdges, nodes: resolvedNodes, children: [_jsx(Background, {}), _jsx(MiniMap, {}), _jsx(Controls, {})] }));
});
