import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid } from "@aa/ui-core";
import { useComplianceVm } from "../hooks";

export function ComplianceWebView(): ReactElement {
  const vm = useComplianceVm();
  return (
    <FeatureScaffold title="Compliance" summary="合规中心与报告出口" status="Planned">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ height: 16 }} />
      <KeyValueTable rows={vm.rows} />
      <div style={{ height: 16 }} />
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
