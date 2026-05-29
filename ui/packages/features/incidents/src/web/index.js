import { jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useIncidentsVm } from "../hooks";
export function IncidentsWebView() {
    const vm = useIncidentsVm();
    return (_jsx(FeatureScaffold, { title: "Incidents", summary: "Incident \u65F6\u95F4\u7EBF\u4E0E\u5904\u7F6E\u6D41", status: "Implemented/Internal", children: _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                { id: "incidents-assign", label: "指派负责人", tone: "accent" },
                { id: "incidents-evidence", label: "附加证据", tone: "neutral" },
                { id: "incidents-close", label: "关闭事件", tone: "danger" },
            ] }) }));
}
