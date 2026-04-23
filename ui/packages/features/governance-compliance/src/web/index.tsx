import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useGovernanceComplianceVm } from "../hooks";

export function GovernanceComplianceWebView(): ReactElement {
  const vm = useGovernanceComplianceVm();
  return (
    <FeatureScaffold title="Governance Compliance" summary="治理与合规视图" status="Planned">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
