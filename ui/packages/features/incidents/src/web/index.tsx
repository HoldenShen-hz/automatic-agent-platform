import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import type { FeatureWorkbenchItem } from "@aa/ui-core";
import { useIncidentsVm } from "../hooks";

function readIncidentStatus(item: FeatureWorkbenchItem | null): string | null {
  const statusRow = item?.detailRows?.find((row) => row.key === "Status");
  return typeof statusRow?.value === "string" ? statusRow.value : null;
}

export function IncidentsWebView(): ReactElement {
  const vm = useIncidentsVm();
  const featureCopy = translateFeatureCopy("incidents");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          {
            id: "incidents-ack",
            label: "认领并确认",
            tone: "accent",
            disabled: (item) => readIncidentStatus(item) !== "open",
            onTrigger: (item) => item == null ? undefined : vm.acknowledgeIncident(item.id),
            activityDescription: "已通过真实事件接口完成确认。",
          },
          {
            id: "incidents-mitigate",
            label: "进入处置",
            tone: "neutral",
            disabled: (item) => {
              const status = readIncidentStatus(item);
              return status !== "acknowledged" && status !== "triaged";
            },
            onTrigger: (item) => item == null ? undefined : vm.startMitigation(item.id),
            activityDescription: "已通过真实事件接口进入处置。",
          },
          {
            id: "incidents-close",
            label: "关闭事件",
            tone: "danger",
            disabled: (item) => {
              const status = readIncidentStatus(item);
              return status !== "mitigating" && status !== "reviewed";
            },
            onTrigger: (item) => item == null ? undefined : vm.resolveIncident(item.id),
            activityDescription: "已通过真实事件接口关闭事件。",
          },
        ]}
      />
    </FeatureScaffold>
  );
}
