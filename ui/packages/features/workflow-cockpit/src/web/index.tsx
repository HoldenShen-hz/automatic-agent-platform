import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useWorkflowCockpitVm } from "../hooks";

export function WorkflowCockpitWebView(): ReactElement {
  const vm = useWorkflowCockpitVm();
  const selectedWorkflow = vm.selectedWorkflow;

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
                    vm.selectWorkflow(workflow.id);
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
          <div style={{ display: "grid", gap: 16 }}>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={vm.pauseWorkflow} type="button">Pause</button>
              <button onClick={vm.resumeWorkflow} type="button">Resume</button>
              <button onClick={vm.recoverWorkflow} type="button">Recover</button>
              <button onClick={vm.releaseWorkflow} type="button">Release</button>
            </div>
          </div>
        )}
        right={selectedWorkflow == null ? <p>No steps</p> : (
          <div>
            <h3>OAPEFLIR Step Rail</h3>
            <ListCard
              items={vm.activityItems.length > 0 ? vm.activityItems : selectedWorkflow.steps.map((step) => ({
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
