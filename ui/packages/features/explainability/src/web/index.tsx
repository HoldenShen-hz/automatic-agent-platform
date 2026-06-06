import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useExplainabilityVm } from "../hooks";

export function ExplainabilityWebView(): ReactElement {
  const vm = useExplainabilityVm();
  const featureCopy = translateFeatureCopy("explainability");

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Explanations</h3>
            {vm.loading ? <p>Loading explanations...</p> : null}
            {vm.loading ? null : vm.listItems.length === 0 ? <p>No explanation summaries available.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectExplanation(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.loading ? <p>Loading explanation detail...</p> : vm.listItems.length === 0 ? <p>No explanation summaries available.</p> : vm.selectedExplanation == null ? <p>No explanation selected</p> : (
          <Stack gap={16}>
            <h3>Explanation detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Explainability summary</h3>
            <ListCard items={vm.summaryItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
