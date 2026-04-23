import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, ThreePaneLayout } from "@aa/ui-core";
import { useSettingsVm } from "../hooks";

export function SettingsWebView(): ReactElement {
  const vm = useSettingsVm();
  return (
    <FeatureScaffold title="Settings" summary="偏好、权限、功能开关、模型、域、租户与 Webhook 管理中心" status="Implemented/Internal">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ marginTop: 16 }}>
        <ThreePaneLayout
          left={<ListCard items={vm.leftItems} />}
          center={vm.loading ? <p>Loading settings...</p> : (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select onChange={(event) => vm.setDraftTheme(event.target.value as "light" | "dark" | "high-contrast")} value={vm.draftTheme}>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                  <option value="high-contrast">high-contrast</option>
                </select>
                <input onChange={(event) => vm.setDraftLocale(event.target.value)} value={vm.draftLocale} />
                <button onClick={vm.save} type="button">Save Settings</button>
              </div>
              <KeyValueTable rows={vm.centerRows} />
            </div>
          )}
          right={<ListCard items={vm.activityItems.length > 0 ? vm.activityItems : vm.rightItems} />}
        />
      </div>
      <p style={{ marginTop: 16 }}>Save State: {vm.saveState}</p>
    </FeatureScaffold>
  );
}
