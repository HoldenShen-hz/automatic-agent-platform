import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useMemoryReviewVm } from "../hooks";

export function MemoryReviewWebView(): ReactElement {
  const vm = useMemoryReviewVm();
  return (
    <FeatureScaffold title="Memory Review Console" summary="高层记忆审核、撤销和证据追溯" status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "memory-review-approve", label: "批准提案", tone: "accent" },
          { id: "memory-review-revoke", label: "撤销记忆", tone: "danger" },
          { id: "memory-review-export", label: "导出审计包", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
