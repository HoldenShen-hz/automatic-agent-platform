import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useMarketplaceVm } from "../hooks";

export function MarketplaceWebView(): ReactElement {
  const vm = useMarketplaceVm();
  const featureCopy = translateFeatureCopy("marketplace");

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Packs</h3>
            {vm.loading ? <p>Loading marketplace catalog...</p> : null}
            {vm.listItems.length === 0 ? <p>No marketplace packs published by the backend.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectPack(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.selectedPack == null ? <p>No pack selected</p> : (
          <Stack gap={16}>
            <h3>Pack detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Marketplace summary</h3>
            <ListCard items={vm.summaryItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
