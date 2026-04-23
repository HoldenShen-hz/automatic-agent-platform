export interface GeneratedBinding {
  readonly id: string;
  readonly source: string;
  readonly generatedAt: string;
}

export function createGeneratedBinding(id: string, source: string): GeneratedBinding {
  return {
    id,
    source,
    generatedAt: new Date().toISOString(),
  };
}

export function generateEndpointBindingModule(endpoints: readonly { readonly id: string; readonly path: string }[]): string {
  return endpoints
    .map((endpoint) => `export const ${endpoint.id}Path = "${endpoint.path}";`)
    .join("\n");
}
