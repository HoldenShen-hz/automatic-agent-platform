import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, ThreePaneLayout } from "@aa/ui-core";
import { useSettingsVm } from "../hooks";

export function SettingsWebView(): ReactElement {
  const vm = useSettingsVm();
  return (
    <FeatureScaffold title="Settings" summary="偏好、权限、功能开关、模型、域、租户与 Webhook 管理中心" status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ marginTop: 16 }}>
        <ThreePaneLayout
          left={<ListCard items={vm.leftItems} />}
          center={vm.loading ? <p>Loading settings...</p> : <KeyValueTable rows={vm.centerRows} />}
          right={<ListCard items={vm.rightItems} />}
        />
      </div>
    </FeatureScaffold>
  );
}
