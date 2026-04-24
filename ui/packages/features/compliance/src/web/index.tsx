import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useComplianceVm } from "../hooks";

export function ComplianceWebView(): ReactElement {
  const vm = useComplianceVm();
  return (
    <FeatureScaffold title="Compliance" summary="合规中心与报告出口" status="Planned">
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        rows={vm.rows}
        items={vm.items}
        actions={[
          { id: "compliance-run", label: "运行检查", tone: "accent" },
          { id: "compliance-export", label: "导出报告", tone: "neutral" },
          { id: "compliance-escalate", label: "升级治理", tone: "danger" },
        ]}
      />
    </FeatureScaffold>
  );
}
