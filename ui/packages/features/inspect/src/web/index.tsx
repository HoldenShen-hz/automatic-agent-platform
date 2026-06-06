import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useInspectVm } from "../hooks";

export function InspectWebView(): ReactElement {
  const vm = useInspectVm();
  const featureCopy = translateFeatureCopy("inspect");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Tasks</h3>
            {vm.loading ? <p>Loading task inspect summaries...</p> : null}
            {vm.loadError != null ? <p>{vm.loadError}</p> : null}
            {vm.loading ? null : vm.listItems.length === 0 ? <p>No tasks are available for inspect.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectTask(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.loading ? <p>Loading inspect detail...</p> : vm.detailRows.length === 0 ? <p>No task selected</p> : (
          <Stack gap={16}>
            <h3>Inspect detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Inspect summary</h3>
            <ListCard items={vm.summaryItems} />
            <h3>Approvals</h3>
            <ListCard items={vm.approvalItems} />
            <h3>Recent events</h3>
            <ListCard items={vm.eventItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
