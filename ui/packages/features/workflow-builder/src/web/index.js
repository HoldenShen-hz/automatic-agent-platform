import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy } from "react";
import { FeatureScaffold, ListCard, designTokens } from "@aa/ui-core";
import { useWorkflowBuilderVm } from "../hooks";
const LazyFlowCanvas = lazy(async () => import("./flow-canvas").then((module) => ({ default: module.FlowCanvas })));
export function WorkflowBuilderWebView() {
    const vm = useWorkflowBuilderVm();
    const nodes = vm.nodes;
    const edges = vm.edges;
    return (_jsxs(FeatureScaffold, { title: "Workflow Builder", summary: "\u53EF\u89C6\u5316\u5DE5\u4F5C\u6D41\u6784\u5EFA\u5668", status: "Planned", children: [_jsx("div", { style: {
                    minHeight: 360,
                    height: "clamp(360px, 55vh, 560px)",
                    marginBottom: 16,
                    border: `1px solid ${designTokens.color.border}`,
                    borderRadius: 12,
                    overflow: "visible",
                }, children: _jsx(Suspense, { fallback: _jsx("div", { style: { padding: 16 }, children: "\u6B63\u5728\u52A0\u8F7D\u5DE5\u4F5C\u6D41\u753B\u5E03..." }), children: _jsx(LazyFlowCanvas, { edges: edges, nodes: nodes }) }) }), _jsx(ListCard, { items: vm.items })] }));
}
