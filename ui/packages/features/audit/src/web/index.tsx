import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useAuditVm } from "../hooks";

export function AuditWebView(): ReactElement {
  const vm = useAuditVm();
  const featureCopy = translateFeatureCopy("audit");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Audit entries</h3>
            {vm.loading ? <p>Loading audit log stream...</p> : null}
            {vm.loadError != null ? <p>{vm.loadError}</p> : null}
            {vm.loading ? null : vm.listItems.length === 0 ? <p>No audit entries returned by the backend.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectEntry(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.loading ? <p>Loading audit detail...</p> : vm.detailRows.length === 0 ? <p>No audit entry selected</p> : (
          <Stack gap={16}>
            <h3>Audit detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Audit summary</h3>
            <ListCard items={vm.summaryItems} />
            <h3>Structured metadata</h3>
            <ListCard items={vm.metadataItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
