import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useHealthVm } from "../hooks";

export function HealthWebView(): ReactElement {
  const vm = useHealthVm();
  const featureCopy = translateFeatureCopy("health");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        rows={vm.rows}
        actions={[
          { id: "health-refresh", label: "刷新健康检查", tone: "accent" },
          { id: "health-diagnose", label: "生成诊断摘要", tone: "neutral" },
          { id: "health-runbook", label: "打开恢复指引", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
