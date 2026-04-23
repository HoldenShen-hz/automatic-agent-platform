import { z } from "zod";
export const DomainOnboardingPhaseSchema = z.enum([
    "modeling",
    "development_validation",
    "security_certification",
    "canary_launch",
]);
export const DomainOnboardingRecordSchema = z.object({
    domainId: z.string().min(1),
    phase: DomainOnboardingPhaseSchema,
    status: z.enum(["pending", "in_progress", "completed", "blocked"]),
    evidenceArtifactIds: z.array(z.string()).default([]),
});
const PHASE_ORDER = [
    "modeling",
    "development_validation",
    "security_certification",
    "canary_launch",
];
export function nextOnboardingPhase(phase) {
    const index = PHASE_ORDER.indexOf(phase);
    return index === -1 || index === PHASE_ORDER.length - 1 ? null : PHASE_ORDER[index + 1] ?? null;
}
export * from "./domain-onboarding-service.js";
//# sourceMappingURL=index.js.map