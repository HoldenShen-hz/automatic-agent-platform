import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useAlertsVm } from "../hooks";
export function AlertsWebView() {
    const vm = useAlertsVm();
    return (_jsxs(FeatureScaffold, { title: "Alerts", summary: "Incident \u548C\u9AD8\u4F18\u5148\u7EA7\u544A\u8B66\u6D41", status: "Implemented/Internal", children: [_jsxs("p", { style: { marginTop: 0 }, children: ["Stream: ", vm.streamStatus, " \u00B7 Pending actions: ", vm.pendingOperations] }), _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
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
                ], labels: {
                    activityLogTitle: "Alert history",
                    activityLogEmpty: "Incoming alert stream updates and operator actions will appear here.",
                } }), vm.history.length > 0 ? (_jsx("ul", { children: vm.history.map((entry) => (_jsxs("li", { children: [_jsx("strong", { children: entry.title }), " - ", entry.description] }, `${entry.title}-${entry.description}`))) })) : null] }));
}
