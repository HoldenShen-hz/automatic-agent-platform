import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, designTokens } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useWorkflowCockpitVm } from "../hooks";
import { DAGViewer } from "./dag-viewer";

export function WorkflowCockpitWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("workflow-cockpit");
  const vm = useWorkflowCockpitVm();
  const selectedWorkflow = vm.selectedWorkflow;

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <div style={{ display: "grid", gap: 24 }}>
        <div>
          <h3>{translateMessage("ui.workflowCockpit.listTitle")}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {vm.listItems.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => {
                  vm.selectWorkflow(workflow.id);
                }}
                style={{
                  textAlign: "left",
                  background: workflow.id === selectedWorkflow?.id ? designTokens.semantic.color.surfaceSelected : "transparent",
                  color: "inherit",
                  border: `1px solid ${designTokens.color.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
                type="button"
              >
                <strong>{workflow.title}</strong>
                <div>{workflow.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
        {selectedWorkflow == null ? <p>{translateMessage("ui.workflowCockpit.noWorkflow")}</p> : (
          <div style={{ display: "grid", gap: 16 }}>
            <h3>{translateMessage("ui.workflowCockpit.dagDetailTitle")}</h3>
            <KeyValueTable
              rows={[
                { key: translateMessage("ui.workflowCockpit.field.workflow"), value: selectedWorkflow.title },
                { key: translateMessage("ui.workflowCockpit.field.owner"), value: selectedWorkflow.owner },
                { key: translateMessage("ui.workflowCockpit.field.status"), value: selectedWorkflow.status },
                { key: translateMessage("ui.workflowCockpit.field.stage"), value: selectedWorkflow.currentStage },
                { key: translateMessage("ui.workflowCockpit.field.steps"), value: String(selectedWorkflow.steps.length) },
                { key: translateMessage("ui.workflowCockpit.field.approvalCount"), value: String(selectedWorkflow.approvalNodes?.length ?? 0) },
                { key: translateMessage("ui.workflowCockpit.field.evidenceCount"), value: String(selectedWorkflow.evidenceRefs?.length ?? 0) },
              ]}
            />
            <DAGViewer currentStage={selectedWorkflow.currentStage} steps={selectedWorkflow.steps} />
            {(selectedWorkflow.approvalNodes?.length ?? 0) > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <strong>{`${translateMessage("ui.workflowCockpit.approvalNodes")}: ${selectedWorkflow.approvalNodes?.length ?? 0}`}</strong>
                {selectedWorkflow.approvalNodes?.map((node) => (
                  <div key={node.nodeId}>{`${node.title} ${node.status}${node.assignee != null ? ` · ${node.assignee}` : ""}`}</div>
                ))}
              </div>
            )}
            {(selectedWorkflow.evidenceRefs?.length ?? 0) > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <strong>{`${translateMessage("ui.workflowCockpit.evidenceRefs")}: ${selectedWorkflow.evidenceRefs?.length ?? 0}`}</strong>
                {selectedWorkflow.evidenceRefs?.map((reference) => (
                  <div key={reference.refId}>{`${reference.type} ${reference.description ?? reference.uri}`}</div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={vm.cancelWorkflow} type="button">{translateMessage("ui.workflowCockpit.cancel")}</button>
              <button onClick={vm.pauseWorkflow} type="button">{translateMessage("ui.workflowCockpit.pause")}</button>
              <button onClick={vm.resumeWorkflow} type="button">{translateMessage("ui.workflowCockpit.resume")}</button>
              <button onClick={vm.recoverWorkflow} type="button">{translateMessage("ui.workflowCockpit.recover")}</button>
              <button onClick={vm.releaseWorkflow} type="button">{translateMessage("ui.workflowCockpit.release")}</button>
            </div>
          </div>
        )}
        {selectedWorkflow == null ? <p>{translateMessage("ui.workflowCockpit.noSteps")}</p> : (
          <div>
            <h3>{translateMessage("ui.workflowCockpit.stepRail")}</h3>
            <ListCard
              items={(vm.activityItems?.length ?? 0) > 0 ? vm.activityItems : selectedWorkflow.steps.map((step) => ({
                title: `${step.phase} · ${step.title}`,
                description: step.status,
              }))}
            />
          </div>
        )}
      </div>
    </FeatureScaffold>
  );
}
