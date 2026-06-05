import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useDispatchVm } from "../hooks";

export function DispatchWebView(): ReactElement {
  const vm = useDispatchVm();
  const featureCopy = translateFeatureCopy("dispatch");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Tasks</h3>
            {vm.loading ? <p>Loading dispatch view...</p> : null}
            {vm.loadError != null ? <p>{vm.loadError}</p> : null}
            {vm.listItems.length === 0 ? <p>No tasks are available for dispatch inspection.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectTask(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.detailRows.length === 0 ? <p>No task selected</p> : (
          <Stack gap={16}>
            <h3>Dispatch detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Dispatch summary</h3>
            <ListCard items={vm.summaryItems} />
            <h3>Workflow feed</h3>
            <ListCard items={vm.workflowItems} />
            <h3>Approval feed</h3>
            <ListCard items={vm.approvalItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
