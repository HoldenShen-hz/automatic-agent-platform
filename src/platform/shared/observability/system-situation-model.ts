import { z } from "zod";

/**
 * SystemSituation — aggregated system-level health and resource state.
 * Complements TaskSituation (task-level) with system-level observability.
 *
 * §3 defines SystemSituation as part of the 8-dimensional observation model.
 */
export const SystemSituationSchema = z.object({
  healthStatus: z.enum(["ok", "degraded", "overloaded", "unhealthy"]),
  providerHealth: z
    .object({
      status: z.enum(["healthy", "degraded", "failed"]),
      successRate: z.number().min(0).max(1),
      recentCalls: z.number().int().nonnegative(),
    })
    .default({ status: "healthy", successRate: 1, recentCalls: 0 }),
  resourceUtilization: z
    .object({
      memoryRssMb: z.number().nonnegative(),
      cpuPercent: z.number().nonnegative().optional(),
      activeProcesses: z.number().int().nonnegative(),
    })
    .default({ memoryRssMb: 0, activeProcesses: 0 }),
  queueBacklog: z
    .object({
      size: z.number().int().nonnegative(),
      degraded: z.boolean().default(false),
    })
    .default({ size: 0, degraded: false }),
  eventBusBacklog: z
    .object({
      tier1PendingAcks: z.number().int().nonnegative(),
    })
    .default({ tier1PendingAcks: 0 }),
  findings: z.array(z.string()).default([]),
  observedAt: z.number().int().nonnegative(),
});

export type SystemSituation = z.infer<typeof SystemSituationSchema>;

export function parseSystemSituation(input: unknown): SystemSituation {
  return SystemSituationSchema.parse(input);
}
