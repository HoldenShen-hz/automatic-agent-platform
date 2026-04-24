import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useIncidentsVm } from "../hooks";

export function IncidentsWebView(): ReactElement {
  const vm = useIncidentsVm();
  return (
    <FeatureScaffold title="Incidents" summary="Incident 时间线与处置流" status="Implemented/Internal">
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
