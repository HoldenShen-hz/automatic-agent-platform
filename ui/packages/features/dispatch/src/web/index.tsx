import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useDispatchVm } from "../hooks";

export function DispatchWebView(): ReactElement {
  const vm = useDispatchVm();
  return (
    <FeatureScaffold title="Dispatch" summary="调度、执行和操作入口。" status="Implemented/Contracted">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
