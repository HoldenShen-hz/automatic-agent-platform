/**
 * Workflow Output Schema
 *
 * Validates workflow step outputs against JSON schemas to ensure
 * downstream steps receive properly formatted data.
 */

import { readFileSync } from "node:fs";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { WorkflowStateError } from "../../../contracts/errors.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/** Schema property definition for supported scalar fields */
export type WorkflowOutputSchemaProperty =
  | {
      type: "string";
      minLength: number;
    }
  | {
      type: "boolean";
    }
  | {
      type: "number";
    }
  | {
      type: "array";
      items: { type: "string" };
    }
  | {
      type: "object";
    };

/** Complete workflow output schema definition */
export interface WorkflowOutputSchemaDefinition {
  sourcePath: string;
  type: "object";
  required: readonly string[];
  properties: Readonly<Record<string, WorkflowOutputSchemaProperty>>;
  additionalProperties: boolean;
}

/** Result of successful schema validation */
export interface WorkflowOutputValidationResult {
  valid: true;
  schemaPath: string;
  requiredKeys: readonly string[];
}

/** Cache of loaded schemas by path */
const schemaCache = new Map<string, WorkflowOutputSchemaDefinition>();

/**
 * Type guard to check if a value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates that a value is a plain object, throwing if not.
 */
function expectPlainObject(value: unknown, sourcePath: string, field: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new WorkflowStateError("workflow.output_schema_invalid_document", `Expected plain object at ${sourcePath}:${field}`, {
      details: { sourcePath, field },
    });
  }
  return value;
}

/**
 * Validates that a value is an array of non-empty strings.
 */
function expectStringArray(value: unknown, sourcePath: string, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new WorkflowStateError("workflow.output_schema_invalid_document", `Expected string array at ${sourcePath}:${field}`, {
      details: { sourcePath, field },
    });
  }
  return value.map((entry) => entry.trim());
}

/**
 * Normalizes a supported property schema from raw JSON.
 */
function normalizePropertySchema(
  value: unknown,
  sourcePath: string,
  propertyName: string,
): WorkflowOutputSchemaProperty {
  const property = expectPlainObject(value, sourcePath, `properties.${propertyName}`);
  if (property.type === "boolean") {
    return {
      type: "boolean",
    };
  }

  if (property.type === "number") {
    return {
      type: "number",
    };
  }

  if (property.type === "array") {
    const items = property.items;
    if (isPlainObject(items) && items.type === "string") {
      return {
        type: "array",
        items: { type: "string" },
      };
    }
    // Fall through to unsupported handler for other array item types
  }

  if (property.type === "object") {
    return {
      type: "object",
    };
  }

  if (property.type !== "string") {
    throw new WorkflowStateError("workflow.output_schema_unsupported", `Unsupported type at ${sourcePath}:properties.${propertyName}.type`, {
      details: { sourcePath, propertyName, type: property.type },
    });
  }

  const minLengthCandidate = property.minLength;
  if (minLengthCandidate != null) {
    if (typeof minLengthCandidate !== "number" || !Number.isInteger(minLengthCandidate) || minLengthCandidate < 0) {
      throw new WorkflowStateError(
        "workflow.output_schema_invalid_document",
        `Invalid minLength at ${sourcePath}:properties.${propertyName}.minLength`,
        { details: { sourcePath, propertyName, minLength: minLengthCandidate } },
      );
    }
  }

  return {
    type: "string",
    minLength: typeof minLengthCandidate === "number" ? minLengthCandidate : 0,
  };
}

/**
 * Parses a workflow output schema from JSON string.
 */
export function parseWorkflowOutputSchema(
  raw: string,
  sourcePath: string,
): WorkflowOutputSchemaDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.debug("parseWorkflowOutputSchema failed", { error: err, sourcePath });
    throw new WorkflowStateError("workflow.output_schema_parse_error", `Failed to parse workflow output schema: ${sourcePath}`, {
      details: { sourcePath, error: err instanceof Error ? err.message : String(err) },
    });
  }

  const document = expectPlainObject(parsed, sourcePath, "root");
  if (document.type !== "object") {
    throw new WorkflowStateError("workflow.output_schema_unsupported", `Expected object type at ${sourcePath}`, {
      details: { sourcePath, type: document.type },
    });
  }

  const propertiesObject = expectPlainObject(document.properties, sourcePath, "properties");
  const properties = Object.fromEntries(
    Object.entries(propertiesObject).map(([propertyName, propertySchema]) => [
      propertyName,
      normalizePropertySchema(propertySchema, sourcePath, propertyName),
    ]),
  );

  const required = document.required == null ? [] : expectStringArray(document.required, sourcePath, "required");
  for (const requiredKey of required) {
    if (!(requiredKey in properties)) {
      throw new WorkflowStateError("workflow.output_schema_invalid_document", `Required key not in properties: ${sourcePath}:required.${requiredKey}`, {
        details: { sourcePath, requiredKey },
      });
    }
  }

  const additionalPropertiesCandidate = document.additionalProperties;
  if (additionalPropertiesCandidate != null && typeof additionalPropertiesCandidate !== "boolean") {
    throw new WorkflowStateError("workflow.output_schema_invalid_document", `Invalid additionalProperties at ${sourcePath}`, {
      details: { sourcePath, additionalProperties: additionalPropertiesCandidate },
    });
  }

  return {
    sourcePath,
    type: "object",
    required,
    properties,
    additionalProperties: additionalPropertiesCandidate === false ? false : true,
  };
}

/**
 * Loads and caches a workflow output schema from a file path.
 */
export function loadWorkflowOutputSchema(schemaPath: string): WorkflowOutputSchemaDefinition {
  const cached = schemaCache.get(schemaPath);
  if (cached) {
    return cached;
  }

  const loaded = parseWorkflowOutputSchema(readFileSync(schemaPath, "utf8"), schemaPath);
  schemaCache.set(schemaPath, loaded);
  return loaded;
}

/**
 * Validates workflow step output data against the step's output schema.
 *
 * Checks that all required keys are present and that string values meet
 * minimum length requirements.
 */
export function validateWorkflowStepOutput(
  step: { stepId: string; outputSchemaPath?: string | null },
  data: Record<string, unknown>,
): WorkflowOutputValidationResult {
  const schemaPath = step.outputSchemaPath?.trim();
  if (!schemaPath) {
    throw new WorkflowStateError("workflow.output_schema_missing", `Missing output schema path for step: ${step.stepId}`, {
      details: { stepId: step.stepId },
    });
  }

  const schema = loadWorkflowOutputSchema(schemaPath);
  if (!isPlainObject(data)) {
    throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Output data must be a plain object`, {
      details: { stepId: step.stepId, schemaPath },
    });
  }

  for (const requiredKey of schema.required) {
    if (!(requiredKey in data)) {
      throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid:${requiredKey}: Missing required output key: ${requiredKey}`, {
        details: { stepId: step.stepId, requiredKey },
      });
    }
  }

  for (const [key, value] of Object.entries(data)) {
    const propertySchema = schema.properties[key];
    if (!propertySchema) {
      if (!schema.additionalProperties) {
        throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid:${key}: Unexpected output key: ${key}`, {
          details: { stepId: step.stepId, key },
        });
      }
      continue;
    }

    if (propertySchema.type === "string") {
      if (typeof value !== "string" || value.length < propertySchema.minLength) {
        throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Invalid output value for key: ${key}`, {
          details: { stepId: step.stepId, key, minLength: propertySchema.minLength, expectedType: propertySchema.type },
        });
      }
      continue;
    }

    if (propertySchema.type === "boolean" && typeof value !== "boolean") {
      throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Invalid output value for key: ${key}`, {
        details: { stepId: step.stepId, key, expectedType: propertySchema.type },
      });
    }

    if (propertySchema.type === "number" && typeof value !== "number") {
      throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Invalid output value for key: ${key}`, {
        details: { stepId: step.stepId, key, expectedType: propertySchema.type },
      });
    }

    if (propertySchema.type === "array") {
      if (!Array.isArray(value)) {
        throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Invalid output value for key: ${key}`, {
          details: { stepId: step.stepId, key, expectedType: propertySchema.type },
        });
      }
      if (propertySchema.items.type === "string") {
        for (const item of value) {
          if (typeof item !== "string") {
            throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Array item type mismatch for key: ${key}`, {
              details: { stepId: step.stepId, key, expectedItemType: "string", actualType: typeof item },
            });
          }
        }
      }
    }

    if (propertySchema.type === "object" && !isPlainObject(value)) {
      throw new WorkflowStateError("workflow.output_schema_invalid", `workflow.output_schema_invalid: Invalid output value for key: ${key}`, {
        details: { stepId: step.stepId, key, expectedType: propertySchema.type },
      });
    }
  }

  return {
    valid: true,
    schemaPath: schema.sourcePath,
    requiredKeys: schema.required,
  };
}
