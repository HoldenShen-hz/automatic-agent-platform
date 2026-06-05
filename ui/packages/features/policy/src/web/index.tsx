import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { usePolicyVm } from "../hooks";

export function PolicyWebView(): ReactElement {
  const vm = usePolicyVm();
  const featureCopy = translateFeatureCopy("policy");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Policies</h3>
            {vm.loading ? <p>Loading governance policies...</p> : null}
            {vm.loadError != null ? <p>{vm.loadError}</p> : null}
            {vm.listItems.length === 0 ? <p>No governance policies published by the backend.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectPolicy(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.detailRows.length === 0 ? <p>No policy selected</p> : (
          <Stack gap={16}>
            <h3>Policy detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Policy summary</h3>
            <ListCard items={vm.summaryItems} />
            <h3>Exception queue</h3>
            <ListCard items={vm.exceptionItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
