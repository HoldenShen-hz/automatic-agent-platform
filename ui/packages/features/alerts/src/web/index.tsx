import { createElement, type ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useAlertsVm } from "../hooks";

export function AlertsWebView(): ReactElement {
  const vm = useAlertsVm();
  return (
    <FeatureScaffold title="Alerts" summary="Incident 和高优先级告警流" status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "alerts-ack", label: "确认告警", tone: "accent" },
          { id: "alerts-dismiss", label: "忽略选中", tone: "neutral" },
          { id: "alerts-mute", label: "静默 30 分钟", tone: "neutral" },
          { id: "alerts-escalate", label: "升级为事件", tone: "danger" },
        ]}
      />
    </FeatureScaffold>
  );
}
