import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useMemoryReviewVm } from "../hooks";

export function MemoryReviewWebView(): ReactElement {
  const vm = useMemoryReviewVm();
  const featureCopy = translateFeatureCopy("memory-review");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "memory-review-approve", label: "批准提案", tone: "accent", onTrigger: buildWorkbenchActionHandler("memory-review", "approve", { deepLinkPath: "/governance/memory-review?mode=approve" }) },
          { id: "memory-review-revoke", label: "撤销记忆", tone: "danger", onTrigger: buildWorkbenchActionHandler("memory-review", "revoke", { deepLinkPath: "/governance/memory-review?mode=revoke" }) },
          { id: "memory-review-export", label: "导出审计包", tone: "neutral", onTrigger: buildWorkbenchActionHandler("memory-review", "export", { copySelection: true }) },
        ]}
      />
    </FeatureScaffold>
  );
}
