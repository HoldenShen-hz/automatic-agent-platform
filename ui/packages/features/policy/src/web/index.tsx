import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { usePolicyVm } from "../hooks";

export function PolicyWebView(): ReactElement {
  const vm = usePolicyVm();
  return (
    <FeatureScaffold title="Policy" summary="治理策略与风险门禁" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "policy-simulate", label: "模拟策略命中", tone: "accent", onTrigger: buildWorkbenchActionHandler("policy", "simulate", { deepLinkPath: "/governance/policy?mode=simulate" }) },
          { id: "policy-publish", label: "发布变更", tone: "neutral", onTrigger: buildWorkbenchActionHandler("policy", "publish", { deepLinkPath: "/governance/policy?mode=publish" }) },
          { id: "policy-rollback", label: "回滚到上版", tone: "danger", onTrigger: buildWorkbenchActionHandler("policy", "rollback", { copySelection: true, deepLinkPath: "/governance/policy?mode=rollback" }) },
        ]}
      />
    </FeatureScaffold>
  );
}
