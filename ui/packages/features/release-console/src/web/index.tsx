import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useReleaseConsoleVm } from "../hooks";

export function ReleaseConsoleWebView(): ReactElement {
  const vm = useReleaseConsoleVm();
  const featureCopy = translateFeatureCopy("release-console");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "release-console-validate", label: "运行门禁", tone: "accent", onTrigger: buildWorkbenchActionHandler("release-console", "validate", { deepLinkPath: "/operations/release-console?mode=validate" }) },
          { id: "release-console-promote", label: "推进灰度", tone: "neutral", onTrigger: buildWorkbenchActionHandler("release-console", "promote", { deepLinkPath: "/operations/release-console?mode=promote" }) },
          { id: "release-console-rollback", label: "查看回滚计划", tone: "danger", onTrigger: buildWorkbenchActionHandler("release-console", "rollback", { copySelection: true, deepLinkPath: "/operations/release-console?view=rollback" }) },
        ]}
      />
    </FeatureScaffold>
  );
}
