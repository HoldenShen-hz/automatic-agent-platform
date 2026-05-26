export interface ReleaseConsoleVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useReleaseConsoleVm(): ReleaseConsoleVm {
  return {
    items: [
      { title: "Manifest Draft Queue", description: "查看待发布 artifact 的 manifest、依赖和回滚计划状态。" },
      { title: "Stable Gate Verdict", description: "聚合 release gate、evidence bundle 和 rollback readiness。" },
      { title: "Promotion Timeline", description: "追踪 canary / tenant gray / production promotion 进度。" },
    ],
  };
}
