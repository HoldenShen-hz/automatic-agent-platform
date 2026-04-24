import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { usePolicyVm } from "../hooks";

export function PolicyWebView(): ReactElement {
  const vm = usePolicyVm();
  return (
    <FeatureScaffold title="Policy" summary="治理策略与风险门禁" status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "policy-simulate", label: "模拟策略命中", tone: "accent" },
          { id: "policy-publish", label: "发布变更", tone: "neutral" },
          { id: "policy-rollback", label: "回滚到上版", tone: "danger" },
        ]}
      />
    </FeatureScaffold>
  );
}
