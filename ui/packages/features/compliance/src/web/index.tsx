import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useComplianceVm } from "../hooks";

export function ComplianceWebView(): ReactElement {
  const vm = useComplianceVm();
  const featureCopy = translateFeatureCopy("compliance");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      {vm.loading ? <p>Loading compliance overview...</p> : null}
      {vm.loadError != null ? <p>{vm.loadError}</p> : null}
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        rows={vm.rows}
        items={vm.items}
        actions={[]}
      />
    </FeatureScaffold>
  );
}
