import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useAuditVm } from "../hooks";

export function AuditWebView(): ReactElement {
  const vm = useAuditVm();
  return (
    <FeatureScaffold title="Audit" summary="审计与追踪中心" status="Implemented/Contracted">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
