import { z } from "zod";
export declare const ArtifactTypeSchema: z.ZodEnum<["source_code", "config", "document", "report", "test_result", "log", "binary", "patch", "code_bundle", "asset_package", "image_prompt", "render_job_spec", "live_runbook", "postmortem", "diagnostic_bundle"]>;
export declare const ArtifactRecordSchema: z.ZodObject<{
    artifactId: z.ZodString;
    taskId: z.ZodString;
    stepId: z.ZodString;
    agentRole: z.ZodString;
    type: z.ZodEnum<["source_code", "config", "document", "report", "test_result", "log", "binary", "patch", "code_bundle", "asset_package", "image_prompt", "render_job_spec", "live_runbook", "postmortem", "diagnostic_bundle"]>;
    path: z.ZodString;
    contentHash: z.ZodString;
    version: z.ZodNumber;
    parentArtifactId: z.ZodNullable<z.ZodString>;
    size: z.ZodNumber;
    createdAt: z.ZodString;
    status: z.ZodEnum<["draft", "committed", "published", "archived"]>;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    taskId: string;
    stepId: string;
    status: "draft" | "published" | "archived" | "committed";
    path: string;
    type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
    version: number;
    artifactId: string;
    contentHash: string;
    size: number;
    agentRole: string;
    parentArtifactId: string | null;
}, {
    createdAt: string;
    taskId: string;
    stepId: string;
    status: "draft" | "published" | "archived" | "committed";
    path: string;
    type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
    version: number;
    artifactId: string;
    contentHash: string;
    size: number;
    agentRole: string;
    parentArtifactId: string | null;
}>;
export declare const ArtifactRecordExtendedSchema: z.ZodObject<{
    artifactId: z.ZodString;
    taskId: z.ZodString;
    stepId: z.ZodString;
    agentRole: z.ZodString;
    type: z.ZodEnum<["source_code", "config", "document", "report", "test_result", "log", "binary", "patch", "code_bundle", "asset_package", "image_prompt", "render_job_spec", "live_runbook", "postmortem", "diagnostic_bundle"]>;
    path: z.ZodString;
    contentHash: z.ZodString;
    version: z.ZodNumber;
    parentArtifactId: z.ZodNullable<z.ZodString>;
    size: z.ZodNumber;
    createdAt: z.ZodString;
    status: z.ZodEnum<["draft", "committed", "published", "archived"]>;
} & {
    namespace: z.ZodString;
    artifactType: z.ZodEnum<["source_code", "config", "document", "report", "test_result", "log", "binary", "patch", "code_bundle", "asset_package", "image_prompt", "render_job_spec", "live_runbook", "postmortem", "diagnostic_bundle"]>;
    storageUri: z.ZodString;
    createdBy: z.ZodString;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    taskId: string;
    stepId: string;
    status: "draft" | "published" | "archived" | "committed";
    path: string;
    type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
    version: number;
    artifactId: string;
    namespace: string;
    metadata: Record<string, unknown>;
    contentHash: string;
    size: number;
    artifactType: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
    createdBy: string;
    agentRole: string;
    parentArtifactId: string | null;
    storageUri: string;
}, {
    createdAt: string;
    taskId: string;
    stepId: string;
    status: "draft" | "published" | "archived" | "committed";
    path: string;
    type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
    version: number;
    artifactId: string;
    namespace: string;
    contentHash: string;
    size: number;
    artifactType: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
    createdBy: string;
    agentRole: string;
    parentArtifactId: string | null;
    storageUri: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const ArtifactLinkSchema: z.ZodObject<{
    linkId: z.ZodString;
    fromArtifactId: z.ZodString;
    toArtifactId: z.ZodString;
    relation: z.ZodEnum<["derived_from", "replaces", "depends_on", "tested_by", "reviewed_by"]>;
}, "strip", z.ZodTypeAny, {
    linkId: string;
    fromArtifactId: string;
    toArtifactId: string;
    relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
}, {
    linkId: string;
    fromArtifactId: string;
    toArtifactId: string;
    relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
}>;
export declare const ArtifactLinkExtendedSchema: z.ZodObject<{
    linkId: z.ZodString;
    fromArtifactId: z.ZodString;
    toRefId: z.ZodString;
    relation: z.ZodEnum<["derived_from", "replaces", "depends_on", "tested_by", "reviewed_by", "uses", "published_from", "summarizes", "attached_to"]>;
}, "strip", z.ZodTypeAny, {
    linkId: string;
    fromArtifactId: string;
    relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by" | "uses" | "published_from" | "summarizes" | "attached_to";
    toRefId: string;
}, {
    linkId: string;
    fromArtifactId: string;
    relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by" | "uses" | "published_from" | "summarizes" | "attached_to";
    toRefId: string;
}>;
export declare const ArtifactBundleSchema: z.ZodObject<{
    bundleId: z.ZodString;
    taskId: z.ZodString;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        artifactId: z.ZodString;
        taskId: z.ZodString;
        stepId: z.ZodString;
        agentRole: z.ZodString;
        type: z.ZodEnum<["source_code", "config", "document", "report", "test_result", "log", "binary", "patch", "code_bundle", "asset_package", "image_prompt", "render_job_spec", "live_runbook", "postmortem", "diagnostic_bundle"]>;
        path: z.ZodString;
        contentHash: z.ZodString;
        version: z.ZodNumber;
        parentArtifactId: z.ZodNullable<z.ZodString>;
        size: z.ZodNumber;
        createdAt: z.ZodString;
        status: z.ZodEnum<["draft", "committed", "published", "archived"]>;
    }, "strip", z.ZodTypeAny, {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }, {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }>, "many">>;
    links: z.ZodDefault<z.ZodArray<z.ZodObject<{
        linkId: z.ZodString;
        fromArtifactId: z.ZodString;
        toArtifactId: z.ZodString;
        relation: z.ZodEnum<["derived_from", "replaces", "depends_on", "tested_by", "reviewed_by"]>;
    }, "strip", z.ZodTypeAny, {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }, {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }>, "many">>;
    finalDeliverables: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    totalSize: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    taskId: string;
    bundleId: string;
    artifacts: {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }[];
    links: {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }[];
    finalDeliverables: string[];
    totalSize: number;
}, {
    createdAt: string;
    taskId: string;
    bundleId: string;
    totalSize: number;
    artifacts?: {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }[] | undefined;
    links?: {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }[] | undefined;
    finalDeliverables?: string[] | undefined;
}>;
export declare const ArtifactBundleExtendedSchema: z.ZodObject<{
    bundleId: z.ZodString;
    taskId: z.ZodString;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        artifactId: z.ZodString;
        taskId: z.ZodString;
        stepId: z.ZodString;
        agentRole: z.ZodString;
        type: z.ZodEnum<["source_code", "config", "document", "report", "test_result", "log", "binary", "patch", "code_bundle", "asset_package", "image_prompt", "render_job_spec", "live_runbook", "postmortem", "diagnostic_bundle"]>;
        path: z.ZodString;
        contentHash: z.ZodString;
        version: z.ZodNumber;
        parentArtifactId: z.ZodNullable<z.ZodString>;
        size: z.ZodNumber;
        createdAt: z.ZodString;
        status: z.ZodEnum<["draft", "committed", "published", "archived"]>;
    }, "strip", z.ZodTypeAny, {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }, {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }>, "many">>;
    links: z.ZodDefault<z.ZodArray<z.ZodObject<{
        linkId: z.ZodString;
        fromArtifactId: z.ZodString;
        toArtifactId: z.ZodString;
        relation: z.ZodEnum<["derived_from", "replaces", "depends_on", "tested_by", "reviewed_by"]>;
    }, "strip", z.ZodTypeAny, {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }, {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }>, "many">>;
    finalDeliverables: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    totalSize: z.ZodNumber;
    createdAt: z.ZodString;
} & {
    bundleType: z.ZodEnum<["release_bundle", "asset_bundle", "campaign_bundle", "incident_bundle", "workflow_snapshot"]>;
    domainId: z.ZodString;
    publishStatus: z.ZodEnum<["draft", "review", "published", "recalled"]>;
    publishedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    taskId: string;
    domainId: string;
    bundleId: string;
    artifacts: {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }[];
    links: {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }[];
    publishedAt: string | null;
    finalDeliverables: string[];
    totalSize: number;
    bundleType: "release_bundle" | "asset_bundle" | "campaign_bundle" | "incident_bundle" | "workflow_snapshot";
    publishStatus: "draft" | "published" | "review" | "recalled";
}, {
    createdAt: string;
    taskId: string;
    domainId: string;
    bundleId: string;
    publishedAt: string | null;
    totalSize: number;
    bundleType: "release_bundle" | "asset_bundle" | "campaign_bundle" | "incident_bundle" | "workflow_snapshot";
    publishStatus: "draft" | "published" | "review" | "recalled";
    artifacts?: {
        createdAt: string;
        taskId: string;
        stepId: string;
        status: "draft" | "published" | "archived" | "committed";
        path: string;
        type: "binary" | "config" | "report" | "patch" | "document" | "log" | "source_code" | "test_result" | "code_bundle" | "asset_package" | "image_prompt" | "render_job_spec" | "live_runbook" | "postmortem" | "diagnostic_bundle";
        version: number;
        artifactId: string;
        contentHash: string;
        size: number;
        agentRole: string;
        parentArtifactId: string | null;
    }[] | undefined;
    links?: {
        linkId: string;
        fromArtifactId: string;
        toArtifactId: string;
        relation: "derived_from" | "replaces" | "depends_on" | "tested_by" | "reviewed_by";
    }[] | undefined;
    finalDeliverables?: string[] | undefined;
}>;
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;
export type ArtifactRecordExtended = z.infer<typeof ArtifactRecordExtendedSchema>;
export type ArtifactLink = z.infer<typeof ArtifactLinkSchema>;
export type ArtifactLinkExtended = z.infer<typeof ArtifactLinkExtendedSchema>;
export type ArtifactBundle = z.infer<typeof ArtifactBundleSchema>;
export type ArtifactBundleExtended = z.infer<typeof ArtifactBundleExtendedSchema>;
