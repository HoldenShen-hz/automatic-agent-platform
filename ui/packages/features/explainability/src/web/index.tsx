import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useExplainabilityVm } from "../hooks";

export function ExplainabilityWebView(): ReactElement {
  const vm = useExplainabilityVm();
  return (
    <FeatureScaffold title="Explainability" summary="Explainability viewer 与因果链路展示" status="Planned">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
