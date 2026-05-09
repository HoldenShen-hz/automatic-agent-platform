import { createElement, type ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel, Timeline } from "@aa/ui-core";
import { useGovernanceComplianceVm } from "../hooks";

function AuditTrailViewer({ entries }: { entries: readonly { id: string; actor: string; action: string; timestamp: string; target: string }[] }): ReactElement {
  return createElement(
    "div",
    { style: { marginTop: 24 } },
    createElement("h3", { style: { margin: "0 0 12px", color: "var(--color-text)" } }, "审计轨迹查看器"),
    createElement(Timeline, {
      items: entries.map((e) => ({
        id: e.id,
        title: `[${e.action}] ${e.target}`,
        description: `${e.actor} · ${new Date(e.timestamp).toLocaleString()}`,
      })),
    }),
  );
}

export function GovernanceComplianceWebView(): ReactElement {
  const vm = useGovernanceComplianceVm();
  return (
    <FeatureScaffold title="Governance Compliance" summary="治理与合规视图" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "governance-summary", label: "汇总治理状态", tone: "accent" },
          { id: "governance-field-policy", label: "审阅字段策略", tone: "neutral" },
          { id: "governance-escalate", label: "升级委托审批", tone: "danger" },
        ]}
      />
      <AuditTrailViewer entries={vm.auditTrail} />
    </FeatureScaffold>
  );
}
