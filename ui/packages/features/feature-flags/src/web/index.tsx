import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useFeatureFlagsVm } from "../hooks";

export function FeatureFlagsWebView(): ReactElement {
  const copy = translateFeatureCopy("feature-flags");
  const vm = useFeatureFlagsVm();

  return (
    <FeatureScaffold title={copy.title} summary={copy.summary} status="Implemented/Internal">
      {vm.isLoading ? (
        <p>{translateMessage("ui.featureFlags.loading")}</p>
      ) : (
        <FeatureWorkbenchPanel
          emptyState={translateMessage("ui.featureFlags.empty")}
          items={vm.items}
          metrics={vm.metrics}
          actions={[]}
        />
      )}
    </FeatureScaffold>
  );
}
