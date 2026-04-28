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
