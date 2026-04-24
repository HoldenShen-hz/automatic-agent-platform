import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useWorkersVm } from "../hooks";

export function WorkersWebView(): ReactElement {
  const vm = useWorkersVm();
  return (
    <FeatureScaffold title="Workers" summary="执行 Worker 运行面板" status="Implemented/Internal">
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
