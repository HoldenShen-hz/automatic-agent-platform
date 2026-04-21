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
      merged[key] = existing || value;
      continue;
    }
    if (typeof existing === "number" && typeof value === "number") {
      merged[key] = Math.max(existing, value);
      continue;
    }
    if (typeof existing === "string" && typeof value === "string" && existing.length > 0) {
      merged[key] = existing === "restricted" || value === "restricted" ? "restricted" : value;
      continue;
    }
    merged[key] = value;
  }
  return merged;
}
