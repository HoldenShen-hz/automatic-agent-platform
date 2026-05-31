import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useExplainabilityVm } from "../hooks";

export function ExplainabilityWebView(): ReactElement {
  const vm = useExplainabilityVm();
  const featureCopy = translateFeatureCopy("explainability");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "explain-chain", label: "展开因果链", tone: "accent", onTrigger: buildWorkbenchActionHandler("explainability", "chain", { deepLinkPath: "/observability/explainability?view=causal-chain" }) },
          { id: "explain-pin", label: "固定证据包", tone: "neutral", onTrigger: buildWorkbenchActionHandler("explainability", "pin", { copySelection: true }) },
          { id: "explain-export", label: "导出解释摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("explainability", "export", { copySelection: true }) },
        ]}
      />
    </FeatureScaffold>
  );
}
