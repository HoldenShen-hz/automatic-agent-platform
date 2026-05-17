import { useMemo, useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useTaskCockpitVm } from "../hooks";

type DrillTab = "steps" | "evidence" | "timeline";

function sanitizeInput(value: string, fallback: string): string {
  const normalized = value.replace(/[^a-z0-9-]/gi, "");
  return normalized.length > 0 ? normalized : fallback;
}

export function TaskCockpitWebView(): ReactElement {
  const vm = useTaskCockpitVm();
  const [operator, setOperator] = useState("platform-sre");
  const [target, setTarget] = useState("domain-admin");
  const [activeTab, setActiveTab] = useState<DrillTab>("steps");

  const selectedTask = vm.selectedTask;
  const detailRows = useMemo(() => {
    if (selectedTask == null) {
      return [];
    }
    return [
      { key: "Task", value: selectedTask.title },
      { key: "Status", value: selectedTask.status },
      { key: "Owner", value: selectedTask.owner ?? "unassigned" },
      { key: "Current Step", value: selectedTask.currentStep },
      { key: "Domain", value: selectedTask.domainId },
      { key: "Evidence", value: String(selectedTask.evidenceCount ?? 0) },
      { key: "CPU", value: `${selectedTask.resourceUsage?.cpuPercent ?? 0}%` },
      { key: "Memory", value: `${selectedTask.resourceUsage?.memoryMb ?? 0} MB` },
      { key: "Runtime", value: `${selectedTask.resourceUsage?.runtimeMinutes ?? 0} min` },
    ];
  }, [selectedTask]);

  return (
    <FeatureScaffold title="Task Cockpit" summary="任务五级下钻和三栏布局" status="Implemented/Contracted">
      <ThreePaneLayout
        left={(
          <div>
            <h3>L1-L2 Task List</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {vm.listItems.map((task) => (
                <button
                  key={task.id}
                  onClick={() => vm.selectTask(task.id)}
                  style={{ textAlign: "left" }}
                  type="button"
                >
                  <strong>{task.title}</strong>
                  <div>{task.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        center={selectedTask == null ? <p>No task selected</p> : (
          <div style={{ display: "grid", gap: 16 }}>
            <h3>L3 Detail</h3>
            <KeyValueTable rows={detailRows} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                onChange={(event) => setOperator(event.target.value)}
                placeholder="e.g. platform-sre"
                value={operator}
              />
              <button onClick={() => { void vm.claimTask(sanitizeInput(operator, "platform-sre")); }} type="button">Take Over</button>
              <button onClick={() => { void vm.pauseTask(); }} type="button">Pause</button>
              <button onClick={() => { void vm.cancelTask(); }} type="button">Cancel</button>
              <button onClick={() => { void vm.retryTask(); }} type="button">Retry</button>
              <button onClick={() => { void vm.resumeTask("normal"); }} type="button">Resume</button>
              <button onClick={() => { void vm.resumeTask("supervised"); }} type="button">Supervised Resume</button>
              <input
                onChange={(event) => setTarget(event.target.value)}
                placeholder="e.g. domain-admin"
                value={target}
              />
              <button onClick={() => { void vm.escalateTask(sanitizeInput(target, "domain-admin")); }} type="button">Escalate</button>
            </div>
          </div>
        )}
        right={selectedTask == null ? <p>No timeline</p> : (
          <div style={{ display: "grid", gap: 12 }}>
            <h3>L4-L5 Drill Down</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setActiveTab("steps")} type="button">L3 Steps</button>
              <button onClick={() => setActiveTab("evidence")} type="button">L4 Evidence</button>
              <button onClick={() => setActiveTab("timeline")} type="button">L5 Timeline</button>
            </div>
            {activeTab === "steps" ? (
              <ListCard
                items={vm.stepViewer.steps.map((step) => ({
                  title: step.title,
                  description: `${step.status} · ${step.executor ?? "unknown"}`,
                }))}
              />
            ) : null}
            {activeTab === "evidence" ? (
              <ListCard
                items={vm.evidenceViewer.evidenceChain.map((item) => ({
                  title: item.type,
                  description: item.description,
                }))}
              />
            ) : null}
            {activeTab === "timeline" ? (
              <ListCard
                items={vm.timelineViewer.timelineEvents.map((item) => ({
                  title: item.title,
                  description: item.description,
                }))}
              />
            ) : null}
          </div>
        )}
      />
    </FeatureScaffold>
  );
}
