export interface PolicyLayer {
  readonly policyId: string;
  readonly rules: Readonly<Record<string, unknown>>;
}

export function inheritPolicyLayers(layers: readonly PolicyLayer[]): Record<string, unknown> {
  return layers.reduce<Record<string, unknown>>((merged, layer) => ({
    ...merged,
    ...layer.rules,
  }), {});
}
