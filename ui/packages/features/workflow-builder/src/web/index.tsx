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
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
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
