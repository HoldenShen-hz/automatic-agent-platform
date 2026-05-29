import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, KeyValueTable, ListCard, designTokens } from "@aa/ui-core";
import { translateMessage } from "@aa/shared-i18n";
import { useWorkflowCockpitVm } from "../hooks";
import { DAGViewer } from "./dag-viewer";
export function WorkflowCockpitWebView() {
    const vm = useWorkflowCockpitVm();
    const selectedWorkflow = vm.selectedWorkflow;
    return (_jsx(FeatureScaffold, { title: "Workflow Cockpit", summary: "\u5DE5\u4F5C\u6D41 DAG\u3001\u6B65\u9AA4\u548C\u6062\u590D\u57FA\u7EBF\u89C6\u56FE", status: "Implemented/Internal", children: _jsxs("div", { style: { display: "grid", gap: 24 }, children: [_jsxs("div", { children: [_jsx("h3", { children: translateMessage("ui.workflowCockpit.listTitle") }), _jsx("div", { style: { display: "grid", gap: 10 }, children: vm.listItems.map((workflow) => (_jsxs("button", { onClick: () => {
                                    vm.selectWorkflow(workflow.id);
                                }, style: {
                                    textAlign: "left",
                                    background: workflow.id === selectedWorkflow?.id ? designTokens.semantic.color.surfaceSelected : "transparent",
                                    color: "inherit",
                                    border: `1px solid ${designTokens.color.border}`,
                                    borderRadius: 12,
                                    padding: 12,
                                }, type: "button", children: [_jsx("strong", { children: workflow.title }), _jsx("div", { children: workflow.subtitle })] }, workflow.id))) })] }), selectedWorkflow == null ? _jsx("p", { children: translateMessage("ui.workflowCockpit.noWorkflow") }) : (_jsxs("div", { style: { display: "grid", gap: 16 }, children: [_jsx("h3", { children: translateMessage("ui.workflowCockpit.dagDetailTitle") }), _jsx(KeyValueTable, { rows: [
                                { key: "Workflow", value: selectedWorkflow.title },
                                { key: "Owner", value: selectedWorkflow.owner },
                                { key: "Status", value: selectedWorkflow.status },
                                { key: "Stage", value: selectedWorkflow.currentStage },
                                { key: "Steps", value: String(selectedWorkflow.steps.length) },
                                { key: "Approval Count", value: String(selectedWorkflow.approvalNodes?.length ?? 0) },
                                { key: "Evidence Count", value: String(selectedWorkflow.evidenceRefs?.length ?? 0) },
                            ] }), _jsx(DAGViewer, { currentStage: selectedWorkflow.currentStage, steps: selectedWorkflow.steps }), (selectedWorkflow.approvalNodes?.length ?? 0) > 0 && (_jsxs("div", { style: { display: "grid", gap: 8 }, children: [_jsx("strong", { children: `${translateMessage("ui.workflowCockpit.approvalNodes")}: ${selectedWorkflow.approvalNodes?.length ?? 0}` }), selectedWorkflow.approvalNodes?.map((node) => (_jsx("div", { children: `${node.title} ${node.status}${node.assignee != null ? ` · ${node.assignee}` : ""}` }, node.nodeId)))] })), (selectedWorkflow.evidenceRefs?.length ?? 0) > 0 && (_jsxs("div", { style: { display: "grid", gap: 8 }, children: [_jsx("strong", { children: `${translateMessage("ui.workflowCockpit.evidenceRefs")}: ${selectedWorkflow.evidenceRefs?.length ?? 0}` }), selectedWorkflow.evidenceRefs?.map((reference) => (_jsx("div", { children: `${reference.type} ${reference.description ?? reference.uri}` }, reference.refId)))] })), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("button", { onClick: vm.cancelWorkflow, type: "button", children: translateMessage("ui.workflowCockpit.cancel") }), _jsx("button", { onClick: vm.pauseWorkflow, type: "button", children: translateMessage("ui.workflowCockpit.pause") }), _jsx("button", { onClick: vm.resumeWorkflow, type: "button", children: translateMessage("ui.workflowCockpit.resume") }), _jsx("button", { onClick: vm.recoverWorkflow, type: "button", children: translateMessage("ui.workflowCockpit.recover") }), _jsx("button", { onClick: vm.releaseWorkflow, type: "button", children: translateMessage("ui.workflowCockpit.release") })] })] })), selectedWorkflow == null ? _jsx("p", { children: translateMessage("ui.workflowCockpit.noSteps") }) : (_jsxs("div", { children: [_jsx("h3", { children: translateMessage("ui.workflowCockpit.stepRail") }), _jsx(ListCard, { items: (vm.activityItems?.length ?? 0) > 0 ? vm.activityItems : selectedWorkflow.steps.map((step) => ({
                                title: `${step.phase} · ${step.title}`,
                                description: step.status,
                            })) })] }))] }) }));
}
