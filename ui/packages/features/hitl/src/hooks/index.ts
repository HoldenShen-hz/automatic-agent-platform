export interface HitlVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useHitlVm(): HitlVm {
  return {
    items: [
      { title: "Inspect", description: "查看当前 PlanBundle、Context 和执行状态。" },
      { title: "Takeover", description: "接管执行并写入人工操作记录。" },
      { title: "Resume", description: "支持 normal、replan、supervised、abort 四种恢复模式。" },
    ],
  };
}
