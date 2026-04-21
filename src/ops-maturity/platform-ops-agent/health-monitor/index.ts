export interface OpsHealthProbe {
  readonly component: string;
  readonly status: "healthy" | "degraded" | "failed";
  readonly latencyMs?: number;
}

export function summarizeOpsHealth(probes: readonly OpsHealthProbe[]): "healthy" | "degraded" | "failed" {
  if (probes.some((item) => item.status === "failed")) return "failed";
  if (probes.some((item) => item.status === "degraded")) return "degraded";
  return "healthy";
}

export function findUnhealthyComponents(probes: readonly OpsHealthProbe[]): string[] {
  return probes.filter((item) => item.status !== "healthy").map((item) => item.component);
}
