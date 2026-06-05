import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
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
          { id: "queues-refresh", label: "刷新积压", tone: "accent", onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新队列状态。" },
          { id: "queues-export", label: "导出 DLQ 摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("queues", "export", { copySelection: true }), activityDescription: "已复制当前队列摘要。" },
          { id: "queues-retry", label: "清理重试队列", tone: "neutral", disabled: vm.retryQueueDepth === 0, onTrigger: () => vm.cleanupRetryQueue(), activityDescription: "已清理重试队列中的待重试任务。" },
        ]}
      />
    </FeatureScaffold>
  );
}
