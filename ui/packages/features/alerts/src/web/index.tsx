import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useAlertsVm } from "../hooks";

export function AlertsWebView(): ReactElement {
  const vm = useAlertsVm();

  return (
    <FeatureScaffold title="Alerts" summary="Incident 和高优先级告警流" status="Implemented/Internal">
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ color: "var(--text-subtle)", fontSize: 12 }}>
            严重性:
            <select
              value={vm.filter.severity}
              onChange={(e) => vm.setFilter({ severity: (e.target as HTMLSelectElement).value as typeof vm.filter.severity })}
              style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)" }}
            >
              <option value="all">全部</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label style={{ color: "var(--text-subtle)", fontSize: 12 }}>
            时间范围:
            <select
              value={vm.filter.timeRange}
              onChange={(e) => vm.setFilter({ timeRange: (e.target as HTMLSelectElement).value as typeof vm.filter.timeRange })}
              style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)" }}
            >
              <option value="all">全部</option>
              <option value="1h">最近 1 小时</option>
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
            </select>
          </label>
        </div>
      </div>
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          {
            id: "alerts-ack",
            label: "确认告警",
            tone: "accent",
            onTrigger: (item) => item == null ? undefined : vm.acknowledgeAlert(item.id ?? ""),
          },
          {
            id: "alerts-mitigate",
            label: "开始处置",
            tone: "neutral",
            onTrigger: (item) => item == null ? undefined : vm.startMitigation(item.id ?? ""),
          },
          {
            id: "alerts-resolve",
            label: "解决告警",
            tone: "danger",
            onTrigger: (item) => item == null ? undefined : vm.resolveAlert(item.id ?? ""),
          },
        ]}
      />
    </FeatureScaffold>
  );
}
