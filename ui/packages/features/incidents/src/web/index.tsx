import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useIncidentsVm } from "../hooks";

export function IncidentsWebView(): ReactElement {
  const vm = useIncidentsVm();
  const featureCopy = translateFeatureCopy("incidents");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "incidents-assign", label: "指派负责人", tone: "accent" },
          { id: "incidents-evidence", label: "附加证据", tone: "neutral" },
          { id: "incidents-close", label: "关闭事件", tone: "danger" },
        ]}
      />
    </FeatureScaffold>
  );
}
