import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useGovernanceComplianceVm } from "../hooks";
function AuditTrailViewer({ entries }) {
    return createElement("div", { style: { marginTop: 24 } }, createElement("h3", { style: { margin: "0 0 12px", color: "var(--aa-color-text)" } }, "Audit Trail"), createElement("div", { style: { display: "grid", gap: 8 } }, ...entries.map((entry) => createElement("div", { key: entry.id }, createElement("div", null, entry.action), createElement("div", null, `${entry.actor} · ${entry.resource ?? entry.target ?? ""} · ${entry.outcome ?? ""}`.trim())))));
}
export function GovernanceComplianceWebView() {
    const vm = useGovernanceComplianceVm();
    const selectedPolicy = vm.policies.find((policy) => policy.id === vm.selectedPolicyId) ?? vm.policies[0] ?? null;
    const selectedException = vm.exceptionQueue[0] ?? null;
    return (_jsxs(FeatureScaffold, { title: "Governance Compliance", summary: "\u6CBB\u7406\u4E0E\u5408\u89C4\u89C6\u56FE", status: "Implemented/Partial", children: [_jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                    { id: "governance-summary", label: "汇总治理状态", tone: "accent", onTrigger: () => { vm.selectPolicy(selectedPolicy?.id ?? ""); } },
                    { id: "governance-field-policy", label: "审阅字段策略", tone: "neutral", onTrigger: () => { void vm.updatePolicy(selectedPolicy?.id ?? "", {}); } },
                    { id: "governance-audit", label: "查看审计轨迹", tone: "neutral", onTrigger: vm.filterAuditTrail },
                    { id: "governance-exception", label: "管理异常", tone: "neutral", onTrigger: () => { void vm.submitExceptionRequest("manual_exception_review_requested", selectedPolicy?.id ?? ""); } },
                    { id: "governance-escalate", label: "升级委托审批", tone: "danger", onTrigger: () => { void vm.submitExceptionRequest("governance_escalation_requested", selectedPolicy?.id ?? ""); } },
                ] }), _jsxs("div", { style: { display: "grid", gap: 16, marginTop: 24 }, children: [_jsxs("div", { children: [_jsx("h3", { children: "Policy Editor" }), vm.policies.map((policy) => (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }, children: [_jsx("span", { children: policy.name }), _jsx("button", { onClick: () => vm.selectPolicy(policy.id), type: "button", children: "Review" })] }, policy.id)))] }), _jsx(AuditTrailViewer, { entries: vm.auditTrail }), _jsxs("div", { children: [_jsx("h3", { children: "Exception Management" }), vm.exceptionQueue.map((exception) => (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }, children: [_jsx("span", { children: exception.reason }), _jsx("span", { children: exception.status }), _jsx("button", { onClick: () => { void vm.approveException(exception.id); }, type: "button", children: "Approve" }), _jsx("button", { onClick: () => { void vm.rejectException(exception.id, "rejected_from_web"); }, type: "button", children: "Reject" })] }, exception.id))), selectedException == null && _jsx("p", { children: "No exceptions queued." })] })] })] }));
}
