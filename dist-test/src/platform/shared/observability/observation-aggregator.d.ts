import { z } from "zod";
import type { TaskSituation } from "../../orchestration/oapeflir/types/task-situation.js";
import type { SystemSituation } from "./system-situation-model.js";
/**
 * UnifiedObservation — the single output surface of the Observe stage.
 * Combines task-level (TaskSituation) and system-level (SystemSituation) observations
 * into one DTO consumed by the Assess stage.
 *
 * §3 defines ObservationAggregator as the sole exit point from Observe.
 */
export interface UnifiedObservation {
    task: TaskSituation;
    system: SystemSituation;
    observedAt: number;
}
/**
 * Zod schema for UnifiedObservation — validates the aggregated output.
 */
export declare const UnifiedObservationSchema: z.ZodObject<{
    task: z.ZodUnknown;
    system: z.ZodObject<{
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
    observedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    system: {
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
    };
    observedAt: number;
    task?: unknown;
}, {
    system: {
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
    };
    observedAt: number;
    task?: unknown;
}>;
/**
 * ObservationAggregator — merges TaskSituation and SystemSituation into
 * a UnifiedObservation that serves as the canonical Observe stage output.
 *
 * §3: "ObservationAggregator — 统一观测层 — 唯一出口"
 *
 * R2 §L.5 enforcement:
 * - Input objects are scanned for blacklisted fields; if any are found they are stripped
 *   and a warning is logged (fail-open to maintain availability).
 * - This guarantees the Assess stage cannot receive recommendation-type fields from Observe.
 */
export declare class ObservationAggregator {
    /**
     * Aggregate task-level and system-level observations into a UnifiedObservation.
     * Enforces R2 whitelist/blacklist by stripping any blacklisted fields found in the input.
     */
    aggregate(taskSituation: TaskSituation, systemSituation: SystemSituation): UnifiedObservation;
    /**
     * Recursively strip blacklisted fields from an object.
     * Blacklisted keys are removed; whitelisted keys are preserved.
     * Logs a warning for each blacklisted field found.
     */
    private stripBlacklistedFields;
}
