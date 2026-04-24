import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useExplainabilityVm } from "../hooks";

export function ExplainabilityWebView(): ReactElement {
  const vm = useExplainabilityVm();
  return (
    <FeatureScaffold title="Explainability" summary="Explainability viewer 与因果链路展示" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "explain-chain", label: "展开因果链", tone: "accent" },
          { id: "explain-pin", label: "固定证据包", tone: "neutral" },
          { id: "explain-export", label: "导出解释摘要", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
