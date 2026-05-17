import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useTakeoverVm } from "../hooks";

export function TakeoverWebView(): ReactElement {
  const vm = useTakeoverVm();
  return (
    <FeatureScaffold title="Admin Takeover Console" summary="管理员接管、重试和人工覆盖入口。" status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "takeover-start", label: "接管当前任务", tone: "danger", onTrigger: () => vm.takeoverCurrentTask("web-operator") },
          { id: "takeover-annotate", label: "添加人工批注", tone: "neutral", onTrigger: () => vm.annotateCurrentSnapshot("manual-note", "web-operator") },
          { id: "takeover-resume", label: "恢复自动执行", tone: "accent", onTrigger: () => vm.resumeAutomaticExecution("web-operator") },
        ]}
      />
    </FeatureScaffold>
  );
}
