export interface WorkflowBuilderVm {
  readonly items: readonly { title: string; description: string }[];
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

export function useWorkflowBuilderVm(): WorkflowBuilderVm {
  return {
    nodes: [
      { id: "observe", position: { x: 0, y: 20 }, data: { label: "观察" }, type: "default" },
      { id: "assess", position: { x: 180, y: 20 }, data: { label: "评估" }, type: "default" },
      { id: "plan", position: { x: 360, y: 20 }, data: { label: "规划" }, type: "default" },
      { id: "execute", position: { x: 540, y: 20 }, data: { label: "执行" }, type: "default" },
      { id: "feedback", position: { x: 720, y: 20 }, data: { label: "反馈" }, type: "default" },
    ],
    edges: [
      { id: "o-a", source: "observe", target: "assess" },
      { id: "a-p", source: "assess", target: "plan" },
      { id: "p-e", source: "plan", target: "execute" },
      { id: "e-f", source: "execute", target: "feedback" },
    ],
    items: [
      { title: "节点编排", description: "当前画布由 OAPEF 主链生成，后续将接入后端计划图和持久化模型。" },
      { title: "画布能力", description: "React Flow 画布已接线，后续补齐拖拽、连线校验和发布动作。" },
      { title: "校验闸门", description: "Schema、策略和运行时校验将作为同一发布前闸门收敛展示。" },
    ],
  };
}
