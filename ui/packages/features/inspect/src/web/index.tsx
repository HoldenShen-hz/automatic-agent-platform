import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useInspectVm } from "../hooks";

export function InspectWebView(): ReactElement {
  const vm = useInspectVm();
  return (
    <FeatureScaffold title="Inspect" summary="Inspect 和 operator snapshot 视图。" status="Implemented/Internal">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
