import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useAuditVm } from "../hooks";

export function AuditWebView(): ReactElement {
  const vm = useAuditVm();
  const featureCopy = translateFeatureCopy("audit");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "audit-export", label: "导出证据包", tone: "accent", onTrigger: buildWorkbenchActionHandler("audit", "export", { copySelection: true }) },
          { id: "audit-actor", label: "检索 Actor 轨迹", tone: "neutral", onTrigger: buildWorkbenchActionHandler("audit", "actor-trace", { deepLinkPath: "/governance/audit?view=actors" }) },
          { id: "audit-lock", label: "锁定时间窗", tone: "neutral", onTrigger: buildWorkbenchActionHandler("audit", "lock-window", { deepLinkPath: "/governance/audit?view=time-window" }) },
        ]}
      />
    </FeatureScaffold>
  );
}
