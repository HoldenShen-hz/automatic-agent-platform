import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
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
          { id: "workers-refresh", label: "刷新 Worker 状态", tone: "accent", onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新 Worker 状态。" },
          { id: "workers-copy", label: "复制 Worker 概览", tone: "neutral", onTrigger: buildWorkbenchActionHandler("workers", "copy", { copySelection: true }), activityDescription: "已复制当前 Worker 概览。" },
          { id: "workers-drain", label: "排空忙碌 Worker", tone: "neutral", disabled: vm.busyWorkerCount === 0, onTrigger: () => vm.drainBusyWorkers(), activityDescription: "已将忙碌 Worker 切换为排空状态。" },
        ]}
      />
    </FeatureScaffold>
  );
}
