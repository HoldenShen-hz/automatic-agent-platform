import { createElement, type ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useGovernanceComplianceVm } from "../hooks";

function AuditTrailViewer({ entries }: { entries: readonly { id: string; action: string; actor: string; timestamp: string; resource?: string; outcome?: string; target?: string }[] }): ReactElement {
  return createElement(
    "div",
    { style: { marginTop: 24 } },
    createElement("h3", { style: { margin: "0 0 12px", color: "var(--aa-color-text)" } }, translateMessage("ui.governanceCompliance.auditTrail")),
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
  const featureCopy = translateFeatureCopy("governance-compliance");
  const selectedPolicy = vm.policies.find((policy) => policy.id === vm.selectedPolicyId) ?? vm.policies[0] ?? null;
  const selectedException = vm.exceptionQueue[0] ?? null;

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <FeatureWorkbenchPanel
        items={vm.items.map((item) => ({ ...item, detailRows: [] }))}
        actions={[
          { id: "governance-refresh", label: "刷新治理状态", tone: "accent", onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新治理摘要、审计轨迹与异常队列。" },
          { id: "governance-audit", label: "查看审计轨迹", tone: "neutral", onTrigger: vm.filterAuditTrail },
          { id: "governance-exception", label: "发起策略例外", tone: "neutral", disabled: selectedPolicy == null, onTrigger: () => { void vm.submitExceptionRequest("manual_exception_review_requested", selectedPolicy?.id ?? ""); } },
          { id: "governance-escalate", label: "升级委托审批", tone: "danger", disabled: selectedPolicy == null, onTrigger: () => { void vm.submitExceptionRequest("governance_escalation_requested", selectedPolicy?.id ?? ""); } },
        ]}
      />
      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        <div>
          <h3>{translateMessage("ui.governanceCompliance.policyEditor")}</h3>
          {vm.loading ? <p>Loading compliance policies...</p> : null}
          {vm.policies.map((policy) => (
            <div key={policy.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span>{policy.name} · {policy.severity}</span>
              <button onClick={() => vm.selectPolicy(policy.id)} type="button">{translateMessage("ui.governanceCompliance.review")}</button>
              <button
                onClick={() => { void vm.updatePolicy(policy.id, { lastReviewSource: "web_console" }); }}
                type="button"
              >
                标记已审阅
              </button>
            </div>
          ))}
        </div>
        <AuditTrailViewer entries={vm.auditTrail} />
        <div>
          <h3>{translateMessage("ui.governanceCompliance.exceptionManagement")}</h3>
          {vm.exceptionQueue.map((exception) => (
            <div key={exception.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span>{exception.reason}</span>
              <span>{exception.status}</span>
              {exception.status === "pending" ? (
                <>
                  <button
                    onClick={() => { void vm.approveException(exception.id); }}
                    type="button"
                  >
                    {translateMessage("ui.governanceCompliance.approve")}
                  </button>
                  <button
                    onClick={() => { void vm.rejectException(exception.id, "rejected_from_web"); }}
                    type="button"
                  >
                    {translateMessage("ui.governanceCompliance.reject")}
                  </button>
                </>
              ) : null}
            </div>
          ))}
          {selectedException == null && <p>{translateMessage("ui.governanceCompliance.noExceptions")}</p>}
        </div>
      </div>
    </FeatureScaffold>
  );
}
