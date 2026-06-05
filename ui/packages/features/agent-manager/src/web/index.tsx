import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useAgentManagerVm } from "../hooks";

export function AgentManagerWebView(): ReactElement {
  const vm = useAgentManagerVm();
  const featureCopy = translateFeatureCopy("agent-manager");

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Agents</h3>
            {vm.loading ? <p>Loading agents...</p> : null}
            {vm.listItems.length === 0 ? <p>No agents reported by the backend.</p> : vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectAgent(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.selectedAgent == null ? <p>No agent selected</p> : (
          <Stack gap={16}>
            <h3>Agent detail</h3>
            <KeyValueTable rows={vm.detailRows} />
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>Supervisor summary</h3>
            <ListCard items={vm.summaryItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
