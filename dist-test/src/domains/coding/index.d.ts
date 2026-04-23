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
    domainId: "coding";
    displayName: "Coding";
    defaultWorkflowIds: string[];
    defaultToolBundleIds: string[];
    requiredCapabilities: ("test" | "plan" | "analyze" | "implement" | "review" | "release")[];
    reviewRequiredTaskTypes: ("test" | "plan" | "analyze" | "implement" | "review" | "release")[];
}, {
    domainId: "coding";
    displayName: "Coding";
    defaultWorkflowIds?: string[] | undefined;
    defaultToolBundleIds?: string[] | undefined;
    requiredCapabilities?: ("test" | "plan" | "analyze" | "implement" | "review" | "release")[] | undefined;
    reviewRequiredTaskTypes?: ("test" | "plan" | "analyze" | "implement" | "review" | "release")[] | undefined;
}>;
export type CodingTaskType = z.infer<typeof CodingTaskTypeSchema>;
export type CodingDomainPreset = z.infer<typeof CodingDomainPresetSchema>;
export declare const CODING_DOMAIN_PRESET: CodingDomainPreset;
export declare function requiresCodingReview(taskType: CodingTaskType): boolean;
