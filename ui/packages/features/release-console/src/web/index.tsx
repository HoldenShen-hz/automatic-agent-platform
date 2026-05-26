import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useReleaseConsoleVm } from "../hooks";

export function ReleaseConsoleWebView(): ReactElement {
  const vm = useReleaseConsoleVm();
  return (
    <FeatureScaffold title="Release Console" summary="发布草稿、门禁、回滚和晋级状态" status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "release-console-validate", label: "运行门禁", tone: "accent" },
          { id: "release-console-promote", label: "推进灰度", tone: "neutral" },
          { id: "release-console-rollback", label: "查看回滚计划", tone: "danger" },
        ]}
      />
    </FeatureScaffold>
  );
}
