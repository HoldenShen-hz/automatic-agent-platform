import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useId, useState } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, Stack, ThreePaneLayout, designTokens } from "@aa/ui-core";
import { translateMessage } from "@aa/shared-i18n";
import { useApprovalCenterVm } from "../hooks";
export function ApprovalWebView() {
    const vm = useApprovalCenterVm();
    const [delegateTarget, setDelegateTarget] = useState("domain-admin");
    const selectedApproval = vm.selectedApproval;
    const delegateInputId = useId();
    const approvalActionDescriptionId = useId();
    const delegateActionDescriptionId = useId();
    return (_jsx(FeatureScaffold, { title: "Approval Center", summary: "\u5BA1\u6279\u961F\u5217\u3001\u59D4\u6D3E\u4E0E\u6062\u590D\u52A8\u4F5C\u95ED\u73AF", status: "Implemented/Contracted", children: _jsx(ThreePaneLayout, { left: (_jsxs("div", { children: [_jsxs("h3", { children: [translateMessage("ui.approval.queueTitle"), " \u00B7 ", vm.queueDepth] }), _jsx(Stack, { gap: 10, children: vm.queueItems.map((approval) => (_jsxs("button", { onClick: () => {
                                vm.selectApproval(approval.id);
                            }, style: {
                                textAlign: "left",
                                background: approval.id === selectedApproval?.approvalId ? designTokens.semantic.color.surfaceSelected : "transparent",
                                color: "inherit",
                                border: `1px solid ${designTokens.color.border}`,
                                borderRadius: 12,
                                padding: 12,
                            }, type: "button", children: [_jsx("strong", { children: approval.title }), _jsx("div", { children: approval.subtitle })] }, approval.id))) })] })), center: selectedApproval == null ? _jsx("p", { children: translateMessage("ui.approval.noSelection") }) : (_jsxs(Stack, { gap: 16, children: [_jsx("p", { id: approvalActionDescriptionId, style: { margin: 0 }, children: translateMessage("ui.approval.guidance") }), _jsx(KeyValueTable, { rows: [
                            { key: "Task", value: selectedApproval.taskId },
                            { key: "Risk", value: selectedApproval.riskLevel },
                            { key: "Reason", value: selectedApproval.reasonSummary },
                            { key: "Deadline", value: selectedApproval.deadline ?? translateMessage("ui.approval.notAvailable") },
                            { key: "Policy Source", value: selectedApproval.policySource ?? translateMessage("ui.approval.notAvailable") },
                            { key: "Recommended Option", value: selectedApproval.recommendedOption ?? translateMessage("ui.approval.notAvailable") },
                            { key: "Approval Level", value: selectedApproval.currentLevel != null && selectedApproval.totalLevels != null ? `${selectedApproval.currentLevel}/${selectedApproval.totalLevels}` : translateMessage("ui.approval.singleLevel") },
                        ] }), _jsxs(Inline, { children: [_jsx("button", { "aria-describedby": approvalActionDescriptionId, onClick: vm.approve, type: "button", children: translateMessage("ui.approval.approve") }), _jsx("button", { "aria-describedby": approvalActionDescriptionId, onClick: vm.reject, type: "button", children: translateMessage("ui.approval.reject") }), _jsx("button", { onClick: () => { void vm.requestMoreContext(); }, type: "button", children: translateMessage("ui.approval.requestContext") })] }), _jsx("form", { onSubmit: (event) => {
                            event.preventDefault();
                            void vm.delegate(delegateTarget);
                        }, children: _jsxs(Inline, { children: [_jsx("input", { "aria-label": translateMessage("ui.approval.delegateTarget"), id: delegateInputId, onChange: (event) => setDelegateTarget(event.target.value), value: delegateTarget }), _jsx("span", { id: delegateActionDescriptionId, style: { display: "none" }, children: translateMessage("ui.approval.delegateGuide.description") }), _jsx("button", { "aria-describedby": delegateActionDescriptionId, type: "submit", children: translateMessage("ui.approval.delegate") })] }) }), _jsxs(Inline, { children: [_jsx("button", { onClick: () => {
                                    void vm.approveBatch(vm.approvals.map((approval) => approval.approvalId));
                                }, type: "button", children: translateMessage("ui.approval.batchApprove") }), _jsx("button", { onClick: () => {
                                    void vm.rejectBatch(vm.approvals.map((approval) => approval.approvalId));
                                }, type: "button", children: translateMessage("ui.approval.batchReject") })] })] })), right: (_jsx(ListCard, { items: vm.actionHistory.length > 0 ? vm.actionHistory : [
                    { title: translateMessage("ui.approval.quickApprove.title"), description: translateMessage("ui.approval.quickApprove.description") },
                    { title: translateMessage("ui.approval.delegateGuide.title"), description: translateMessage("ui.approval.delegateGuide.description") },
                    { title: translateMessage("ui.approval.resumeGuide.title"), description: translateMessage("ui.approval.resumeGuide.description") },
                ] })) }) }));
}
