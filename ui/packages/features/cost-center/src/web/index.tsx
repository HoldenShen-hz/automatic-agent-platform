import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useCostCenterVm } from "../hooks";

export function CostCenterWebView(): ReactElement {
  const vm = useCostCenterVm();
  return (
    <FeatureScaffold title="Cost Center" summary="成本中心与预算视图" status="Planned">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
