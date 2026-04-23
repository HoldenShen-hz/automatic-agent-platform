/**
 * Declarative Approval Policy Types
 *
 * Defines a JSON-based rule format for approval policies that can be
 * versioned and managed through an approval workflow.
 *
 * ## Rule Format
 *
 * Rules are declarative JSON objects that match conditions against
 * policy decision requests and specify approval requirements.
 *
 * ## Version Management
 *
 * Each policy bundle has a version identifier. Changes to policies
 * require going through an approval workflow before becoming active.
 */
/**
 * Default approval policy bundle.
 */
export const DEFAULT_APPROVAL_POLICY_BUNDLE = {
    bundleId: "default-approval-policies",
    version: "1.0.0",
    name: "Default Approval Policies",
    description: "Default approval policies based on risk categories",
    enabled: true,
    rules: [
        {
            ruleId: "destructive-high-risk",
            description: "Destructive actions in supervised mode require approval",
            priority: 100,
            enabled: true,
            conditions: [
                { field: "riskCategory", operator: "eq", value: "destructive" },
                { field: "mode", operator: "eq", value: "supervised" },
            ],
            conditionLogic: "and",
            action: "require_approval",
            timeoutPolicy: "reject",
            tags: ["risk", "destructive"],
        },
        {
            ruleId: "prod-affecting-approval",
            description: "Production-affecting actions always require approval",
            priority: 90,
            enabled: true,
            conditions: [
                { field: "riskCategory", operator: "eq", value: "prod_affecting" },
            ],
            conditionLogic: "and",
            action: "require_approval",
            timeoutPolicy: "reject",
            tags: ["risk", "production"],
        },
        {
            ruleId: "org-change-approval",
            description: "Organization-changing actions require approval",
            priority: 95,
            enabled: true,
            conditions: [
                { field: "riskCategory", operator: "eq", value: "org_changing" },
            ],
            conditionLogic: "and",
            action: "require_approval",
            timeoutPolicy: "reject",
            tags: ["risk", "org"],
        },
        {
            ruleId: "high-cost-approval",
            description: "High-cost actions (>=$100) require approval",
            priority: 80,
            enabled: true,
            conditions: [
                { field: "estimatedCostUsd", operator: "gte", value: 100 },
            ],
            conditionLogic: "and",
            action: "require_approval",
            timeoutPolicy: "approve",
            tags: ["cost"],
        },
        {
            ruleId: "critical-action-deny",
            description: "Critical destructive actions are denied in auto mode",
            priority: 200,
            enabled: true,
            conditions: [
                { field: "riskCategory", operator: "eq", value: "destructive" },
                { field: "action", operator: "in", value: ["exec_command", "write_file"] },
            ],
            conditionLogic: "and",
            action: "deny",
            tags: ["risk", "critical"],
        },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};
//# sourceMappingURL=types.js.map