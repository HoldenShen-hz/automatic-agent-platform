export interface InspectVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useInspectVm(): InspectVm {
  return {
    items: [
      { title: "Operator Snapshot", description: "查看当前上下文、指令和状态快照。" },
      { title: "Tool Trace", description: "定位最近工具调用与输出。" },
      { title: "Evidence Chain", description: "回看证据、事件和时间线。" },
    ],
  };
}
