import { useMemo, useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useWorkflowCockpitVm } from "../hooks";

export function WorkflowCockpitWebView(): ReactElement {
  const vm = useWorkflowCockpitVm();
  const [selectedId, setSelectedId] = useState<string | null>(vm.workflows[0]?.id ?? null);
  const selectedWorkflow = useMemo(
    () => vm.workflows.find((workflow) => workflow.id === selectedId) ?? vm.workflows[0] ?? null,
    [selectedId, vm.workflows],
  );

  return (
    <FeatureScaffold title="Workflow Cockpit" summary="工作流 DAG、步骤和恢复基线视图" status="Implemented/Internal">
      <ThreePaneLayout
        left={(
          <div>
            <h3>Workflow List</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {vm.listItems.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => {
                    setSelectedId(workflow.id);
                  }}
                  style={{ textAlign: "left", background: workflow.id === selectedWorkflow?.id ? "#12201a" : "transparent", color: "inherit", border: "1px solid #334155", borderRadius: 12, padding: 12 }}
                  type="button"
                >
                  <strong>{workflow.title}</strong>
                  <div>{workflow.subtitle}</div>
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
}
