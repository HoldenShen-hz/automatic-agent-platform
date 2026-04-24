import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useQueuesVm } from "../hooks";

export function QueuesWebView(): ReactElement {
  const vm = useQueuesVm();
  return (
    <FeatureScaffold title="Queues" summary="队列与 DLQ 监控面板" status="Implemented/Internal">
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
