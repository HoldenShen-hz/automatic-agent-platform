import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useDomainWizardVm } from "../hooks";

export function DomainWizardWebView(): ReactElement {
  const vm = useDomainWizardVm();
  return (
    <FeatureScaffold title="Domain Wizard" summary="领域接入向导和 DomainUIConfig 驱动页面。" status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "domain-open", label: "进入配置向导", tone: "accent" },
          { id: "domain-validate", label: "校验显隐策略", tone: "neutral" },
          { id: "domain-checklist", label: "生成接入清单", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
