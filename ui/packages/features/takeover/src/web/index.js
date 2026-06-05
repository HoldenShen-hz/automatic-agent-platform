import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useTakeoverVm } from "../hooks";
export function TakeoverWebView() {
    const vm = useTakeoverVm();
    return (_jsxs(FeatureScaffold, { title: "Admin Takeover Console", summary: "\u7BA1\u7406\u5458\u63A5\u7BA1\u3001\u91CD\u8BD5\u548C\u4EBA\u5DE5\u8986\u76D6\u5165\u53E3\u3002", status: "Implemented/Internal", children: [_jsx(FeatureWorkbenchPanel, { items: vm.items, actions: [
                    { id: "takeover-start", label: "接管当前任务", tone: "danger", disabled: !vm.canTakeover, onTrigger: () => vm.takeoverCurrentTask("web-operator") },
                    { id: "takeover-annotate", label: "添加人工批注", tone: "neutral", disabled: !vm.canAnnotate, onTrigger: () => vm.annotateCurrentSnapshot("manual-note", "web-operator") },
                    { id: "takeover-resume", label: "恢复自动执行", tone: "accent", disabled: !vm.canResume, onTrigger: () => vm.resumeAutomaticExecution("web-operator") },
                ] }), _jsxs("section", { "aria-label": "Current takeover snapshot", style: { display: "grid", gap: 12, marginTop: 16 }, children: [_jsx("h3", { style: { margin: 0 }, children: "Current snapshot" }), vm.currentSnapshot == null ? (_jsx("p", { style: { margin: 0 }, children: "No takeover snapshot captured yet." })) : (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsxs("dl", { style: {
                                        display: "grid",
                                        gridTemplateColumns: "max-content 1fr",
                                        gap: "8px 12px",
                                        margin: 0,
                                    }, children: [_jsx("dt", { children: "Task" }), _jsx("dd", { style: { margin: 0 }, children: vm.currentSnapshot.taskId }), _jsx("dt", { children: "Owner" }), _jsx("dd", { style: { margin: 0 }, children: vm.currentSnapshot.owner }), _jsx("dt", { children: "Status" }), _jsx("dd", { style: { margin: 0 }, children: vm.currentSnapshot.status }), _jsx("dt", { children: "Captured at" }), _jsx("dd", { style: { margin: 0 }, children: vm.currentSnapshot.capturedAt })] }), _jsxs("div", { children: [_jsx("h4", { style: { marginBottom: 8 }, children: "Captured steps" }), _jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: vm.currentSnapshot.steps.map((step, index) => (_jsxs("li", { children: [typeof step === "object" && step != null && "title" in step
                                                        ? `${String(step.title)}`
                                                        : `Step ${index + 1}`, typeof step === "object" && step != null && "status" in step
                                                        ? ` \u00b7 ${String(step.status)}`
                                                        : "", typeof step === "object" && step != null && "executor" in step
                                                        ? ` \u00b7 ${String(step.executor)}`
                                                        : ""] }, typeof step === "object" && step != null && "id" in step ? String(step.id) : `${vm.currentSnapshot.taskId}-${index}`))) })] })] }))] }), _jsxs("section", { "aria-label": "Takeover ownership history", style: { display: "grid", gap: 12, marginTop: 16 }, children: [_jsx("h3", { style: { margin: 0 }, children: "Ownership history" }), vm.ownershipHistory.length === 0 ? (_jsx("p", { style: { margin: 0 }, children: "No takeover actions recorded yet." })) : (_jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: vm.ownershipHistory.map((entry) => (_jsxs("li", { children: [entry.recordedAt, " \u00b7 ", entry.taskId, " \u00b7 ", entry.owner, " \u00b7 ", entry.action] }, `${entry.recordedAt}-${entry.taskId}-${entry.action}`))) }))] })] }));
}
