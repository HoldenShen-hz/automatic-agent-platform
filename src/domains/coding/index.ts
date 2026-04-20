import { z } from "zod";

export const CodingTaskTypeSchema = z.enum([
  "analyze",
  "plan",
  "implement",
  "test",
  "review",
  "release",
]);

export const CodingDomainPresetSchema = z.object({
  domainId: z.literal("coding"),
  displayName: z.literal("Coding"),
  defaultWorkflowIds: z.array(z.string()).default(["coding_change"]),
  defaultToolBundleIds: z.array(z.string()).default(["repo_tools", "build_tools", "test_tools"]),
  requiredCapabilities: z.array(CodingTaskTypeSchema).default(["analyze", "implement", "test"]),
  reviewRequiredTaskTypes: z.array(CodingTaskTypeSchema).default(["implement", "release"]),
});

export type CodingTaskType = z.infer<typeof CodingTaskTypeSchema>;
export type CodingDomainPreset = z.infer<typeof CodingDomainPresetSchema>;

export const CODING_DOMAIN_PRESET: CodingDomainPreset = CodingDomainPresetSchema.parse({
  domainId: "coding",
  displayName: "Coding",
});

export function requiresCodingReview(taskType: CodingTaskType): boolean {
  return CODING_DOMAIN_PRESET.reviewRequiredTaskTypes.includes(taskType);
}
