import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useHitlVm } from "../hooks";

export function HitlWebView(): ReactElement {
  const vm = useHitlVm();
  return (
    <FeatureScaffold title="HITL" summary="人工介入、Inspect、Takeover、Resume 的统一入口" status="Implemented/Partial">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
