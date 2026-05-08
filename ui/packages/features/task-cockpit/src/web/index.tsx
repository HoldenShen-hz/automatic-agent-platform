import { useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useTaskCockpitVm } from "../hooks";

// §210-2502: Task cockpit drill-down levels - L3 Step Output, L4 Evidence Chain, L5 Timeline
type DrillLevel = "l3-steps" | "l4-evidence" | "l5-timeline";

export function TaskCockpitWebView(): ReactElement {
  const vm = useTaskCockpitVm();
  const [operator, setOperator] = useState("platform-sre");
  const [target, setTarget] = useState("domain-admin");
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("l3-steps"); // §210-2502: track current drill level
  const selectedTask = vm.selectedTask;

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
                  onClick={() => {
                    vm.selectTask(task.id);
                  }}
                  style={{ textAlign: "left", background: task.id === selectedTask?.id ? "#12201a" : "transparent", color: "inherit", border: "1px solid #334155", borderRadius: 12, padding: 12 }}
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
            <h3>L3-L4 Detail</h3>
            <KeyValueTable
              rows={[
                { key: "Task", value: selectedTask.title },
                { key: "Status", value: selectedTask.status },
                { key: "Owner", value: selectedTask.owner ?? "unassigned" },
                { key: "Current Step", value: selectedTask.currentStep },
                { key: "Domain", value: selectedTask.domainId },
                { key: "Evidence", value: String(selectedTask.evidenceCount ?? 0) },
              ]}
            />
            {/* §2274: Operator and escalation target inputs with validation */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Operator</span>
                <input
                  onChange={(event) => setOperator(event.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  value={operator}
                  placeholder="e.g. platform-sre"
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </label>
              <button
                onClick={() => {
                  if (!operator.trim()) {
                    alert("Operator cannot be empty");
                    return;
                  }
                  vm.claimTask(operator);
                }}
                type="button"
              >
                Take Over
              </button>
              <button onClick={() => vm.pauseTask()} type="button">Pause</button>
              <button onClick={() => vm.cancelTask()} type="button">Cancel</button>
              <button onClick={() => vm.retryTask()} type="button">Retry</button>
              <button onClick={() => vm.resumeTask("normal")} type="button">Resume</button>
              <button onClick={() => vm.resumeTask("supervised")} type="button">Supervised Resume</button>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Escalation Target</span>
                <input
                  onChange={(event) => setTarget(event.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  value={target}
                  placeholder="e.g. domain-admin"
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </label>
              <button
                onClick={() => {
                  if (!target.trim()) {
                    alert("Escalation target cannot be empty");
                    return;
                  }
                  vm.escalateTask(target);
                }}
                type="button"
              >
                Escalate
              </button>
            </div>
            {/* §210-2502: L3-L5 drill-down tabs for sub-routes */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #334155", paddingBottom: 8 }}>
              <button
                onClick={() => setDrillLevel("l3-steps")}
                type="button"
                style={{ padding: "4px 12px", background: drillLevel === "l3-steps" ? "#1e3a5f" : "transparent", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}
              >
                L3 Steps
              </button>
              <button
                onClick={() => setDrillLevel("l4-evidence")}
                type="button"
                style={{ padding: "4px 12px", background: drillLevel === "l4-evidence" ? "#1e3a5f" : "transparent", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}
              >
                L4 Evidence
              </button>
              <button
                onClick={() => setDrillLevel("l5-timeline")}
                type="button"
                style={{ padding: "4px 12px", background: drillLevel === "l5-timeline" ? "#1e3a5f" : "transparent", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}
              >
                L5 Timeline
              </button>
            </div>
            {/* §210-2502: Render step output viewer at L3 */}
            {drillLevel === "l3-steps" && (
              <div style={{ padding: "8px 0" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>Step Output</h4>
                <ListCard items={vm.stepViewer.steps.map((s) => ({ title: s.title, description: `${s.status} · ${s.executor}` }))} />
              </div>
            )}
            {/* §210-2502: Render evidence chain viewer at L4 */}
            {drillLevel === "l4-evidence" && (
              <div style={{ padding: "8px 0" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>Evidence Chain</h4>
                <ListCard items={vm.evidenceViewer.evidenceChain.map((e) => ({ title: e.type, description: e.description }))} />
              </div>
            )}
            {/* §210-2502: Render timeline viewer at L5 */}
            {drillLevel === "l5-timeline" && (
              <div style={{ padding: "8px 0" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>Timeline Events</h4>
                <ListCard items={vm.timelineViewer.timelineEvents.map((e) => ({ title: e.title, description: e.description }))} />
              </div>
            )}
          </div>
        )}
        right={selectedTask == null ? <p>No timeline</p> : (
          <div>
            <h3>L5 Timeline / Evidence</h3>
            <ListCard
              items={vm.timelineItems.length > 0 ? vm.timelineItems : [
                { title: "Execution Timeline", description: `${selectedTask.timelineDepth ?? 0} drill levels are available for this task.` },
                { title: "Evidence Pack", description: `${selectedTask.evidenceCount ?? 0} artifacts and evidence references are attached.` },
                { title: "Recovery Action", description: "Resume, supervised resume, and takeover are routed through HITL." },
              ]}
            />
          </div>
        )}
      />
    </FeatureScaffold>
  );
}
