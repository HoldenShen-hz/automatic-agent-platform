import { z } from "zod";

export const ResearchSourceTypeSchema = z.enum([
  "paper",
  "blog",
  "webpage",
  "internal_report",
  "benchmark",
  "experiment_log",
]);
export const ResearchCopyrightBoundarySchema = z.enum([
  "summary_only",
  "short_excerpt_allowed",
  "internal_fulltext_allowed",
  "restricted",
]);
export const ResearchContaminationTagSchema = z.enum([
  "benchmark",
  "train_candidate",
  "do_not_train",
  "unknown",
]);
export const ResearchDataClassSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);

export const ResearchSourceGovernanceSchema = z
  .object({
    sourceId: z.string().min(1),
    sourceType: ResearchSourceTypeSchema,
    sourceAttribution: z.string().min(1),
    license: z.string().min(1).optional(),
    copyrightBoundary: ResearchCopyrightBoundarySchema,
    dataClass: ResearchDataClassSchema,
    retentionPolicy: z.string().min(1),
    contaminationTag: ResearchContaminationTagSchema.optional(),
    piiDetected: z.boolean(),
    redactionApplied: z.boolean(),
    tenantId: z.string().min(1),
    accessPolicyRef: z.string().min(1),
    evidenceRef: z.string().min(1),
  })
  .strict();

export type ResearchSourceGovernance = z.infer<
  typeof ResearchSourceGovernanceSchema
>;

export interface ResearchSourceGovernanceDecision {
  readonly accepted: boolean;
  readonly reasonCodes: readonly string[];
  readonly record: ResearchSourceGovernance | null;
}

export function validateResearchSourceGovernance(
  input: unknown,
): ResearchSourceGovernanceDecision {
  const parsed = ResearchSourceGovernanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      accepted: false,
      reasonCodes: ["research_source.schema_invalid"],
      record: null,
    };
  }

  const reasonCodes: string[] = [];
  if (parsed.data.license == null) {
    reasonCodes.push("research_source.license_missing");
  }
  if (parsed.data.contaminationTag == null) {
    reasonCodes.push("research_source.contamination_tag_missing");
  }
  if (parsed.data.piiDetected && !parsed.data.redactionApplied) {
    reasonCodes.push("research_source.pii_redaction_missing");
  }
  if (
    parsed.data.copyrightBoundary === "restricted" &&
    parsed.data.dataClass === "public"
  ) {
    reasonCodes.push("research_source.restricted_boundary_public_class");
  }

  return {
    accepted: reasonCodes.length === 0,
    reasonCodes,
    record: parsed.data,
  };
}
