import { Suspense, lazy, type ReactElement } from "react";
import { FeatureScaffold, ListCard, designTokens } from "@aa/ui-core";
import { useWorkflowBuilderVm } from "../hooks";
import type { FlowCanvasProps } from "./flow-canvas";

const LazyFlowCanvas = lazy(async () => import("./flow-canvas").then((module) => ({ default: module.FlowCanvas })));

export function WorkflowBuilderWebView(): ReactElement {
  const vm = useWorkflowBuilderVm();
  const nodes: FlowCanvasProps["nodes"] = [
    { id: "observe", position: { x: 0, y: 20 }, data: { label: "Observe" }, type: "default" },
    { id: "plan", position: { x: 180, y: 20 }, data: { label: "Plan" }, type: "default" },
    { id: "execute", position: { x: 360, y: 20 }, data: { label: "Execute" }, type: "default" },
  ];
  const edges: FlowCanvasProps["edges"] = [
    { id: "e1", source: "observe", target: "plan" },
    { id: "e2", source: "plan", target: "execute" },
  ];
  return (
    <FeatureScaffold title="Workflow Builder" summary="可视化工作流构建器" status="Planned">
      <div style={{ height: 280, marginBottom: 16, border: `1px solid ${designTokens.color.border}`, borderRadius: 12, overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 16 }}>正在加载工作流画布...</div>}>
          <LazyFlowCanvas edges={edges} nodes={nodes} />
        </Suspense>
      </div>
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
