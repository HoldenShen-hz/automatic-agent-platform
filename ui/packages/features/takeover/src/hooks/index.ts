export interface TakeoverVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useTakeoverVm(): TakeoverVm {
  return {
    items: [
      { title: "Manual Takeover", description: "切换执行到人工接管模式并记录理由。" },
      { title: "Override Actions", description: "执行人工覆盖、取消或重排。" },
      { title: "Resume Control", description: "完成接管后选择恢复模式继续执行。" },
    ],
  };
}
