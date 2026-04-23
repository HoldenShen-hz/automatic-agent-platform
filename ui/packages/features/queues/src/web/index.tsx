import type { ReactElement } from "react";
import { FeatureScaffold, MetricGrid } from "@aa/ui-core";
import { useQueuesVm } from "../hooks";

export function QueuesWebView(): ReactElement {
  const vm = useQueuesVm();
  return (
    <FeatureScaffold title="Queues" summary="队列与 DLQ 监控面板" status="Implemented/Internal">
      <MetricGrid metrics={vm.metrics} />
    </FeatureScaffold>
  );
}
