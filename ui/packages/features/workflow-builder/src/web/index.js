import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy } from "react";
import { FeatureScaffold, ListCard, designTokens } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useWorkflowBuilderVm } from "../hooks";
const LazyFlowCanvas = lazy(async () => import("./flow-canvas").then((module) => ({ default: module.FlowCanvas })));
export function WorkflowBuilderWebView() {
    const featureCopy = translateFeatureCopy("workflow-builder");
    const vm = useWorkflowBuilderVm();
    const nodes = vm.nodes;
    const edges = vm.edges;
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [_jsxs("section", { style: {
                    display: "grid",
                    gap: 12,
                    marginBottom: 16,
                    padding: 16,
                    border: `1px solid ${designTokens.color.border}`,
                    borderRadius: 12,
                }, children: [_jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: [_jsx("button", { disabled: vm.isMutating, onClick: () => void vm.createDraft(), type: "button", children: "Create Draft" }), _jsx("button", { disabled: !vm.canSave, onClick: () => void vm.saveDraft(), type: "button", children: "Save Draft" }), _jsx("button", { disabled: !vm.canDelete, onClick: () => void vm.deleteDraft(), type: "button", children: "Delete Draft" })] }), _jsxs("label", { style: { display: "grid", gap: 8 }, children: [_jsx("span", { children: "Draft Title" }), _jsx("input", { onChange: (event) => vm.setDraftTitle(event.target.value), placeholder: "Workflow draft", type: "text", value: vm.draftTitle })] }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: vm.drafts.length === 0
                            ? _jsx("span", { children: translateMessage("ui.workflowBuilder.empty.description") })
                            : vm.drafts.map((draft) => (_jsx("button", { onClick: () => vm.setSelectedDraftId(draft.draftId), style: {
                                    border: `1px solid ${designTokens.color.border}`,
                                    background: draft.draftId === vm.selectedDraftId ? designTokens.color.surfaceSelected : designTokens.color.surface,
                                    padding: "8px 12px",
                                    borderRadius: 999,
                                }, type: "button", children: draft.title }, draft.draftId))) }), vm.statusMessage == null ? null : _jsx("div", { role: "status", children: vm.statusMessage }), vm.validationMessages.length === 0 ? null : (_jsx("div", { "aria-label": "workflow-builder-validation", children: vm.validationMessages.map((message) => _jsx("div", { children: message }, message)) }))] }), _jsx("div", { style: {
                    minHeight: 360,
                    height: "clamp(360px, 55vh, 560px)",
                    marginBottom: 16,
                    border: `1px solid ${designTokens.color.border}`,
                    borderRadius: 12,
                    overflow: "visible",
                }, children: _jsx(Suspense, { fallback: _jsx("div", { style: { padding: 16 }, children: translateMessage("ui.workflowBuilder.canvas.loading") }), children: nodes.length === 0
                        ? _jsx("div", { role: "status", style: { padding: 16 }, children: translateMessage("ui.workflowBuilder.canvas.empty") })
                        : _jsx(LazyFlowCanvas, { edges: edges, nodes: nodes }) }) }), _jsx(ListCard, { items: vm.items })] }));
}
