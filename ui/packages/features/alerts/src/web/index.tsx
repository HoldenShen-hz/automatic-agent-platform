import { FeatureScaffold, ListCard } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useAlertsVm } from "../hooks";

export function AlertsWebView(): ReactElement {
  const vm = useAlertsVm();
  return (
    <FeatureScaffold title="Alerts" summary="Incident 和高优先级告警流" status="Implemented/Internal">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
