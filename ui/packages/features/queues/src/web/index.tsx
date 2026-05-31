import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useQueuesVm } from "../hooks";

export function QueuesWebView(): ReactElement {
  const vm = useQueuesVm();
  const featureCopy = translateFeatureCopy("queues");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        actions={[
          { id: "queues-refresh", label: "刷新积压", tone: "accent" },
          { id: "queues-retry", label: "清理重试队列", tone: "neutral" },
          { id: "queues-export", label: "导出 DLQ 摘要", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
