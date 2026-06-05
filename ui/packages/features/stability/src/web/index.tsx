import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useStabilityVm } from "../hooks";

export function StabilityWebView(): ReactElement {
  const vm = useStabilityVm();
  const featureCopy = translateFeatureCopy("stability");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        rows={vm.rows}
        items={vm.items}
        actions={[
          { id: "stability-refresh", label: "刷新稳定性摘要", tone: "accent", onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新稳定性摘要。" },
          { id: "stability-escalate", label: "升级高优先级事件", tone: "danger", onTrigger: buildWorkbenchActionHandler("stability", "escalate", { deepLinkPath: "/operations/incidents" }), activityDescription: "已跳转到真实事件处置页面。" },
          { id: "stability-export", label: "导出恢复摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("stability", "export", { copySelection: true }), activityDescription: "已复制当前恢复摘要。" },
        ]}
      />
    </FeatureScaffold>
  );
}
