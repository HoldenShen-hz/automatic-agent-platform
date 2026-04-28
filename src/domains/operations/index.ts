import { z } from "zod";

const DOMAIN_ONBOARDING_PHASE_ALIASES = {
  modeling: "domain_modeling",
  development_validation: "pack_development",
  canary_launch: "gray_rollout",
} as const;

export type DomainOnboardingPhase =
  | "domain_modeling"
  | "pack_development"
  | "security_certification"
  | "gray_rollout";

export function normalizeDomainOnboardingPhase(value: string): DomainOnboardingPhase {
  return (DOMAIN_ONBOARDING_PHASE_ALIASES[value as keyof typeof DOMAIN_ONBOARDING_PHASE_ALIASES] ?? value) as DomainOnboardingPhase;
}

export const DomainOnboardingPhaseSchema = z.preprocess(
  (value) => typeof value === "string" ? normalizeDomainOnboardingPhase(value) : value,
  z.enum([
    "domain_modeling",
    "pack_development",
    "security_certification",
    "gray_rollout",
  ]),
);

export const DomainOnboardingRecordSchema = z.object({
  domainId: z.string().min(1),
  phase: DomainOnboardingPhaseSchema,
  status: z.enum(["pending", "in_progress", "completed", "blocked"]),
  evidenceArtifactIds: z.array(z.string()).default([]),
});

export type DomainOnboardingRecord = z.infer<typeof DomainOnboardingRecordSchema>;

const PHASE_ORDER: readonly DomainOnboardingPhase[] = [
  "domain_modeling",
  "pack_development",
  "security_certification",
  "gray_rollout",
];

export function nextOnboardingPhase(phase: DomainOnboardingPhase): DomainOnboardingPhase | null {
  const index = PHASE_ORDER.indexOf(normalizeDomainOnboardingPhase(phase));
  return index === -1 || index === PHASE_ORDER.length - 1 ? null : PHASE_ORDER[index + 1] ?? null;
}

export * from "./domain-onboarding-service.js";
