# Sandbox And Auth Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Execute Hub 的安全边界，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. Scope

This contract defines execution sandbox, filesystem/network permissions, user authentication, and authorization provider boundaries.

## 2. Key Objects

- `SandboxPolicy`
- `FilesystemRule`
- `NetworkRule`
- `AuthSession`
- `AuthProviderBinding`

## 3. SandboxPolicy Minimum Fields

- `policy_id`
- `mode`
- `filesystem_rules`
- `network_rules`
- `process_rules`
- `created_at`
- `realpath_enforced`
- `symlink_policy`
- `allowed_roots`
- `denied_roots`

## 4. AuthSession Minimum Fields

- `session_id`
- `subject_id`
- `provider`
- `scopes`
- `issued_at`
- `expires_at`

## 5. Behavioral Constraints

- Execution permission must be explicitly declared, default deny.
- Remote kill switch should be able to interrupt high-risk execution.
- User authentication and agent execution permission cannot be mixed into one layer.
- Authentication provider should be pluggable, but upper layer permission semantics remain consistent.
- FileLock is responsible for concurrent write conflicts, does not replace sandbox path whitelist.
- Unified policy entry is defined by `policy_engine_contract.md`; sandbox / auth is just one type of constraint source.
- Path judgment must be based on `realpath`, cannot just look at original string path.
- Default deny follows symlinks not explicitly allowed.
- `AuthSession` only solves identity, does not automatically grant execution permission; execution capability still needs joint decision through Policy Engine and sandbox.

## 5A. Remote Worker Registration and Challenge Authentication

### 5A.1 Two-Phase Registration Flow

Remote worker registration uses challenge-response mode:

**Phase 1: Issue Challenge**

- Requester declares `workerId`, `capabilities`, `isolationLevel`.
- System generates random `challengeToken` and stores its SHA256 hash (not plaintext).
- System filters requested capabilities according to `allowedCapabilities` in security config, records rejected capabilities.
- Challenge has TTL (default `challengeTtlMs = 300000`, i.e., 5 minutes).

**Phase 2: Complete Registration**

- Requester submits `challengeId` + original `challengeToken`.
- System verifies: token SHA256 matches, challenge not expired, challenge not consumed.
- After verification passes, consume challenge (non-reusable), create worker snapshot.
- Worker snapshot initializes `registrationVerified: true`, `consistencyCheckStatus: 'unknown'`.

### 5A.2 Rules

- Challenge token is returned only once during issue phase, thereafter only hash is stored.
- Same challenge cannot be completed twice (one-time consumption).
- Expired challenge automatically becomes invalid.
- Filtered capabilities must be recorded in `rejectedCapabilities` for audit.
- Challenge does not replace runtime sandbox and policy, only solves worker identity and initial capability declaration.

## 5B. Remote Session Authority Guard

### 5B.1 Semantics

Remote session guard checks during dispatch phase whether remote worker has execution permission.

### 5B.2 Blocking Conditions

| block reason | Trigger Condition | Meaning |
| --- | --- | --- |
| `viewer_only` | Worker remote session status is `viewer_only` | Worker has read-only permission, cannot execute write operations |
| `consistency_mismatch` | `consistencyCheckStatus == 'mismatch'` | Worker inconsistent with control plane status |
| `resume_offset_missing` | Remote session status is not `connecting / failed` and `lastAcknowledgedStreamOffset` is empty | Worker cannot confirm which message it has processed up to |

### 5B.3 Rules

- Non-remote deployment (`local`) workers are not subject to session guard constraints.
- `connecting` and `failed` status are exempt from offset check (still connecting or already disconnected, cannot have offset).
- Blocking reason must be written to dispatch decision trace's `reasonCode`.
- Session guard does not modify any state, purely read-only judgment.

## 6. Supplementary Rules

- OAuth authorization code flow defaults to requiring PKCE, preventing public client from leaking code.
- Virtual path mapping must be explicit whitelist mapping, does not allow arbitrary path projection to host.
- Warm pool can only reuse base image or controlled sandbox, must not reuse execution environment with task residual state.
- Different tasks must not reuse sandbox instance with residual files, residual environment variables, residual secrets, or residual sockets.
- Authentication tokens, temporary credentials, and worker-level credentials must not enter artifact, memory, event payload, or debug dump.
- Minimum command execution sandbox and browser / GUI automation sandbox should be managed in layers, not recommended to share same heavyweight image.
- If browser sandbox needs Chromium, Xvfb or equivalent graphics dependencies, should be treated as independent capability profile, and enter separate readiness and cost evaluation.
- If standalone command execution surface exists, should be modeled separately from task / workflow main chain, but still reuse same `SandboxPolicy` shape, avoiding second sandbox protocol.
- PTY, stdin streaming, stdout/stderr streaming, output cap, timeout这类 execution control items belong to command execution sub-protocol, should not be put into prompt or free-text tool description.


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-16: 隔离层级 standard/hardened/strict，架构§11.4定义 read_only/workspace_write/scoped_external_access/restricted_exec 完全不同的4层。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
