/**
 * @fileoverview Agent Version Manager with Blue-Green Deployment
 *
 * Provides:
 * - Multi-version registry for agents (v1, v2, v3 coexisting)
 * - Blue-green deployment slot management
 * - Version stability and deprecation tracking
 * - Version comparison and compatibility checking
 *
 * §61 Agent 生命周期 - Agent 版本管理 + 蓝绿部署
 */
import { z } from "zod";
export declare const AgentVersionStageSchema: z.ZodEnum<["stable", "canary", "beta", "alpha"]>;
export declare const DeploymentSlotSchema: z.ZodEnum<["blue", "green"]>;
export type AgentVersionStage = z.infer<typeof AgentVersionStageSchema>;
export type DeploymentSlot = z.infer<typeof DeploymentSlotSchema>;
export declare const AgentVersionDetailSchema: z.ZodObject<{
    versionId: z.ZodString;
    agentId: z.ZodString;
    version: z.ZodString;
    stage: z.ZodDefault<z.ZodEnum<["stable", "canary", "beta", "alpha"]>>;
    createdAt: z.ZodString;
    deprecatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    stable: z.ZodDefault<z.ZodBoolean>;
    deploymentSlot: z.ZodDefault<z.ZodNullable<z.ZodEnum<["blue", "green"]>>>;
    changelog: z.ZodDefault<z.ZodString>;
    metrics: z.ZodDefault<z.ZodObject<{
        totalExecutions: z.ZodDefault<z.ZodNumber>;
        successRate: z.ZodDefault<z.ZodNumber>;
        avgDurationMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        successRate: number;
        totalExecutions: number;
        avgDurationMs: number;
    }, {
        successRate?: number | undefined;
        totalExecutions?: number | undefined;
        avgDurationMs?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    agentId: string;
    version: string;
    stage: "canary" | "stable" | "beta" | "alpha";
    metrics: {
        successRate: number;
        totalExecutions: number;
        avgDurationMs: number;
    };
    deprecatedAt: string | null;
    stable: boolean;
    versionId: string;
    deploymentSlot: "blue" | "green" | null;
    changelog: string;
}, {
    createdAt: string;
    agentId: string;
    version: string;
    versionId: string;
    stage?: "canary" | "stable" | "beta" | "alpha" | undefined;
    metrics?: {
        successRate?: number | undefined;
        totalExecutions?: number | undefined;
        avgDurationMs?: number | undefined;
    } | undefined;
    deprecatedAt?: string | null | undefined;
    stable?: boolean | undefined;
    deploymentSlot?: "blue" | "green" | null | undefined;
    changelog?: string | undefined;
}>;
export type AgentVersionDetail = z.infer<typeof AgentVersionDetailSchema>;
export interface AgentVersionConflict {
    agentId: string;
    conflictingVersions: string[];
    reason: string;
}
export declare class AgentVersionManager {
    private readonly versions;
    private readonly slotAssignments;
    registerVersion(detail: Omit<AgentVersionDetail, "versionId" | "createdAt">): AgentVersionDetail;
    assignDeploymentSlot(agentId: string, versionId: string, slot: DeploymentSlot): void;
    getActiveSlot(agentId: string, slot: DeploymentSlot): AgentVersionDetail | null;
    switchSlot(agentId: string, targetSlot: DeploymentSlot): AgentVersionDetail | null;
    listVersions(agentId: string): AgentVersionDetail[];
    getStableVersions(agentId: string): AgentVersionDetail[];
    deprecateVersion(agentId: string, versionId: string): boolean;
    updateMetrics(agentId: string, versionId: string, metrics: Partial<AgentVersionDetail["metrics"]>): void;
}
