import { z } from "zod";
export declare const DualChannelStepOutputSchema: z.ZodObject<{
    stepId: z.ZodString;
    planRef: z.ZodString;
    userFacingResult: z.ZodObject<{
        summary: z.ZodString;
        artifacts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        artifacts: string[];
    }, {
        summary: string;
        artifacts?: string[] | undefined;
    }>;
    systemTelemetry: z.ZodObject<{
        durationMs: z.ZodNumber;
        tokensUsed: z.ZodNumber;
        modelId: z.ZodString;
        retryCount: z.ZodNumber;
        validationPassed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        durationMs: number;
        modelId: string;
        tokensUsed: number;
        retryCount: number;
        validationPassed: boolean;
    }, {
        durationMs: number;
        modelId: string;
        tokensUsed: number;
        retryCount: number;
        validationPassed: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    stepId: string;
    planRef: string;
    userFacingResult: {
        summary: string;
        artifacts: string[];
    };
    systemTelemetry: {
        durationMs: number;
        modelId: string;
        tokensUsed: number;
        retryCount: number;
        validationPassed: boolean;
    };
}, {
    stepId: string;
    planRef: string;
    userFacingResult: {
        summary: string;
        artifacts?: string[] | undefined;
    };
    systemTelemetry: {
        durationMs: number;
        modelId: string;
        tokensUsed: number;
        retryCount: number;
        validationPassed: boolean;
    };
}>;
export type DualChannelStepOutput = z.output<typeof DualChannelStepOutputSchema>;
export declare function parseDualChannelStepOutput(input: unknown): DualChannelStepOutput;
