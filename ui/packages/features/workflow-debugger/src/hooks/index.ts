export interface WorkflowDebuggerVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useWorkflowDebuggerVm(): WorkflowDebuggerVm {
  return {
    items: [
      { title: "Execution Timeline", description: "只读时间线回放已留 seam，后续接 DebuggerService 流。" },
      { title: "OAPEFLIR Step In", description: "逐阶段面板与数据流视图已预留结构。" },
      { title: "Time Travel", description: "保持 planned 状态，等待后端调试端点稳定。" },
    ],
  };
}
