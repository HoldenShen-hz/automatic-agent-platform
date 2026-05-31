import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useAlertsVm } from "../hooks";

export function AlertsWebView(): ReactElement {
  const vm = useAlertsVm();
  const featureCopy = translateFeatureCopy("alerts");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <p style={{ marginTop: 0 }}>
        {translateMessage("ui.alerts.stream")}: {vm.streamStatus} · {translateMessage("ui.alerts.pendingActions")}: {vm.pendingOperations}
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
          activityLogTitle: translateMessage("ui.alerts.activityLogTitle"),
          activityLogEmpty: translateMessage("ui.alerts.activityLogEmpty"),
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
