# Sandbox And Auth Contract

## 1. Scope

This contract defines execution sandbox, filesystem/network permissions, user authentication, and auth provider boundaries.

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

- Execution permissions must be explicitly declared and default to deny.
- Remote kill switch should be able to interrupt high-risk runs.
- User authentication and agent execution permissions must not be mixed into one layer.
- Auth providers should be pluggable, but upper-layer permission semantics remain consistent.
- FileLock is responsible for concurrent write conflicts and does not replace sandbox path whitelist.
- Unified policy entry is defined by `policy_engine_contract.md`; sandbox / auth is only one type of constraint source.
- Path judgment must be based on `realpath` and cannot look only at original string path.
- Default deny follows symlinks not explicitly allowed.
- `AuthSession` only resolves identity and does not automatically grant execution permissions; execution capability still requires joint judgment by Policy Engine and sandbox.

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
- System verifies: token SHA256 match, challenge not expired, challenge not consumed.
- After verification passes, consumes challenge (not reusable), creates worker snapshot.
- Worker snapshot initializes `registrationVerified: true`, `consistencyCheckStatus: 'unknown'`.

### 5A.2 Rules

- Challenge token returned only once during issue phase, after which only hash is stored.
- Same challenge cannot be completed multiple times (one-time consumption).
- Expired challenge automatically invalidates.
- Filtered capabilities must be recorded in `rejectedCapabilities` for audit.
- Challenge does not replace runtime sandbox and policy, only solves worker identity and initial capability declaration.

## 5B. Remote Session Authority Guard

### 5B.1 Semantics

Remote session guard checks whether remote worker has execution permissions during dispatch phase.

### 5B.2 Blocking Conditions

| block reason | Trigger Condition | Meaning |
| --- | --- | --- |
| `viewer_only` | Worker remote session state is `viewer_only` | Worker has read-only permissions and cannot execute write operations |
| `consistency_mismatch` | `consistencyCheckStatus == 'mismatch'` | Worker inconsistent with control plane state |
| `resume_offset_missing` | Remote session state not `connecting / failed` and `lastAcknowledgedStreamOffset` is empty | Worker cannot confirm which message it has processed |

### 5B.3 Rules

- Non-remote deployment (`local`) workers are not subject to session guard constraints.
- `connecting` and `failed` states are exempt from offset check (connection in progress or already disconnected, cannot have offset).
- Blocking reason must be written to dispatch decision trace `reasonCode`.
- Session guard does not modify any state and is purely read-only judgment.

## 6. Supplementary Rules

- OAuth authorization code flow requires PKCE by default to prevent public client code leakage.
- Virtual path mapping must be explicit whitelist mapping and does not allow arbitrary path projection to host machine.
- Warm pool can only reuse base image or controlled sandbox and must not reuse execution environment with task residual state.
- Different tasks must not reuse sandbox instances with residual files, residual environment variables, residual secrets, or residual sockets.
- Auth tokens, temporary credentials, and worker-level credentials must not enter artifact, memory, event payload, or debug dump.
- Minimum command execution sandbox and browser / GUI automation sandbox should be managed in separate layers and not recommended to share the same heavyweight image.
- If browser sandbox needs Chromium, Xvfb, or equivalent graphics dependencies, should be treated as independent capability profile and enter separate readiness and cost evaluation.
- If standalone command execution surface exists, should be modeled separately from task / workflow main chain but still reuse the same `SandboxPolicy` shape to avoid a second sandbox protocol.
- PTY, stdin streaming, stdout/stderr streaming, output cap, timeout and other execution control items belong to command execution sub-protocol and should not be placed in prompt or free-text tool description.
