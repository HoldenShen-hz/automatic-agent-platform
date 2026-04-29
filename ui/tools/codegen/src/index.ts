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

/**
 * OpenAPI schema types for contract-driven DTO generation.
 * §5.2.3: OpenAPI/contract-driven DTO type generation
 */
export interface OpenAPISchema {
  type: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  description?: string;
  format?: string;
  enum?: string[];
  $ref?: string;
}

export interface OpenAPIParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  schema?: OpenAPISchema;
  description?: string;
}

export interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content?: Record<string, { schema?: OpenAPISchema }>;
    required?: boolean;
  };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: OpenAPISchema }> }>;
}

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths?: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
  };
}

/**
 * Generates TypeScript type definitions from OpenAPI schema.
 * §5.2.3: OpenAPI/contract-driven DTO type generation
 */
export function generateTypeFromSchema(name: string, schema: OpenAPISchema): string {
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop() ?? name;
    return refName;
  }

  switch (schema.type) {
    case "object":
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([propName, propSchema]) => {
            const optional = schema.required?.includes(propName) ? "" : "?";
            return `  ${propName}${optional}: ${generateTypeFromSchema(propName, propSchema)};`;
          })
          .join("\n");
        return `{\n${props}\n}`;
      }
      return "Record<string, unknown>";
    case "array":
      if (schema.items) {
        return `${generateTypeFromSchema(name, schema.items)}[]`;
      }
      return "unknown[]";
    case "string":
      if (schema.enum) {
        return schema.enum.map((e) => `"${e}"`).join(" | ");
      }
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}

/**
 * Generates TypeScript DTO types from OpenAPI specification.
 * §5.2.3: OpenAPI/contract-driven DTO type generation
 */
export function generateDtoTypes(spec: OpenAPISpec): string {
  const lines: string[] = [
    `// Generated from ${spec.info.title} v${spec.info.version}`,
    `// OpenAPI ${spec.openapi}`,
    "",
  ];

  // Generate component schemas
  if (spec.components?.schemas) {
    lines.push("// DTO Types");
    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      const typeName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
      lines.push(`export type ${typeName} = ${generateTypeFromSchema(schemaName, schema)};`);
      lines.push("");
    }
  }

  // Generate endpoint parameter types
  if (spec.paths) {
    lines.push("// Endpoint Parameter Types");
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (operation.operationId && operation.parameters?.length) {
          const paramsTypeName = `${operation.operationId}Params`;
          const paramsProps = operation.parameters
            .map((p) => `  ${p.name}${p.required ? "" : "?"}: ${generateTypeFromSchema(p.name, p.schema ?? { type: "string" })};`)
            .join("\n");
          lines.push(`export type ${paramsTypeName} = {\n${paramsProps}\n};`);
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Parse an OpenAPI JSON spec and return typed DTOs.
 * §5.2.3: OpenAPI/contract-driven DTO type generation
 */
export function parseOpenApiSpec(spec: OpenAPISpec): {
  dtoTypes: string;
  endpointBindings: string;
} {
  return {
    dtoTypes: generateDtoTypes(spec),
    endpointBindings: generateEndpointBindings(spec),
  };
}

function generateEndpointBindings(spec: OpenAPISpec): string {
  if (!spec.paths) return "";

  const lines: string[] = ["// Endpoint Path Bindings"];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation.operationId) {
        const bindingName = `${operation.operationId}Path`;
        lines.push(`export const ${bindingName} = "${path}" as const;`);
        lines.push(`export const ${bindingName.toUpperCase().replace("PATH", "_PATH")}_METHOD = "${method.toUpperCase()}" as const;`);
      }
    }
  }
  return lines.join("\n");
}
