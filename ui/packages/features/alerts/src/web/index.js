import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useAlertsVm } from "../hooks";
function readAlertStatus(item) {
    const statusRow = item?.detailRows?.find((row) => row.key === "Status");
    return typeof statusRow?.value === "string" ? statusRow.value : null;
}
export function AlertsWebView() {
    const vm = useAlertsVm();
    const featureCopy = translateFeatureCopy("alerts");
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: [_jsxs("p", { style: { marginTop: 0 }, children: [translateMessage("ui.alerts.stream"), ": ", vm.streamStatus, " \u00B7 ", translateMessage("ui.alerts.pendingActions"), ": ", vm.pendingOperations] }), vm.loading ? _jsx("p", { children: "Loading live incidents..." }) : null, _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                    {
                        id: "alerts-ack",
                        label: "确认告警",
                        tone: "accent",
                        disabled: (item) => vm.loading || readAlertStatus(item) !== "open",
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
                            if (vm.loading) {
                                return true;
                            }
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
                    disabled: (item) => vm.loading || readAlertStatus(item) === "closed",
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
                    disabled: (item) => vm.loading || readAlertStatus(item) === "closed",
                    onTrigger: (item) => {
                        if (item != null) {
                            vm.onDismiss(item.id);
                        }
                    },
                    activityDescription: "已通过真实事件接口关闭当前事件。",
                },
                ], labels: {
                    activityLogTitle: translateMessage("ui.alerts.activityLogTitle"),
                    activityLogEmpty: translateMessage("ui.alerts.activityLogEmpty"),
                } }), vm.history.length > 0 ? (_jsx("ul", { children: vm.history.map((entry) => (_jsxs("li", { children: [_jsx("strong", { children: entry.title }), " - ", entry.description] }, `${entry.title}-${entry.description}`))) })) : null] }));
}
