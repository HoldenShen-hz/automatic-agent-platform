import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard } from "@aa/ui-core";
import { useWorkflowCockpitVm } from "../hooks";
import { DAGViewer } from "./dag-viewer";

export function WorkflowCockpitWebView(): ReactElement {
  const vm = useWorkflowCockpitVm();
  const selectedWorkflow = vm.selectedWorkflow;

  const handleRelease = () => {
    if (selectedWorkflow != null && window.confirm(`Release workflow "${selectedWorkflow.title}"? This action cannot be undone.`)) {
      vm.releaseWorkflow();
    }
  };

  const handlePause = () => {
    if (selectedWorkflow != null && window.confirm(`Pause workflow "${selectedWorkflow.title}"?`)) {
      vm.pauseWorkflow();
    }
  };

  const handleResume = () => {
    if (selectedWorkflow != null && window.confirm(`Resume workflow "${selectedWorkflow.title}"? This will continue execution from the current checkpoint.`)) {
      vm.resumeWorkflow();
    }
  };

  const handleRecover = () => {
    if (selectedWorkflow != null && window.confirm(`Recover workflow "${selectedWorkflow.title}"? This will rebuild state and replay the workflow.`)) {
      vm.recoverWorkflow();
    }
  };

  return (
    <FeatureScaffold title="Workflow Cockpit" summary="工作流 DAG、步骤和恢复基线视图" status="Implemented/Internal">
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
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
        <div style={{ display: "grid", gap: 16 }}>
          <h3>DAG / Stage Detail</h3>
          {selectedWorkflow != null && (
            <>
              <KeyValueTable
                rows={[
                  { key: "Workflow", value: selectedWorkflow.title },
                  { key: "Owner", value: selectedWorkflow.owner },
                  { key: "Status", value: selectedWorkflow.status },
                  { key: "Stage", value: selectedWorkflow.currentStage },
                  { key: "Steps", value: String(selectedWorkflow.steps.length) },
                  { key: "Approval Nodes", value: String(selectedWorkflow.approvalNodes?.length ?? 0) },
                  { key: "Evidence Refs", value: String(selectedWorkflow.evidenceRefs?.length ?? 0) },
                ]}
              />
              {/* §2497: DAGViewer replaces static ListCard for L2 OAPEFLIR stage rail */}
              <DAGViewer steps={selectedWorkflow.steps} currentStage={selectedWorkflow.currentStage} />
              {selectedWorkflow.approvalNodes != null && selectedWorkflow.approvalNodes.length > 0 && (
                <ListCard
                  items={selectedWorkflow.approvalNodes.map((node) => ({
                    title: node.title,
                    description: `${node.status}${node.assignee ? ` · ${node.assignee}` : ""}`,
                  }))}
                />
              )}
              {selectedWorkflow.evidenceRefs != null && selectedWorkflow.evidenceRefs.length > 0 && (
                <ListCard
                  items={selectedWorkflow.evidenceRefs.map((ref) => ({
                    title: ref.type,
                    description: ref.description ?? ref.uri,
                  }))}
                />
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={handlePause} type="button">Pause</button>
                <button onClick={handleResume} type="button">Resume</button>
                <button onClick={handleRecover} type="button">Recover</button>
                <button onClick={handleRelease} type="button">Release</button>
              </div>
            </>
          )}
        </div>
      </div>
    </FeatureScaffold>
  );
}
