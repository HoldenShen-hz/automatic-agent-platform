import { useMemo, useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useTaskCockpitVm } from "../hooks";

export function TaskCockpitWebView(): ReactElement {
  const vm = useTaskCockpitVm();
  const [selectedId, setSelectedId] = useState<string | null>(vm.tasks[0]?.id ?? null);
  const selectedTask = useMemo(
    () => vm.tasks.find((task) => task.id === selectedId) ?? vm.tasks[0] ?? null,
    [selectedId, vm.tasks],
  );

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
                    setSelectedId(task.id);
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
          <div>
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
          </div>
        )}
        right={selectedTask == null ? <p>No timeline</p> : (
          <div>
            <h3>L5 Timeline / Evidence</h3>
            <ListCard
              items={[
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
