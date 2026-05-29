# Artifact Store Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Artifact Plane 的storage机制，对应 ADR-016 §11 和设计文档 §D。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines文件型产出物的storage布局、元data索references、生命cycle和references用语义。

## 2. 关键对象

- `ArtifactRecord`
- `ArtifactLink`
- `ArtifactBundle`
- `ArtifactStorageLayout`
- `ArtifactRetentionPolicy`
- `ArtifactPublishService`
- `ArtifactPreviewService`

## 3. ArtifactRecord 最小字段

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

## 4. lines为约束

- DB 中只保存索references和references用，不保存大体积 BLOB 主体。
- artifact 路径必须稳定且可重建。
- 删除策略不得破坏completed任务的审计性。
- 对外暴露 artifact 时必须via过permission检查。

## 5. 补充规则

### 5.1 本地布局

本地开发defaults to布局：

- `data/artifacts/<task_id>/<artifact_id>/`
- 元data以 DB authoritative 索references为准

### 5.2 对象storage边界

- 对象storage负责 artifact 主体，不负责任务真相Status。
- `artifact_id`、`storage_key`、`checksum` 必须能相互映射。
- 迁移到对象storage后，读取接口语义不变。

### 5.3 GC vs冷storage

- completed任务的核心 artifact 不得在审计窗口内被directly删除。
- 可重建或低价值 artifact 可进入冷storage或过期删除。
- GC 必须按 retention policy 执lines，并产生日志vs审计record。

### 5.4 ArtifactLink / ArtifactBundle

`ArtifactLink` 最小字段：

- `artifact_id`
- `link_type`
- `bundle_type?`
- `publish_status?`
- `ref_id?`

`ArtifactBundle` 最小字段：

- `bundle_id`
- `bundle_type`
- `artifact_ids`
- `created_at`

规则：

- artifact 必须能via `ref_id` 回链到 feedback / learning / improvement / rollout / diagnostics 等闭环对象。
- publish / preview / governance 相关 artifact 不得只存在文件系统路径，必须有结构化索references。

## v4.3 Contract Remediation

- T-64: 本文原先只要求 `task_id`，Root cause:  artifact store contract 早于 v4.3 executable contract 成型，导致 artifact 索references缺少运lines时 lineage。修复：正文现要求 `harness_run_id / node_run_id / plan_graph_bundle_id` 作为最小运lines链主键，`task_id` only作为聚合查询入口。

### 5.5 ArtifactPublishService

`ArtifactPublishService` 负责将 artifact 发布到外部系统：

```typescript
interface ArtifactPublishService {
  publishToGit(artifact: ArtifactRecord): Promise<GitPublishResult>;
  publishToNotion(artifact: ArtifactRecord, pageId?: string): Promise<NotionPublishResult>;
  publishToCdn(artifact: ArtifactRecord): Promise<CdnPublishResult>;
}
```

### 5.6 ArtifactPreviewService

`ArtifactPreviewService` 负责生成 artifact 预览：

```typescript
interface ArtifactPreviewService {
  previewDiff(artifact: ArtifactRecord): Promise<DiffPreview>;
  previewJson(artifact: ArtifactRecord): Promise<JsonTreePreview>;
  previewMarkdown(artifact: ArtifactRecord): Promise<MarkdownRenderedPreview>;
}
```
