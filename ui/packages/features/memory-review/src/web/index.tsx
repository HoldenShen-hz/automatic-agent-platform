import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useMemoryReviewVm } from "../hooks";

export function MemoryReviewWebView(): ReactElement {
  const vm = useMemoryReviewVm();
  const featureCopy = translateFeatureCopy("memory-review");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Knowledge Items</h3>
            {vm.loading ? <p>Loading memory inventory...</p> : null}
            {vm.loadError != null ? <p>{vm.loadError}</p> : null}
            {vm.listItems.length === 0 ? <p>No knowledge items returned by the backend.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectItem(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.detailRows.length === 0 ? <p>No knowledge item selected</p> : (
          <Stack gap={16}>
            <h3>Memory detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Review summary</h3>
            <ListCard items={vm.summaryItems} />
            <h3>Lineage</h3>
            <ListCard items={vm.lineageItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
