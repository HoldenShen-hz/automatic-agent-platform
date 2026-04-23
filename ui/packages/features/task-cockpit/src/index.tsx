import { useMemo, useState } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout, createFeatureModule } from "@aa/ui-core";
import { useTasksQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "task-cockpit",
  title: "Task Cockpit",
  group: "Mission Control",
  path: "/mission-control/tasks",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "任务五级下钻和三栏工作台基线。",
  render: () => {
    const query = useTasksQuery();
    const tasks = query.data ?? [];
    const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null);
    const selectedTask = useMemo(
      () => tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null,
      [selectedId, tasks],
    );

    return (
      <FeatureScaffold title="Task Cockpit" summary="任务五级下钻和三栏布局" status="Implemented/Contracted">
        <ThreePaneLayout
          left={(
            <div>
              <h3>L1-L2 Task List</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedId(task.id);
                    }}
                    style={{ textAlign: "left", background: task.id === selectedTask?.id ? "#12201a" : "transparent", color: "inherit", border: "1px solid #334155", borderRadius: 12, padding: 12 }}
                    type="button"
                  >
                    <strong>{task.title}</strong>
                    <div>{task.status} · {task.domainId}</div>
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
  },
});
