import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel, type FeatureWorkbenchItem } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useAlertsVm } from "../hooks";

function readAlertStatus(item: FeatureWorkbenchItem | null): string | null {
  const statusRow = item?.detailRows?.find((row) => row.key === "Status");
  return typeof statusRow?.value === "string" ? statusRow.value : null;
}

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
            disabled: (item) => readAlertStatus(item) !== "open",
            onTrigger: (item) => {
              if (item != null) {
                vm.onAcknowledge(item.id);
              }
            },
          },
          {
            id: "alerts-mitigate",
            label: "进入处置",
            tone: "neutral",
            disabled: (item) => {
              const status = readAlertStatus(item);
              return status !== "acknowledged" && status !== "triaged";
            },
            onTrigger: (item) => {
              if (item != null) {
                vm.onEscalate(item.id);
              }
            },
          },
          {
            id: "alerts-mute",
            label: "静默 30 分钟",
            tone: "neutral",
            disabled: (item) => readAlertStatus(item) === "closed",
            onTrigger: (item) => {
              if (item != null) {
                vm.onSnooze(item.id);
              }
            },
            activityDescription: "已通过真实事件接口写入 snooze deadline。",
          },
          {
            id: "alerts-dismiss",
            label: "忽略选中",
            tone: "danger",
            disabled: (item) => readAlertStatus(item) === "closed",
            onTrigger: (item) => {
              if (item != null) {
                vm.onDismiss(item.id);
              }
            },
            activityDescription: "已通过真实事件接口关闭当前事件。",
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
