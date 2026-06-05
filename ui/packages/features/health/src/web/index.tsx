import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
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
          { id: "health-refresh", label: "刷新健康检查", tone: "accent", disabled: vm.loading, onTrigger: () => vm.refresh(), activityDescription: "已从真实后端 /health 刷新健康报告。" },
          { id: "health-diagnose", label: "生成诊断摘要", tone: "neutral", onTrigger: buildWorkbenchActionHandler("health", "diagnose", { copySelection: true }), activityDescription: "已复制当前健康摘要。" },
          { id: "health-runbook", label: "打开恢复指引", tone: "neutral", onTrigger: buildWorkbenchActionHandler("health", "runbook", { deepLinkPath: "/operations/inspect" }), activityDescription: "已跳转到真实诊断观察页面。" },
        ]}
      />
    </FeatureScaffold>
  );
}
