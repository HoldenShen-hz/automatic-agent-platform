import { useMemo, useState } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout, createFeatureModule } from "@aa/ui-core";
import { useWorkflowsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "workflow-cockpit",
  title: "Workflow Cockpit",
  group: "Mission Control",
  path: "/mission-control/workflows",
  permission: "pack_developer+",
  status: "Implemented/Internal",
  summary: "工作流 DAG、步骤和恢复基线视图。",
  render: () => {
    const query = useWorkflowsQuery();
    const workflows = query.data ?? [];
    const [selectedId, setSelectedId] = useState<string | null>(workflows[0]?.id ?? null);
    const selectedWorkflow = useMemo(
      () => workflows.find((workflow) => workflow.id === selectedId) ?? workflows[0] ?? null,
      [selectedId, workflows],
    );

    return (
      <FeatureScaffold title="Workflow Cockpit" summary="工作流 DAG、步骤和恢复基线视图" status="Implemented/Internal">
        <ThreePaneLayout
          left={(
            <div>
              <h3>Workflow List</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {workflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    onClick={() => {
                      setSelectedId(workflow.id);
                    }}
                    style={{ textAlign: "left", background: workflow.id === selectedWorkflow?.id ? "#12201a" : "transparent", color: "inherit", border: "1px solid #334155", borderRadius: 12, padding: 12 }}
                    type="button"
                  >
                    <strong>{workflow.title}</strong>
                    <div>{workflow.status} · {workflow.currentStage}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          center={selectedWorkflow == null ? <p>No workflow selected</p> : (
            <div>
              <h3>DAG / Stage Detail</h3>
              <KeyValueTable
                rows={[
                  { key: "Workflow", value: selectedWorkflow.title },
                  { key: "Owner", value: selectedWorkflow.owner },
                  { key: "Status", value: selectedWorkflow.status },
                  { key: "Stage", value: selectedWorkflow.currentStage },
                  { key: "Steps", value: String(selectedWorkflow.steps.length) },
                ]}
              />
            </div>
          )}
          right={selectedWorkflow == null ? <p>No steps</p> : (
            <div>
              <h3>OAPEFLIR Step Rail</h3>
              <ListCard
                items={selectedWorkflow.steps.map((step) => ({
                  title: `${step.phase} · ${step.title}`,
                  description: step.status,
                }))}
              />
            </div>
          )}
        />
      </FeatureScaffold>
    );
  },
});
