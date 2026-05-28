import { memo, useMemo, type ReactElement } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

export interface FlowCanvasProps {
  readonly nodes: readonly {
    readonly id: string;
    readonly position: { readonly x: number; readonly y: number };
    readonly data: { readonly label: string };
    readonly type: "default";
  }[];
  readonly edges: readonly {
    readonly id: string;
    readonly source: string;
    readonly target: string;
  }[];
}

export const FlowCanvas = memo(function FlowCanvas({ nodes, edges }: FlowCanvasProps): ReactElement {
  const resolvedNodes = useMemo(() => Array.from(nodes), [nodes]);
  const resolvedEdges = useMemo(() => Array.from(edges), [edges]);

  return (
    <ReactFlow fitView edges={resolvedEdges} nodes={resolvedNodes}>
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
});
