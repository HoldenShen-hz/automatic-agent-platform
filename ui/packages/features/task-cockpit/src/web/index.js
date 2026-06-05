import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateMessage } from "@aa/shared-i18n";
import { useTaskCockpitVm } from "../hooks";
function sanitizeInput(value, fallback) {
    const normalized = value.replace(/[^a-z0-9-]/gi, "");
    return normalized.length > 0 ? normalized : fallback;
}
export function TaskCockpitWebView() {
    const vm = useTaskCockpitVm();
    const [operator, setOperator] = useState("platform-sre");
    const [target, setTarget] = useState("domain-admin");
    const [taskInput, setTaskInput] = useState("");
    const [taskDomain, setTaskDomain] = useState("platform");
    const [taskOwner, setTaskOwner] = useState("platform-sre");
    const [createError, setCreateError] = useState(null);
    const [activeTab, setActiveTab] = useState("steps");
    const selectedTask = vm.selectedTask;
    const evidenceCount = vm.evidenceViewer.evidenceChain.length > 0
        ? vm.evidenceViewer.evidenceChain.length
        : (selectedTask?.evidenceCount ?? 0);
    const detailRows = useMemo(() => {
        if (selectedTask == null) {
            return [];
        }
        const modelLabel = selectedTask.modelProvider == null && selectedTask.modelName == null
            ? translateMessage("ui.taskCockpit.value.unknown")
            : `${selectedTask.modelProvider ?? "unknown"} / ${selectedTask.modelName ?? "unknown"}`;
        return [
            { key: translateMessage("ui.taskCockpit.field.task"), value: selectedTask.title },
            { key: translateMessage("ui.taskCockpit.field.status"), value: selectedTask.status },
            { key: translateMessage("ui.taskCockpit.field.owner"), value: selectedTask.owner ?? translateMessage("ui.taskCockpit.value.unassigned") },
            { key: translateMessage("ui.taskCockpit.field.currentStep"), value: selectedTask.currentStep },
            { key: translateMessage("ui.taskCockpit.field.domain"), value: selectedTask.domainId },
            { key: translateMessage("ui.taskCockpit.field.executionMode"), value: selectedTask.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
            { key: translateMessage("ui.taskCockpit.field.modelCall"), value: selectedTask.modelCallStatus ?? translateMessage("ui.taskCockpit.value.unknown") },
            { key: translateMessage("ui.taskCockpit.field.model"), value: modelLabel },
            { key: translateMessage("ui.taskCockpit.field.output"), value: selectedTask.outputSummary ?? selectedTask.outputUri ?? translateMessage("ui.taskCockpit.value.noRealOutput") },
            { key: translateMessage("ui.taskCockpit.field.evidence"), value: String(evidenceCount) },
            { key: translateMessage("ui.taskCockpit.field.cpu"), value: `${selectedTask.resourceUsage?.cpuPercent ?? 0}%` },
            { key: translateMessage("ui.taskCockpit.field.memory"), value: `${selectedTask.resourceUsage?.memoryMb ?? 0} MB` },
            { key: translateMessage("ui.taskCockpit.field.runtime"), value: `${selectedTask.resourceUsage?.runtimeMinutes ?? 0} min` },
        ];
    }, [evidenceCount, selectedTask]);
    return (_jsxs(FeatureScaffold, { title: "Task Cockpit", summary: "\u4EFB\u52A1\u4E94\u7EA7\u4E0B\u94BB\u548C\u4E09\u680F\u5E03\u5C40", status: "Implemented/Contracted", children: [_jsxs("form", { "aria-label": translateMessage("ui.taskCockpit.createForm"), onSubmit: (event) => {
                    event.preventDefault();
                    setCreateError(null);
                    void vm.createTaskFromPrompt({
                        title: taskInput,
                        domainId: taskDomain,
                        owner: taskOwner,
                    }).then(() => {
                        setTaskInput("");
                    }).catch((error) => {
                        setCreateError(error instanceof Error ? error.message : String(error));
                    });
                }, style: {
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 16,
                    display: "grid",
                    gap: 12,
                    marginBottom: 16,
                    padding: 16,
                }, children: [_jsx("strong", { children: translateMessage("ui.taskCockpit.createTitle") }), _jsx("textarea", { "aria-label": translateMessage("ui.taskCockpit.createInput"), name: "task-input", onChange: (event) => setTaskInput(event.target.value), placeholder: translateMessage("ui.taskCockpit.createPlaceholder"), rows: 3, value: taskInput }), _jsxs(Inline, { children: [_jsx("input", { "aria-label": translateMessage("ui.taskCockpit.createDomain"), name: "task-domain", onChange: (event) => setTaskDomain(event.target.value), placeholder: translateMessage("ui.taskCockpit.createDomainPlaceholder"), value: taskDomain }), _jsx("input", { "aria-label": translateMessage("ui.taskCockpit.createOwner"), name: "task-owner", onChange: (event) => setTaskOwner(event.target.value), placeholder: translateMessage("ui.taskCockpit.createOwnerPlaceholder"), value: taskOwner }), _jsx("button", { disabled: taskInput.trim().length === 0 || vm.pendingOperations > 0, type: "submit", children: translateMessage("ui.taskCockpit.createSubmit") })] }), createError == null ? null : _jsx("p", { role: "alert", children: createError })] }), _jsx(ThreePaneLayout, { left: (_jsxs("div", { children: [_jsx("h3", { children: translateMessage("ui.taskCockpit.listTitle") }), _jsx(Stack, { gap: 10, children: vm.listItems.map((task) => (_jsxs("button", { onClick: () => vm.selectTask(task.id), style: { textAlign: "left" }, type: "button", children: [_jsx("strong", { children: task.title }), _jsx("div", { children: task.subtitle })] }, task.id))) })] })), center: selectedTask == null ? _jsx("p", { children: translateMessage("ui.taskCockpit.noTask") }) : (_jsxs(Stack, { gap: 16, children: [_jsx("h3", { children: translateMessage("ui.taskCockpit.detailTitle") }), _jsx(KeyValueTable, { rows: detailRows }), _jsx("form", { onSubmit: (event) => {
                            event.preventDefault();
                            void vm.claimTask(sanitizeInput(operator, "platform-sre"));
                        }, children: _jsxs(Inline, { children: [_jsx("input", { "aria-label": translateMessage("ui.taskCockpit.operatorInput"), name: "operator-id", onChange: (event) => setOperator(event.target.value), placeholder: translateMessage("ui.taskCockpit.operatorPlaceholder"), value: operator }), _jsx("button", { type: "submit", children: translateMessage("ui.taskCockpit.takeOver") }), _jsx("button", { onClick: () => { void vm.pauseTask(); }, type: "button", children: translateMessage("ui.taskCockpit.pause") }), _jsx("button", { onClick: () => { void vm.cancelTask(); }, type: "button", children: translateMessage("ui.taskCockpit.cancel") }), _jsx("button", { onClick: () => { void vm.retryTask(); }, type: "button", children: translateMessage("ui.taskCockpit.retry") }), _jsx("button", { onClick: () => { void vm.resumeTask("normal"); }, type: "button", children: translateMessage("ui.taskCockpit.resume") }), _jsx("button", { onClick: () => { void vm.resumeTask("supervised"); }, type: "button", children: translateMessage("ui.taskCockpit.supervisedResume") })] }) }), _jsx("form", { onSubmit: (event) => {
                            event.preventDefault();
                            void vm.escalateTask(sanitizeInput(target, "domain-admin"));
                        }, children: _jsxs(Inline, { children: [_jsx("input", { "aria-label": translateMessage("ui.taskCockpit.targetInput"), name: "target-id", onChange: (event) => setTarget(event.target.value), placeholder: translateMessage("ui.taskCockpit.targetPlaceholder"), value: target }), _jsx("button", { type: "submit", children: translateMessage("ui.taskCockpit.escalate") })] }) })] })), right: selectedTask == null ? _jsx("p", { children: translateMessage("ui.taskCockpit.noTimeline") }) : (_jsxs(Stack, { children: [_jsx("h3", { children: translateMessage("ui.taskCockpit.drillTitle") }), _jsxs(Inline, { children: [_jsx("button", { onClick: () => setActiveTab("steps"), type: "button", children: translateMessage("ui.taskCockpit.stepsTab") }), _jsx("button", { onClick: () => setActiveTab("evidence"), type: "button", children: translateMessage("ui.taskCockpit.evidenceTab") }), _jsx("button", { onClick: () => setActiveTab("timeline"), type: "button", children: translateMessage("ui.taskCockpit.timelineTab") })] }), activeTab === "steps" ? (_jsx(ListCard, { items: vm.stepViewer.steps.map((step) => ({
                            title: step.title,
                            description: `${step.status} · ${step.executor ?? translateMessage("ui.taskCockpit.value.unknown")}`,
                        })) })) : null, activeTab === "evidence" ? (_jsx(ListCard, { items: vm.evidenceViewer.evidenceChain.map((item) => ({
                            title: item.type,
                            description: item.description,
                        })) })) : null, activeTab === "timeline" ? (_jsx(ListCard, { items: vm.timelineViewer.timelineEvents.map((item) => ({
                            title: item.title,
                            description: item.description,
                        })) })) : null] })) })] }));
}
