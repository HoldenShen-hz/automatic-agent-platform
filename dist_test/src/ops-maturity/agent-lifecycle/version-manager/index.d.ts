import { z } from "zod";
/**
 * Component snapshot for version tracking.
 * As defined in architecture doc §61.2.
 */
export declare const ComponentSnapshotSchema: z.ZodObject<{
    packVersion: z.ZodString;
    promptBundleVersion: z.ZodString;
    modelBindingHash: z.ZodString;
    trustProfileHash: z.ZodString;
    triggerSetHash: z.ZodString;
    autonomyConfigHash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    packVersion: string;
    promptBundleVersion: string;
    modelBindingHash: string;
    trustProfileHash: string;
    triggerSetHash: string;
    autonomyConfigHash: string;
}, {
    packVersion: string;
    promptBundleVersion: string;
    modelBindingHash: string;
    trustProfileHash: string;
    triggerSetHash: string;
    autonomyConfigHash: string;
}>;
/**
 * Agent version snapshot - immutable record of agent components at a point in time.
 * As defined in architecture doc §61.2.
 */
export declare const AgentVersionSchema: z.ZodObject<{
    versionId: z.ZodString;
    agentId: z.ZodString;
    semver: z.ZodString;
    componentSnapshot: z.ZodObject<{
        packVersion: z.ZodString;
        promptBundleVersion: z.ZodString;
        modelBindingHash: z.ZodString;
        trustProfileHash: z.ZodString;
        triggerSetHash: z.ZodString;
        autonomyConfigHash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        packVersion: string;
        promptBundleVersion: string;
        modelBindingHash: string;
        trustProfileHash: string;
        triggerSetHash: string;
        autonomyConfigHash: string;
    }, {
        packVersion: string;
        promptBundleVersion: string;
        modelBindingHash: string;
        trustProfileHash: string;
        triggerSetHash: string;
        autonomyConfigHash: string;
    }>;
    createdAt: z.ZodString;
    createdBy: z.ZodString;
    releaseNote: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    agentId: string;
    versionId: string;
    semver: string;
    componentSnapshot: {
        packVersion: string;
        promptBundleVersion: string;
        modelBindingHash: string;
        trustProfileHash: string;
        triggerSetHash: string;
        autonomyConfigHash: string;
    };
    createdBy: string;
    releaseNote: string;
}, {
    createdAt: string;
    agentId: string;
    versionId: string;
    semver: string;
    componentSnapshot: {
        packVersion: string;
        promptBundleVersion: string;
        modelBindingHash: string;
        trustProfileHash: string;
        triggerSetHash: string;
        autonomyConfigHash: string;
    };
    createdBy: string;
    releaseNote?: string | undefined;
}>;
export type AgentVersion = z.infer<typeof AgentVersionSchema>;
export declare function resolveLatestAgentVersion(versions: readonly AgentVersion[]): AgentVersion | null;
/**
 * Parses a semver string into components.
 */
export declare function parseSemver(semver: string): {
    major: number;
    minor: number;
    patch: number;
} | null;
/**
 * Compares two semver strings.
 * Returns negative if left < right, 0 if equal, positive if left > right.
 */
export declare function compareSemver(left: string, right: string): number;
