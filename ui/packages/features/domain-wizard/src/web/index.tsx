import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useDomainWizardVm } from "../hooks";

export function DomainWizardWebView(): ReactElement {
  const vm = useDomainWizardVm();
  return (
    <FeatureScaffold title="Domain Wizard" summary="领域接入向导和 DomainUIConfig 驱动页面。" status="Implemented/Internal">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
