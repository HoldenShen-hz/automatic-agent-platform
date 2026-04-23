import type { ReactElement } from "react";
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

export function FlowCanvas({ nodes, edges }: FlowCanvasProps): ReactElement {
  return (
    <ReactFlow fitView edges={[...edges]} nodes={[...nodes]}>
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
