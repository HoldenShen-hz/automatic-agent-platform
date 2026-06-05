import { Suspense, lazy, type ReactElement } from "react";
import { FeatureScaffold, ListCard, designTokens } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useWorkflowBuilderVm } from "../hooks";
import type { FlowCanvasProps } from "./flow-canvas";

const LazyFlowCanvas = lazy(async () => import("./flow-canvas").then((module) => ({ default: module.FlowCanvas })));

export function WorkflowBuilderWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("workflow-builder");
  const vm = useWorkflowBuilderVm();
  const nodes: FlowCanvasProps["nodes"] = vm.nodes;
  const edges: FlowCanvasProps["edges"] = vm.edges;
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <section
        style={{
          display: "grid",
          gap: 12,
          marginBottom: 16,
          padding: 16,
          border: `1px solid ${designTokens.color.border}`,
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button disabled={vm.isMutating} onClick={() => void vm.createDraft()} type="button">Create Draft</button>
          <button disabled={!vm.canSave} onClick={() => void vm.saveDraft()} type="button">Save Draft</button>
          <button disabled={!vm.canDelete} onClick={() => void vm.deleteDraft()} type="button">Delete Draft</button>
        </div>
        <label style={{ display: "grid", gap: 8 }}>
          <span>Draft Title</span>
          <input
            onChange={(event) => vm.setDraftTitle(event.target.value)}
            placeholder="Workflow draft"
            type="text"
            value={vm.draftTitle}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {vm.drafts.length === 0
            ? <span>{translateMessage("ui.workflowBuilder.empty.description")}</span>
            : vm.drafts.map((draft) => (
                <button
                  key={draft.draftId}
                  onClick={() => vm.setSelectedDraftId(draft.draftId)}
                  style={{
                    border: `1px solid ${designTokens.color.border}`,
                    background: draft.draftId === vm.selectedDraftId ? designTokens.color.surfaceSelected : designTokens.color.surface,
                    padding: "8px 12px",
                    borderRadius: 999,
                  }}
                  type="button"
                >
                  {draft.title}
                </button>
              ))}
        </div>
        {vm.statusMessage == null ? null : <div role="status">{vm.statusMessage}</div>}
        {vm.validationMessages.length === 0 ? null : (
          <div aria-label="workflow-builder-validation">
            {vm.validationMessages.map((message) => <div key={message}>{message}</div>)}
          </div>
        )}
      </section>
      <div
        style={{
          minHeight: 360,
          height: "clamp(360px, 55vh, 560px)",
          marginBottom: 16,
          border: `1px solid ${designTokens.color.border}`,
          borderRadius: 12,
          overflow: "visible",
        }}
      >
        <Suspense fallback={<div style={{ padding: 16 }}>{translateMessage("ui.workflowBuilder.canvas.loading")}</div>}>
          {nodes.length === 0
            ? <div role="status" style={{ padding: 16 }}>{translateMessage("ui.workflowBuilder.canvas.empty")}</div>
            : <LazyFlowCanvas edges={edges} nodes={nodes} />}
        </Suspense>
      </div>
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
