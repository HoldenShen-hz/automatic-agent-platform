# Sandbox And Auth Contract

> **OAPEFLIR Related**: This contract defines security boundaries for OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines execution sandbox, filesystem/network permissions, user authentication, and authorization provider boundaries.

## 2. Key Objects

- `SandboxPolicy`
- `SandboxCapabilityProfile`
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

`SandboxPolicy.mode` canonical enum:

- `read_only`
- `workspace_write`
- `scoped_external_access`
- `restricted_exec`

`SandboxCapabilityProfile` minimum fields:

- `mode`
- `execution_isolation`
- `filesystem_profile`
- `network_profile`
- `memory_limit_mb`
- `timeout_limit_ms`
- `approval_gate_required`

Rules:

- `read_only` only allows read-only mounts and no external egress.
- `workspace_write` only allows writes inside explicit workspace / tmpfs scope, still no external egress.
- `scoped_external_access` only allows allowlisted egress targets and explicit writable scratch space.
- `restricted_exec` is the highest-risk execution profile; it must run with explicit approval / policy justification and the strongest isolation profile.
- `standard / hardened / strict` only survive as deprecated migration aliases; new schema and new APIs must use the four canonical modes above.

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
- OAuth authorization code flow defaults to requiring PKCE, preventing public client from leaking code.
- Virtual path mapping must be explicit whitelist mapping, does not allow arbitrary path projection to host.
- Warm pool can only reuse base image or controlled sandbox, must not reuse execution environment with task residual state.
- Different tasks must not reuse sandbox instance with residual files, residual environment variables, residual secrets, or residual sockets.
- Authentication tokens, temporary credentials, and worker-level credentials must not enter artifact, memory, event payload, or debug dump.
- Minimum command execution sandbox and browser / GUI automation sandbox should be managed in layers, not recommended to share same heavyweight image.
- If browser sandbox needs Chromium, Xvfb or equivalent graphics dependencies, should be treated as independent capability profile, and enter separate readiness and cost evaluation.
- If standalone command execution surface exists, should be modeled separately from task / workflow main chain, but still reuse same `SandboxPolicy` shape, avoiding second sandbox protocol.
- PTY, stdin streaming, stdout/stderr streaming, output cap, timeout这类 execution control items belong to command execution sub-protocol, should not be put into prompt or free-text tool description.

### 5A. Remote Worker Registration and Challenge Authentication

### 5A.1 Two-Phase Registration Flow

Remote worker registration uses challenge-response mode:

**Phase 1: Issue Challenge**

- Requester declares `workerId`, `capabilities`, `sandboxMode`.
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
- Worker-declared `sandboxMode` is only a capability claim; whether a run can use that mode still depends on Policy Engine and dispatch-time constraints.

### 5B. Remote Session Authority Guard

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

### 6A. Canonical Sandbox Mode Matrix

| mode | filesystem | network | execution profile | typical use |
| --- | --- | --- | --- | --- |
| `read_only` | read-only mounts only | denied | subprocess + seccomp | inspect, search, parse |
| `workspace_write` | tmpfs + explicit workspace write roots | denied | subprocess + seccomp | code edit, local artifact generation |
| `scoped_external_access` | tmpfs + scoped writable roots | allowlist only | isolated multi-process / container optional | verified fetch, registry / API calls |
| `restricted_exec` | overlay / isolated fs | allowlist only | strongest isolated exec profile | privileged but tightly governed execution |

Rules:

- Sandbox mode must be decided before execution ticket dispatch and written into the execution constraint pack.
- Tool / provider / worker runtime must consume the resolved canonical mode, not reinterpret deprecated aliases locally.
- `AuthSession` does not upgrade sandbox mode; identity proof and sandbox authority are orthogonal.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-16: This document originally continued to use `standard / hardened / strict` three-tier isolation levels. Root cause: early security design stratified by "implementation strength", later main architecture changed to defining four canonical sandbox modes by "writability + egress + exec governance surface", but old worker registration and execution contract did not migrate together. Fix: Body now converges `SandboxPolicy.mode` to `read_only / workspace_write / scoped_external_access / restricted_exec`, old three tiers only retained as deprecated alias.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
