# Automatic Agent System Full-Project Review / Audit Methodology, Execution Plan, and Automated Assurance Pipeline

> Version: v1.3
> Date: 2026-06-02
> Goal: Based on historical issue analysis, conduct a systematic review and audit of the Automatic Agent System across code, documentation, tests, CI, release, and historical planning; by using coverage matrices, historical promise recovery, auditor self-tests, seeded defects, reverse tracing, and release gates, maximize the discovery of all issues and prevent historical problems from being repeatedly missed.
> Scope: `src/`, `ui/`, `scripts/`, `tests/`, `deploy/`, `.github/`, `config/`, `docs_zh/`, `docs_en/`, `eval/`, `redteam/`, `roi/`, `training-data-policy/`, historical ADR / Release / Review / Architecture / Planning documents.

> Structure note: This document contains multiple rounds of historical additions. When executing, do not only cite numeric section numbers; you must cite both "section title + anchor/path" to avoid ambiguity as the document grows.

---

## 0. Key Conclusion

Engineering-wise it is not realistic to truly promise "absolutely discovering all issues with zero omissions". Complex systems always have unknown unknowns.

But it is possible to achieve:

```text
1. All known issue sources are brought into the audit scope
2. All historical planning promises are converted into verifiable objects
3. All key system invariants are automatically checked
4. Every release claim must have evidence
5. All P0 issues must enter the CI/release gate
6. All new code must pass the same set of audit rules
7. All manual reviews must have a coverage matrix and dual-person verification
```

The goal should shift from "do not miss any bug" to:

```text
Do not miss any problem domain
Do not miss any historical promise source
Do not miss any P0/P1 problem type
Do not allow known types of issues to enter mainline again without a gate
```

The final deliverable should not be just a markdown report, but a continuously running Assurance System:

```text
Issue Ledger
Historical Promise Ledger
Contract Drift Report
Security Audit Report
Eval Oracle Report
Release Claim Evidence Report
Architecture Boundary Report
rc:check Release Gate
```

---

## 1. Review / Audit General Principles

### 1.1 Triple Independent Discovery Principle

Each critical problem domain must be covered by at least three independent methods:

```text
Static scanning
Dynamic / test verification
Manual architecture review
```

For example, tenant isolation issues:

```text
Static scanning: check whether all routes/repositories/queries include tenantId
Dynamic testing: construct A/B tenant access to the same object
Manual review: confirm whether the tenant model is consistent in contract/schema/runtime
```

### 1.2 Documentation Promises Are Audit Objects

The following words in historical documents must all be extracted:

```text
must / should / required / done / accepted / final / release-ready
production-grade / industry-grade / industry-leading / completed / releasable
Phase / P0 / P1 / gate / metric / event / API / UI / DoD
```

Any promise must be reconciled with:

```text
code implementation
contract/schema
test
CI gate
evidenceRef
owner
expiry
```

### 1.3 Zero-Trust Principle for Release Claims

The following claims are untrustworthy by default and must be re-verified:

```text
final release
production-ready
industry-leading
pilot-ready
done
accepted
fully implemented
```

Without evidence, downgrade to:

```text
proposed
draft
prototype
experimental
disabled_by_default
```

### 1.4 Fail-Closed Priority Principle

Default rules for all security, evidence, execution, and release paths:

```text
unknown = reject
missing = reject
malformed = reject
timeout = hold / retry / quarantine
failed check = block
no evidence = not releasable
```

Prohibited:

```text
catch warn continue
missing config fallback allow
invalid time ignore
no metrics allow rollout
no webhook secret skip verify
SBOM scan error still load plugin
```

### 1.5 All Issues Must Enter a Machine-Readable Ledger

A manual markdown is not enough. In the end they must enter:

```text
artifacts/assurance/issues.raw.jsonl
artifacts/assurance/issues.normalized.jsonl
artifacts/assurance/issues.deduped.jsonl
```

Each issue must have:

```json
{
  "issueId": "AAS-ISSUE-000001",
  "source": "code|doc|adr|release|test|ci|runtime|manual",
  "sourceRef": "file:line or doc section",
  "category": "security.tenant_isolation",
  "severity": "P0",
  "plane": "execution",
  "module": "lease",
  "description": "...",
  "rootCause": "...",
  "invariantViolated": "...",
  "evidence": ["..."],
  "fixStrategy": "...",
  "testRequired": ["unit", "integration", "chaos"],
  "gateRequired": ["audit:tenant-isolation"],
  "owner": "TBD",
  "status": "open"
}
```

---

## 2. Full-Project Audit Scope Map

### 2.1 Code Scope

```text
src/platform/five-plane-interface
src/platform/five-plane-control-plane
src/platform/five-plane-orchestration
src/platform/five-plane-execution
src/platform/five-plane-state-evidence
src/platform/shared
src/platform/model-gateway
src/platform/stability
src/domains
src/sdk
src/plugins
src/ops-maturity
src/interaction
src/scale-ecosystem
src/org-governance
src/core
src/runtime
```

### 2.2 UI Scope

```text
ui/apps/web
ui/packages/shared
ui/packages/features
ui/packages/features/mission-console
ui/packages/features/release-console
ui/packages/features/hitl
ui/packages/features/division-inventory
```

### 2.3 Scripts / Deployment / CI Scope

```text
scripts/
scripts/ci/
scripts/dev/
scripts/validation/
bin/
Dockerfile
docker-compose.yml
deploy/
.github/workflows/
package.json
package-lock.json
tsconfig*.json
eslint.config.js
stryker.config.mjs
```

### 2.4 Governance Asset Scope

```text
config/
config/division-coverage/
config/tool-risk/
config/policy/
config/validation/
eval/
redteam/
roi/
training-data-policy/
deploy/runbooks/
```

### 2.5 Documentation and Historical Planning Scope

```text
docs_zh/reference/
docs_zh/releases/
docs_zh/adr/
docs_zh/architecture/
docs_zh/contracts/
docs_zh/reviews/
docs_zh/quality/
docs_zh/governance/
docs_zh/operations/
docs_en/
README.md
AGENTS.md
MEMORY.md
CONTRIBUTING.md
Historical Marp / PPT / Markdown planning
```

### 2.6 `docs_zh/reviews/` Must Be an Authoritative Issue Input

`docs_zh/reviews/` is not ordinary background documentation, but a first-class input source that has gone through multiple rounds of manual and automatic review and contains real issues and closure evidence. Any "full-project audit" that does not explicitly consume these review files will systematically miss already-identified problem domains.

Minimum required to include:

```text
docs_zh/reviews/issues-table.md
docs_zh/reviews/platforme-full-review.md
docs_zh/reviews/platforme-full-review-a.md
docs_zh/reviews/platforme-full-review-b.md
docs_zh/reviews/platforme-full-review-c.md
docs_zh/reviews/platforme-full-review-d.md
docs_zh/reviews/platforme-full-review-e.md
docs_zh/reviews/platforme-full-review-ee.md
docs_zh/reviews/platform-architecture-implementation-consistency-audit.md
docs_zh/reviews/platform-architecture-implementation-consistency-audit_round.md
docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md
docs_zh/reviews/system-review-2026-05-26.md
docs_zh/reviews/ui-design-vs-implementation-review.md
docs_zh/reviews/v3_2_release_baseline_verification.md
docs_zh/reviews/current-codebase-gap-review-v1.9.md
docs_zh/reviews/full-cleanup-review.md
docs_zh/reviews/temp-cache-cleanup.md
docs_zh/reviews/architecture-design-review.md
docs_zh/reviews/architecture-design-vs-implementation-review.md
docs_zh/reviews/README.md
```

These files already cover several categories of real problem sources in the current repository:

```text
Real code-level defects
Design / implementation deviations
Test quality issues (hard wait / cleanup leak / type escape hatch)
Documentation state drift and review conclusion conflicts
Release claim overstatement
System-level manual sampling gaps
UI contract and platform shell inconsistencies
Temporary artifacts / cleanup / environment hygiene governance
```

### 2.7 Authoritative Source Priority and Conflict Resolution

If the conclusion of the same issue is inconsistent across code/runtime/test/docs/review/release documents, it must be adjudicated by authoritative source priority, not by "who wrote it more recently or more emphatically".

Default priority:

```text
runtime / truth data / executable test evidence
> code path / schema / route / CI config
> review finding with concrete evidenceRef
> release / reference / architecture / planning documents
> README / summary-style explanations
```

Conflict resolution rules:

```text
1. Doc says done, but runtime/test proves not closed: take runtime/test as the truth and mark as not completed
2. Review says fixed, but new regression still fails: take the latest failing evidence as the truth and revert to open
3. Architecture doc and implementation conflict, but review does not cover: generate a new implementation drift issue
4. Multiple reviews conflict with each other: keep all sourceRefs and decide latestStatus by latestReviewDate + stronger evidence
5. When unadjudicable, do not allow closure; only enter needs_revalidation
```

---

## 3. Overall Execution Flow

The complete audit is divided into 12 phases.

```text
Phase 0: Freeze & Baseline
Phase 1: Source Inventory
Phase 2: Historical Promise Recovery
Phase 3: Architecture Boundary Audit
Phase 4: Contract / Schema / Runtime Audit
Phase 5: Security Audit
Phase 6: Execution Correctness Audit
Phase 7: State Evidence / Audit / Receipt Audit
Phase 8: Eval / Redteam / Golden Audit
Phase 9: UI / Console / Operator Safety Audit
Phase 10: CI / Scripts / Supply-chain Audit
Phase 11: Domain / Mission / Playbook Audit
Phase 12: Release Gate & Evidence Bundle
```

---

## 4. Phase 0: Freeze & Baseline

### 4.1 Immediately Freeze Release Language

All of the following statuses are downgraded until the evidence gate is completed:

```text
final
production-ready
industry-leading
fully implemented
release-ready
done
accepted
```

Changed to:

```text
draft
proposed
implementation baseline
RC
experimental
disabled_by_default
```

### 4.2 Freeze New Features

Before P0 audit is complete, prohibit further expansion of:

```text
new domain
new Mission Playbook
new plugin marketplace capability
new release claim
new production-ready claim
new external connector
new high-risk automation
```

### 4.3 Establish Baseline Snapshot

Output:

```text
artifacts/assurance/baseline/repo-file-index.json
artifacts/assurance/baseline/package-scripts.json
artifacts/assurance/baseline/routes.json
artifacts/assurance/baseline/contracts.json
artifacts/assurance/baseline/events.json
artifacts/assurance/baseline/metrics.json
artifacts/assurance/baseline/tests.json
```

---

## 5. Phase 1: Source Inventory

### 5.1 File-Level Asset Inventory

Scan all files and classify them:

```text
code
test
config
schema
doc
workflow
script
fixture
dataset
runbook
report
```

Additional requirement: Files in `docs_zh/reviews/*.md` and `docs_en/**/*.md` that carry review / verification / baseline / cleanup semantics must not only be classified as ordinary `doc`; they must additionally be tagged with:

```text
review_source
issue_source
claim_source
verification_source
historical_snapshot
```

Otherwise, later Promise Ledger / Issue Ledger / Dedup processes will mistakenly demote the real issue ledger to "background documentation".

Output:

```text
source-inventory.json
```

Fields:

```json
{
  "path": "src/platform/five-plane-execution/lease/execution-lease-service.ts",
  "kind": "code",
  "plane": "execution",
  "module": "lease",
  "owner": "TBD",
  "hasTests": false,
  "hasContract": false,
  "riskTags": ["lease", "fencing", "execution"]
}
```

### 5.2 Module Ownership Inventory

Must establish:

```text
module → plane → owner → contract → tests → CI gate
```

Prohibit P0 modules with no clear owner from entering release.

---

## 6. Phase 2: Historical Promise Recovery

This is key to avoiding missing historical issues.

### 6.1 Extract Historical Promises

Scan:

```text
docs_zh/
docs_en/
docs_zh/reviews/
README.md
AGENTS.md
MEMORY.md
CONTRIBUTING.md
Historical planning md/ppt/marp
```

Extract keywords:

```bash
rg -n "必须|应当|应该|MUST|SHOULD|required|require|shall|验收|DoD|Acceptance" docs_zh docs_en README.md AGENTS.md MEMORY.md
rg -n "done|accepted|final|release-ready|production-ready|industry-leading|已完成|可发布|行业领先" docs_zh docs_en README.md
rg -n "Phase|P0|P1|P2|gate|metric|event|API|endpoint|UI|runbook|evidence" docs_zh docs_en
```

For `docs_zh/reviews/`, you must additionally extract "issue status words" and "evidence words", otherwise you will miss real existing gaps:

```bash
rg -n "todo|fixed|done|已解决|已复核关闭|风险接受|治理项|未解决|部分完成" docs_zh/reviews docs_en
rg -n "Review结论|根因|证据|验证结果|定向测试|回归命令|审查日期" docs_zh/reviews docs_en
```

### 6.2 Generate a Promise Ledger Per Promise

```json
{
  "promiseId": "AAS-PROMISE-000001",
  "sourceFile": "docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md",
  "sourceSection": "L20",
  "promiseText": "P0 pilots are done",
  "promiseType": "release_claim",
  "expectedArtifacts": [
    "pilot report",
    "eval suite",
    "redteam result",
    "ROI baseline",
    "CI gate"
  ],
  "actualArtifacts": [],
  "status": "unverified",
  "generatedIssueId": "AAS-ISSUE-..."
}
```

### 6.3 Architecture Diagram Reconciliation

Extract from Mermaid / Marp / PPT diagrams:

```text
nodes
edges
planes
services
data stores
events
control gates
```

Each node must be reconciled with:

```text
code exists
tests exist
owner exists
runtime path exists
observability exists
```

Each edge must be reconciled with:

```text
import/call/API/event exists
has contract
has error handling
has test
```

### 6.4 ADR Reconciliation

Each ADR must be checked:

```text
Is the status legal
Is Accepted implemented
Does Superseded have a pointer
Is the implementation plan completed
Do the acceptance criteria have tests
Does risk mitigation have runtime guard
```

### 6.5 Review Ledger Recovery

The review tables, manual sample reviews, baseline verifications, and cleanup reviews in `docs_zh/reviews/` must be recovered into a machine-readable review ledger, not left as only markdown.

Recommended output:

```text
artifacts/assurance/review-ledger.raw.jsonl
artifacts/assurance/review-ledger.normalized.jsonl
artifacts/assurance/review-source-coverage-report.json
artifacts/assurance/review-conflict-resolution-report.jsonl
```

Minimum fields:

```json
{
  "reviewSourceId": "AAS-REVIEW-SRC-000001",
  "sourceFile": "docs_zh/reviews/platforme-full-review-e.md",
  "rowId": "1439",
  "title": "Test hard wait depends on real wall-clock",
  "status": "todo",
  "severity": "P1",
  "category": "test_quality.hard_wait",
  "sourceKind": "review_table",
  "evidenceRefs": [
    "tests/unit/platform/interface/ingress/distributed-rate-limiter.unit.test.ts:307"
  ]
}
```

If the review original does not explicitly state `severity`, you must generate initial priority by the following signals, then enter manual review:

```text
Whether it involves security / tenant / execution / release gate
Whether there is already a failing test or manual review evidence
Whether it points to a production claim / UI operator path / CI gate
Whether it would cause state divergence, silent failure, or false green
```

### 6.5.1 `review-ledger` Minimum Schema Contract

To avoid different scripts producing different field names, you must converge on at least one formal schema. During implementation, it is recommended to also land:

```text
docs_zh/contracts/review_ledger_contract.md
schemas/review-ledger.schema.json
```

Minimum schema constraints:

```json
{
  "type": "object",
  "required": [
    "reviewSourceId",
    "sourceFile",
    "rowId",
    "title",
    "status",
    "category",
    "sourceKind",
    "sourceRefs"
  ],
  "properties": {
    "reviewSourceId": { "type": "string", "pattern": "^AAS-REVIEW-SRC-" },
    "sourceFile": { "type": "string" },
    "rowId": { "type": "string" },
    "canonicalIssueId": { "type": ["string", "null"] },
    "title": { "type": "string", "minLength": 1 },
    "status": {
      "type": "string",
      "enum": [
        "todo",
        "fixed",
        "done",
        "partial",
        "accepted_risk",
        "stale",
        "needs_revalidation"
      ]
    },
    "severity": {
      "type": ["string", "null"],
      "enum": ["P0", "P1", "P2", "P3", null]
    },
    "category": { "type": "string", "minLength": 1 },
    "sourceKind": {
      "type": "string",
      "enum": [
        "review_table",
        "manual_sample",
        "baseline_verification",
        "cleanup_review",
        "issue_summary",
        "release_review"
      ]
    },
    "sourceRefs": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "evidenceRefs": {
      "type": "array",
      "items": { "type": "string" }
    },
    "testRefs": {
      "type": "array",
      "items": { "type": "string" }
    },
    "docRefs": {
      "type": "array",
      "items": { "type": "string" }
    },
    "latestStatus": { "type": ["string", "null"] },
    "latestReviewDate": { "type": ["string", "null"] },
    "latestClosureNote": { "type": ["string", "null"] },
    "freshness": {
      "type": ["string", "null"],
      "enum": ["fresh", "stale", "revalidated", "superseded", "needs_revalidation", null]
    }
  },
  "additionalProperties": false
}
```

Minimum requirements:

```text
1. No undeclared fields are allowed in the normalized ledger
2. category / status / sourceKind must be enum-constrained
3. One normalized issue can attach multiple sourceRefs, but each original finding must still be reverse-traceable
4. Both raw and normalized ledgers must be schema-validatable
```

### 6.5.2 `review-source-coverage-report`: Proving Reviews Were Really Imported

Merely "claiming to include docs_zh/reviews" is not enough; you must generate an import integrity proof, answering:

```text
Which review files were scanned
How many findings were identified per file
How many successfully entered the raw ledger
How many successfully entered the normalized ledger
Which entries were not imported due to format anomalies / conflicts
Whether there are review files that are completely uncovered
```

Recommended format:

```json
{
  "generatedAt": "2026-06-02T12:00:00Z",
  "reviewSources": [
    {
      "sourceFile": "docs_zh/reviews/platforme-full-review-e.md",
      "detectedRows": 1442,
      "rawImportedRows": 1442,
      "normalizedLinkedRows": 1442,
      "droppedRows": 0,
      "dropReasons": []
    }
  ],
  "unscannedReviewFiles": [],
  "filesWithParseWarnings": [],
  "overallStatus": "pass"
}
```

If any of the following is true, `assurance:full` cannot report completion:

```text
There are unscanned authoritative review files
detectedRows > rawImportedRows without explicit dropReasons
droppedRows > 0 but no owner / follow-up issue
parseWarnings exist but did not enter the issue ledger
```

### 6.5.3 `review-conflict-resolution-report`: Proving How Conflicts Were Resolved

When the same issue has inconsistent conclusions across different reviews / documents / code / tests, an auditable conflict resolution record must be kept, rather than silently overwriting it in the final ledger.

It is recommended that each record include at least:

```json
{
  "conflictId": "AAS-REVIEW-CONFLICT-000001",
  "canonicalIssueId": "AAS-ISSUE-000321",
  "sourceRefs": [
    "docs_zh/reviews/platforme-full-review-b.md#206",
    "docs_zh/reviews/system-review-2026-05-26.md#SYS-004"
  ],
  "conflictType": "status_mismatch",
  "candidates": [
    { "status": "fixed", "basis": "review note", "evidenceRefs": [] },
    { "status": "todo", "basis": "failing regression test", "evidenceRefs": ["tests/..."] }
  ],
  "decision": "todo",
  "decisionBasis": "executable_test_evidence_precedes_review_note",
  "decidedAt": "2026-06-02T12:00:00Z",
  "decidedBy": "assurance:review-conflict-resolver"
}
```

Minimum supported conflict types:

```text
status_mismatch
severity_mismatch
duplicate_but_not_same_object
doc_claim_vs_runtime
review_fixed_vs_test_failed
release_claim_vs_evidence_missing
```

The following conflicts may not be auto-closed without a resolution report:

```text
fixed vs failing test
done vs missing runtime path
accepted risk vs missing expiry/owner
release-ready vs missing evidence bundle
```

### 6.6 Review Freshness and Re-validation

Review documents are not permanent truth. Any review conclusion that diverges from the current code state, test state, or release state must be marked as stale and re-validated.

Minimum required to record:

```text
reviewDate
reviewedCommit / reviewedTag
reviewedPaths
evidenceDate
revalidatedAt
revalidatedBy
```

The following cases must force re-validation rather than directly reusing the old conclusion:

```text
1. Relevant code paths have changed
2. Relevant tests have new / deleted / skip status changes
3. release / architecture / contract documents have been rewritten
4. More than the agreed window (e.g., 30 days) since the last review
5. The old conclusion has no evidenceRef or only cites manual verbal judgment
```

The review ledger must support at least:

```text
fresh
stale
revalidated
superseded
needs_revalidation
```

---

## 7. Phase 3: Architecture Boundary Audit

### 7.1 Five-Plane Import Boundaries

Goal:

```text
interface → contracts/shared only
control → contracts/state abstractions only
orchestration → contracts/execution abstractions only
execution → contracts/state abstractions only
state-evidence → no reverse plane dependency
```

Prohibited:

```text
execution imports orchestration internals
execution imports control concrete implementation
contracts export concrete plane implementation
core facade re-exports multiple planes
```

### 7.2 Scan Rules

```bash
rg -n "from .*five-plane-orchestration" src/platform/five-plane-execution
rg -n "from .*five-plane-control-plane" src/platform/five-plane-execution
rg -n "from .*five-plane-state-evidence" src/platform/five-plane-execution
rg -n "export .*five-plane-control-plane" src/platform/contracts
```

### 7.3 Outputs

```text
architecture-boundary-report.json
architecture-boundary-violations.md
```

---

## 8. Phase 4: Contract / Schema / Runtime Audit

### 8.1 Reconciliation Objects

```text
docs_zh/contracts/*.md
src/platform/contracts/**/*.ts
Zod schemas
JSON schemas
OpenAPI
runtime validators
default config
tests
```

### 8.2 Required Categories

```text
EventEnvelope
HarnessRun
TaskIntakeRequest
Mission
BudgetLedger
SideEffect
Receipt
ErrorCode
Configuration layers
Runtime State Machine
OAPEFLIR boundaries
Project structure
```

### 8.3 Check Rules

Each contract field must be checked:

```text
docs exists
TS type exists
runtime schema exists
JSON schema exists if external
OpenAPI exists if API
producer writes it
consumer reads it
test covers it
```

Each enum must be checked:

```text
docs enum == TS enum == schema enum == runtime transition table
```

Each state machine must be checked:

```text
state set consistent
transition set consistent
terminal immutable
invalid transition rejected
transition event emitted
transition receipt / audit written
```

### 8.4 Outputs

```text
contract-drift-report.json
contract-drift-report.md
```

---

## 9. Phase 5: Security Audit

### 9.1 Tenant Isolation Audit

Check all:

```text
routes
repositories
queries
websocket broadcasts
event subscriptions
artifact/evidence/knowledge reads
debugger/replay/recovery paths
domain services
admin endpoints
```

Must prove:

```text
tenantId required
workspaceId/projectId if applicable
object belongs to tenant
cross-tenant attempt returns indistinguishable error
audit event written
```

### 9.2 Secret Sink Audit

Scan sinks:

```text
console.log / stderr / stdout
logger.*
throw new Error
AppError
event payload
audit metadata
receipt metadata
span attributes
metric labels
JSON.stringify(result)
VCR fixture
offline queue
IndexedDB / localStorage / sessionStorage
CI artifact
```

Scan sources:

```text
token
secret
password
dsn
credential
apiKey
authorization
private_key
client_secret
bearer
jwt
webhook
kms
vault
```

### 9.3 Auth / RBAC / Approval Audit

Check:

```text
service principal role mapping
operator check
break-glass
HITL approval
multi-party approval
delegate vote dedupe
no-go policy
high-risk action list
manual takeover
```

### 9.4 SSRF / Path / Sandbox Audit

Check:

```text
URL allowlist
private IP ranges
IPv4-mapped IPv6
metadata host
file:// refs
symlink
realpath
root guard
rm/mv/cp/writeFile/readFile
sandbox mode aliases
denied roots
```

---

## 10. Phase 6: Execution Correctness Audit

### 10.1 Idempotency Audit

All write paths check:

```text
idempotency key required
atomic SETNX / INSERT ON CONFLICT
same key same response
conflict key detected
5xx not cached
large response not stored
body fallback disabled
```

### 10.2 Queue Audit

Check:

```text
enqueue atomic
dequeue visibility timeout
ack/nack state machine
retry backoff cap
DLQ dedupe
priority stable ordering
Redis Lua or fail startup
SQLite transaction
```

### 10.3 Lease / Fencing Audit

Check:

```text
acquire uses DB sequence
renew WHERE fencingToken
release WHERE fencingToken
expired worker cannot release new lease
leadership fencing persistent
clock skew margin
lease audit for blocked attempts
```

### 10.4 Side-effect / Compensation Audit

Check:

```text
prepare
pre-commit validation
commit journal
idempotency key
commit receipt
verify receipt
compensation plan
compensation CAS
partial failure repair
```

### 10.5 Recovery / Replay Audit

Check:

```text
tenant filter
target exact match
DLQ dedupe
repair transaction boundary
replacement ticket attempt uniqueness
traceId causality preserved
bounded fan-out
hasRealSideEffect complete
```

---

## 11. Phase 7: State Evidence / Audit / Receipt Audit

### 11.1 Audit Chain

Check:

```text
persistent audit store
prevHash
HMAC/signature
chainPosition continuity
event checksum
tenant scope
redaction
no silent truncation
```

### 11.2 Receipt

Check:

```text
receipt factory
signature/MAC
payload hash
schema version
producer identity
access policy
retention policy
persistence
verification test
```

### 11.3 Event Outbox

Check:

```text
truth mutation + event append same transaction
idempotency key
partition key
consumer ack atomic
DLQ dedupe
replay monotonic cursor
projection rebuild no offset leak
```

### 11.4 Evidence Bundle

Check:

```text
bundleHash
signature
included reports
source refs
validation run id
config version
contract schema version
event registry hash
verification CLI
```

---

## 12. Phase 8: Eval / Redteam / Golden Audit

### 12.1 Eval Oracle Anti-Fake

Prohibited:

```text
expectedOutput as actualOutput
constant treatment/control scores
judge reads submitted score
empty expected passes
static scorecard text
```

### 12.2 Dataset Audit

Each dataset must have:

```text
dataset-card.json
samples
sample count
frozenHash actual sha256
contaminationStatus evidence
retentionPolicyRef correct
schema additionalProperties:false
```

### 12.3 Redteam Audit

Each redteam suite must have:

```text
schema
caseId
objective
severity
scope
evidenceRefs
runner
result
critical_success count
release blocking gate
```

### 12.4 Golden / Replay Audit

Check:

```text
frozen clock
deterministic id
seed injected
exact event match or allowed diff list
extra events fail unless allowlisted
fixture fingerprint includes full model/tool params
secret redaction
```

---

## 13. Phase 9: UI / Console / Operator Safety Audit

### 13.1 Token Storage

Prohibited:

```text
bearer in meta
Authorization in IndexedDB
JWT no exp accepted
PKCE verifier readable by arbitrary script
SharedWorker global token shared across origins/ports
```

### 13.2 WebSocket / SharedWorker

Check:

```text
origin/source validation
tenant-scoped subscription
broadcast authorization
malformed frame try/catch
reconnect backoff cap
token rotation
logout clears cache
```

### 13.3 High-Risk Operator UX

Must have:

```text
secondary confirmation
risk summary
scope display
approval reference
receipt
undo/rollback if applicable
bulk operation partial failure UI
```

### 13.4 Console Placeholder Audit

All console features must be classified:

```text
real
mock
placeholder
disabled
experimental
```

mock/placeholder must not enter production-ready claim.

---

## 14. Phase 10: CI / Scripts / Supply-chain Audit

### 14.1 Scripts Path Safety

Scan:

```text
rmSync
rm -rf
mv -f
cp
writeFileSync
readFileSync
mkdirSync
symlinkSync
spawn/spawnSync/exec
```

All paths must:

```text
resolve repoRoot
realpath
startsWith allowed root
reject symlink if unsafe
size limit
atomic tmp + fsync + rename
```

### 14.2 CI Workflow Audit

Check:

```text
permissions least privilege per job
pull_request untrusted code isolation
no shared cache between PR and release
actions pinned SHA
Docker image digest pin
GITHUB_TOKEN minimized
secrets masked field-level
```

### 14.3 Dependency Audit

Check:

```text
package-lock registry
runtime deps no ^
overrides/resolutions
npm ci --ignore-scripts where possible
Docker npm lifecycle root risk
base image digest
SBOM/cosign/provenance
```

---

## 15. Phase 11: Domain / Mission / Playbook Audit

### 15.1 Mission

Check:

```text
MissionKind enum
MissionRole
MissionPermission
MissionRecord fields
Lifecycle state machine
Mission transition side effects
Mission SQL repository
Mission event sequence
Mission API headers
Mission UI pages
Mission live guard
```

### 15.2 Playbook

Check:

```text
MissionPlaybookRegistry
ResolutionPolicy
MigrationPlan
StageExitDecision
StageTransitionCommand
StageExit transaction
FailureMode detection
Outcome measurement
SkillPack lifecycle
WorkflowRecording policy
```

### 15.3 YONO / Experimental Domains

Each domain must have:

```text
release scope
disabled_by_default flag
SQL/migration if persistent
tenant field
risk policy
state machine
API coverage
eval/redteam
metrics
admin/ops
```

If it is only a prototype, it must be marked:

```text
experimental
not production
not release blocking
not industry claim evidence
```

---

## 16. Phase 12: Release Gate & Evidence Bundle

### 16.1 rc:check Must Aggregate

```bash
npm run assurance:full
npm run test:p0
npm run test:chaos:p0
npm run test:redteam:p0
npm run test:golden:strict
npm run evidence:bundle:verify
```

Among them, `assurance:full` is responsible for aggregating the low-level audits:

```text
audit:contracts-sync
audit:release-claims
audit:secret-sinks
audit:tenant-isolation
audit:plugin-security
audit:eval-oracle
audit:path-safety
audit:execution-invariants
audit:historical-promises
```

### 16.2 Release Blocker Rules

If any of the following exists, release is prohibited:

```text
open P0
unverified final/production-ready/industry-leading claim
contract drift P0
secret sink P0
tenant isolation P0
eval oracle fake pass
plugin verification fail-open
side-effect receipt missing
unsigned evidence bundle
P0 alert without runbook
```

### 16.3 Evidence Bundle

Output:

```text
artifacts/release/evidence-bundle.json
artifacts/release/evidence-bundle.sig
artifacts/release/rc-check-report.json
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/eval-oracle-report.json
artifacts/assurance/redteam-report.json
artifacts/assurance/golden-replay-report.json
artifacts/assurance/review-ledger.normalized.jsonl
artifacts/assurance/review-evidence-readiness-report.json
artifacts/assurance/historical-promises.jsonl
artifacts/assurance/assumptions.jsonl
artifacts/assurance/issues.deduped.jsonl
artifacts/assurance/test-to-issue-map.json
artifacts/assurance/historical-issue-regression-map.json
artifacts/assurance/completeness-coverage-matrix.json
artifacts/assurance/seeded-defect-report.json
artifacts/assurance/assurance-full-report.json
```

---

## 17. Review Team Division of Labor

### 17.1 Required Roles

| Role | Responsibility |
|---|---|
| Platform Architect | Architecture boundaries, contracts, source-of-truth |
| Security Reviewer | tenant, secret, auth, plugin, SSRF, CI supply-chain |
| Execution Reviewer | queue, lease, fencing, recovery, side-effect |
| Evidence Reviewer | audit, receipt, event, projection, evidence bundle |
| Eval Reviewer | eval, redteam, golden, judge, dataset |
| UI Reviewer | token storage, operator UX, console RBAC |
| Ops Reviewer | scripts, backup/restore, runbook, SLO, DR |
| Domain Reviewer | Mission, YONO, marketplace, division/family |
| Release Owner | rc gate, claim evidence, P0 closure |

### 17.2 Dual-Person Review

All P0 domains must:

```text
primary reviewer
independent reviewer
owner sign-off
evidence link
```

---

## 18. Audit Completion Criteria

It is not "finished reading the code" that counts as done, but rather satisfying:

```text
1. source inventory covers 100%
2. historical promise ledger generated
3. all known issues imported into the issue ledger
4. every P0 issue has owner/fix/test/gate
5. every P0 category has an automatic gate
6. contract drift report has no P0
7. release claim report has no unverified claim
8. eval oracle report has no fake-pass path
9. secret sink report has no P0
10. tenant isolation report has no P0
11. evidence bundle is signable
12. rc:check one-click run and failure blocks release
```

### 18.1 Issues Must First Be Split into "Repo-Closeable" and "External Evolution"

Audit completion does not mean "all issues are fixed in this repo's code". You must first split the issues, otherwise two bad outcomes will appear:

```text
1. Disguising external infrastructure / integration items as in-repo code gaps
2. Using "external reasons" to wrongly exempt real in-repo gaps
```

Minimum classification:

```text
repo_actionable
repo_test_or_doc_actionable
external_integration
deployment_topology
risk_accepted_with_expiry
residual_risk
```

Each non-`repo_actionable` issue must have:

```text
Why it cannot be closed in a single cycle in this repo
Current compensating control
owner
expiry / revisit date
Next verification entry
```

Release conclusion must separately count:

```text
in-repo unfinished gap count
external evolution item count
risk acceptance count
residual risk count
```

---

## 19. Final Recommendations

Subsequent review/audit of the Automatic Agent System can no longer rely on humans "doing another review". It must shift to the following mechanisms:

```text
historical issue → issue ledger
historical promise → promise ledger
architecture diagram → architecture ledger
contract → schema/runtime/test gate
security invariant → static + dynamic audit
execution invariant → chaos/concurrency test
eval/redteam → anti-fake oracle
release claim → evidence gate
```

End goal:

```text
All historical known issues are traceable
All historical planning promises are verifiable
All P0 problem types can be automatically blocked
All new code cannot bypass the same set of gates
```

This is the correct way to "ensure that all issues are found as much as possible without systematic omission".

---

## 20. Re-Review Conclusion: What v1.0 May Still Miss

v1.0 already covers code, documentation, historical planning, CI, tests, Release, UI, Execution, Evidence and other main domains, but if the goal is "to ensure that issues are not missed as much as possible", the following 12 mechanisms must be added.

| # | v1.0 Gap | Missed-Inspection Risk | v1.1 Enhancement |
|---:|---|---|---|
| 1 | Lacks a "problem domain × source × method" coverage matrix | Some problem domains are covered only by manual review and not by automatic scanning | Add Completeness Coverage Matrix |
| 2 | Lacks reverse tracing from "historical issue → audit rule" | Already-discovered issues may still appear next time | Add Historical Issue Regression Map |
| 3 | Lacks tests for the audit tool itself | The scanner is written but missed/false-positives are not discovered | Add Audit Tool Test Harness |
| 4 | Lacks negative sample / seeded defect validation | Gate looks like it runs but actually cannot catch target issues | Add Seeded Defect Test |
| 5 | Lacks cross-source reconciliation | Missing any layer of docs, schema, runtime, tests, CI may be missed | Add N-way Reconciliation |
| 6 | Lacks "new PR delta audit" | Only a one-time full audit, then drifts again | Add PR Delta Audit |
| 7 | Lacks handling of uncertain items | Uncertain issues are skipped | Add Unknown-to-Issue Policy |
| 8 | Lacks issue dedup and split rules | 5000+ raw issues can become unexecutable noise | Add Dedup / Cluster / Epic Policy |
| 9 | Lacks fix acceptance criteria | Issue is marked fixed but no regression test / gate | Add Fix Verification Contract |
| 10 | Lacks audit coverage score | Don't know how many blind spots remain | Add Coverage Scorecard |
| 11 | Lacks anti-gaming strategy | Developers can bypass scanners by renaming / wrapping | Add Anti-gaming Rules |
| 12 | Lacks data flow / threat model audit | File-only scanning misses cross-module data flow issues | Add Dataflow & Threat Model Audit |

Conclusion:

```text
v1.0 is a complete audit process.
v1.1 must be upgraded to an "omission-prevention closed-loop system".
```

---

## 21. Core Omission-Prevention Mechanism: Completeness Coverage Matrix

### 21.1 Coverage Matrix Goal

Each problem category must be covered by at least the following dimensions:

```text
Source Coverage
Method Coverage
Evidence Coverage
Gate Coverage
Regression Coverage
Owner Coverage
```

### 21.2 Problem Domain × Audit Method Matrix

| Problem Domain | Static Scan | Dynamic Test | Manual Arch Review | Historical Promise | CI Gate | Regression Seed |
|---|---:|---:|---:|---:|---:|---:|
| Release claim distortion | Required | Required | Required | Required | Required | Required |
| Contract/schema/runtime drift | Required | Required | Required | Required | Required | Required |
| Tenant isolation | Required | Required | Required | Optional | Required | Required |
| Secret leakage | Required | Required | Required | Optional | Required | Required |
| Plugin/SBOM/signature | Required | Required | Required | Required | Required | Required |
| Queue/idempotency | Required | Required | Required | Optional | Required | Required |
| Lease/fencing | Required | Required | Required | Optional | Required | Required |
| Side-effect/receipt | Required | Required | Required | Required | Required | Required |
| Audit/evidence chain | Required | Required | Required | Required | Required | Required |
| Eval/redteam/golden fake pass | Required | Required | Required | Required | Required | Required |
| UI token/operator safety | Required | Required | Required | Optional | Required | Required |
| Scripts/path/CI supply-chain | Required | Required | Required | Optional | Required | Required |
| Mission/playbook lifecycle | Required | Required | Required | Required | Required | Required |
| Domain prototype scope | Required | Optional | Required | Required | Required | Required |
| Observability/runbook/SLO | Required | Required | Required | Required | Required | Required |
| Governance/division/family/ROI | Required | Optional | Required | Required | Required | Required |
| Architecture boundary | Required | Optional | Required | Required | Required | Required |
| Docs/ADR/SOT drift | Required | Optional | Required | Required | Required | Required |

### 21.3 Insufficient Coverage Determination

If a problem domain satisfies any of the following, the audit may not claim complete:

```text
1. Only manual review, no static scan
2. Only static scan, no negative sample validation
3. Only script, no CI integration
4. Only CI, no release blocker
5. Only documentation, no issue ledger
6. Only issue, no owner / gate / regression test
7. Only one-time audit, no PR delta audit
```

---

## 22. Historical Issue Regression Map

### 22.1 Principle

Each historically known issue must be reverse-mapped to at least one automation rule.

```text
Historical issues are not "done after fixing"; they must be sedimented into scanner / test / invariant / release gate.
```

### 22.2 Mapping Format

```json
{
  "historicalIssueId": "AAS-HIST-000001",
  "originalFinding": "service principal after auth gets roles:[admin]",
  "category": "security.authorization.scope_escalation",
  "requiredAuditRules": [
    "audit:auth-role-mapping",
    "test:security:service-principal-no-admin-by-default"
  ],
  "requiredInvariant": "No service principal receives admin unless role mapping explicitly grants admin.",
  "regressionSeed": "fixtures/security/service-principal-admin-escalation.json",
  "releaseGate": "rc:check:p0-security"
}
```

### 22.3 Historical Issues Must Be Archived into Four Categories

| Category | Description | Required Output |
|---|---|---|
| Fixed with Gate | Fixed and has a gate | regression test + CI rule |
| Fixed without Gate | Fixed but no gate | Not allowed to close the issue |
| Accepted Risk | Explicitly accepted | owner + expiry + compensating control |
| Not Fixed | Not fixed | blocker / roadmap |

### 22.4 Conditions Prohibiting Closure

Historical issues may not be closed in the following situations:

```text
No regression test
No audit rule
No CI gate
No evidenceRef
No owner sign-off
No verification that similar issues do not exist
```

---

## 23. Audit Tool Test Harness

### 23.1 Why Test the Auditor

If the scanner itself is not tested, the following will happen:

```text
Scanner ran but did not catch the issue
Regex is easily bypassed
New paths were not scanned
CI passes but actually is invalid
```

### 23.2 Each audit script must have three types of tests

| Test Type | Goal |
|---|---|
| Positive Seed | Confirm known bad samples are caught |
| Negative Seed | Confirm legitimate samples are not false-positive |
| Evasion Seed | Confirm simple evasion still gets caught |

### 23.3 Example: secret sink audit

Must catch:

```ts
console.error(process.env.AA_API_JWT_SECRET);
logger.info({ token: bearerToken });
throw new Error(`failed: ${dsn}`);
span.setAttribute("user.authorization", req.headers.authorization);
audit.record({ metadata: { apiKey } });
```

Must avoid false positives:

```ts
logger.info("secret redacted", { secret: "[REDACTED]" });
const publicTokenName = "token_budget";
```

Must catch evasion:

```ts
const k = "AA_" + "API" + "_KEY";
console.log(env[k]);
```

---

## 24. Seeded Defect Test: Intentionally Planted Vulnerabilities Validate Gates

### 24.1 Goal

Every P0 audit gate must have a seeded defect fixture to prove the gate can really catch the target issue.

### 24.2 Seeded Defect Directories

```text
tests/fixtures/seeded-defects/
  tenant-isolation/
  secret-sinks/
  lease-fencing/
  idempotency/
  eval-oracle/
  plugin-signature/
  release-claims/
  contract-drift/
  side-effect-receipt/
  ci-supply-chain/
```

### 24.3 Each CI Validation

```bash
npm run audit:seeded-defects
```

Requirements:

```text
All bad seeds must fail
All good seeds must pass
All evasion seeds must fail
```

If the audit tool cannot catch the seeded defect, the audit result is invalid.

---

## 25. N-way Reconciliation: Multi-Source Cross-Check

### 25.1 Why N-way

Two-source reconciliation is not enough. For example, the contract docs agree with the TS type, but the runtime does not write it; the runtime writes it, but the OpenAPI does not expose it; the OpenAPI has it, but the test does not cover it.

### 25.2 N-way Reconciliation Objects

| Object | Sources That Must Be Reconciled |
|---|---|
| API | docs / route / OpenAPI / client / test / auth policy |
| Event | docs / registry / payload schema / producer / consumer / replay test |
| Metric | docs / registry / emitter / exporter / alert / dashboard / runbook |
| Contract | docs / TS / Zod / JSON schema / runtime / fixture / test |
| State machine | docs / transition table / service / event / receipt / invalid transition test |
| Release claim | release doc / claim record / evidenceRef / report / expiry / owner |
| Tool action | tool descriptor / risk taxonomy / policy / ToolGateway / receipt / eval/redteam |
| Mission feature | contract / repository / route / UI / event / permission / e2e |
| Review finding | review row / code evidence / test evidence / issue ledger / todo board / closure note |
| Cleanup / hygiene finding | cleanup review / `.gitignore` / CI audit / artifact policy / reproducibility proof |
| UI implementation gap | UI review / route / feature registry / state / endpoint catalog / shell smoke |
| System-level sampled gap | manual system review / code path / runtime evidence / CI coverage / regression |

### 25.3 Missing One Is an Issue

If any source is missing in N-way reconciliation, an issue must be generated:

```text
missing_docs
missing_schema
missing_runtime
missing_test
missing_ci_gate
missing_evidence
missing_owner
```

---

## 26. PR Delta Audit: Prevent Recurrence After Fix

### 26.1 Each PR Must Run

```text
changed files inventory
changed contract detection
changed route detection
changed event/metric detection
changed security-sensitive sink detection
changed docs claim detection
changed workflow permission detection
changed package/docker dependency detection
```

### 26.2 PR Risk Escalation Rules

If a PR touches the following paths, it must enter P0/P1 review:

```text
src/platform/five-plane-execution/**
src/platform/five-plane-control-plane/iam/**
src/platform/five-plane-state-evidence/**
src/sdk/plugin-sdk/**
ui/packages/shared/auth/**
.github/workflows/**
scripts/backup* / scripts/restore*
docs_zh/releases/**
docs_zh/contracts/**
config/policy/**
eval/** / redteam/**
```

### 26.3 PR Merge Prohibited Conditions

```text
New release claim without evidence
New contract field without runtime/test
New route without tenant/auth test
New metric without emitter/exporter
New event without producer/consumer schema
New plugin path without SBOM/signature gate
New high-risk action without no-go/HITL policy
New script rm/mv/cp/write without root guard
```

---

## 27. Unknown-to-Issue Policy

### 27.1 Principle

Any "uncertain" in the audit must not be skipped; it must be converted into an issue or assumption.

```text
Uncertain whether implemented = issue: implementation_unverified
Uncertain whether safe = issue: security_review_required
Uncertain whether covered by CI = issue: gate_unverified
Uncertain whether historical promise = issue: promise_unclassified
```

### 27.2 Assumption Ledger

All assumptions must enter:

```text
artifacts/assurance/assumptions.jsonl
```

Fields:

```json
{
  "assumptionId": "AAS-ASSUMPTION-000001",
  "statement": "YONO is disabled_by_default in production",
  "evidence": [],
  "riskIfFalse": "prototype domain exposed as production feature",
  "owner": "TBD",
  "expiry": "2026-06-09",
  "status": "unverified"
}
```

Unverified assumptions auto-escalate to issues after expiry.

---

## 28. Dedup / Cluster / Epic Policy

### 28.1 Why Dedup

5000+ raw issues, if not deduplicated, will become unexecutable noise.

### 28.2 Three-Layer Structure

```text
Raw Finding       Original finding, can be many
Normalized Issue  Normalized issue, merges duplicates
Epic              Deliverable engineering package
```

### 28.3 Dedup Rules

Issues with the same root cause + the same invariant + the same fix strategy can be merged.

Example:

```text
Multiple Date.now() used for ID / report / checkpoint hash
can be merged into a deterministic clock/id generator epic
But security token random secret module load should not be merged with ordinary Date.now
```

For shard reviews under `docs_zh/reviews/`, the following additional conditions must be met before dedup is allowed:

```text
1. Preserve original authoritative IDs:
   The original rowIds of issues-table / platforme-full-review-a/b/c/d/e/ee / system-review / consistency-audit / ui-review
   cannot be lost, they can only be attached to sourceRefs[] in the normalized issue

2. Preserve the latest conclusion:
   If the same issue is reviewed again in round / reaudit / follow-up review,
   latestStatus, latestReviewDate, latestClosureNote must be kept, not just the first finding

3. Preserve multi-source evidence:
   The merged issue must at least record sourceFiles[], evidenceRefs[], testRefs[], docRefs[]

4. Merge only when "the problem object" is consistent:
   Being timeout / retry / leak / missing test does not mean the same issue;
   if the target object is different (API, worker, UI shell, CDC, DLQ, OIDC, etc.), split by default

5. Prefer "linking" over "swallowing" between review shards:
   For scenarios like `platforme-full-review-ee.md` merged into `platforme-full-review-e.md`,
   the shard source is kept by default, and linkedFindings[] is built with the canonical id
```

### 28.4 Over-Merging Is Not Allowed

The following issues cannot be merged into a single vague "security issue":

```text
tenant isolation
secret leakage
plugin signature
approval bypass
SSRF
path traversal
```

They must each have their own gate.

In addition, the following issue families are not allowed to be crudely merged into "test issue / documentation issue / cleanup issue / UI issue":

```text
test_quality.hard_wait
test_quality.cleanup_leak
test_quality.type_escape_hatch
doc_state.review_status_conflict
doc_state.release_claim_overreach
ops_hygiene.temp_artifact_governance
system_review.manual_sampled_gap
ui_contract.bridge_or_endpoint_mismatch
review_process.false_fixed_or_false_done
```

Reasons:

```text
These issues have different root causes, risk surfaces, fix strategies, validation methods, and CI gates.
Over-merging will:
1. Have hard wait swallowed by cleanup leak
2. Have release claim overstatement swallowed by ordinary documentation typos
3. Have UI bridge naming errors generalized to "frontend issues"
4. Have runtime gaps found by manual system review sampling lose tracking after being merged into old issues
```

Therefore, the normalized ledger must at least guarantee:

```text
One canonical issue corresponds to only one clear invariant break point
One invariant break point binds only one primary fix strategy
One fix strategy must be mappable to clear regression / gate / closure evidence
```

---

## 29. Fix Verification Contract

### 29.1 Every Fix Must Include

```text
code fix
unit test
negative test
regression seed
CI gate update
issue ledger update
evidenceRef
owner sign-off
```

### 29.2 Fix Acceptance Template

```json
{
  "issueId": "AAS-ISSUE-000001",
  "fixCommit": "...",
  "testsAdded": ["tests/security/service-principal-role.test.ts"],
  "auditRulesAdded": ["audit:auth-role-mapping"],
  "regressionSeedsAdded": ["fixtures/security/service-admin-bypass.ts"],
  "evidenceRefs": ["evidence://release/security-audit-report#AAS-ISSUE-000001"],
  "verifiedBy": ["primary", "independent"],
  "closedAt": "..."
}
```

### 29.3 "Fix Code Only" Is Prohibited

The following fixes are invalid:

```text
Only change implementation, no tests
Only add tests, no CI integration
Only change documentation, no runtime
Only change scanner, no seeded defect
Only mark accepted risk, no expiry/owner
```

---

## 30. Coverage Scorecard: Quantifying Audit Coverage

### 30.1 Score Is Not a Release Sufficient Condition

Coverage score is only used to discover blind spots, not to replace P0 blockers.

### 30.2 Dimensions

| Dimension | Description | Goal |
|---|---|---:|
| Source Coverage | Whether files/documentation/config are included in inventory | 100% |
| Promise Coverage | Whether historical promises are extracted | ≥ 95%, P0 documents 100% |
| Contract Coverage | Whether contracts are N-way reconciled | 100% P0 |
| Security Coverage | Whether P0 security rules have seeds | 100% |
| Execution Coverage | idempotency/lease/queue/side-effect invariants | 100% P0 |
| Eval Coverage | eval/redteam/golden anti-fake | 100% P0 |
| CI Coverage | Whether P0 audits are in CI/release gate | 100% |
| Regression Coverage | Whether historical P0 has regression seed | 100% |
| Owner Coverage | Whether P0/P1 has owner | 100% |

### 30.3 Output

```text
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/audit-coverage-scorecard.md
```

---

## 31. Anti-Gaming Rules: Preventing Audit Evasion

### 31.1 Common Evasion

```text
Rename the secret field to credentialRef2
Use string concatenation to bypass the scanner
Wrap dangerous paths into helpers
Write eval score as static builder
Put mock data into shared api-client
Put production-ready claim into non-docs_zh paths
Put event/metric names into JSON instead of TS
Put route registration into dynamic dispatcher
```

### 31.2 Anti-Evasion Strategy

```text
AST scanning preferred over regex
taint tracking covers source→sink
config/JSON/YAML/MD all included in scanning
new helpers must be expanded and recognized by the scanner
scanner rules must have evasion seeds
release claim scanning covers README/docs/ui/config/release_notes
```

---

## 32. Dataflow & Threat Model Audit

### 32.1 Why File Scanning Is Not Enough

Many issues only appear across files:

```text
route reads tenantId → service does not use it → repository has no filter
LLM output → learning object → promotion → knowledge store
token → offline queue → IndexedDB → replay
Tool output → handoff builder → audit receipt
```

### 32.2 Required Data Flow Diagrams

Build at least 10 core data flows:

```text
User Request → Auth → Tenant Guard → Route → Service → Repository
Task Intake → Planner → Execution → Tool → SideEffect → Receipt
Observation → Feedback → Learning → Knowledge Promotion → Memory/Knowledge
Eval Dataset → Runner → Judge → Report → Release Gate
Plugin Manifest → Signature → SBOM → Registry → Execution
Secret Provider → Runtime Config → Logger/Event/Span sinks
WebSocket Subscribe → Broadcast → Client Cache
Backup/Restore → File System → Remote URI → Retention
Mission Resolve → Mission Guard → NodeRun → Runtime Transition
YONO Market → Forecast → Order → Settlement → Reputation
```

Each data flow must mark:

```text
trust boundary
tenant boundary
secret boundary
side-effect boundary
evidence boundary
failure mode
required gate
```

---

## 33. Manual Review Anti-Omission Protocol

### 33.1 Reviewers Must Not Freestyle

Each reviewer must fill in by checklist:

```text
reviewed files
reviewed contracts
reviewed tests
reviewed CI gates
unverified assumptions
found issues
missed areas
confidence score
```

### 33.2 Dual Independent Review

P0 domains must be reviewed independently by two people; record independently first, then merge findings.

### 33.3 Blind Spot Declaration

Each review must declare:

```text
Which paths I did not cover
Which conclusions depend on assumptions
Which checks cannot be automatically verified
Which ones need runtime/chaos tests
```

Reviews without a blind spot declaration cannot serve as release evidence.

---

## 34. Minimum Non-Omittable Audit Set

If time is limited, at least the following 15 items must be completed, otherwise "full-project audit" cannot be claimed.

```text
1. source inventory
2. known issue ledger import
3. historical promise ledger
4. contract/schema/runtime drift audit
5. release claim evidence audit
6. tenant isolation audit
7. secret sink audit
8. plugin/SBOM/signature audit
9. execution idempotency/lease/queue audit
10. side-effect/receipt/audit/evidence audit
11. eval/redteam/golden anti-fake audit
12. UI token/operator safety audit
13. scripts/path/CI supply-chain audit
14. architecture boundary audit
15. rc:check release gate
```

If any is not completed, only:

```text
partial audit
```

can be claimed. Cannot claim:

```text
full audit
release-ready
final
production-ready
```

---

## 35. v1.1 Supplementary Audit Completion Criteria (Now Merged into v1.3)

On top of the original section 18, add the following hard conditions:

```text
13. Every P0 problem domain has a coverage matrix record
14. Every historical P0 issue has a regression seed
15. Every audit script has positive/negative/evasion tests
16. Every release claim has owner/evidenceRef/expiry
17. Every unknown assumption enters the assumptions ledger
18. Every P0 fix has a Fix Verification Contract
19. Every P0 gate is validated by seeded defect
20. Every PR triggers a delta audit
21. Every manual review has a blind spot declaration
22. audit coverage scorecard is generated and archived
```

If these conditions are not met, the audit conclusion can only write:

```text
This audit covers the main problem domains, but unquantified omission risk remains.
```

Cannot write:

```text
Ensure no omission.
```

---

## 36. Final Omission-Prevention Conclusion

The v1.1 strategy is:

```text
Not to promise absolute zero omission,
but to build a system in which omissions can be discovered, traced, regressed, and blocked.
```

A truly reliable state should satisfy:

```text
All historical issues enter the ledger
All historical promises enter the promise ledger
All P0 problem domains have automatic gates
The gates themselves have seeded defect validation
Fixes must come with regression tests
Release claims must come with signed evidence
New PRs must run delta audit
Manual reviews must declare blind spots
```

Only in this way can the Automatic Agent System shift from "humans repeatedly finding a large number of issues" to:

```text
Known type issues are automatically blocked
Historical promises are automatically reconciled
Release claims are automatically downgraded or blocked
Unknown issues continue to converge through the coverage matrix
```

---

# 37. Automated Assurance Pipeline Design

> This section comes from the v1.1 addition content and has been merged into v1.3, used to land the "full-project review / audit methodology" as an executable, sustainable, release-blocking automated flow.

## 20.1 Core Conclusion

The automated audit of the Automatic Agent System cannot be just a scanning script; it must be a continuously running **Assurance Pipeline**:

```text
Historical issue recovery
→ Full repository inventory
→ Static audit
→ Dynamic invariant tests
→ Contract / docs / runtime reconciliation
→ Eval / redteam anti-fake pass
→ Issue ledger merge
→ Release gate blocking
→ Evidence bundle signed archive
```

It needs to cover three execution scenarios:

```text
PR:       assurance:delta
Nightly:  assurance:full
Release:  rc:check
```

The goal is not to promise "absolute zero omission", but to achieve:

```text
1. Historical issues no longer rely on human memory;
2. Historical promises no longer rely on document self-claims;
3. P0 type issues are no longer only discovered by manual review;
4. Release no longer relies on subjective judgment;
5. New PRs cannot bypass existing issue type gates;
6. All release claims must have signable evidence.
```

---

## 20.2 Automated Main Entry

It is recommended to uniformly add a complete automated entry:

```bash
npm run assurance:full
```

It internally chains:

```bash
npm run assurance:inventory
npm run assurance:historical-promises
npm run assurance:architecture-boundary
npm run assurance:contracts-sync
npm run assurance:security
npm run assurance:execution-invariants
npm run assurance:evidence-integrity
npm run assurance:eval-oracle
npm run assurance:ui-safety
npm run assurance:ci-supply-chain
npm run assurance:domain-scope
npm run assurance:seeded-defects
npm run assurance:issue-ledger
npm run assurance:coverage-scorecard
```

Before release, must run:

```bash
npm run rc:check
```

`rc:check` only allows release after all P0 gates pass.

---

## 20.3 Automated Flow Overview Diagram

```text
                 +--------------------------+
                 |  1. Source Inventory      |
                 +-------------+------------+
                               |
                 +-------------v------------+
                 |  2. Historical Promises   |
                 |  ADR / Release / Docs     |
                 +-------------+------------+
                               |
        +----------------------v----------------------+
        |  3. Static Audit Layer                       |
        |  contract / secret / tenant / path / import  |
        +----------------------+----------------------+
                               |
        +----------------------v----------------------+
        |  4. Dynamic Audit Layer                      |
        |  invariant / chaos / multi-tenant / replay   |
        +----------------------+----------------------+
                               |
        +----------------------v----------------------+
        |  5. Eval / Redteam / Golden Anti-fake        |
        +----------------------+----------------------+
                               |
        +----------------------v----------------------+
        |  6. Issue Ledger Normalize + Dedup           |
        +----------------------+----------------------+
                               |
        +----------------------v----------------------+
        |  7. P0/P1 Gate + Coverage Scorecard          |
        +----------------------+----------------------+
                               |
        +----------------------v----------------------+
        |  8. Release Evidence Bundle                  |
        +----------------------------------------------+
```

---

## 20.4 Layer 1: Full-Repository Inventory

### 20.4.1 Goal

First know exactly what is in the project; "unregistered assets" are not allowed to enter release.

### 20.4.2 Output

```text
artifacts/assurance/source-inventory.json
artifacts/assurance/routes.json
artifacts/assurance/contracts.json
artifacts/assurance/events.json
artifacts/assurance/metrics.json
artifacts/assurance/tests.json
artifacts/assurance/docs-index.json
artifacts/assurance/config-index.json
artifacts/assurance/workflows-index.json
```

### 20.4.3 Automatic Checks

```text
Which modules have no owner
Which modules have no tests
Which routes have no OpenAPI
Which events have no schema
Which metrics have no emitter/exporter
Which docs claims have no evidence
Which configs have no schema
Which workflows have not entered the least-privilege strategy
Which domains are prototype but not marked disabled_by_default
```

---

## 20.5 Layer 2: Historical Promise Recovery

### 20.5.1 Scan Sources

```text
docs_zh/reference/
docs_zh/releases/
docs_zh/adr/
docs_zh/architecture/
docs_zh/contracts/
docs_zh/reviews/
docs_zh/quality/
docs_en/
README.md
AGENTS.md
MEMORY.md
CONTRIBUTING.md
Historical Marp / PPT / Markdown
```

### 20.5.2 Extract Keywords

```text
must
should
required
done
accepted
final
release-ready
production-ready
industry-leading
已完成
可发布
行业领先
验收标准
Phase
P0
gate
metric
event
API
UI
runbook
receipt
evidence
```

### 20.5.3 Output

```text
artifacts/assurance/historical-promises.jsonl
artifacts/assurance/historical-promise-drift-report.json
artifacts/assurance/historical-promise-drift-report.md
```

### 20.5.4 Blocking Rules

```text
Historical doc says done, but no code/test/gate/evidence = issue
Historical doc says final, but P0 not closed = release blocker
Historical doc says metric, but no emitter/exporter/alert = issue
Historical doc says API, but no route/OpenAPI/test = issue
Historical doc says event, but no schema/producer/consumer = issue
Historical doc says UI, but only placeholder/mock = issue
Historical doc says production-ready, but no signed evidence bundle = release blocker
```

---

## 20.6 Layer 3: Static Audit Layer

### 20.6.1 Recommended Scripts

```bash
npm run audit:architecture-boundary
npm run audit:contracts-sync
npm run audit:secret-sinks
npm run audit:tenant-isolation
npm run audit:path-safety
npm run audit:plugin-security
npm run audit:ci-supply-chain
npm run audit:ui-token-storage
npm run audit:fire-and-forget
npm run audit:determinism
npm run audit:docs-sot
npm run audit:release-claims
```

### 20.6.2 Key Scanning Patterns

```text
process.env
Date.now / Math.random / new Date
randomBytes module-level secret
catch warn continue
fire-and-forget Promise
readFileSync / writeFileSync / rmSync / mv -f / rm -rf
JSON.stringify hash
startsWith auth/path
includes subject matching
Map without TTL
in-memory repository
Authorization / token / secret sink
service principal → admin
broadcastToAll without tenant filter
file:// without sandbox root check
```

### 20.6.3 Static Audit Must Output

```text
artifacts/assurance/static-audit-report.json
artifacts/assurance/static-audit-report.md
artifacts/assurance/static-audit-findings.jsonl
```

---

## 20.7 Layer 4: Dynamic Invariant Tests

Static scanning cannot catch concurrency, crashes, consistency, and cross-tenant paths; dynamic tests must be added.

### 20.7.1 Recommended Scripts

```bash
npm run test:invariant:tenant
npm run test:invariant:idempotency
npm run test:invariant:lease-fencing
npm run test:invariant:queue
npm run test:invariant:side-effect
npm run test:invariant:evidence
npm run test:chaos:execution
npm run test:chaos:recovery
```

### 20.7.2 Must-Test Invariants

```text
Tenant A cannot read tenant B's object
Same idempotency key concurrent writes only once
Old fencing token cannot release new lease
After worker crash, active queue job is recoverable
External side-effect commit must have receipt
Truth mutation + event append must be in the same transaction
Projection rebuild does not miss events
DLQ retry does not cause duplicate side effects
Replay cannot cross tenant
Recovery repair cannot create orphan ticket
```

### 20.7.3 Output

```text
artifacts/assurance/invariant-test-report.json
artifacts/assurance/chaos-test-report.json
```

---

## 20.8 Layer 5: Eval / Redteam / Golden Anti-Fake

### 20.8.1 Recommended Scripts

```bash
npm run audit:eval-oracle
npm run audit:redteam-runner
npm run audit:golden-replay
npm run test:redteam:p0
npm run test:golden:strict
```

### 20.8.2 Prohibited Patterns

```text
expectedOutput as actualOutput
constant treatment/control score
judge reads self-reported score from the system under test
dataset only has card, no samples
frozenHash is sha256:<datasetId> placeholder
redteam only has yaml, no result
golden expected.length === 0 passes directly
golden only checks subsequence, extra events do not fail
scorecard static builder text masquerades as real scoring
```

### 20.8.3 Output

```text
artifacts/assurance/eval-oracle-report.json
artifacts/assurance/redteam-report.json
artifacts/assurance/golden-replay-report.json
```

---

## 20.9 Layer 6: Auditor Self-Test

The audit script itself must also be tested to avoid the scanner only catching the simplest patterns.

### 20.9.1 Each audit script must have three types of seeds

```text
positive seed: real issue must be caught
negative seed: normal code must not be false-positive
evasion seed: must still be caught after rewording
```

### 20.9.2 Example: secret sink auditor must catch

```ts
logger.info({ token });
throw new Error(`dsn=${dsn}`);
eventBus.publish({ authorization });
span.setAttribute("user.jwt", jwt);
metric.labels({ apiKey });
audit.record({ metadata: { bearerToken } });
```

Cannot only catch:

```ts
console.log(token);
```

### 20.9.3 Recommended Scripts

```bash
npm run test:audit-tools
npm run test:seeded-defects
```

### 20.9.4 Output

```text
artifacts/assurance/audit-tool-test-report.json
artifacts/assurance/seeded-defect-report.json
```

---

## 20.10 Layer 7: Issue Ledger Auto-Merge

All audit results uniformly enter the issue ledger.

### 20.10.1 Output Files

```text
artifacts/assurance/issues.raw.jsonl
artifacts/assurance/issues.normalized.jsonl
artifacts/assurance/issues.deduped.jsonl
docs_zh/quality/issue-ledger/automatic-agent-system-issues.md
```

### 20.10.2 Merge Rules

```text
Same file same root cause merge
Same invariant merge
Same historical promise merge
Same P0 Epic merge
Same contract drift merge
Same release claim drift merge
```

### 20.10.3 Each Issue Must Include

```json
{
  "issueId": "AAS-ISSUE-000001",
  "source": "code|doc|adr|release|test|ci|runtime|manual",
  "sourceRef": "file:line or doc section",
  "category": "security.tenant_isolation",
  "severity": "P0",
  "plane": "execution",
  "module": "lease",
  "description": "...",
  "rootCause": "...",
  "invariantViolated": "...",
  "evidence": ["..."],
  "requiredFix": "...",
  "requiredTest": ["unit", "integration", "chaos"],
  "requiredGate": ["audit:tenant-isolation"],
  "owner": "TBD",
  "status": "open"
}
```

---

## 20.11 Layer 8: Coverage Scorecard

Automatically generate coverage scoring to prevent "looks like a lot of scripts ran but problem domains are not covered".

### 20.11.1 Output

```text
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/audit-coverage-scorecard.md
artifacts/assurance/coverage-scorecard.json
```

### 20.11.2 Scoring Dimensions

```text
source inventory coverage
historical promise coverage
contract sync coverage
security audit coverage
execution invariant coverage
eval oracle coverage
CI gate coverage
regression seed coverage
release claim evidence coverage
audit-tool self-test coverage
```

### 20.11.3 Release Minimum Requirements

```text
P0 issue coverage = 100%
historical promise extraction = 100%
contract drift P0 = 0
secret sink P0 = 0
tenant isolation P0 = 0
eval fake-pass path = 0
release claim unverified = 0
P0 gate self-test pass = 100%
```

---

# 38. PR / Nightly / Release Three-Layer Pipeline

## 21.1 PR Delta Audit

Each PR does not need to run the full set, but must run the delta audit:

```bash
npm run assurance:delta -- --base origin/main
```

Delta audit checks the changed files and impact chain:

```text
changed code
changed tests
changed docs
changed config
changed routes
changed schemas
changed workflows
changed release claim
changed eval/redteam/dataset
changed runbook
```

### 21.1.1 PR Blocking Conditions

```text
New P0
New release claim without evidence
New API without OpenAPI/test
New event without schema
New metric without emitter/exporter
New high-risk action without policy/approval/receipt
New secret sink
New tenant query without tenantId
New fire-and-forget async
New process.env in library code
New in-memory truth store without experimental flag
New eval dataset card without samples/frozenHash
```

---

## 21.2 Nightly Full Assurance

Run the full version every day:

```bash
npm run assurance:full
```

Output:

```text
artifacts/assurance/
  assurance-full-report.json
  static-audit-report.json
  static-audit-report.md
  static-audit-findings.jsonl
  review-ledger.normalized.jsonl
  review-evidence-readiness-report.json
  historical-promises.jsonl
  assumptions.jsonl
  issues.raw.jsonl
  issues.normalized.jsonl
  issues.deduped.jsonl
  historical-issue-regression-map.json
  completeness-coverage-matrix.json
  audit-coverage-scorecard.json
  coverage-scorecard.json
```

Nightly goal:

```text
Discover cross-module issues
Discover historical promise drift
Discover issues not covered by PR delta
Discover documentation state drift
Discover release claim expiry
Discover new mock/placeholder leaks into production scope
```

---

## 21.3 Release rc:check

Must run before release:

```bash
npm run rc:check
```

`rc:check` should aggregate internally:

```bash
npm run assurance:full
npm run test:p0
npm run test:chaos:p0
npm run test:redteam:p0
npm run test:golden:strict
npm run evidence:bundle:create
npm run evidence:bundle:verify
```

### 21.3.1 Release Blocker

```text
open P0 > 0
contract drift P0 > 0
secret sink P0 > 0
tenant isolation P0 > 0
eval oracle fake pass > 0
release claim unverified > 0
unsigned evidence bundle
P0 alert without runbook
P0 audit gate lacks seeded defect test
```

### 21.3.2 Release Output

```text
artifacts/release/rc-check-report.json
artifacts/release/evidence-bundle.json
artifacts/release/evidence-bundle.sig
```

---

# 39. Recommended package.json Script Structure

```json
{
  "scripts": {
    "assurance:full": "node scripts/assurance/run-full-assurance.mjs",
    "assurance:delta": "node scripts/assurance/run-delta-assurance.mjs",
    "assurance:inventory": "node scripts/assurance/collect-source-inventory.mjs",
    "assurance:historical-promises": "node scripts/assurance/collect-historical-promises.mjs",
    "assurance:issue-ledger": "node scripts/assurance/build-issue-ledger.mjs",
    "assurance:coverage-scorecard": "node scripts/assurance/build-coverage-scorecard.mjs",

    "audit:contracts-sync": "node scripts/ci/audit-contracts-sync.mjs",
    "audit:release-claims": "node scripts/ci/audit-release-claims.mjs",
    "audit:secret-sinks": "node scripts/ci/audit-secret-sinks.mjs",
    "audit:tenant-isolation": "node scripts/ci/audit-tenant-isolation.mjs",
    "audit:plugin-security": "node scripts/ci/audit-plugin-security.mjs",
    "audit:path-safety": "node scripts/ci/audit-path-safety.mjs",
    "audit:eval-oracle": "node scripts/ci/audit-eval-oracle.mjs",
    "audit:architecture-boundary": "node scripts/ci/audit-architecture-boundary.mjs",

    "test:invariant": "node --test tests/invariant/**/*.test.ts",
    "test:p0": "npm run test:invariant && npm run test:regression:p0",
    "test:chaos:p0": "node --test tests/chaos/p0/**/*.test.ts",
    "test:redteam:p0": "node scripts/redteam/run-p0-redteam.mjs",
    "test:audit-tools": "node --test tests/audit-tools/**/*.test.ts",
    "test:seeded-defects": "node scripts/assurance/run-seeded-defect-tests.mjs",

    "evidence:bundle:create": "node scripts/assurance/create-release-evidence-bundle.mjs",
    "evidence:bundle:verify": "node scripts/assurance/verify-release-evidence-bundle.mjs",

    "rc:check": "node scripts/assurance/rc-check.mjs"
  }
}
```

---

# 40. Automated Landing Roadmap

## 23.1 Stage 0: Generate Reports Only, Do Not Block

```text
assurance:inventory
assurance:historical-promises
audit:release-claims
audit:contracts-sync
audit:secret-sinks
```

Output reports, but do not fail CI.

## 23.2 Stage 1: P0 Gate Observe Mode

```text
P0 issues recorded as blockers
CI shows failure risk
But release owner can manually override
```

Override must be written to:

```text
override owner
expiry
reason
risk acceptance
follow-up issue
```

## 23.3 Stage 2: P0 Gate Enforcing Mode

The following issues fail directly:

```text
secret sink P0
tenant isolation P0
eval oracle fake pass
release claim unverified
plugin verification fail-open
contract drift P0
```

## 23.4 Stage 3: P1 Gate Observe Mode

Bring P1 into the scorecard, do not block immediately.

## 23.5 Stage 4: Full Release Evidence Gate

Release must generate and verify the signature of:

```text
evidence-bundle.json
evidence-bundle.sig
rc-check-report.json
```

---

# 41. Anti-Omission Mechanisms for the Automated Flow Itself

The automated flow itself may also miss issues, so the following protections must be added:

```text
1. Every audit gate must have a seeded defect test.
2. Every historical problem category must map to at least one scanner/test/gate.
3. Every scanner must have an evasion seed.
4. Every P0 fix must add a regression seed.
5. Every release claim must be reverse-traceable to evidenceRef.
6. Every evidenceRef must be openable and sign-verifiable by the verifier.
7. Every generated report must have a schema.
8. Every schema must additionalProperties:false unless there is a clear reason.
9. Every warning-only gate must have an escalation date.
10. Every manual override must have an expiry.
```

---

# 42. Automated Flow Acceptance Criteria

The automated flow itself must satisfy:

```text
assurance:full can run in a clean environment
assurance:delta can run in a PR
rc:check can one-click decide release
All output artifacts have schemas
All P0 gates have seeded defect tests
All historical promises have ledgers
All known issues have issue ledger entries
All release claims have evidenceRef
All evidence bundles are sign-verifiable
```

---

# 43. Relationship with the Original Review/Audit Document

The original v1.1 document answered:

```text
How should review / audit be done?
```

This automated chapter answers:

```text
How to turn review / audit into a continuously automated flow?
```

The relationship between the two:

```text
v1.1 methodology = audit standard
Sections 20-25 = automated execution system
rc:check = release blocking entry
issue-ledger = problem closed-loop carrier
evidence-bundle = release fact certification
```

---

# 44. Relationship Between Tests and the Assurance Pipeline

> This section explains the position and responsibility boundary of `tests/` in the Automatic Agent System Assurance Pipeline, the recommended directory structure, the CI integration approach, and how to use the test system to prevent historical issues from being missed again.

## 44.1 Core Relationship

`tests/` is a core input layer of the Assurance Pipeline, but the Assurance Pipeline is not an ordinary test runner, nor a replacement for tests.

More precisely:

```text
tests are responsible for proving "whether code behavior matches expectations";
the Assurance Pipeline is responsible for proving "whether the entire project can be trusted, whether it can be released, and whether historical issues are missed".
```

Therefore:

```text
Tests are one of the evidence sources for the Assurance Pipeline;
the Assurance Pipeline is the master control system that decides whether the project is trustworthy and can be released.
```

Ordinary tests can only cover runtime behavior. A large number of historical issues cannot be found by ordinary tests, for example:

```text
Doc says done but code is not implemented
Release claim has no evidence
Contract enum is inconsistent with schema
CI does not run a certain gate
OpenAPI does not declare a route
Metric only exists in the doc, no emitter
dataset-card exists but no samples
Docker/GHA supply-chain risk
Historical ADR accepted but acceptance criteria not landed
```

These must rely on audit, scanner, schema reconciliation, release gate, and evidence bundle, not just `tests/`.

---

## 44.2 Position of tests in the Assurance Pipeline

```text
Assurance Pipeline
├── Static Audit
│   ├── contract drift scan
│   ├── secret sink scan
│   ├── tenant isolation scan
│   ├── path safety scan
│   └── architecture boundary scan
│
├── Tests (Dynamic Verification)
│   ├── unit tests
│   ├── integration tests
│   ├── e2e tests
│   ├── invariant tests
│   ├── chaos tests
│   ├── regression tests
│   ├── audit-tools tests
│   ├── seeded-defect tests
│   ├── redteam tests
│   ├── eval tests
│   ├── golden tests
│   └── contract tests
│
├── Docs / Contract / Runtime Reconciliation
├── Issue Ledger
├── Coverage Scorecard
└── Release Evidence Bundle
```

Conclusion:

```text
tests prove "the implementation can run";
audit proves "the implementation has not deviated from architecture, security, contract, and release promises";
rc:check aggregates tests + audit + evidence to decide whether release is allowed.
```

---

## 44.3 Recommended tests Directory Structure

The current project should not only organize tests into three categories: `unit / integration / e2e`. It is recommended to upgrade to:

```text
tests/
├── unit/
├── integration/
├── e2e/
├── invariant/
├── chaos/
├── regression/
├── audit-tools/
├── seeded-defects/
├── redteam/
├── eval/
├── golden/
├── contract/
└── release/
```

Each type of test takes on a different responsibility and cannot replace each other.

---

## 44.4 Unit Tests

### Responsibility

Verify whether a single function, class, or pure logic is correct.

### Examples

```text
parseSemver whether to reject NaN
roundCurrency whether it conforms to currency rules
stableHash whether deterministic
normalizeTenantId whether correct
strictIsoInstant whether to reject loose dates
```

### Suitable for Discovering

```text
Local algorithm errors
Boundary condition errors
Schema parsing errors
Small state machine errors
```

### Not Suitable for Discovering

```text
Cross-tenant leakage
Cross-module transaction inconsistency
Release claim fraud
CI gate not integrated
Documentation promise not landed
```

---

## 44.5 Integration Tests

### Responsibility

Verify the collaboration path between multiple modules.

### Examples

```text
HTTP route → auth → service → repository
ToolGateway → risk → approval → receipt
MissionResolver → MissionRepository → EventAppender
Queue → Lease → Worker → Writeback
```

### Historical Problem Domains That Must Be Covered

```text
auth / route / service / repository tenant propagation
approval / risk / policy / receipt chain
truth write / event append / audit write chain
plugin verification / registry / executor chain
```

---

## 44.6 E2E Tests

### Responsibility

Verify the complete product main chain.

### Examples

```text
Create task → plan → execute → write evidence → generate receipt → UI display
Mission create → bind task → budget reserve → run → report
YONO market create → comment → forecast → resolve → settlement
```

### Requirements

E2E should not only verify the happy path, but must also verify:

```text
Failure path
Permission denial
Approval path
Block when receipt is missing
Reject on tenant escalation
Reject when release claim has no evidence
```

---

## 44.7 Invariant Tests

This is the most critical and most-needed class of tests in the Automatic Agent System.

It does not test a feature, but tests system invariants.

### Must-Test Invariants

```text
No tenant A can read tenant B's object
Any external side-effect must have a receipt
Any lease release must carry fencingToken
Any event append must have an idempotencyKey
Any high-risk action must go through approval
Any release claim must have evidenceRef
Any plugin load must complete signature/SBOM/waiver checks
Any production rollout must have metrics gate
Any truth mutation must be in the same transaction or outbox boundary as event append
```

### Recommended Directory

```text
tests/invariant/
├── tenant-isolation.test.ts
├── idempotency.test.ts
├── lease-fencing.test.ts
├── queue-visibility-timeout.test.ts
├── side-effect-receipt.test.ts
├── event-truth-transaction.test.ts
├── release-claim-evidence.test.ts
├── plugin-verification-fail-closed.test.ts
└── eval-oracle-anti-fake.test.ts
```

### Release Requirements

P0 invariant tests must enter:

```text
npm run test:invariant
npm run rc:check
```

---

## 44.8 Chaos Tests

### Responsibility

Verify crash, concurrency, retry, recovery, partial commit, and clock skew scenarios.

### Must-Test Scenarios

```text
truth write succeeds but event write fails
side-effect commit succeeds but receipt write fails
worker crashes after acquiring lease
new event arrives mid-projection-rebuild
cleanup runs after backup upload fails
SIGINT during restore
queue job becomes active then worker crashes
lease renew and release concurrent
budget reserve and settle concurrent
```

### Recommended Directory

```text
tests/chaos/
├── p0/
│   ├── side-effect-receipt-crash.test.ts
│   ├── event-outbox-crash.test.ts
│   ├── lease-worker-crash.test.ts
│   └── projection-rebuild-concurrent-append.test.ts
└── p1/
```

Chaos test failures should not be simply labeled as flaky. If a P0 invariant is involved, release defaults to hold.

---

## 44.9 Regression Tests

### Responsibility

After each historical issue is fixed, it must be sedimented into a regression test.

The historical issue chain must be:

```text
issue → fix → regression test → audit gate / test gate → evidenceRef
```

### Example Mapping

```text
issue 2: Redis keyPrefix double idempotency
  tests/regression/interface/idempotency-redis-prefix.test.ts

issue 12: service principal granted admin
  tests/regression/interface/service-principal-role-mapping.test.ts

issue 524: SQLite queue idempotency TOCTOU
  tests/regression/execution/sqlite-queue-idempotency-race.test.ts

issue 562: expectedOutput as actualOutput
  tests/regression/eval/eval-oracle-expected-as-actual.test.ts

issue 977: admin inventory endpoint without audit
  tests/regression/interface/admin-inventory-audit.test.ts
```

### Rules

```text
P0 fix without regression test: not allowed to close the issue
P1 fix without regression test: must have a written reason
regression test must enter CI or rc:check
regression test must reference issueId
```

---

## 44.10 Audit Tool Tests

The Assurance Pipeline adds a special class of tests: testing the auditor itself.

### Responsibility

Verify that the audit script can discover real issues, not just "run through".

### Example: secret sink auditor must catch

```ts
logger.info({ token });
throw new Error(`dsn=${dsn}`);
eventBus.publish({ authorization });
span.setAttribute("user.jwt", jwt);
metric.labels({ apiKey });
audit.record({ metadata: { bearerToken } });
```

Cannot only catch:

```ts
console.log(token);
```

### Recommended Directory

```text
tests/audit-tools/
├── secret-sinks-auditor.test.ts
├── tenant-isolation-auditor.test.ts
├── contract-sync-auditor.test.ts
├── eval-oracle-auditor.test.ts
├── path-safety-auditor.test.ts
├── release-claim-auditor.test.ts
└── plugin-security-auditor.test.ts
```

### Each audit tool must have three types of samples

```text
positive seed: real issue must be caught
negative seed: normal code must not be false-positive
evasion seed: must still be caught after rewording
```

---

## 44.11 Seeded Defect Tests

### Responsibility

Deliberately put in vulnerability fixtures to verify that the gate can really block.

### Recommended Directory

```text
tests/fixtures/seeded-defects/
├── secret-logged/
├── tenant-query-missing-tenant-id/
├── eval-expected-as-actual/
├── lease-release-without-fencing/
├── release-claim-without-evidence/
├── plugin-sbom-fail-open/
├── side-effect-without-receipt/
└── route-without-openapi/
```

### Acceptance Rules

```text
audit script must catch seeded defects;
failure to catch means the gate is invalid;
P0 gate without seeded defect test: not allowed to enter enforcing mode
```

---

## 44.12 Contract Tests

### Responsibility

Verify that docs / TS type / Zod schema / JSON schema / OpenAPI / runtime behavior are consistent.

### Must-Test Objects

```text
EventEnvelope
TaskIntakeRequest
HarnessRun
Mission
BudgetLedger
SideEffect
Receipt
ErrorCode
Configuration layers
OAPEFLIR boundary
Runtime state machine
```

### Requirements

```text
contract tests not only check types, but also producer / consumer / runtime validator
```

Example:

```text
docs_zh/contracts/event-envelope-contract.md
  ↔ src/platform/contracts/...
  ↔ schemas.ts
  ↔ event-registry
  ↔ producer tests
  ↔ consumer tests
```

---

## 44.13 Redteam / Eval / Golden Tests

### 44.13.1 Redteam Tests

Must upgrade from static YAML to executable runner:

```text
redteam suite
→ runner
→ result
→ critical_success count
→ release gate
```

### 44.13.2 Eval Tests

Must verify:

```text
dataset has samples
frozenHash is the real content hash
runner is runnable
judge does not read self-reported scores
threshold comes from policy
```

### 44.13.3 Golden Tests

Must strictly verify:

```text
frozen clock
deterministic id
seed injected
expected events exact match or explicit allowlist diff
extra events default to fail
```

---

## 44.14 Difference Between tests and audit

| Dimension | tests | audit |
|---|---|---|
| Main Goal | Whether behavior is correct | Whether the project is trustworthy, whether it drifts |
| Input | Code execution result | Code, documentation, config, CI, schema, historical promises |
| Method | Execute code | Scan + reconcile + partial execution |
| Output | pass/fail | issue/finding/report/gate |
| Can discover | runtime behavior bug | drift, claim, missing gate, security smell, contract mismatch |
| Typical Issue | Whether queue enqueue succeeded | Whether enqueue has idempotency unique key, whether it has regression test, whether it is run by CI |

One sentence:

```text
tests prove "implementation behavior";
audit proves "project facts";
assurance aggregates both to prove "whether release is possible".
```

---

## 44.15 Recommended package.json Test Scripts

```json
{
  "scripts": {
    "test:unit": "node --test tests/unit/**/*.test.ts",
    "test:integration": "node --test tests/integration/**/*.test.ts",
    "test:e2e": "node --test tests/e2e/**/*.test.ts",

    "test:invariant": "node --test tests/invariant/**/*.test.ts",
    "test:p0": "npm run test:invariant && npm run test:regression:p0",
    "test:chaos:p0": "node --test tests/chaos/p0/**/*.test.ts",
    "test:regression:p0": "node --test tests/regression/p0/**/*.test.ts",
    "test:audit-tools": "node --test tests/audit-tools/**/*.test.ts",
    "test:seeded-defects": "node scripts/assurance/run-seeded-defect-tests.mjs",
    "test:redteam:p0": "node scripts/redteam/run-p0-redteam.mjs",
    "test:golden:strict": "node scripts/golden/run-strict-golden.mjs",

    "assurance:full": "node scripts/assurance/run-full-assurance.mjs",
    "assurance:delta": "node scripts/assurance/run-delta-assurance.mjs",
    "rc:check": "node scripts/assurance/rc-check.mjs"
  }
}
```

Relationship:

```text
assurance:full will call key tests;
rc:check will call P0 tests + audit gates + evidence verification;
ordinary tests no longer equal release check.
```

### 44.15.1 Disabled / Skip / Flaky Test Governance

Historical reviews have proven that `skip`, `todo`, `only`, and pseudo-flaky exemptions directly create false green lights. Therefore, the test methodology must explicitly govern these states.

Minimum rules:

```text
Committing .only is prohibited
New .skip / test.skip / describe.skip / xit / xtest / todo must have issueId + owner + expiry
P0/P1 tests must not be skipped by default; if temporarily skipped, rc:check must fail
flaky cannot be a permanent label, must enter the quarantine ledger and set an exit time
```

It is recommended to add a check:

```bash
npm run test:disabled-audit
```

Output:

```text
artifacts/assurance/disabled-tests-report.json
artifacts/assurance/flaky-tests-report.json
artifacts/assurance/quarantine-tests-report.json
```

If any of the following is true, release defaults to hold:

```text
There are disabled tests without owner/expiry
There are skipped tests covering P0 invariants
There are flaky quarantine tests past expiry without recovery
There are temporary skips added just to pass rc:check
```

---

## 44.16 CI Integration Relationship

### PR Stage

PR mainly runs:

```text
test:unit
test:integration impacted subset
test:regression impacted subset
test:audit-tools impacted subset
assurance:delta
```

Goal:

```text
Prevent new issues from entering mainline.
```

### Nightly Stage

Nightly runs:

```text
test:unit
test:integration
test:e2e
test:invariant
test:chaos:p0
test:regression:p0
test:audit-tools
test:seeded-defects
assurance:full
```

Goal:

```text
Discover cross-module, slow-path, historical drift, and non-PR-layer issues.
```

### Release Stage

Release only looks at:

```text
npm run rc:check
```

It must include:

```text
test:p0
test:invariant
test:chaos:p0
test:redteam:p0
test:golden:strict
assurance:full
evidence:bundle:verify
```

Goal:

```text
Decide whether release is possible.
```

---

## 44.17 tests Coverage Scorecard

The Assurance Coverage Scorecard must separately include the tests dimension:

```text
unit coverage
integration coverage
e2e coverage
invariant coverage
chaos coverage
regression coverage
audit-tool self-test coverage
seeded-defect coverage
redteam executable coverage
golden strictness coverage
contract test coverage
release test coverage
```

Minimum requirements:

```text
P0 historical issue regression coverage = 100%
P0 invariant test coverage = 100%
P0 audit tool seeded defect coverage = 100%
release claim evidence test coverage = 100%
eval anti-fake regression coverage = 100%
```

---

## 44.18 tests Issue Ledger Binding

Each test should be able to be reverse-traced to:

```text
issueId
invariantId
promiseId
contractId
releaseGateId
```

It is recommended to add metadata comments at the top of the test file:

```ts
/**
 * @issue AAS-ISSUE-000524
 * @invariant INV-QUEUE-IDEMPOTENCY-001
 * @gate audit:execution-invariants
 * @severity P0
 */
```

The Assurance Pipeline should scan these metadata and generate:

```text
artifacts/assurance/test-to-issue-map.json
artifacts/assurance/issue-to-test-map.json
```

If a P0 issue has no test binding, `rc:check` must fail.

---

## 44.19 Final Requirements

The subsequent project must not just say:

```text
We have a lot of tests.
```

It must be upgraded to:

```text
Every historical P0 issue has a regression test;
every system invariant has an invariant test;
every auditor has a seeded defect test;
every release claim has an evidence test;
all of these are blocked by rc:check.
```

This is the test system by which the Automatic Agent System can reduce issue omission.
