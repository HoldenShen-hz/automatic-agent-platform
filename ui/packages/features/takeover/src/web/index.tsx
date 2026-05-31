import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useTakeoverVm } from "../hooks";

export function TakeoverWebView(): ReactElement {
  const vm = useTakeoverVm();
  const featureCopy = translateFeatureCopy("takeover");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
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
