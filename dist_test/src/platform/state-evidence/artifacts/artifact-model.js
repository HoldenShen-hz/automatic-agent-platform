import { z } from "zod";
export const ArtifactTypeSchema = z.enum([
    "source_code",
    "config",
    "document",
    "report",
    "test_result",
    "log",
    "binary",
    "patch",
    "code_bundle",
    "asset_package",
    "image_prompt",
    "render_job_spec",
    "live_runbook",
    "postmortem",
    "diagnostic_bundle",
]);
export const ArtifactRecordSchema = z.object({
    artifactId: z.string().min(1),
    taskId: z.string().min(1),
    stepId: z.string().min(1),
    agentRole: z.string().min(1),
    type: ArtifactTypeSchema,
    path: z.string().min(1),
    contentHash: z.string().min(1),
    version: z.number().int().positive(),
    parentArtifactId: z.string().nullable(),
    size: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
    status: z.enum(["draft", "committed", "published", "archived"]),
});
export const ArtifactRecordExtendedSchema = ArtifactRecordSchema.extend({
    namespace: z.string().min(1),
    artifactType: ArtifactTypeSchema,
    storageUri: z.string().min(1),
    createdBy: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export const ArtifactLinkSchema = z.object({
    linkId: z.string().min(1),
    fromArtifactId: z.string().min(1),
    toArtifactId: z.string().min(1),
    relation: z.enum(["derived_from", "replaces", "depends_on", "tested_by", "reviewed_by"]),
});
export const ArtifactLinkExtendedSchema = z.object({
    linkId: z.string().min(1),
    fromArtifactId: z.string().min(1),
    toRefId: z.string().min(1),
    relation: z.enum([
        "derived_from",
        "replaces",
        "depends_on",
        "tested_by",
        "reviewed_by",
        "uses",
        "published_from",
        "summarizes",
        "attached_to",
    ]),
});
export const ArtifactBundleSchema = z.object({
    bundleId: z.string().min(1),
    taskId: z.string().min(1),
    artifacts: z.array(ArtifactRecordSchema).default([]),
    links: z.array(ArtifactLinkSchema).default([]),
    finalDeliverables: z.array(z.string()).default([]),
    totalSize: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
});
export const ArtifactBundleExtendedSchema = ArtifactBundleSchema.extend({
    bundleType: z.enum(["release_bundle", "asset_bundle", "campaign_bundle", "incident_bundle", "workflow_snapshot"]),
    domainId: z.string().min(1),
    publishStatus: z.enum(["draft", "review", "published", "recalled"]),
    publishedAt: z.string().nullable(),
});
//# sourceMappingURL=artifact-model.js.map