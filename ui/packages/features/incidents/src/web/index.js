import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useIncidentsVm } from "../hooks";
function readIncidentStatus(item) {
    const statusRow = item?.detailRows?.find((row) => row.key === "Status");
    return typeof statusRow?.value === "string" ? statusRow.value : null;
}
export function IncidentsWebView() {
    const vm = useIncidentsVm();
    const featureCopy = translateFeatureCopy("incidents");
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: [vm.loading ? _jsx("p", { children: "Loading incidents..." }) : null, _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                {
                    id: "incidents-ack",
                    label: "\u8BA4\u9886\u5E76\u786E\u8BA4",
                    tone: "accent",
                    disabled: (item) => vm.loading || readIncidentStatus(item) !== "open",
                    onTrigger: (item) => item == null ? undefined : vm.acknowledgeIncident(item.id),
                    activityDescription: "\u5DF2\u901A\u8FC7\u771F\u5B9E\u4E8B\u4EF6\u63A5\u53E3\u5B8C\u6210\u786E\u8BA4\u3002",
                },
                {
                    id: "incidents-mitigate",
                    label: "\u8FDB\u5165\u5904\u7F6E",
                    tone: "neutral",
                    disabled: (item) => {
                        if (vm.loading) {
                            return true;
                        }
                        const status = readIncidentStatus(item);
                        return status !== "acknowledged" && status !== "triaged";
                    },
                    onTrigger: (item) => item == null ? undefined : vm.startMitigation(item.id),
                    activityDescription: "\u5DF2\u901A\u8FC7\u771F\u5B9E\u4E8B\u4EF6\u63A5\u53E3\u8FDB\u5165\u5904\u7F6E\u3002",
                },
                {
                    id: "incidents-close",
                    label: "\u5173\u95ED\u4E8B\u4EF6",
                    tone: "danger",
                    disabled: (item) => {
                        if (vm.loading) {
                            return true;
                        }
                        const status = readIncidentStatus(item);
                        return status !== "mitigating" && status !== "reviewed";
                    },
                    onTrigger: (item) => item == null ? undefined : vm.resolveIncident(item.id),
                    activityDescription: "\u5DF2\u901A\u8FC7\u771F\u5B9E\u4E8B\u4EF6\u63A5\u53E3\u5173\u95ED\u4E8B\u4EF6\u3002",
                },
            ] })] }));
}
