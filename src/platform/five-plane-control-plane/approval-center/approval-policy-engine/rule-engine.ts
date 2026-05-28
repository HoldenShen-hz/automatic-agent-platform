/**
 * Approval Policy Rule Engine
 *
 * Evaluates declarative approval policy rules against policy decision context.
 * Rules are matched in priority order, with the first matching rule determining
 * the outcome.
 *
 * ## Evaluation Order
 *
 * 1. Filter to enabled rules only
 * 2. Sort by priority (highest first)
 * 3. Evaluate conditions for each rule
 * 4. First matching rule wins
 * 5. If no rule matches, use default (no approval required)
 */

import { createRequire } from "node:module";
import type {
  ApprovalPolicyRule,
  ApprovalPolicyBundle,
  ApprovalPolicyContext,
  ApprovalPolicyResult,
  RuleCondition,
  RuleOperator,
  PolicyLintResult,
  PolicyLintError,
  PolicyLintWarning,
} from "./types.js";

/**
 * Maximum number of rules that can be evaluated for a single decision.
 */
const MAX_RULES_EVALUATED = 1000;

/**
 * Default timeout policy when no rule specifies one.
 */
const DEFAULT_TIMEOUT_POLICY: "reject" | "approve" | "remain_pending" = "remain_pending";

/**
 * Default required approvals for multi-party approval.
 */
const DEFAULT_REQUIRED_APPROVALS = 1;

const require = createRequire(import.meta.url);

/**
 * Evaluates approval policies against a policy decision context.
 */
export class ApprovalPolicyEngine {
  private static readonly PROHIBITED_FIELD_PATH_PARTS = new Set(["__proto__", "constructor", "prototype"]);

  private readonly bundle: ApprovalPolicyBundle;

  public constructor(bundle: ApprovalPolicyBundle) {
    this.bundle = bundle;
  }

  /**
   * Evaluates the policy bundle against the given context.
   *
   * @param context - The policy decision context to evaluate
   * @returns The approval policy result
   */
  public evaluate(context: ApprovalPolicyContext): ApprovalPolicyResult {
    if (!this.bundle.enabled) {
      return this.defaultResult("No active policy bundle.");
    }

    const enabledRules = this.bundle.rules
      .filter((rule) => rule.enabled)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_RULES_EVALUATED);

    let rulesEvaluated = 0;
    for (const rule of enabledRules) {
      rulesEvaluated++;
      if (rulesEvaluated > MAX_RULES_EVALUATED) {
        break;
      }

      if (this.matchesConditions(rule, context)) {
        return this.applyRule(rule);
      }
    }

    return this.defaultResult("No matching approval rules.");
  }

  /**
   * Checks if a rule's conditions match the context.
   */
  private matchesConditions(rule: ApprovalPolicyRule, context: ApprovalPolicyContext): boolean {
    if (rule.conditions.length === 0) {
      return false;
    }

    const logic = rule.conditionLogic ?? "and";
    const results = rule.conditions.map((condition) =>
      this.evaluateCondition(condition, context),
    );

    if (logic === "and") {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Evaluates a single condition against the context.
   */
  private evaluateCondition(condition: RuleCondition, context: ApprovalPolicyContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);

    return this.compareValues(fieldValue, condition.operator, condition.value);
  }

  /**
   * Gets a field value from the context by path (e.g., "riskCategory", "metadata.costCenter").
   */
  private getFieldValue(fieldPath: string, context: ApprovalPolicyContext): unknown {
    const parts = fieldPath.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (ApprovalPolicyEngine.PROHIBITED_FIELD_PATH_PARTS.has(part)) {
        return undefined;
      }
      if (value == null || typeof value !== "object") {
        return undefined;
      }
      const record = value as Record<string, unknown>;
      if (!Object.hasOwn(record, part)) {
        return undefined;
      }
      value = record[part];
    }

    return value;
  }

  /**
   * Compares values using the specified operator.
   */
  private compareValues(fieldValue: unknown, operator: RuleOperator, ruleValue: unknown): boolean {
    switch (operator) {
      case "eq":
        return fieldValue === ruleValue;

      case "neq":
        return fieldValue !== ruleValue;

      case "in":
        if (Array.isArray(ruleValue)) {
          return ruleValue.includes(fieldValue);
        }
        return false;

      case "nin":
        if (Array.isArray(ruleValue)) {
          return !ruleValue.includes(fieldValue);
        }
        return true;

      case "gt":
        if (typeof fieldValue === "number" && typeof ruleValue === "number") {
          return fieldValue > ruleValue;
        }
        return false;

      case "gte":
        if (typeof fieldValue === "number" && typeof ruleValue === "number") {
          return fieldValue >= ruleValue;
        }
        return false;

      case "lt":
        if (typeof fieldValue === "number" && typeof ruleValue === "number") {
          return fieldValue < ruleValue;
        }
        return false;

      case "lte":
        if (typeof fieldValue === "number" && typeof ruleValue === "number") {
          return fieldValue <= ruleValue;
        }
        return false;

      case "contains":
        if (typeof fieldValue === "string" && typeof ruleValue === "string") {
          return fieldValue.includes(ruleValue);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Applies a matching rule and returns the result.
   */
  private applyRule(rule: ApprovalPolicyRule): ApprovalPolicyResult {
    switch (rule.action) {
      case "deny":
        return {
          requiresApproval: false,
          deny: true,
          requireMultiParty: false,
          requiredApprovals: 0,
          approverGroups: [],
          timeoutPolicy: rule.timeoutPolicy ?? DEFAULT_TIMEOUT_POLICY,
          evaluatedBundleVersion: this.bundle.version,
          matchedRuleIds: [rule.ruleId],
          reasonCode: `policy.rule.${rule.ruleId}.denied`,
          explainSummary: rule.description,
        };

      case "allow":
        return {
          requiresApproval: false,
          deny: false,
          requireMultiParty: false,
          requiredApprovals: 0,
          approverGroups: [],
          timeoutPolicy: rule.timeoutPolicy ?? DEFAULT_TIMEOUT_POLICY,
          evaluatedBundleVersion: this.bundle.version,
          matchedRuleIds: [rule.ruleId],
          reasonCode: `policy.rule.${rule.ruleId}.allowed`,
          explainSummary: rule.description,
        };

      case "require_approval":
        return {
          requiresApproval: true,
          deny: false,
          requireMultiParty: false,
          requiredApprovals: rule.requiredApprovals ?? DEFAULT_REQUIRED_APPROVALS,
          approverGroups: rule.approverGroups ?? [],
          timeoutPolicy: rule.timeoutPolicy ?? DEFAULT_TIMEOUT_POLICY,
          evaluatedBundleVersion: this.bundle.version,
          matchedRuleIds: [rule.ruleId],
          reasonCode: `policy.rule.${rule.ruleId}.approval_required`,
          explainSummary: rule.description,
        };

      case "require_multi_party_approval":
        return {
          requiresApproval: true,
          deny: false,
          requireMultiParty: true,
          requiredApprovals: rule.requiredApprovals ?? 2,
          approverGroups: rule.approverGroups ?? [],
          timeoutPolicy: rule.timeoutPolicy ?? DEFAULT_TIMEOUT_POLICY,
          evaluatedBundleVersion: this.bundle.version,
          matchedRuleIds: [rule.ruleId],
          reasonCode: `policy.rule.${rule.ruleId}.multi_party_approval_required`,
          explainSummary: rule.description,
        };

      default:
        return this.defaultResult(`Unknown rule action: ${(rule as ApprovalPolicyRule).action}`);
    }
  }

  /**
   * Returns the default result when no rule matches.
   */
  private defaultResult(reason: string): ApprovalPolicyResult {
    return {
      requiresApproval: false,
      deny: false,
      requireMultiParty: false,
      requiredApprovals: 0,
      approverGroups: [],
      timeoutPolicy: DEFAULT_TIMEOUT_POLICY,
      evaluatedBundleVersion: this.bundle.version,
      matchedRuleIds: [],
      reasonCode: "policy.no_matching_rule",
      explainSummary: reason,
    };
  }

  /**
   * Lints the policy bundle for issues.
   *
   * Checks for:
   * - Unreachable rules (deny/ask rules that can never match)
   * - Shadowed rules (rules that are always overridden by higher priority)
   * - Invalid field references
   * - Duplicate rule IDs
   */
  public lint(): PolicyLintResult {
    const errors: PolicyLintError[] = [];
    const warnings: PolicyLintWarning[] = [];

    // Check for duplicate rule IDs
    const ruleIds = new Set<string>();
    for (const rule of this.bundle.rules) {
      if (ruleIds.has(rule.ruleId)) {
        errors.push({
          ruleId: rule.ruleId,
          code: "duplicate_rule_id",
          message: `Rule ID '${rule.ruleId}' appears multiple times`,
          field: "ruleId",
        });
      }
      ruleIds.add(rule.ruleId);
    }

    // Check for invalid field references
    const validFields = new Set([
      "decisionId",
      "taskId",
      "executionId",
      "sessionId",
      "subjectType",
      "subjectId",
      "action",
      "resourceRef",
      "riskCategory",
      "mode",
      "stage",
      "estimatedCostUsd",
      "metadata",
    ]);

    for (const rule of this.bundle.rules) {
      for (const condition of rule.conditions) {
        const topLevelField = condition.field.split(".")[0] ?? "";
        if (!topLevelField || !validFields.has(topLevelField)) {
          errors.push({
            ruleId: rule.ruleId,
            code: "invalid_field_reference",
            message: `Field '${condition.field}' is not a valid context field`,
            field: `conditions[].field`,
          });
        }
      }
    }

    // Check for shadowed rules
    const sortedRules = [...this.bundle.rules]
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (let i = 0; i < sortedRules.length; i++) {
      for (let j = i + 1; j < sortedRules.length; j++) {
        const higher = sortedRules[i]!;
        const lower = sortedRules[j]!;

        if (this.ruleAlwaysOverrides(higher, lower)) {
          warnings.push({
            ruleId: lower.ruleId,
            code: "shadowed_rule",
            message: `Rule '${lower.ruleId}' is always overridden by '${higher.ruleId}'`,
            suggestion: `Increase priority of '${lower.ruleId}' or narrow its conditions`,
          });
        }
      }
    }

    // Check for rules with no conditions
    for (const rule of this.bundle.rules) {
      if (rule.enabled && rule.conditions.length === 0) {
        warnings.push({
          ruleId: rule.ruleId,
          code: "empty_conditions",
          message: `Rule '${rule.ruleId}' has no conditions and will never match`,
          suggestion: "Add conditions or disable the rule",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Checks if a higher priority rule always overrides a lower priority rule.
   */
  private ruleAlwaysOverrides(higher: ApprovalPolicyRule, lower: ApprovalPolicyRule): boolean {
    // If the higher priority rule has fewer or equal conditions,
    // it might shadow the lower priority rule
    if (higher.conditions.length <= lower.conditions.length) {
      // Check if all conditions of the higher rule are a subset of the lower rule
      const higherConditionStrings = higher.conditions
        .map((c) => `${c.field}:${c.operator}:${JSON.stringify(c.value)}`)
        .sort();
      const lowerConditionStrings = lower.conditions
        .map((c) => `${c.field}:${c.operator}:${JSON.stringify(c.value)}`)
        .sort();

      return higherConditionStrings.every((hc) => lowerConditionStrings.includes(hc));
    }
    return false;
  }
}

/**
 * Creates a policy engine with the default approval policies.
 */
export function createDefaultPolicyEngine(): ApprovalPolicyEngine {
  const { DEFAULT_APPROVAL_POLICY_BUNDLE } = require("./types.js");
  return new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);
}
