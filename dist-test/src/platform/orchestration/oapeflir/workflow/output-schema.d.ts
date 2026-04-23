/**
 * Workflow Output Schema
 *
 * Validates workflow step outputs against JSON schemas to ensure
 * downstream steps receive properly formatted data.
 */
/** Schema property definition for supported scalar fields */
export type WorkflowOutputSchemaProperty = {
    type: "string";
    minLength: number;
} | {
    type: "boolean";
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
/**
 * Parses a workflow output schema from JSON string.
 */
export declare function parseWorkflowOutputSchema(raw: string, sourcePath: string): WorkflowOutputSchemaDefinition;
/**
 * Loads and caches a workflow output schema from a file path.
 */
export declare function loadWorkflowOutputSchema(schemaPath: string): WorkflowOutputSchemaDefinition;
/**
 * Validates workflow step output data against the step's output schema.
 *
 * Checks that all required keys are present and that string values meet
 * minimum length requirements.
 */
export declare function validateWorkflowStepOutput(step: {
    stepId: string;
    outputSchemaPath?: string | null;
}, data: Record<string, unknown>): WorkflowOutputValidationResult;
