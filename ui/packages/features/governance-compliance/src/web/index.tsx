import { createElement, type ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useGovernanceComplianceVm } from "../hooks";

function AuditTrailViewer({ entries }: { entries: readonly { id: string; action: string; actor: string; timestamp: string; resource?: string; outcome?: string; target?: string }[] }): ReactElement {
  return createElement(
    "div",
    { style: { marginTop: 24 } },
    createElement("h3", { style: { margin: "0 0 12px", color: "var(--color-text)" } }, "Audit Trail"),
    createElement(
      "div",
      { style: { display: "grid", gap: 8 } },
      ...entries.map((entry) => createElement(
        "div",
        { key: entry.id },
        createElement("div", null, entry.action),
        createElement("div", null, `${entry.actor} · ${entry.resource ?? entry.target ?? ""} · ${entry.outcome ?? ""}`.trim()),
      )),
    ),
  );
}

export function GovernanceComplianceWebView(): ReactElement {
  const vm = useGovernanceComplianceVm();
  const selectedPolicy = vm.policies.find((policy) => policy.id === vm.selectedPolicyId) ?? vm.policies[0] ?? null;
  const selectedException = vm.exceptionQueue[0] ?? null;

  return (
    <FeatureScaffold title="Governance Compliance" summary="治理与合规视图" status="Implemented/Partial">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "governance-summary", label: "汇总治理状态", tone: "accent", onTrigger: () => { vm.selectPolicy(selectedPolicy?.id ?? ""); } },
          { id: "governance-field-policy", label: "审阅字段策略", tone: "neutral", onTrigger: () => { void vm.updatePolicy(selectedPolicy?.id ?? "", {}); } },
          { id: "governance-audit", label: "查看审计轨迹", tone: "neutral", onTrigger: vm.filterAuditTrail },
          { id: "governance-exception", label: "管理异常", tone: "neutral", onTrigger: () => { void vm.submitExceptionRequest("manual_exception_review_requested", selectedPolicy?.id ?? ""); } },
          { id: "governance-escalate", label: "升级委托审批", tone: "danger", onTrigger: () => { void vm.submitExceptionRequest("governance_escalation_requested", selectedPolicy?.id ?? ""); } },
        ]}
      />
      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        <div>
          <h3>Policy Editor</h3>
          {vm.policies.map((policy) => (
            <div key={policy.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span>{policy.name}</span>
              <button onClick={() => vm.selectPolicy(policy.id)} type="button">Review</button>
            </div>
          ))}
        </div>
        <AuditTrailViewer entries={vm.auditTrail} />
        <div>
          <h3>Exception Management</h3>
          {vm.exceptionQueue.map((exception) => (
            <div key={exception.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span>{exception.reason}</span>
              <span>{exception.status}</span>
              <button onClick={() => { void vm.approveException(exception.id); }} type="button">Approve</button>
              <button onClick={() => { void vm.rejectException(exception.id, "rejected_from_web"); }} type="button">Reject</button>
            </div>
          ))}
          {selectedException == null && <p>No exceptions queued.</p>}
        </div>
      </div>
    </FeatureScaffold>
  );
}
