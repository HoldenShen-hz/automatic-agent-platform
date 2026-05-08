import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useGovernanceComplianceVm } from "../hooks";

export function GovernanceComplianceWebView(): ReactElement {
  const vm = useGovernanceComplianceVm();
  const defaultPolicy = vm.policies.find((policy) => policy.id === vm.selectedPolicyId) ?? vm.policies[0] ?? null;
  return (
    <FeatureScaffold title="Governance Compliance" summary="治理与合规视图" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 16 }}>
        <FeatureWorkbenchPanel
          items={vm.items}
          actions={[
            {
              id: "governance-summary",
              label: "汇总治理状态",
              tone: "accent",
              onTrigger: () => {
                if (defaultPolicy != null) {
                  vm.selectPolicy(defaultPolicy.id);
                }
              },
            },
            {
              id: "governance-field-policy",
              label: "审阅字段策略",
              tone: "neutral",
              onTrigger: () => {
                if (defaultPolicy != null) {
                  vm.selectPolicy(defaultPolicy.id);
                  return vm.updatePolicy(defaultPolicy.id, {});
                }
              },
            },
            {
              id: "governance-audit-trail",
              label: "查看审计轨迹",
              tone: "neutral",
              onTrigger: () => {
                const endDate = new Date().toISOString().split("T")[0] ?? "";
                const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? endDate;
                vm.filterAuditTrail(startDate, endDate);
              },
            },
            {
              id: "governance-exception",
              label: "管理异常",
              tone: "neutral",
              onTrigger: () => {
                if (defaultPolicy != null) {
                  return vm.submitExceptionRequest("manual_exception_review_requested", defaultPolicy.id);
                }
              },
            },
            {
              id: "governance-escalate",
              label: "升级委托审批",
              tone: "danger",
              onTrigger: () => {
                if (defaultPolicy != null) {
                  return vm.submitExceptionRequest("governance_escalation_requested", defaultPolicy.id);
                }
              },
            },
          ]}
        />
        <section style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Policy Editor</h3>
          {vm.policies.map((policy) => (
            <div
              key={policy.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}
            >
              <div>
                <strong>{policy.name}</strong>
                <div style={{ color: "var(--text-subtle)", fontSize: 13 }}>{policy.severity}</div>
              </div>
              <button type="button" onClick={() => void vm.updatePolicy(policy.id, {})}>Review</button>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Audit Trail</h3>
          {vm.auditTrail.map((entry) => (
            <div key={entry.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
              <strong>{entry.action}</strong>
              <div style={{ color: "var(--text-subtle)", fontSize: 13 }}>
                {entry.actor} · {entry.resource} · {entry.outcome}
              </div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Exception Management</h3>
          {vm.exceptionQueue.map((entry) => (
            <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
              <div>
                <strong>{entry.reason}</strong>
                <div style={{ color: "var(--text-subtle)", fontSize: 13 }}>{entry.status}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => void vm.approveException(entry.id)}>Approve</button>
                <button type="button" onClick={() => void vm.rejectException(entry.id, "rejected_from_web")}>Reject</button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </FeatureScaffold>
  );
}
