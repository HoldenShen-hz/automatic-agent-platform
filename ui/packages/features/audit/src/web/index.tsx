import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useAuditVm } from "../hooks";

export function AuditWebView(): ReactElement {
  const vm = useAuditVm();
  return (
    <FeatureScaffold title="Audit" summary="审计与追踪中心" status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "audit-export", label: "导出证据包", tone: "accent" },
          { id: "audit-actor", label: "检索 Actor 轨迹", tone: "neutral" },
          { id: "audit-lock", label: "锁定时间窗", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
