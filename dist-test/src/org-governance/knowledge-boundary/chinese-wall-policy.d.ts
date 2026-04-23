export interface ChineseWallPolicy {
    readonly policyId: string;
    readonly conflictGroups: Readonly<Record<string, readonly string[]>>;
}
export interface ChineseWallDecision {
    readonly allowed: boolean;
    readonly blockedGroupId: string | null;
    readonly reasonCodes: readonly string[];
}
export declare function evaluateChineseWallPolicy(policy: ChineseWallPolicy, requesterOrgNodeId: string, targetOrgNodeId: string): ChineseWallDecision;
