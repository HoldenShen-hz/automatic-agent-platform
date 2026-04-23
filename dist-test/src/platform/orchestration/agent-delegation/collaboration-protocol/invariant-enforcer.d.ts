import type { PermissionSet } from "../delegation-types.js";
import type { ACPMessage } from "./types.js";
export interface InvariantContext {
    readonly parentPermissions: PermissionSet;
    readonly parentRiskMode: number;
    readonly parentConstraints: Record<string, unknown>;
    readonly parentBudgetRemaining: number;
    readonly globalCallDepth: number;
}
export declare class ACPInvariantEnforcer {
    checkPermissionSubset(child: PermissionSet, parent: PermissionSet): boolean;
    checkRiskNotEscalated(childRisk: number, parentRisk: number): boolean;
    checkConstraintNotRelaxed(childConstraints: Record<string, unknown>, parentConstraints: Record<string, unknown>): boolean;
    checkCompletionHasEvidence(message: ACPMessage): boolean;
    checkTakeoverAudit(message: ACPMessage): boolean;
    checkBudgetNotExceeded(childBudget: number, parentBudget: number): boolean;
    checkDepthLimit(depth: number, maxDepth: number): boolean;
    enforceAll(message: ACPMessage, context: InvariantContext): {
        passed: boolean;
        violations: string[];
    };
}
