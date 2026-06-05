import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useTraceExplorerVm } from "../hooks";

export function TraceExplorerWebView(): ReactElement {
  const vm = useTraceExplorerVm();
  const featureCopy = translateFeatureCopy("trace-explorer");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Tasks</h3>
            {vm.loading ? <p>Loading trace task summaries...</p> : null}
            {vm.loadError != null ? <p>{vm.loadError}</p> : null}
            {vm.listItems.length === 0 ? <p>No tasks are available for trace exploration.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectTask(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.detailRows.length === 0 ? <p>No task selected</p> : (
          <Stack gap={16}>
            <h3>Trace detail</h3>
            <KeyValueTable rows={vm.detailRows} />
            <h3>Timeline</h3>
            <ListCard items={vm.timelineItems} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Trace summary</h3>
            <ListCard items={vm.summaryItems} />
            <h3>Restricted signals</h3>
            <ListCard items={vm.restrictedItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
