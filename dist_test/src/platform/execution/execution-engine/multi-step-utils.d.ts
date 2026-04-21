/**
 * @fileoverview Multi-Step Utility Functions
 *
 * Helper functions for multi-step orchestration.
 */
export declare function parseOptionalPositiveInteger(value: unknown): number | undefined;
export declare function parseOptionalStringArray(value: unknown): string[];
export declare function resolveMultiStepToolPath(rootPath: string, inputPath: string | null | undefined): string;
export declare function safeParseToolResult(raw: string): unknown;
