import { z } from "zod";
export declare const DomainOnboardingPhaseSchema: z.ZodEnum<["modeling", "development_validation", "security_certification", "canary_launch"]>;
export declare const DomainOnboardingRecordSchema: z.ZodObject<{
    domainId: z.ZodString;
    phase: z.ZodEnum<["modeling", "development_validation", "security_certification", "canary_launch"]>;
    status: z.ZodEnum<["pending", "in_progress", "completed", "blocked"]>;
    evidenceArtifactIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    status: "pending" | "completed" | "blocked" | "in_progress";
    phase: "modeling" | "development_validation" | "security_certification" | "canary_launch";
    evidenceArtifactIds: string[];
}, {
    domainId: string;
    status: "pending" | "completed" | "blocked" | "in_progress";
    phase: "modeling" | "development_validation" | "security_certification" | "canary_launch";
    evidenceArtifactIds?: string[] | undefined;
}>;
export type DomainOnboardingPhase = z.infer<typeof DomainOnboardingPhaseSchema>;
export type DomainOnboardingRecord = z.infer<typeof DomainOnboardingRecordSchema>;
export declare function nextOnboardingPhase(phase: DomainOnboardingPhase): DomainOnboardingPhase | null;
export * from "./domain-onboarding-service.js";
