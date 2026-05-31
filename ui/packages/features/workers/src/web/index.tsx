import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useWorkersVm } from "../hooks";

export function WorkersWebView(): ReactElement {
  const vm = useWorkersVm();
  const featureCopy = translateFeatureCopy("workers");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        actions={[
          { id: "workers-drain", label: "排空忙碌 Worker", tone: "accent" },
          { id: "workers-copy", label: "复制 Worker 概览", tone: "neutral" },
          { id: "workers-note", label: "创建排障批注", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
