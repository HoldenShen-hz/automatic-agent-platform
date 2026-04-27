# Artifact Store Contract

> **OAPEFLIR Related**: This contract defines the storage mechanism for OAPEFLIR Artifact Plane, corresponding to ADR-016 §11 and design document §D.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the storage layout, metadata index, lifecycle, and reference semantics for file-based output artifacts.

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
- `task_id`
- `ref_id?`
- `kind`
- `path`
- `mime_type`
- `size_bytes`
- `checksum?`
- `created_at`

## 4. Behavior Constraints

- Only index and reference are saved in DB, not large BLOB bodies.
- Artifact paths must be stable and reconstructible.
- Deletion policies must not destroy the auditability of completed tasks.
- External artifact exposure must go through permission checks.

## 5. Supplementary Rules

### 5.1 Local Layout

Default local development layout:

- `data/artifacts/<task_id>/<artifact_id>/`
- Metadata based on DB authoritative index

### 5.2 Object Storage Boundary

- Object storage is responsible for artifact bodies, not task truth state.
- `artifact_id`, `storage_key`, `checksum` must be mutually mappable.
- After migrating to object storage, read interface semantics remain unchanged.

### 5.3 GC and Cold Storage

- Core artifacts of completed tasks must not be directly deleted within the audit window.
- Reconstructible or low-value artifacts can enter cold storage or expire deletion.
- GC must execute according to retention policy, and generate logs and audit records.

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

- Artifacts must be able to trace back to feedback / learning / improvement / rollout / diagnostics and other closed-loop objects through `ref_id`.
- Publish / preview / governance related artifacts must not exist only in filesystem paths; must have structured index.

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
