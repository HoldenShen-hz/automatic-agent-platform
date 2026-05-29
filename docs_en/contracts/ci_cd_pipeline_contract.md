# CI/CD Pipeline Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Improve Hub 的 CI/CD pipeline 机制，对应 ADR-075 §13 pre-release 和设计文档 §9.1。
> **更新日期**：2026-04-29

## 1. Scope

本 contract defines build、test、package、publish 和 artifact promotion 的完整 CI/CD pipeline 机制。

Related documents:

- `release_rollout_and_rollback_contract.md`
- `ring_model_contract.md`
- `artifact_store_contract.md`
- [ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)

## 2. Pipeline Overview

CI/CD Pipeline 负责将code、configure、prompt 等工件从开发环境 promotion 到生产环境，确保每个阶段的 quality gate 都满足要求。

### 2.1 Pipeline Stages

```
build → test → package → publish → artifact_promotion → staging → production
  ↓        ↓        ↓         ↓              ↓              ↓          ↓
[验证]  [验证]   [验证]    [验证]        [验证]         [验证]     [release]
```

## 3. Pipeline Stages

### 3.1 Build Stage

**职责**：将源code编译/打包成可部署的 artifact

**输入**：
- Source code (Git commit)
- Dependencies
- Build configuration

**输出**：
- Build artifact (binary, container image, etc.)
- Build metadata (version, checksum, build time)

**Quality Gates**：
- 编译success，no错误
- 静态分析via
- relies onsecurity扫描via

### 3.2 Test Stage

**职责**：执lines各class测试确保质量

**测试class型**：
- Unit tests
- Integration tests
- Contract tests
- E2E tests (optional)

**Quality Gates**：
- Unit test pass rate >= 95%
- Integration test pass rate >= 90%
- Contract test pass rate >= 100%
- no high/critical security性Issue

### 3.3 Package Stage

**职责**：将 build artifact 打包成可分发的格式

**输出**：
- Package manifest
- Signed artifacts
- Package metadata

**Quality Gates**：
- Package 签名验证via
- Package size 在限额内
- relies on版本锁定

### 3.4 Publish Stage

**职责**：将 package 发布到 artifact registry

**输出**：
- Published artifact with registry location
- Publication timestamp
- Publisher identity

**Quality Gates**：
- Registry authentication via
- Artifact 唯一性验证
- repeats artifact 检测

### 3.5 Artifact Promotion Stage

**职责**：在 ring model 中 promotion artifact

**Promotion 规则**（对应 §13 pre-release）：
- Ring 0 (off): no promotion
- Ring 1 (evaluate_0): onlyrecord，不Impact生产
- Ring 2-5: 按 ring_model_contract.md 规则 promotion
- Release: full发布

**Quality Gates**：
- 满足 ring promotion criteria
- 人class审批（若 required）
- Rollback plan 已创建

## 4. Pipeline Interface

### 4.1 PipelineExecution

```typescript
interface PipelineExecution {
  executionId: string;
  pipelineType: PipelineType;
  status: PipelineStatus;
  stages: StageExecution[];
  triggeredBy: "commit" | "schedule" | "manual" | "api";
  triggerReason?: string;
  startedAt: string;
  completedAt?: string;
  artifactRef?: ArtifactRef;
}

type PipelineStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "cancelled";

type PipelineType =
  | "build"
  | "test"
  | "package"
  | "publish"
  | "promotion"
  | "release";
```

### 4.2 StageExecution

```typescript
interface StageExecution {
  stageName: string;
  status: StageStatus;
  startedAt: string;
  completedAt?: string;
  output?: StageOutput;
  error?: StageError;
}

type StageStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";
```

### 4.3 ArtifactRef

```typescript
interface ArtifactRef {
  artifactId: string;
  registry: string;
  path: string;
  version: string;
  checksum: string;
  sizeBytes: number;
  publishedAt: string;
}
```

### 4.4 PromotionRequest

```typescript
interface PromotionRequest {
  artifactRef: ArtifactRef;
  targetEnvironment: Environment;
  targetRing?: RingStatus;
  approvalRequired: boolean;
  requestedBy: "scheduler" | "human" | "api";
  requestedAt: string;
}
```

## 5. Quality Gates

### 5.1 Build Gate

| 指标 | threshold | 验证方式 |
|------|------|---------|
| 编译success | 100% | 退出码 = 0 |
| 静态分析 | 0 errors | linter output |
| relies on扫描 | 0 high/critical | security scan |

### 5.2 Test Gate

| 指标 | threshold | 验证方式 |
|------|------|---------|
| Unit test | >= 95% pass | test report |
| Integration test | >= 90% pass | test report |
| Contract test | 100% pass | contract suite |
| Code coverage | >= 80% | coverage report |

### 5.3 Package Gate

| 指标 | threshold | 验证方式 |
|------|------|---------|
| 签名验证 | pass | gpg/sig verification |
| Size | < 100MB | manifest check |
| relies on锁定 | 100% | lock file validation |

### 5.4 Publish Gate

| 指标 | threshold | 验证方式 |
|------|------|---------|
| Registry auth | pass | 200 OK |
| 唯一性 | pass | checksum check |
| 元data完整 | pass | schema validation |

### 5.5 Promotion Gate

| 指标 | threshold | 验证方式 |
|------|------|---------|
| Ring criteria | 100% meet | metrics evaluation |
| Rollback plan | exists | plan check |
| Approval | approved (if required) | approval record |

## 6. Environment Types

```typescript
type Environment =
  | "development"   // 本地开发
  | "staging"       // 预发布
  | "production";   // 生产环境
```

## 7. Artifact Promotion Workflow

### 7.1 Normal Promotion Flow

```
1. Artifact 被 build 并via test
2. Artifact 被 package 并签名
3. Artifact 被 publish 到 registry
4. Promotion request 被创建
5. Quality gates 被验证
6. 如果 approvalRequired，等待人class审批
7. Artifact 被 promotion 到目标 environment/ring
8. Monitoring 被enabled
```

### 7.2 Rollback Flow

```
1. Monitoring 检测到Issue
2. Rollback criteria 被满足
3. Rollback request 被创建
4. Rollback plan 被执lines
5. Previous artifact 被 restore
6. Rollback 被record到 audit log
```

## 8. Pipeline Service Interface

```typescript
interface CiCdPipelineService {
  // 执lines完整 pipeline
  executePipeline(execution: PipelineExecution): Promise<PipelineExecution>;

  // 执lines单个 stage
  executeStage(stage: StageExecution): Promise<StageExecution>;

  // request artifact promotion
  requestPromotion(request: PromotionRequest): Promise<PromotionDecision>;

  // 执lines rollback
  executeRollback(artifactId: string, targetEnvironment: Environment): Promise<void>;

  // 获取 pipeline Status
  getPipelineStatus(executionId: string): Promise<PipelineExecution>;

  // 获取 artifact 历史
  getArtifactHistory(artifactId: string): Promise<ArtifactRef[]>;
}
```

## 9. Testing Requirements

### 9.1 Unit Tests

- Pipeline stage execution
- Quality gate evaluation
- Artifact promotion logic

### 9.2 Integration Tests

- Build → Test → Package → Publish flow
- Promotion request → approval → execution flow
- Rollback trigger → execution flow

### 9.3 Contract Tests

- 所有 quality gates 必须按 §13 defines验证
- Artifact 必须可追溯
- Rollback plan 必须存在

## 10. Closure Conclusion

CI/CD Pipeline 不is简单的 build-test-deploy 流程，而iscontains严格 quality gates、artifact promotion 和 rollback 能力的完整机制。每个 stage 都必须viadefines的 quality gate 才能进入下一 stage，确保发布风险可控。