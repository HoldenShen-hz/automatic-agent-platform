# CI/CD Pipeline Contract

> **OAPEFLIR Related**: This contract defines the CI/CD pipeline mechanism for OAPEFLIR Improve Hub, corresponding to ADR-075 §13 pre-release and design document §9.1.
> **Update Date**: 2026-04-29

## 1. Scope

This contract defines the complete CI/CD pipeline mechanism for build, test, package, publish, and artifact promotion.

Related Documents:

- `release_rollout_and_rollback_contract.md`
- `ring_model_contract.md`
- `artifact_store_contract.md`
- [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)

## 2. Pipeline Overview

CI/CD Pipeline is responsible for promoting code, configuration, prompts, and other artifacts from the development environment to the production environment, ensuring that each stage's quality gate meets requirements.

### 2.1 Pipeline Stages

```
build → test → package → publish → artifact_promotion → staging → production
  ↓        ↓        ↓         ↓              ↓              ↓          ↓
[verify] [verify] [verify]  [verify]       [verify]      [verify]  [release]
```

## 3. Pipeline Stages

### 3.1 Build Stage

**Responsibility**: Compile/package source code into a deployable artifact

**Input**:
- Source code (Git commit)
- Dependencies
- Build configuration

**Output**:
- Build artifact (binary, container image, etc.)
- Build metadata (version, checksum, build time)

**Quality Gates**:
- Compilation succeeds with no errors
- Static analysis passes
- Dependency security scan passes

### 3.2 Test Stage

**Responsibility**: Execute various tests to ensure quality

**Test Types**:
- Unit tests
- Integration tests
- Contract tests
- E2E tests (optional)

**Quality Gates**:
- Unit test pass rate >= 95%
- Integration test pass rate >= 90%
- Contract test pass rate >= 100%
- No high/critical security issues

### 3.3 Package Stage

**Responsibility**: Package build artifact into a distributable format

**Output**:
- Package manifest
- Signed artifacts
- Package metadata

**Quality Gates**:
- Package signature verification passes
- Package size within limits
- Dependency versions locked

### 3.4 Publish Stage

**Responsibility**: Publish package to artifact registry

**Output**:
- Published artifact with registry location
- Publication timestamp
- Publisher identity

**Quality Gates**:
- Registry authentication passes
- Artifact uniqueness verification
- Duplicate artifact detection

### 3.5 Artifact Promotion Stage

**Responsibility**: Promote artifact within the ring model

**Promotion Rules** (corresponding to §13 pre-release):
- Ring 0 (off): No promotion
- Ring 1 (evaluate_0): Recording only, no production impact
- Ring 2-5: Promote according to ring_model_contract.md rules
- Release: Full release

**Quality Gates**:
- Ring promotion criteria met
- Human approval (if required)
- Rollback plan created

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

| Metric | Threshold | Verification Method |
|------|------|---------|
| Compilation success | 100% | Exit code = 0 |
| Static analysis | 0 errors | linter output |
| Dependency scan | 0 high/critical | security scan |

### 5.2 Test Gate

| Metric | Threshold | Verification Method |
|------|------|---------|
| Unit test | >= 95% pass | test report |
| Integration test | >= 90% pass | test report |
| Contract test | 100% pass | contract suite |
| Code coverage | >= 80% | coverage report |

### 5.3 Package Gate

| Metric | Threshold | Verification Method |
|------|------|---------|
| Signature verification | pass | gpg/sig verification |
| Size | < 100MB | manifest check |
| Dependency lock | 100% | lock file validation |

### 5.4 Publish Gate

| Metric | Threshold | Verification Method |
|------|------|---------|
| Registry auth | pass | 200 OK |
| Uniqueness | pass | checksum check |
| Metadata integrity | pass | schema validation |

### 5.5 Promotion Gate

| Metric | Threshold | Verification Method |
|------|------|---------|
| Ring criteria | 100% met | metrics evaluation |
| Rollback plan | exists | plan check |
| Approval | approved (if required) | approval record |

## 6. Environment Types

```typescript
type Environment =
  | "development"   // Local development
  | "staging"       // Pre-release
  | "production";   // Production environment
```

## 7. Artifact Promotion Workflow

### 7.1 Normal Promotion Flow

```
1. Artifact is built and passes test
2. Artifact is packaged and signed
3. Artifact is published to registry
4. Promotion request is created
5. Quality gates are verified
6. If approvalRequired, wait for human approval
7. Artifact is promoted to target environment/ring
8. Monitoring is enabled
```

### 7.2 Rollback Flow

```
1. Monitoring detects a problem
2. Rollback criteria is met
3. Rollback request is created
4. Rollback plan is executed
5. Previous artifact is restored
6. Rollback is recorded to audit log
```

## 8. Pipeline Service Interface

```typescript
interface CiCdPipelineService {
  // Execute complete pipeline
  executePipeline(execution: PipelineExecution): Promise<PipelineExecution>;

  // Execute single stage
  executeStage(stage: StageExecution): Promise<StageExecution>;

  // Request artifact promotion
  requestPromotion(request: PromotionRequest): Promise<PromotionDecision>;

  // Execute rollback
  executeRollback(artifactId: string, targetEnvironment: Environment): Promise<void>;

  // Get pipeline status
  getPipelineStatus(executionId: string): Promise<PipelineExecution>;

  // Get artifact history
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

- All quality gates must be verified according to §13 definition
- Artifacts must be traceable
- Rollback plan must exist

## 10. Closure Conclusion

CI/CD Pipeline is not a simple build-test-deploy flow, but a complete mechanism with strict quality gates, artifact promotion, and rollback capabilities. Each stage must pass the defined quality gate to enter the next stage, ensuring controllable release risk.