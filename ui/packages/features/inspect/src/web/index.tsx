import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useInspectVm } from "../hooks";

export function InspectWebView(): ReactElement {
  const vm = useInspectVm();
  return (
    <FeatureScaffold title="Inspect" summary="Inspect 和 operator snapshot 视图。" status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "inspect-snapshot", label: "抓取快照", tone: "accent" },
          { id: "inspect-compare", label: "对比上次执行", tone: "neutral" },
          { id: "inspect-export", label: "导出证据链", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
