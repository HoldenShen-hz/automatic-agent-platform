import { jsx, jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useTaskCockpitVm } from "../hooks";
function sanitizeInput(value, fallback) {
  const normalized = value.replace(/[^a-z0-9-]/gi, "");
  return normalized.length > 0 ? normalized : fallback;
}
function TaskCockpitWebView() {
  const vm = useTaskCockpitVm();
  const featureCopy = translateFeatureCopy("task-cockpit");
  const [operator, setOperator] = useState("platform-sre");
  const [target, setTarget] = useState("domain-admin");
  const [taskInput, setTaskInput] = useState("");
  const [taskDomain, setTaskDomain] = useState("platform");
  const [taskOwner, setTaskOwner] = useState("platform-sre");
  const [createError, setCreateError] = useState(null);
  const [activeTab, setActiveTab] = useState("steps");
  const selectedTask = vm.selectedTask;
  const evidenceCount = vm.evidenceViewer.evidenceChain.length > 0 ? vm.evidenceViewer.evidenceChain.length : selectedTask?.evidenceCount ?? 0;
  const detailRows = useMemo(() => {
    if (selectedTask == null) {
      return [];
    }
    const modelLabel = selectedTask.modelProvider == null && selectedTask.modelName == null ? translateMessage("ui.taskCockpit.value.unknown") : `${selectedTask.modelProvider ?? "unknown"} / ${selectedTask.modelName ?? "unknown"}`;
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
      { key: translateMessage("ui.taskCockpit.field.runtime"), value: `${selectedTask.resourceUsage?.runtimeMinutes ?? 0} min` }
    ];
  }, [evidenceCount, selectedTask]);
  return /* @__PURE__ */ jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Contracted", children: [
    /* @__PURE__ */ jsxs(
      "form",
      {
        "aria-label": translateMessage("ui.taskCockpit.createForm"),
        onSubmit: (event) => {
          event.preventDefault();
          setCreateError(null);
          void vm.createTaskFromPrompt({
            title: taskInput,
            domainId: taskDomain,
            owner: taskOwner
          }).then(() => {
            setTaskInput("");
          }).catch((error) => {
            setCreateError(error instanceof Error ? error.message : String(error));
          });
        },
        style: {
          border: "1px solid rgba(148, 163, 184, 0.35)",
          borderRadius: 16,
          display: "grid",
          gap: 12,
          marginBottom: 16,
          padding: 16
        },
        children: [
          /* @__PURE__ */ jsx("strong", { children: translateMessage("ui.taskCockpit.createTitle") }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              "aria-label": translateMessage("ui.taskCockpit.createInput"),
              name: "task-input",
              onChange: (event) => setTaskInput(event.target.value),
              placeholder: translateMessage("ui.taskCockpit.createPlaceholder"),
              rows: 3,
              value: taskInput
            }
          ),
          /* @__PURE__ */ jsxs(Inline, { children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                "aria-label": translateMessage("ui.taskCockpit.createDomain"),
                name: "task-domain",
                onChange: (event) => setTaskDomain(event.target.value),
                placeholder: translateMessage("ui.taskCockpit.createDomainPlaceholder"),
                value: taskDomain
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                "aria-label": translateMessage("ui.taskCockpit.createOwner"),
                name: "task-owner",
                onChange: (event) => setTaskOwner(event.target.value),
                placeholder: translateMessage("ui.taskCockpit.createOwnerPlaceholder"),
                value: taskOwner
              }
            ),
            /* @__PURE__ */ jsx("button", { disabled: taskInput.trim().length === 0 || vm.pendingOperations > 0, type: "submit", children: translateMessage("ui.taskCockpit.createSubmit") })
          ] }),
          createError == null ? null : /* @__PURE__ */ jsx("p", { role: "alert", children: createError })
        ]
      }
    ),
    vm.loadError == null ? null : /* @__PURE__ */ jsxs(
      "div",
      {
        role: "alert",
        style: {
          border: "1px solid rgba(239, 68, 68, 0.45)",
          borderRadius: 12,
          display: "grid",
          gap: 8,
          marginBottom: 16,
          padding: 12
        },
        children: [
          /* @__PURE__ */ jsx("strong", { children: "Task query failed" }),
          /* @__PURE__ */ jsx("span", { children: vm.loadError }),
          /* @__PURE__ */ jsx(Inline, { children: /* @__PURE__ */ jsx("button", { onClick: () => {
            void vm.refreshTasks();
          }, type: "button", children: "Retry task load" }) })
        ]
      }
    ),
    vm.operationError == null ? null : /* @__PURE__ */ jsxs(
      "div",
      {
        role: "alert",
        style: {
          border: "1px solid rgba(239, 68, 68, 0.45)",
          borderRadius: 12,
          display: "grid",
          gap: 8,
          marginBottom: 16,
          padding: 12
        },
        children: [
          /* @__PURE__ */ jsx("strong", { children: "Task action failed" }),
          /* @__PURE__ */ jsx("span", { children: vm.operationError })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      ThreePaneLayout,
      {
        left: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { children: translateMessage("ui.taskCockpit.listTitle") }),
          /* @__PURE__ */ jsxs(Stack, { gap: 10, children: [
            vm.loading ? /* @__PURE__ */ jsx("p", { children: "Loading tasks..." }) : null,
            vm.listItems.map((task) => /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => vm.selectTask(task.id),
                style: { textAlign: "left" },
                type: "button",
                children: [
                  /* @__PURE__ */ jsx("strong", { children: task.title }),
                  /* @__PURE__ */ jsx("div", { children: task.subtitle })
                ]
              },
              task.id
            ))
          ] })
        ] }),
        center: selectedTask == null ? /* @__PURE__ */ jsx("p", { children: translateMessage("ui.taskCockpit.noTask") }) : /* @__PURE__ */ jsxs(Stack, { gap: 16, children: [
          /* @__PURE__ */ jsx("h3", { children: translateMessage("ui.taskCockpit.detailTitle") }),
          /* @__PURE__ */ jsx(KeyValueTable, { rows: detailRows }),
          vm.workflowControlsAvailable || vm.workflowControlReason == null ? null : /* @__PURE__ */ jsx("p", { role: "note", style: { margin: 0 }, children: vm.workflowControlReason }),
          /* @__PURE__ */ jsx(
            "form",
            {
              onSubmit: (event) => {
                event.preventDefault();
                void vm.claimTask(sanitizeInput(operator, "platform-sre"));
              },
              children: /* @__PURE__ */ jsxs(Inline, { children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    "aria-label": translateMessage("ui.taskCockpit.operatorInput"),
                    name: "operator-id",
                    onChange: (event) => setOperator(event.target.value),
                    placeholder: translateMessage("ui.taskCockpit.operatorPlaceholder"),
                    value: operator
                  }
                ),
                /* @__PURE__ */ jsx("button", { type: "submit", children: translateMessage("ui.taskCockpit.takeOver") }),
                /* @__PURE__ */ jsx("button", { disabled: !vm.workflowControlsAvailable || vm.pendingOperations > 0, onClick: () => {
                  void vm.pauseTask();
                }, type: "button", children: translateMessage("ui.taskCockpit.pause") }),
                /* @__PURE__ */ jsx("button", { disabled: !vm.workflowControlsAvailable || vm.pendingOperations > 0, onClick: () => {
                  void vm.cancelTask();
                }, type: "button", children: translateMessage("ui.taskCockpit.cancel") }),
                /* @__PURE__ */ jsx("button", { disabled: !vm.workflowControlsAvailable || vm.pendingOperations > 0, onClick: () => {
                  void vm.retryTask();
                }, type: "button", children: translateMessage("ui.taskCockpit.retry") }),
                /* @__PURE__ */ jsx("button", { disabled: !vm.workflowControlsAvailable || vm.pendingOperations > 0, onClick: () => {
                  void vm.resumeTask("normal");
                }, type: "button", children: translateMessage("ui.taskCockpit.resume") }),
                /* @__PURE__ */ jsx("button", { disabled: !vm.workflowControlsAvailable || vm.pendingOperations > 0, onClick: () => {
                  void vm.resumeTask("supervised");
                }, type: "button", children: translateMessage("ui.taskCockpit.supervisedResume") })
              ] })
            }
          ),
          /* @__PURE__ */ jsx(
            "form",
            {
              onSubmit: (event) => {
                event.preventDefault();
                void vm.escalateTask(sanitizeInput(target, "domain-admin"));
              },
              children: /* @__PURE__ */ jsxs(Inline, { children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    "aria-label": translateMessage("ui.taskCockpit.targetInput"),
                    name: "target-id",
                    onChange: (event) => setTarget(event.target.value),
                    placeholder: translateMessage("ui.taskCockpit.targetPlaceholder"),
                    value: target
                  }
                ),
                /* @__PURE__ */ jsx("button", { type: "submit", children: translateMessage("ui.taskCockpit.escalate") })
              ] })
            }
          )
        ] }),
        right: selectedTask == null ? /* @__PURE__ */ jsx("p", { children: translateMessage("ui.taskCockpit.noTimeline") }) : /* @__PURE__ */ jsxs(Stack, { children: [
          /* @__PURE__ */ jsx("h3", { children: translateMessage("ui.taskCockpit.drillTitle") }),
          /* @__PURE__ */ jsxs(Inline, { children: [
            /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("steps"), type: "button", children: translateMessage("ui.taskCockpit.stepsTab") }),
            /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("evidence"), type: "button", children: translateMessage("ui.taskCockpit.evidenceTab") }),
            /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("timeline"), type: "button", children: translateMessage("ui.taskCockpit.timelineTab") })
          ] }),
          activeTab === "steps" ? /* @__PURE__ */ jsx(
            ListCard,
            {
              items: vm.stepViewer.steps.map((step) => ({
                title: step.title,
                description: `${step.status} \xB7 ${step.executor ?? translateMessage("ui.taskCockpit.value.unknown")}`
              }))
            }
          ) : null,
          activeTab === "evidence" ? /* @__PURE__ */ jsx(
            ListCard,
            {
              items: vm.evidenceViewer.evidenceChain.map((item) => ({
                title: item.type,
                description: item.description
              }))
            }
          ) : null,
          activeTab === "timeline" ? /* @__PURE__ */ jsx(
            ListCard,
            {
              items: vm.timelineViewer.timelineEvents.map((item) => ({
                title: item.title,
                description: item.description
              }))
            }
          ) : null
        ] })
      }
    )
  ] });
}
export {
  TaskCockpitWebView
};
