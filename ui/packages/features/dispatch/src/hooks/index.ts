export interface DispatchVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useDispatchVm(): DispatchVm {
  return {
    items: [
      { title: "Dispatch Queue", description: "发起和重排 execution dispatch。" },
      { title: "Operator Actions", description: "人工触发 replay、repair 和 reroute。" },
      { title: "Escalation", description: "高风险任务进入人工监管和审批联动。" },
    ],
  };
}
