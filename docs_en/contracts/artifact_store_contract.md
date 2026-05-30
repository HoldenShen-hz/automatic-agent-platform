# Artifact Store Contract

> **OAPEFLIR Relationship**: This contract defines the storage mechanism for OAPEFLIR Artifact Plane, corresponding to ADR-016 §11 and design document §D.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines the storage layout, metadata index, lifecycle, and reference semantics for file-based outputs.

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

- Only index and reference are saved in DB; large BLOB body is not stored directly.
- Artifact path must be stable and reconstructible.
- Deletion policy must not break auditability of completed tasks.
- Permission check must be performed when externally exposing artifacts.

## 5. Supplementary Rules

### 5.1 Local Layout

Default local development layout:

- `data/artifacts/<task_id>/<artifact_id>/`
- Metadata follows DB authoritative index

### 5.2 Object Storage Boundaries

- Object storage is responsible for artifact body, not task truth state.
- `artifact_id`, `storage_key`, `checksum` must be mappable to each other.
- After migrating to object storage, read interface semantics remain unchanged.

### 5.3 GC and Cold Storage

- Core artifacts of completed tasks must not be directly deleted within the audit window.
- Rebuildable or low-value artifacts can enter cold storage or expire deletion.
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

- Artifacts must be traceable back to feedback / learning / improvement / rollout / diagnostics and other closed-loop objects via `ref_id`.
- Publish / preview / governance related artifacts must not only exist in filesystem path; structured index is required.

## v4.3 Contract Remediation

- T-64: This document originally only required `task_id`. Root cause: Artifact store contract preceded v4.3 executable contract maturity, causing artifact index to lack runtime lineage. Fix: The main text now requires `harness_run_id / node_run_id / plan_graph_bundle_id` as minimum execution chain primary keys; `task_id` is only used as aggregate query entry.

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