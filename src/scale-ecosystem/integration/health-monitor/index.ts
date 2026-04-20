import { z } from "zod";

export const ConnectorHealthReportSchema = z.object({
  connectorId: z.string().min(1),
  status: z.enum(["healthy", "degraded", "failed"]),
  latencyMs: z.number().nonnegative(),
  checkedAt: z.string().min(1),
});

export type ConnectorHealthReport = z.infer<typeof ConnectorHealthReportSchema>;

export function summarizeConnectorHealth(reports: readonly ConnectorHealthReport[]): "healthy" | "degraded" | "failed" {
  if (reports.some((item) => item.status === "failed")) {
    return "failed";
  }
  if (reports.some((item) => item.status === "degraded")) {
    return "degraded";
  }
  return "healthy";
}
