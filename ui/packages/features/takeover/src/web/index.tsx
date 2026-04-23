import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useTakeoverVm } from "../hooks";

export function TakeoverWebView(): ReactElement {
  const vm = useTakeoverVm();
  return (
    <FeatureScaffold title="Admin Takeover Console" summary="管理员接管、重试和人工覆盖入口。" status="Implemented/Internal">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
