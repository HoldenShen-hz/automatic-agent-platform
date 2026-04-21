export interface OpsHealthProbe {
  readonly component: string;
  readonly status: "healthy" | "degraded" | "failed";
}

export function summarizeOpsHealth(probes: readonly OpsHealthProbe[]): "healthy" | "degraded" | "failed" {
  if (probes.some((item) => item.status === "failed")) return "failed";
  if (probes.some((item) => item.status === "degraded")) return "degraded";
  return "healthy";
}