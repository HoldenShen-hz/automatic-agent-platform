import { z } from "zod";
export const ConnectorHealthReportSchema = z.object({
    connectorId: z.string().min(1),
    status: z.enum(["healthy", "degraded", "failed"]),
    latencyMs: z.number().nonnegative(),
    checkedAt: z.string().min(1),
});
export function summarizeConnectorHealth(reports) {
    if (reports.some((item) => item.status === "failed")) {
        return "failed";
    }
    if (reports.some((item) => item.status === "degraded")) {
        return "degraded";
    }
    return "healthy";
}
//# sourceMappingURL=index.js.map