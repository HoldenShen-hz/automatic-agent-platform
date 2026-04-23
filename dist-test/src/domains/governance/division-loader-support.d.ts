export declare function throwDivisionValidationError(code: string, details?: Record<string, unknown>): never;
export declare function throwDivisionWorkflowError(code: string, details?: Record<string, unknown>): never;
export declare function throwDivisionSandboxError(code: string, details?: Record<string, unknown>): never;
export interface ParsedLine {
    indent: number;
    text: string;
    lineNumber: number;
}
export interface RawDivisionRoleConfig {
    id: string;
    name?: string;
    prompt: string;
    model?: string;
    tools?: unknown;
    max_instances?: unknown;
}
export interface RawDivisionConfig {
    id: string;
    version?: unknown;
    name: string;
    description?: unknown;
    priority?: unknown;
    default_workflow: string;
    orchestration_workflow?: unknown;
    triggers?: unknown;
    roles?: unknown;
}
export interface RawWorkflowStepConfig {
    step_id: string;
    division_id?: unknown;
    role_id: string;
    input_keys?: unknown;
    output_key: string;
    output_schema?: unknown;
    timeout_ms: unknown;
    max_attempts: unknown;
    depends_on?: unknown;
}
export interface RawWorkflowConfig {
    id: string;
    division_id: string;
    steps: unknown;
}
export declare const DEFAULT_DIVISIONS_ROOT: string;
export declare function tokenizeYaml(raw: string): ParsedLine[];
export declare function parseLimitedYaml(raw: string, sourcePath: string): unknown;
export declare function parseBlock(lines: ParsedLine[], startIndex: number, indent: number, sourcePath: string): [unknown, number];
export declare function parseObject(lines: ParsedLine[], startIndex: number, indent: number, sourcePath: string): [Record<string, unknown>, number];
export declare function parseArray(lines: ParsedLine[], startIndex: number, indent: number, sourcePath: string): [unknown[], number];
export declare function splitKeyValue(text: string, sourcePath: string, lineNumber: number): [string, string];
export declare function looksLikeKeyValue(text: string): boolean;
export declare function parseScalar(raw: string): unknown;
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function expectNonEmptyString(value: unknown, errorCode: string): string;
export declare function toObjectArray(value: unknown): Record<string, unknown>[];
export declare function toStringArray(value: unknown): string[];
export declare function toInteger<T>(value: unknown, fallback: T): number | T;
