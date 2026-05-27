import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useTraceExplorerVm } from "../hooks";

export function TraceExplorerWebView(): ReactElement {
  const vm = useTraceExplorerVm();
  return (
    <FeatureScaffold title="Trace Explorer" summary="按 trace / receipt / artifact 追踪运行事实" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "trace-explorer-open", label: "打开 Trace", tone: "accent", onTrigger: buildWorkbenchActionHandler("trace-explorer", "open", { deepLinkPath: "/observability/trace-explorer?view=trace" }) },
          { id: "trace-explorer-filter", label: "过滤受限事件", tone: "neutral", onTrigger: buildWorkbenchActionHandler("trace-explorer", "filter", { deepLinkPath: "/observability/trace-explorer?view=restricted" }) },
          { id: "trace-explorer-export", label: "导出追踪包", tone: "neutral", onTrigger: buildWorkbenchActionHandler("trace-explorer", "export", { copySelection: true }) },
        ]}
      />
    </FeatureScaffold>
  );
}
