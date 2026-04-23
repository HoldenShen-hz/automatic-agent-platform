import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useIncidentsVm } from "../hooks";

export function IncidentsWebView(): ReactElement {
  const vm = useIncidentsVm();
  return (
    <FeatureScaffold title="Incidents" summary="Incident 时间线与处置流" status="Implemented/Internal">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
