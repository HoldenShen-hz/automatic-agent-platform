import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { usePolicyVm } from "../hooks";

export function PolicyWebView(): ReactElement {
  const vm = usePolicyVm();
  return (
    <FeatureScaffold title="Policy" summary="治理策略与风险门禁" status="Implemented/Contracted">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
