# Artifact Store Contract

> **OAPEFLIR Association**: This contract defines the storage mechanism for the OAPEFLIR Artifact Plane, corresponding to ADR-016 §11 and design document §D.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the storage layout, metadata index, lifecycle, and reference semantics for file-based artifacts.

## 2. Key Objects

- `ArtifactRecord`
- `ArtifactLink`
- `ArtifactBundle`
- `ArtifactStorageLayout`
- `ArtifactRetentionPolicy`
- `ArtifactPublishService`
- `ArtifactPreviewService`

## 3. ArtifactRecord Minimum Fields

- `artifact_id`
- `harness_run_id`
- `node_run_id?`
- `plan_graph_bundle_id?`
- `task_id?`
- `ref_id?`
- `kind`
- `path`
- `mime_type`
- `size_bytes`
- `checksum?`
- `created_at`

## 4. Behavioral Constraints

- Only indexes and references are stored in the DB; large BLOB bodies are not stored.
- Artifact paths must be stable and reconstructible.
- Deletion policies must not compromise the auditability of completed tasks.
- Artifacts exposed externally must undergo permission checks.

## 5. Supplementary Rules

### 5.1 Local Layout

Default local development layout:

- `data/artifacts/<task_id>/<artifact_id>/`
- Metadata is governed by DB authoritative index

### 5.2 Object Storage Boundaries

- Object storage is responsible for artifact bodies, not for task truth state.
- `artifact_id`, `storage_key`, and `checksum` must be mappable to each other.
- After migrating to object storage, read interface semantics remain unchanged.

### 5.3 GC and Cold Storage

- Core artifacts of completed tasks must not be directly deleted within the audit window.
- Reconstructible or low-value artifacts may enter cold storage or expire for deletion.
- GC must execute according to retention policy and produce logs and audit records.

### 5.4 ArtifactLink / ArtifactBundle

`ArtifactLink` minimum fields:

- `artifact_id`
- `link_type`
- `bundle_type?`
- `publish_status?`
- `ref_id?`

`ArtifactBundle` minimum fields:

- `bundle_id`
- `bundle_type`
- `artifact_ids`
- `created_at`

Rules:

- Artifacts must be able to trace back to closed-loop objects such as feedback, learning, improvement, rollout, and diagnostics through `ref_id`.
- Publish, preview, and governance-related artifacts must not exist only in filesystem paths; they must have structured indexes.

## v4.3 Contract Remediation

- T-64: This document originally only required `task_id`. Root cause: The artifact store contract predated the v4.3 executable contract, resulting in artifact indexes lacking runtime lineage. Fix: Body now requires `harness_run_id / node_run_id / plan_graph_bundle_id` as the minimum runtime chain primary key, with `task_id` serving only as an aggregation query entry point.

### 5.5 ArtifactPublishService

`ArtifactPublishService` is responsible for publishing artifacts to external systems:

```typescript
interface ArtifactPublishService {
  publishToGit(artifact: ArtifactRecord): Promise<GitPublishResult>;
  publishToNotion(artifact: ArtifactRecord, pageId?: string): Promise<NotionPublishResult>;
  publishToCdn(artifact: ArtifactRecord): Promise<CdnPublishResult>;
}
```

### 5.6 ArtifactPreviewService

`ArtifactPreviewService` is responsible for generating artifact previews:

```typescript
interface ArtifactPreviewService {
  previewDiff(artifact: ArtifactRecord): Promise<DiffPreview>;
  previewJson(artifact: ArtifactRecord): Promise<JsonTreePreview>;
  previewMarkdown(artifact: ArtifactRecord): Promise<MarkdownRenderedPreview>;
}
```
