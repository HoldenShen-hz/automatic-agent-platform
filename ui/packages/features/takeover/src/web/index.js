import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useTakeoverVm } from "../hooks";
export function TakeoverWebView() {
    const vm = useTakeoverVm();
    const featureCopy = translateFeatureCopy("takeover");
    const snapshot = vm.currentSnapshot;
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [_jsx("p", { style: { marginTop: 0 }, children: "\u63A5\u7BA1\u3001\u6279\u6CE8\u4E0E\u6062\u590D\u52A8\u4F5C\u73B0\u5728\u90FD\u4F1A\u5199\u5165\u540E\u7AEF takeover session \u4E0E operator action \u5BA1\u8BA1\u94FE\uFF0C\u9875\u9762\u4E0D\u518D\u4F7F\u7528\u6D4F\u89C8\u5668\u672C\u5730\u5386\u53F2\u5145\u5F53\u771F\u5B9E\u72B6\u6001\u3002" }), vm.errorMessage != null ? (_jsx("p", { style: { marginTop: 0, color: "#b42318" }, children: vm.errorMessage })) : null, _jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                    { id: "takeover-start", label: "接管当前任务", tone: "danger", disabled: !vm.canTakeover, onTrigger: () => vm.takeoverCurrentTask("web-operator") },
                    { id: "takeover-annotate", label: "添加人工批注", tone: "neutral", disabled: !vm.canAnnotate, onTrigger: () => vm.annotateCurrentSnapshot("manual-note", "web-operator") },
                    { id: "takeover-resume", label: "恢复任务运行", tone: "accent", disabled: !vm.canResume, onTrigger: () => vm.resumeAutomaticExecution("web-operator") },
                    { id: "takeover-refresh", label: "刷新接管快照", tone: "neutral", onTrigger: () => vm.refresh() },
                ] }), _jsxs("section", { "aria-label": "Current takeover snapshot", style: { display: "grid", gap: 12, marginTop: 16 }, children: [_jsx("h3", { style: { margin: 0 }, children: "Current snapshot" }), vm.loading ? (_jsx("p", { style: { margin: 0 }, children: "Loading takeover snapshot..." })) : snapshot == null ? (_jsx("p", { style: { margin: 0 }, children: "No takeover snapshot captured yet." })) : (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsxs("dl", { style: {
                                    display: "grid",
                                    gridTemplateColumns: "max-content 1fr",
                                    gap: "8px 12px",
                                    margin: 0,
                                }, children: [_jsx("dt", { children: "Task" }), _jsx("dd", { style: { margin: 0 }, children: snapshot.taskId }), _jsx("dt", { children: "Owner" }), _jsx("dd", { style: { margin: 0 }, children: snapshot.owner }), _jsx("dt", { children: "Status" }), _jsx("dd", { style: { margin: 0 }, children: snapshot.status }), _jsx("dt", { children: "Captured at" }), _jsx("dd", { style: { margin: 0 }, children: snapshot.capturedAt })] }), _jsxs("div", { children: [_jsx("h4", { style: { marginBottom: 8 }, children: "Captured steps" }), _jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: snapshot.steps.map((step, index) => (_jsxs("li", { children: [typeof step === "object" && step != null && "title" in step
                                                    ? `${String(step.title)}`
                                                    : `Step ${index + 1}`, typeof step === "object" && step != null && "status" in step
                                                    ? ` · ${String(step.status)}`
                                                    : "", typeof step === "object" && step != null && "executor" in step
                                                    ? ` · ${String(step.executor)}`
                                                    : ""] }, typeof step === "object" && step != null && "id" in step ? String(step.id) : `${snapshot.taskId}-${index}`))) })] })] }))] }), _jsxs("section", { "aria-label": "Takeover ownership history", style: { display: "grid", gap: 12, marginTop: 16 }, children: [_jsx("h3", { style: { margin: 0 }, children: "Ownership history" }), vm.ownershipHistory.length === 0 ? (_jsx("p", { style: { margin: 0 }, children: "No takeover actions recorded yet." })) : (_jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: vm.ownershipHistory.map((entry) => (_jsxs("li", { children: [entry.recordedAt, " \u00B7 ", entry.taskId, " \u00B7 ", entry.owner, " \u00B7 ", entry.action] }, `${entry.recordedAt}-${entry.taskId}-${entry.action}`))) }))] })] }));
}
