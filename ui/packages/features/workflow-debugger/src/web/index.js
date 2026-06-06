import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useWorkflowDebuggerVm } from "../hooks";
export function WorkflowDebuggerWebView() {
    const featureCopy = translateFeatureCopy("workflow-debugger");
    const vm = useWorkflowDebuggerVm();
    const rightItems = vm.activePanel === "timeline"
        ? vm.timelineItems
        : vm.activePanel === "failure"
            ? vm.failureItems
            : vm.activityItems.length > 0
                ? vm.activityItems
                : [{ title: "No export activity", description: "Export a live debugger snapshot to populate this pane." }];
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [_jsx(MetricGrid, { metrics: vm.metrics }), vm.loadError == null ? null : _jsx("p", { role: "alert", children: vm.loadError }), _jsx(ThreePaneLayout, { left: (_jsxs(Stack, { gap: 10, children: [_jsx("h3", { children: "Recent tasks" }), vm.loading ? _jsx("p", { children: "Loading debugger scope..." }) : null, vm.listItems.map((item) => (_jsxs("button", { onClick: () => vm.selectTask(item.id), style: { textAlign: "left" }, type: "button", children: [_jsx("strong", { children: item.title }), _jsx("div", { children: item.subtitle })] }, item.id)))] })), center: vm.loading ? _jsx("p", { children: "Loading debugger detail..." }) : vm.listItems.length === 0 ? _jsx("p", { children: "No debugger tasks available from the backend." }) : vm.selectedTask == null ? _jsx("p", { children: "No task selected" }) : (_jsxs(Stack, { gap: 16, children: [_jsx("h3", { children: "Live debugger view" }), _jsx(KeyValueTable, { rows: vm.detailRows }), _jsxs(Inline, { children: [_jsx("button", { disabled: vm.pendingOperations > 0, onClick: () => { void vm.replayTimeline(); }, type: "button", children: "\u56DE\u653E\u65F6\u95F4\u7EBF" }), _jsx("button", { disabled: vm.pendingOperations > 0, onClick: () => { void vm.focusFailure(); }, type: "button", children: "\u5B9A\u4F4D\u5931\u8D25\u9636\u6BB5" }), _jsx("button", { disabled: vm.pendingOperations > 0, onClick: () => { void vm.exportDebugSnapshot(); }, type: "button", children: "\u5BFC\u51FA\u8C03\u8BD5\u5FEB\u7167" })] }), vm.activePanel !== "export" || vm.exportSnapshot.length === 0 ? null : _jsx("pre", { style: { margin: 0, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap" }, children: vm.exportSnapshot })] })), right: (_jsxs(Stack, { gap: 12, children: [_jsx("h3", { children: vm.activePanel === "timeline" ? "Timeline" : vm.activePanel === "failure" ? "Failure Focus" : "Export Activity" }), _jsx(ListCard, { items: rightItems })] })) })] }));
}
