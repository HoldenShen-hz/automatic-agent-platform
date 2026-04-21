import { z } from "zod";
export declare const CodingTaskTypeSchema: z.ZodEnum<["analyze", "plan", "implement", "test", "review", "release"]>;
export declare const CodingDomainPresetSchema: z.ZodObject<{
    domainId: z.ZodLiteral<"coding">;
    displayName: z.ZodLiteral<"Coding">;
    defaultWorkflowIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    defaultToolBundleIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    requiredCapabilities: z.ZodDefault<z.ZodArray<z.ZodEnum<["analyze", "plan", "implement", "test", "review", "release"]>, "many">>;
    reviewRequiredTaskTypes: z.ZodDefault<z.ZodArray<z.ZodEnum<["analyze", "plan", "implement", "test", "review", "release"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    requiredCapabilities: ("test" | "plan" | "release" | "review" | "analyze" | "implement")[];
    domainId: "coding";
    displayName: "Coding";
    defaultWorkflowIds: string[];
    defaultToolBundleIds: string[];
    reviewRequiredTaskTypes: ("test" | "plan" | "release" | "review" | "analyze" | "implement")[];
}, {
    domainId: "coding";
    displayName: "Coding";
    requiredCapabilities?: ("test" | "plan" | "release" | "review" | "analyze" | "implement")[] | undefined;
    defaultWorkflowIds?: string[] | undefined;
    defaultToolBundleIds?: string[] | undefined;
    reviewRequiredTaskTypes?: ("test" | "plan" | "release" | "review" | "analyze" | "implement")[] | undefined;
}>;
export type CodingTaskType = z.infer<typeof CodingTaskTypeSchema>;
export type CodingDomainPreset = z.infer<typeof CodingDomainPresetSchema>;
export declare const CODING_DOMAIN_PRESET: CodingDomainPreset;
export declare function requiresCodingReview(taskType: CodingTaskType): boolean;
