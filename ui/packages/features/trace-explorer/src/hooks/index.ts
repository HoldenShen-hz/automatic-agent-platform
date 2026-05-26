export interface TraceExplorerVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useTraceExplorerVm(): TraceExplorerVm {
  return {
    items: [
      { title: "Trace Timeline", description: "按 traceId 查看 receipt、approval、tool 和 memory 关键事件。" },
      { title: "Restricted Trace Access", description: "展示受限 trace 的权限说明与审计轨迹。" },
      { title: "Receipt Correlation", description: "关联 outbox、receipt、artifact 和 diagnostics export。" },
    ],
  };
}
