export interface PackCompatibilityInput {
  readonly manifestId: string;
  readonly openApiOperationIds: readonly string[];
  readonly eventTypes: readonly string[];
  readonly contractSchemaIds: readonly string[];
}

export interface PackCompatibilityTestCase {
  readonly testId: string;
  readonly source: "manifest" | "openapi" | "event_registry" | "contract_schema";
  readonly assertion: string;
}

export interface PackCompatibilityTestPlan {
  readonly manifestId: string;
  readonly generatedAt: string;
  readonly testCases: readonly PackCompatibilityTestCase[];
}

export class PackCompatibilityTestGenerator {
  public generate(input: PackCompatibilityInput, generatedAt: string): PackCompatibilityTestPlan {
    return {
      manifestId: input.manifestId,
      generatedAt,
      testCases: [
        {
          testId: `${input.manifestId}:manifest:required-fields`,
          source: "manifest",
          assertion: "manifest declares runtime, permissions, entrypoints, and version compatibility",
        },
        ...input.openApiOperationIds.map((operationId) => ({
          testId: `${input.manifestId}:openapi:${operationId}`,
          source: "openapi" as const,
          assertion: `operation ${operationId} remains backward compatible`,
        })),
        ...input.eventTypes.map((eventType) => ({
          testId: `${input.manifestId}:event:${eventType}`,
          source: "event_registry" as const,
          assertion: `event ${eventType} declares replay behavior and consumer contract`,
        })),
        ...input.contractSchemaIds.map((schemaId) => ({
          testId: `${input.manifestId}:contract:${schemaId}`,
          source: "contract_schema" as const,
          assertion: `contract schema ${schemaId} validates canonical and compatibility fixtures`,
        })),
      ],
    };
  }
}
