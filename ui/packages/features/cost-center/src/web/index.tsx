import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useCostCenterVm } from "../hooks";

export function CostCenterWebView(): ReactElement {
  const vm = useCostCenterVm();
  const featureCopy = translateFeatureCopy("cost-center");

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Cost reports</h3>
            {vm.loading ? <p>Loading cost reports...</p> : null}
            {vm.listItems.length === 0 ? <p>No cost reports published by the backend.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectReport(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.selectedReport == null ? <p>No report selected</p> : (
          <Stack gap={16}>
            <h3>Cost detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Cost summary</h3>
            <ListCard items={vm.summaryItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
