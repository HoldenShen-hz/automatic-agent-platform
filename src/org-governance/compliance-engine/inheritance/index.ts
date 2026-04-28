export interface PolicyLayer {
  readonly policyId: string;
  readonly rules: Readonly<Record<string, unknown>>;
}

export function inheritPolicyLayers(layers: readonly PolicyLayer[]): Record<string, unknown> {
  return layers.reduce<Record<string, unknown>>((merged, layer) => mergePolicyRules(merged, layer.rules), {});
}

function mergePolicyRules(
  base: Readonly<Record<string, unknown>>,
  incoming: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    if (typeof existing === "boolean" && typeof value === "boolean") {
      merged[key] = mergeBooleanRule(key, existing, value);
      continue;
    }
    if (typeof existing === "number" && typeof value === "number") {
      merged[key] = mergeNumberRule(key, existing, value);
      continue;
    }
    if (typeof existing === "string" && typeof value === "string" && existing.length > 0) {
      merged[key] = mergeStringRule(key, existing, value);
      continue;
    }
    if (typeof existing === "string" && typeof value === "string" && value.length === 0) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function mergeBooleanRule(key: string, existing: boolean, value: boolean): boolean {
  if (key.startsWith("allow") || key.startsWith("can")) {
    return existing && value;
  }
  return existing || value;
}

function mergeNumberRule(key: string, existing: number, value: number): number {
  if (key.startsWith("max") || key.includes("timeout") || key.includes("quota") || key.endsWith("Hours")) {
    return Math.min(existing, value);
  }
  if (key.startsWith("min")) {
    return Math.max(existing, value);
  }
  if (key.endsWith("RetentionDays")) {
    return Math.max(existing, value);
  }
  return Math.min(existing, value);
}

function mergeStringRule(key: string, existing: string, value: string): string {
  if (value.length === 0) {
    return existing;
  }
  if (key.toLowerCase().includes("classification")) {
    const rank = ["public", "internal", "confidential", "restricted"];
    const existingRank = rank.indexOf(existing);
    const valueRank = rank.indexOf(value);
    if (existingRank >= 0 && valueRank >= 0) {
      return rank[Math.max(existingRank, valueRank)] ?? existing;
    }
  }
  return existing === "restricted" || value === "restricted" ? "restricted" : value;
}

export type StrictnessOrdering = "less_strict" | "equal" | "more_strict" | "incomparable";

export interface PolicyStrictnessResult {
  readonly ordering: StrictnessOrdering;
  readonly requiresComplianceApproval: boolean;
  readonly reason: string;
}

export function comparePolicyStrictness(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): PolicyStrictnessResult {
  const leftIsEmpty = Object.keys(left).length === 0;
  const rightIsEmpty = Object.keys(right).length === 0;
  if (leftIsEmpty && rightIsEmpty) {
    return { ordering: "equal", requiresComplianceApproval: false, reason: "both_empty" };
  }
  if (leftIsEmpty) {
    return { ordering: "less_strict", requiresComplianceApproval: false, reason: "left_empty_is_less_restrictive" };
  }
  if (rightIsEmpty) {
    return { ordering: "more_strict", requiresComplianceApproval: false, reason: "right_empty_is_more_restrictive" };
  }

  const comparedFields: Array<{ field: string; leftVal: unknown; rightVal: unknown; strictness: StrictnessOrdering }> = [];
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of allKeys) {
    const leftVal = left[key];
    const rightVal = right[key];
    if (leftVal === rightVal) {
      continue;
    }
    const fieldStrictness = deriveFieldStrictness(key, leftVal, rightVal);
    comparedFields.push({ field: key, leftVal, rightVal, strictness: fieldStrictness });
  }

  if (comparedFields.some((f) => f.strictness === "incomparable")) {
    return {
      ordering: "incomparable",
      requiresComplianceApproval: true,
      reason: `incomparable_fields:${comparedFields.filter((f) => f.strictness === "incomparable").map((f) => f.field).join(",")}`,
    };
  }

  const stricterCount = comparedFields.filter((f) => f.strictness === "more_strict").length;
  const lessStrictCount = comparedFields.filter((f) => f.strictness === "less_strict").length;

  if (stricterCount > lessStrictCount) {
    return { ordering: "more_strict", requiresComplianceApproval: false, reason: "right_more_strict" };
  }
  if (lessStrictCount > stricterCount) {
    return { ordering: "less_strict", requiresComplianceApproval: false, reason: "left_more_strict" };
  }
  return { ordering: "equal", requiresComplianceApproval: false, reason: "balanced" };
}

function deriveFieldStrictness(key: string, leftVal: unknown, rightVal: unknown): StrictnessOrdering {
  if (typeof leftVal === "boolean" && typeof rightVal === "boolean") {
    if (key.startsWith("allow") || key.startsWith("can")) {
      return leftVal === rightVal ? "equal" : (leftVal ? "less_strict" : "more_strict");
    }
    return leftVal === rightVal ? "equal" : (leftVal ? "more_strict" : "less_strict");
  }
  if (typeof leftVal === "number" && typeof rightVal === "number") {
    if (key.startsWith("max") || key.includes("timeout") || key.includes("quota") || key.endsWith("Hours")) {
      return leftVal === rightVal ? "equal" : (leftVal < rightVal ? "less_strict" : "more_strict");
    }
    if (key.startsWith("min")) {
      return leftVal === rightVal ? "equal" : (leftVal > rightVal ? "less_strict" : "more_strict");
    }
    return leftVal === rightVal ? "equal" : "incomparable";
  }
  if (typeof leftVal === "string" && typeof rightVal === "string") {
    if (key.toLowerCase().includes("classification")) {
      const rank = ["public", "internal", "confidential", "restricted"];
      const leftRank = rank.indexOf(leftVal);
      const rightRank = rank.indexOf(rightVal);
      if (leftRank < 0 || rightRank < 0) {
        return "incomparable";
      }
      return leftRank === rightRank ? "equal" : (leftRank < rightRank ? "less_strict" : "more_strict");
    }
    return leftVal === rightVal ? "equal" : "incomparable";
  }
  return "incomparable";
}
