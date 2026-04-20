# Artifact Store Contract

## 1. Scope

This contract defines the storage layout, metadata index, lifecycle, and reference semantics of file-based artifacts.

## 2. Key Objects

- `ArtifactRecord`
- `ArtifactLink`
- `ArtifactBundle`
- `ArtifactStorageLayout`
- `ArtifactRetentionPolicy`

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

## 4. Behavioral Constraints

- Only indexes and references are stored in the database; large BLOB bodies are not stored.
- Artifact paths must be stable and reconstructible.
- Deletion policies must not break the auditability of completed tasks.
- Artifact exposure must go through permission checks.

## 5. Supplementary Rules

### 5.1 Local Layout

Default local development layout:

- `data/artifacts/<task_id>/<artifact_id>/`
- Metadata authoritative index is in the database

### 5.2 Object Storage Boundaries

- Object storage is responsible for artifact bodies, not task truth state.
- `artifact_id`, `storage_key`, `checksum` must be mappable to each other.
- After migrating to object storage, read interface semantics remain unchanged.

### 5.3 GC and Cold Storage

- Core artifacts of completed tasks must not be directly deleted within the audit window.
- Reconstructible or low-value artifacts may enter cold storage or expire deletion.
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

- Artifacts must be able to link back to feedback / learning / improvement / rollout / diagnostics and other closed-loop objects via `ref_id`.
- Publish / preview / governance related artifacts must not exist only in filesystem paths; they must have structured indexes.
