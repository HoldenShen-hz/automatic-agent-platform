import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useGovernanceComplianceVm } from "../hooks";

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
    </FeatureScaffold>
  );
}
