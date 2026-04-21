import { z } from "zod";
/**
 * SystemSituation — aggregated system-level health and resource state.
 * Complements TaskSituation (task-level) with system-level observability.
 *
 * §3 defines SystemSituation as part of the 8-dimensional observation model.
 */
export declare const SystemSituationSchema: z.ZodObject<{
    healthStatus: z.ZodEnum<["ok", "degraded", "overloaded", "unhealthy"]>;
    providerHealth: z.ZodDefault<z.ZodObject<{
        status: z.ZodEnum<["healthy", "degraded", "failed"]>;
        successRate: z.ZodNumber;
        recentCalls: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "failed" | "degraded" | "healthy";
        successRate: number;
        recentCalls: number;
    }, {
        status: "failed" | "degraded" | "healthy";
        successRate: number;
        recentCalls: number;
    }>>;
    resourceUtilization: z.ZodDefault<z.ZodObject<{
        memoryRssMb: z.ZodNumber;
        cpuPercent: z.ZodOptional<z.ZodNumber>;
        activeProcesses: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        memoryRssMb: number;
        activeProcesses: number;
        cpuPercent?: number | undefined;
    }, {
        memoryRssMb: number;
        activeProcesses: number;
        cpuPercent?: number | undefined;
    }>>;
    queueBacklog: z.ZodDefault<z.ZodObject<{
        size: z.ZodNumber;
        degraded: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        degraded: boolean;
        size: number;
    }, {
        size: number;
        degraded?: boolean | undefined;
    }>>;
    eventBusBacklog: z.ZodDefault<z.ZodObject<{
        tier1PendingAcks: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tier1PendingAcks: number;
    }, {
        tier1PendingAcks: number;
    }>>;
    findings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    observedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    observedAt: number;
    findings: string[];
    healthStatus: "degraded" | "ok" | "overloaded" | "unhealthy";
    providerHealth: {
        status: "failed" | "degraded" | "healthy";
        successRate: number;
        recentCalls: number;
    };
    resourceUtilization: {
        memoryRssMb: number;
        activeProcesses: number;
        cpuPercent?: number | undefined;
    };
    queueBacklog: {
        degraded: boolean;
        size: number;
    };
    eventBusBacklog: {
        tier1PendingAcks: number;
    };
}, {
    observedAt: number;
    healthStatus: "degraded" | "ok" | "overloaded" | "unhealthy";
    findings?: string[] | undefined;
    providerHealth?: {
        status: "failed" | "degraded" | "healthy";
        successRate: number;
        recentCalls: number;
    } | undefined;
    resourceUtilization?: {
        memoryRssMb: number;
        activeProcesses: number;
        cpuPercent?: number | undefined;
    } | undefined;
    queueBacklog?: {
        size: number;
        degraded?: boolean | undefined;
    } | undefined;
    eventBusBacklog?: {
        tier1PendingAcks: number;
    } | undefined;
}>;
export type SystemSituation = z.infer<typeof SystemSituationSchema>;
export declare function parseSystemSituation(input: unknown): SystemSituation;
