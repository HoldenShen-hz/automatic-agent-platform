import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useAlertsVm } from "../hooks";

export function AlertsWebView(): ReactElement {
  const vm = useAlertsVm();
  return (
    <FeatureScaffold title="Alerts" summary="Incident 和高优先级告警流" status="Implemented/Internal">
      <p style={{ marginTop: 0 }}>
        Stream: {vm.streamStatus} · Pending actions: {vm.pendingOperations}
      </p>
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          {
            id: "alerts-ack",
            label: "确认告警",
            tone: "accent",
            onTrigger: (item) => {
              if (item != null) {
                vm.onAcknowledge(item.id);
              }
            },
          },
          {
            id: "alerts-dismiss",
            label: "忽略选中",
            tone: "neutral",
            onTrigger: (item) => {
              if (item != null) {
                vm.onDismiss(item.id);
              }
            },
          },
          {
            id: "alerts-mute",
            label: "静默 30 分钟",
            tone: "neutral",
            onTrigger: (item) => {
              if (item != null) {
                vm.onSnooze(item.id);
              }
            },
          },
          {
            id: "alerts-escalate",
            label: "升级为事件",
            tone: "danger",
            onTrigger: (item) => {
              if (item != null) {
                vm.onEscalate(item.id);
              }
            },
          },
        ]}
        labels={{
          activityLogTitle: "Alert history",
          activityLogEmpty: "Incoming alert stream updates and operator actions will appear here.",
        }}
      />
      {vm.history.length > 0 ? (
        <ul>
          {vm.history.map((entry) => (
            <li key={`${entry.title}-${entry.description}`}>
              <strong>{entry.title}</strong> - {entry.description}
            </li>
          ))}
        </ul>
      ) : null}
    </FeatureScaffold>
  );
}
