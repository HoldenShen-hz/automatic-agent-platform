export interface GeneratedBinding {
  readonly id: string;
  readonly source: string;
  readonly generatedAt: string;
}

export interface OpenApiDocument {
  readonly paths: Record<string, Record<string, { readonly operationId?: string }>>;
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

function toConstantName(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, group: string) => group.toUpperCase())
    .replace(/^[A-Z]/, (value) => value.toLowerCase());
}

export function parseOpenApiDocument(document: string | OpenApiDocument): OpenApiDocument {
  if (typeof document === "string") {
    return JSON.parse(document) as OpenApiDocument;
  }
  return document;
}

export function generateBindingsFromOpenApi(document: string | OpenApiDocument): string {
  const openApiDocument = parseOpenApiDocument(document);
  const endpoints = Object.entries(openApiDocument.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => {
      const id = operation.operationId ?? `${method}-${path}`;
      return {
        id: `${toConstantName(id)}Path`,
        method: method.toUpperCase(),
        path,
      };
    }),
  );

  return endpoints
    .map((endpoint) => `export const ${endpoint.id} = { method: "${endpoint.method}", path: "${endpoint.path}" } as const;`)
    .join("\n");
}
