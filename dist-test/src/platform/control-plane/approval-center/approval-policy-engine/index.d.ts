/**
 * Approval Policy Engine
 *
 * Provides declarative JSON-based approval policy evaluation
 * with version management for change tracking.
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   ApprovalPolicyEngine,
 *   PolicyVersionManager,
 *   DEFAULT_APPROVAL_POLICY_BUNDLE,
 * } from "./approval-policy-engine/index.js";
 *
 * // Create a policy engine with default policies
 * const engine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
 *
 * // Evaluate a policy decision context
 * const result = engine.evaluate({
 *   decisionId: "dec-123",
 *   taskId: "task-456",
 *   subjectType: "agent",
 *   subjectId: "agent-1",
 *   action: "write_file",
 *   riskCategory: "destructive",
 *   mode: "supervised",
 *   stage: "execute",
 * });
 *
 * if (result.requiresApproval) {
 *   // Create approval request
 * }
 * ```
 *
 * ## Version Management
 *
 * ```typescript
 * // Create a version manager
 * const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);
 *
 * // Create a draft for changes
 * const draft = manager.createDraft("my-policies", "1.0.0", "user-1");
 *
 * // Submit for approval
 * const submitted = manager.submitForApproval(draft, "user-1", "Added new rule");
 *
 * // After approval...
 * manager.approve(submitted, "approver-1", "approval-123");
 * manager.activate("my-policies", "1.0.1", "admin-1");
 * ```
 */
export * from "./types.js";
export * from "./rule-engine.js";
export * from "./version-manager.js";
