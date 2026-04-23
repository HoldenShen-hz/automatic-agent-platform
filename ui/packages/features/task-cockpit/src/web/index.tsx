import { useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useTaskCockpitVm } from "../hooks";

export function TaskCockpitWebView(): ReactElement {
  const vm = useTaskCockpitVm();
  const [operator, setOperator] = useState("platform-sre");
  const [target, setTarget] = useState("domain-admin");
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input onChange={(event) => setOperator(event.target.value)} value={operator} />
              <button onClick={() => vm.claimTask(operator)} type="button">Take Over</button>
              <button onClick={() => vm.resumeTask("normal")} type="button">Resume</button>
              <button onClick={() => vm.resumeTask("supervised")} type="button">Supervised Resume</button>
              <input onChange={(event) => setTarget(event.target.value)} value={target} />
              <button onClick={() => vm.escalateTask(target)} type="button">Escalate</button>
            </div>
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
