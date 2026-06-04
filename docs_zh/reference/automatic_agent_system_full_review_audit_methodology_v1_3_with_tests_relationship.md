# Automatic Agent System 全项目 Review / Audit 方法论、执行方案与自动化 Assurance Pipeline

> 版本：v1.3  
> 日期：2026-06-02  
> 目标：基于历史问题分析，对 Automatic Agent System 进行全项目、跨代码/文档/测试/CI/Release/历史规划的系统性 review 与 audit；通过覆盖矩阵、历史承诺回收、审计器自测、种子漏洞、反向追溯和 release gate，最大化发现所有问题，避免历史问题反复遗漏。  
> 适用范围：`src/`、`ui/`、`scripts/`、`tests/`、`deploy/`、`.github/`、`config/`、`docs_zh/`、`docs_en/`、`eval/`、`redteam/`、`roi/`、`training-data-policy/`、历史 ADR / Release / Review / Architecture / Planning 文档。  

> 结构说明：本文档包含多轮历史增补段。执行时不得只引用纯数字章节号，必须同时引用“章节标题 + 锚点/路径”，避免后续增补导致引用歧义。

---

## 0. 关键结论

工程上不能真实承诺“绝对发现所有问题、零遗漏”。复杂系统中总会存在未知未知问题。

但可以做到：

```text
1. 所有已知问题来源被纳入审计范围
2. 所有历史规划承诺被转成可验证对象
3. 所有关键系统不变量被自动化检查
4. 所有 release claim 必须有 evidence
5. 所有 P0 类问题必须进入 CI/release gate
6. 所有新增代码必须通过同一套审计规则
7. 所有人工 review 必须有覆盖矩阵和双人复核
```

目标应从“不遗漏任何 bug”转成：

```text
不遗漏任何问题域
不遗漏任何历史承诺来源
不遗漏任何 P0/P1 问题类型
不允许已知类型问题再次无 gate 进入主干
```

最终产物不应该只是一个 markdown 报告，而应是一套持续运行的 Assurance System：

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

## 1. Review / Audit 总原则

### 1.1 三重独立发现原则

每个关键问题域必须至少由三种独立方法覆盖：

```text
静态扫描
动态/测试验证
人工架构审查
```

例如租户隔离问题：

```text
静态扫描：查所有 route/repository/query 是否包含 tenantId
动态测试：构造 A/B tenant 访问同一对象
人工审查：确认 tenant model 是否在 contract/schema/runtime 一致
```

### 1.2 文档承诺即审计对象

历史文档中的以下词都必须被抽取：

```text
must / should / required / done / accepted / final / release-ready
生产级 / 工业级 / 行业领先 / 已完成 / 可发布
Phase / P0 / P1 / gate / metric / event / API / UI / DoD
```

任何承诺都必须对账到：

```text
代码实现
contract/schema
测试
CI gate
evidenceRef
owner
expiry
```

### 1.3 Release Claim 零信任原则

以下声明默认不可信，必须重新验证：

```text
final release
production-ready
industry-leading
pilot-ready
done
accepted
fully implemented
```

无证据时降级为：

```text
proposed
draft
prototype
experimental
disabled_by_default
```

### 1.4 Fail-closed 优先原则

所有安全、证据、执行、发布相关路径默认规则：

```text
unknown = reject
missing = reject
malformed = reject
timeout = hold / retry / quarantine
failed check = block
no evidence = not releasable
```

禁止：

```text
catch warn continue
missing config fallback allow
invalid time ignore
no metrics allow rollout
no webhook secret skip verify
SBOM scan error still load plugin
```

### 1.5 所有问题必须进入 Machine-readable Ledger

人工 markdown 不够。最终要进入：

```text
artifacts/assurance/issues.raw.jsonl
artifacts/assurance/issues.normalized.jsonl
artifacts/assurance/issues.deduped.jsonl
```

每条 issue 必须有：

```json
{
  "issueId": "AAS-ISSUE-000001",
  "source": "code|doc|adr|release|test|ci|runtime|manual|audit|review",
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
  "requiredTest": ["unit", "integration", "chaos"],
  "requiredGate": ["audit:tenant-isolation"],
  "owner": "TBD",
  "status": "open"
}
```

---

## 2. 全项目 Audit 范围地图

### 2.1 代码范围

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

### 2.2 UI 范围

```text
ui/apps/web
ui/packages/shared
ui/packages/features
ui/packages/features/mission-console
ui/packages/features/release-console
ui/packages/features/hitl
ui/packages/features/division-inventory
```

### 2.3 脚本 / 部署 / CI 范围

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

### 2.4 治理资产范围

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

### 2.5 文档与历史规划范围

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
历史 Marp / PPT / Markdown 规划
```

### 2.6 `docs_zh/reviews/` 必须作为权威问题输入

`docs_zh/reviews/` 不是普通背景文档，而是已经过多轮人工/自动复核、包含真实问题与收口证据的一级输入源。任何“全项目 audit”若没有显式消费这些 review 文件，都会系统性漏掉已经被识别过的问题域。

最少必须纳入：

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

这些文件已经覆盖了当前仓库真实存在的几类问题源：

```text
代码级真实缺陷
设计/实现偏差
测试质量问题（hard wait / cleanup leak / type escape hatch）
文档状态漂移与 review 结论冲突
release claim 过度声明
系统级人工抽样缺口
UI 契约与平台壳不一致
临时产物 / 清理 / 环境卫生治理
```

### 2.7 权威来源优先级与冲突处理

同一问题若在 code/runtime/test/docs/review/release 文档中结论不一致，必须按权威来源优先级裁决，而不是“谁写得更新、谁语气更强就信谁”。

默认优先级：

```text
runtime / truth data / executable test evidence
> code path / schema / route / CI config
> review finding with concrete evidenceRef
> release / reference / architecture / planning 文档
> README / 总结型说明
```

冲突处理规则：

```text
1. 文档说 done，但 runtime/test 证明未闭环：以 runtime/test 为准，记为未完成
2. review 说 fixed，但新一轮回归仍失败：以最新失败证据为准，回退为 open
3. 架构文档与实现冲突，但 review 未覆盖：生成新的 implementation drift issue
4. 多份 review 彼此冲突：保留全部 sourceRefs，以 latestReviewDate + stronger evidence 决定 latestStatus
5. 无法裁决时，不允许关单，只能进入 needs_revalidation
```

---

## 3. 总体执行流程

完整 audit 分为 12 个阶段。

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

## 4. Phase 0：Freeze & Baseline

### 4.1 立即冻结 release 语言

所有以下状态在完成 evidence gate 前降级：

```text
final
production-ready
industry-leading
fully implemented
release-ready
done
accepted
```

改为：

```text
draft
proposed
implementation baseline
RC
experimental
disabled_by_default
```

### 4.2 冻结新增功能

在 P0 audit 完成前，禁止继续扩展：

```text
新 domain
新 Mission Playbook
新 plugin marketplace 能力
新 release claim
新 production-ready claim
新 external connector
新 high-risk automation
```

### 4.3 建立 baseline snapshot

输出：

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

## 5. Phase 1：Source Inventory

### 5.1 文件级资产盘点

扫描所有文件并分类：

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

补充要求：`docs_zh/reviews/*.md`、`docs_en/**/*.md` 中带有 review / verification / baseline / cleanup 语义的文件，不能只归类为普通 `doc`，必须额外打标签：

```text
review_source
issue_source
claim_source
verification_source
historical_snapshot
```

否则后续 Promise Ledger / Issue Ledger / Dedup 会把真实问题台账误降级成“背景说明文档”。

输出：

```text
source-inventory.json
```

字段：

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

### 5.2 模块 ownership 盘点

必须建立：

```text
module → plane → owner → contract → tests → CI gate
```

禁止 owner 不明的 P0 模块进入 release。

---

## 6. Phase 2：Historical Promise Recovery

这是避免历史问题遗漏的关键。

### 6.1 抽取历史承诺

扫描：

```text
docs_zh/
docs_en/
docs_zh/reviews/
README.md
AGENTS.md
MEMORY.md
CONTRIBUTING.md
历史规划 md/ppt/marp
```

抽取关键词：

```bash
rg -n "必须|应当|应该|MUST|SHOULD|required|require|shall|验收|DoD|Acceptance" docs_zh docs_en README.md AGENTS.md MEMORY.md
rg -n "done|accepted|final|release-ready|production-ready|industry-leading|已完成|可发布|行业领先" docs_zh docs_en README.md
rg -n "Phase|P0|P1|P2|gate|metric|event|API|endpoint|UI|runbook|evidence" docs_zh docs_en
```

对 `docs_zh/reviews/` 还必须额外抽取“问题状态词”和“证据词”，否则会漏掉已经存在的真实缺口：

```bash
rg -n "todo|fixed|done|已解决|已复核关闭|风险接受|治理项|未解决|部分完成" docs_zh/reviews docs_en
rg -n "Review结论|根因|证据|验证结果|定向测试|回归命令|审查日期" docs_zh/reviews docs_en
```

### 6.2 每条承诺生成 Promise Ledger

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

### 6.3 架构图对账

对 Mermaid / Marp / PPT 图抽取：

```text
nodes
edges
planes
services
data stores
events
control gates
```

每个节点必须对账：

```text
存在代码
存在 tests
存在 owner
存在 runtime path
存在 observability
```

每条边必须对账：

```text
存在 import/call/API/event
有 contract
有 error handling
有 test
```

### 6.4 ADR 对账

每个 ADR 必须检查：

```text
状态是否合法
Accepted 是否实现
Superseded 是否有指针
实施计划是否完成
验收标准是否有 test
风险缓解是否有 runtime guard
```

### 6.5 Review 台账恢复

`docs_zh/reviews/` 中的 review 表、人工抽样复核、baseline verification、cleanup review，必须被恢复成 machine-readable review ledger，而不是只保留 markdown。

建议输出：

```text
artifacts/assurance/review-ledger.raw.jsonl
artifacts/assurance/review-ledger.normalized.jsonl
artifacts/assurance/review-source-coverage-report.json
artifacts/assurance/review-conflict-resolution-report.jsonl
```

最小字段：

```json
{
  "reviewSourceId": "AAS-REVIEW-SRC-000001",
  "sourceFile": "docs_zh/reviews/platforme-full-review-e.md",
  "rowId": "1439",
  "title": "测试硬等待依赖真实 wall-clock",
  "status": "todo",
  "severity": "P1",
  "category": "test_quality.hard_wait",
  "sourceKind": "review_table",
  "evidenceRefs": [
    "tests/unit/platform/interface/ingress/distributed-rate-limiter.unit.test.ts:307"
  ]
}
```

如果 review 原文没有明确 `severity`，必须按以下信号生成初始优先级，再进入人工复核：

```text
是否涉及 security / tenant / execution / release gate
是否已有失败测试或人工复核证据
是否指向 production claim / UI operator path / CI gate
是否会导致状态发散、静默失败、错误 green
```

### 6.5.1 `review-ledger` 最小 Schema 契约

为了避免不同脚本各自产出不同字段名，必须至少收敛到一个正式 schema。实现时建议同步落地：

```text
docs_zh/contracts/review_ledger_contract.md
schemas/review-ledger.schema.json
```

最小 schema 约束：

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

最低要求：

```text
1. normalized ledger 中不得出现未声明字段
2. category / status / sourceKind 必须受 enum 约束
3. 一个 normalized issue 可以挂多个 sourceRefs，但每条原始 finding 仍必须可逆向追溯
4. raw ledger 与 normalized ledger 都必须可 schema 校验
```

### 6.5.2 `review-source-coverage-report`：证明 review 真的被导入

仅仅“声明纳入了 docs_zh/reviews”还不够，必须生成导入完整性证明，回答：

```text
有哪些 review 文件被扫描了
每个文件识别到多少条 finding
多少条成功进入 raw ledger
多少条成功进入 normalized ledger
哪些条目因格式异常/冲突未导入
是否存在完全未覆盖的 review 文件
```

建议格式：

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

若以下任一成立，`assurance:full` 不能报告完成：

```text
存在未扫描的权威 review 文件
存在 detectedRows > rawImportedRows 且无显式 dropReasons
存在 droppedRows > 0 但没有 owner / follow-up issue
存在 parseWarnings 但未进入 issue ledger
```

### 6.5.3 `review-conflict-resolution-report`：证明冲突是如何裁决的

当同一问题在不同 review / 文档 / 代码 / 测试中结论不一致时，必须留下可审计的冲突裁决记录，而不是只在最终 ledger 里悄悄覆盖。

建议每条记录至少包含：

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

至少支持的冲突类型：

```text
status_mismatch
severity_mismatch
duplicate_but_not_same_object
doc_claim_vs_runtime
review_fixed_vs_test_failed
release_claim_vs_evidence_missing
```

以下冲突若没有 resolution report，不允许自动闭合：

```text
fixed vs failing test
done vs missing runtime path
accepted risk vs missing expiry/owner
release-ready vs missing evidence bundle
```

### 6.6 Review 新鲜度与重验证

review 文档不是永久真相。任何 review 结论若脱离当前代码状态、测试状态或 release 状态，都必须被标记为 stale，并重新验证。

最少需要记录：

```text
reviewDate
reviewedCommit / reviewedTag
reviewedPaths
evidenceDate
revalidatedAt
revalidatedBy
```

以下情况必须强制重验证，而不能直接复用旧结论：

```text
1. 相关代码路径有变更
2. 相关测试已新增/删除/skip 状态变化
3. release / architecture / contract 文档已改写
4. 距离上次复核超过约定窗口（例如 30 天）
5. 旧结论没有 evidenceRef 或只引用人工口头判断
```

review ledger 至少需要支持：

```text
fresh
stale
revalidated
superseded
needs_revalidation
```

---

## 7. Phase 3：Architecture Boundary Audit

### 7.1 五平面 import 边界

目标：

```text
interface → contracts/shared only
control → contracts/state abstractions only
orchestration → contracts/execution abstractions only
execution → contracts/state abstractions only
state-evidence → no reverse plane dependency
```

禁止：

```text
execution import orchestration internal
execution import control concrete implementation
contracts export concrete plane implementation
core facade re-export multiple planes
```

### 7.2 扫描规则

```bash
rg -n "from .*five-plane-orchestration" src/platform/five-plane-execution
rg -n "from .*five-plane-control-plane" src/platform/five-plane-execution
rg -n "from .*five-plane-state-evidence" src/platform/five-plane-execution
rg -n "export .*five-plane-control-plane" src/platform/contracts
```

### 7.3 产物

```text
architecture-boundary-report.json
architecture-boundary-violations.md
```

---

## 8. Phase 4：Contract / Schema / Runtime Audit

### 8.1 对账对象

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

### 8.2 必查类别

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

### 8.3 检查规则

每个 contract 字段必须检查：

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

每个 enum 必须检查：

```text
docs enum == TS enum == schema enum == runtime transition table
```

每个 state machine 必须检查：

```text
state set 一致
transition set 一致
terminal immutable
invalid transition rejected
transition event emitted
transition receipt/audit written
```

### 8.4 输出

```text
contract-drift-report.json
contract-drift-report.md
```

---

## 9. Phase 5：Security Audit

### 9.1 Tenant Isolation Audit

检查所有：

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

必须证明：

```text
tenantId required
workspaceId/projectId if applicable
object belongs to tenant
cross-tenant attempt returns indistinguishable error
audit event written
```

### 9.2 Secret Sink Audit

扫描 sink：

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

扫描 source：

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

检查：

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

检查：

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

## 10. Phase 6：Execution Correctness Audit

### 10.1 幂等审计

所有写入路径检查：

```text
idempotency key required
atomic SETNX / INSERT ON CONFLICT
same key same response
conflict key detected
5xx not cached
large response not stored
body fallback disabled
```

### 10.2 Queue 审计

检查：

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

### 10.3 Lease / Fencing 审计

检查：

```text
acquire uses DB sequence
renew WHERE fencingToken
release WHERE fencingToken
expired worker cannot release new lease
leadership fencing persistent
clock skew margin
lease audit for blocked attempts
```

### 10.4 Side-effect / Compensation 审计

检查：

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

### 10.5 Recovery / Replay 审计

检查：

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

## 11. Phase 7：State Evidence / Audit / Receipt Audit

### 11.1 Audit Chain

检查：

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

检查：

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

检查：

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

检查：

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

## 12. Phase 8：Eval / Redteam / Golden Audit

### 12.1 Eval Oracle Anti-fake

禁止：

```text
expectedOutput as actualOutput
constant treatment/control scores
judge reads submitted score
empty expected passes
static scorecard text
```

### 12.2 Dataset Audit

每个 dataset 必须有：

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

每个 redteam suite 必须有：

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

检查：

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

## 13. Phase 9：UI / Console / Operator Safety Audit

### 13.1 Token Storage

禁止：

```text
bearer in meta
Authorization in IndexedDB
JWT no exp accepted
PKCE verifier readable by arbitrary script
SharedWorker global token shared across origins/ports
```

### 13.2 WebSocket / SharedWorker

检查：

```text
origin/source validation
tenant-scoped subscription
broadcast authorization
malformed frame try/catch
reconnect backoff cap
token rotation
logout clears cache
```

### 13.3 High-risk Operator UX

必须有：

```text
二次确认
风险摘要
scope 展示
approval reference
receipt
undo/rollback if applicable
bulk operation partial failure UI
```

### 13.4 Console Placeholder Audit

所有 console feature 必须分类：

```text
real
mock
placeholder
disabled
experimental
```

mock/placeholder 不得进入 production-ready claim。

---

## 14. Phase 10：CI / Scripts / Supply-chain Audit

### 14.1 Scripts Path Safety

扫描：

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

所有路径必须：

```text
resolve repoRoot
realpath
startsWith allowed root
reject symlink if unsafe
size limit
atomic tmp + fsync + rename
```

### 14.2 CI Workflow Audit

检查：

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

检查：

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

## 15. Phase 11：Domain / Mission / Playbook Audit

### 15.1 Mission

检查：

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

检查：

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

每个 domain 必须有：

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

如果只是 prototype，必须标：

```text
experimental
not production
not release blocking
not industry claim evidence
```

---

## 16. Phase 12：Release Gate & Evidence Bundle

### 16.1 rc:check 必须聚合

```bash
npm run assurance:full
npm run test:p0
npm run test:chaos:p0
npm run test:redteam:p0
npm run test:golden:strict
npm run test:audit-tools
npm run test:seeded-defects
npm run evidence:bundle:create
npm run evidence:bundle:verify
```

其中，`assurance:full` 负责聚合低层 audit：

```text
assurance:review-import:check
audit:docs-sync
audit:leadership-claims
audit:contracts-sync
audit:release-claims
audit:secret-sinks
audit:tenant-isolation
audit:plugin-security
audit:eval-oracle
audit:path-safety
audit:execution-invariants
assurance:historical-promises
```

### 16.2 release blocker 规则

以下任一存在则禁止 release：

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

输出：

```text
artifacts/release/evidence-bundle.json
artifacts/release/evidence-bundle.sig
artifacts/release/rc-check-report.json
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/invariant-test-report.json
artifacts/assurance/chaos-test-report.json
artifacts/assurance/audit-tool-test-report.json
artifacts/assurance/eval-oracle-report.json
artifacts/assurance/redteam-report.json
artifacts/assurance/golden-replay-report.json
artifacts/assurance/review-ledger.normalized.jsonl
artifacts/assurance/review-evidence-readiness-report.json
artifacts/assurance/historical-promises.jsonl
artifacts/assurance/assumptions.jsonl
artifacts/assurance/issues.deduped.jsonl
artifacts/assurance/test-to-issue-map.json
artifacts/assurance/issue-to-test-map.json
artifacts/assurance/test-coverage-report.json
artifacts/assurance/historical-issue-regression-map.json
artifacts/assurance/completeness-coverage-matrix.json
artifacts/assurance/seeded-defect-report.json
artifacts/assurance/assurance-full-report.json
```

---

## 17. Review Team 分工

### 17.1 必须分角色

| 角色 | 负责 |
|---|---|
| Platform Architect | 架构边界、contract、source-of-truth |
| Security Reviewer | tenant、secret、auth、plugin、SSRF、CI supply-chain |
| Execution Reviewer | queue、lease、fencing、recovery、side-effect |
| Evidence Reviewer | audit、receipt、event、projection、evidence bundle |
| Eval Reviewer | eval、redteam、golden、judge、dataset |
| UI Reviewer | token storage、operator UX、console RBAC |
| Ops Reviewer | scripts、backup/restore、runbook、SLO、DR |
| Domain Reviewer | Mission、YONO、marketplace、division/family |
| Release Owner | rc gate、claim evidence、P0 closure |

### 17.2 双人复核

所有 P0 域必须：

```text
primary reviewer
independent reviewer
owner sign-off
evidence link
```

---

## 18. 审计完成标准

不是“看完代码”算完成，而是满足：

```text
1. source inventory 覆盖 100%
2. historical promise ledger 生成
3. known issues 全部导入 issue ledger
4. 每个 P0 issue 有 owner/fix/test/gate
5. 每个 P0 category 有自动 gate
6. contract drift report 无 P0
7. release claim report 无 unverified claim
8. eval oracle report 无 fake-pass path
9. secret sink report 无 P0
10. tenant isolation report 无 P0
11. evidence bundle 可验签
12. rc:check 一键运行并失败即阻断 release
```

### 18.1 问题必须先分“仓内可闭环”与“外部演进项”

审计完成不等于“所有问题都在本仓代码里修完”。必须先把问题分流，否则会出现两种坏结果：

```text
1. 把外部基础设施/联调项伪装成仓内代码缺口
2. 把真正的仓内缺口用“外部原因”错误豁免
```

最少分类：

```text
repo_actionable
repo_test_or_doc_actionable
external_integration
deployment_topology
risk_accepted_with_expiry
residual_risk
```

每条非 `repo_actionable` 问题都必须有：

```text
为什么不能在本仓单次闭环
当前补偿控制
owner
expiry / revisit date
下一个验证入口
```

release 结论必须分别统计：

```text
仓内未完成缺口数
外部演进项数
风险接受项数
残余风险项数
```

---

## 19. 最终建议

Automatic Agent System 后续 review/audit 不能再依赖人工“再 review 一遍”。必须转成如下机制：

```text
历史问题 → issue ledger
历史承诺 → promise ledger
架构图 → architecture ledger
contract → schema/runtime/test gate
security invariant → static + dynamic audit
execution invariant → chaos/concurrency test
eval/redteam → anti-fake oracle
release claim → evidence gate
```

最终目标：

```text
所有历史已知问题可追踪
所有历史规划承诺可验证
所有 P0 类型问题可自动阻断
所有新增代码不能绕过同一套 gate
```

这才是“尽可能确保发现所有问题、没有系统性遗漏”的正确方式。

---

## 20. 再次 Review 结论：v1.0 仍可能遗漏的地方

v1.0 已经覆盖了代码、文档、历史规划、CI、测试、Release、UI、Execution、Evidence 等主要域，但如果目标是“尽可能确保问题不会遗漏”，还必须补强以下 12 个机制。

| 编号 | v1.0 缺口 | 漏检风险 | v1.1 补强方式 |
|---:|---|---|---|
| 1 | 缺少“问题域 × 来源 × 方法”的覆盖矩阵 | 某些问题域只靠人工 review，未被自动扫描覆盖 | 新增 Completeness Coverage Matrix |
| 2 | 缺少“历史问题 → 审计规则”的反向追溯 | 已发现过的问题可能下次仍然出现 | 新增 Historical Issue Regression Map |
| 3 | 缺少审计器自身测试 | scanner 写了但漏报/误报无人发现 | 新增 Audit Tool Test Harness |
| 4 | 缺少负样本/种子漏洞验证 | gate 看似运行，实际无法抓到目标问题 | 新增 Seeded Defect Test |
| 5 | 缺少 cross-source reconciliation | docs、schema、runtime、tests、CI 任一层缺失可能被漏掉 | 新增 N-way Reconciliation |
| 6 | 缺少“新增 PR 增量审计” | 只做一次性全量 audit，后续又漂移 | 新增 PR Delta Audit |
| 7 | 缺少“不确定项处理” | 不确定问题被跳过 | 新增 Unknown-to-Issue Policy |
| 8 | 缺少 issue 去重与拆分规则 | 5000+ raw issues 可能变成不可执行噪声 | 新增 Dedup / Cluster / Epic Policy |
| 9 | 缺少修复验收标准 | issue 标 fixed 但没有 regression test/gate | 新增 Fix Verification Contract |
| 10 | 缺少 audit coverage score | 不知道还有多少盲区 | 新增 Coverage Scorecard |
| 11 | 缺少反规避策略 | 开发者可通过改名/包装绕过 scanner | 新增 Anti-gaming Rules |
| 12 | 缺少数据流/威胁模型审计 | 仅按文件扫描会漏跨模块数据流问题 | 新增 Dataflow & Threat Model Audit |

结论：

```text
v1.0 是完整审计流程。
v1.1 必须升级为“防遗漏闭环系统”。
```

---

## 21. 防遗漏核心机制：Completeness Coverage Matrix

### 21.1 覆盖矩阵目标

每个问题类别都必须至少被以下维度覆盖：

```text
Source Coverage    来源覆盖
Method Coverage    方法覆盖
Evidence Coverage  证据覆盖
Gate Coverage      阻断覆盖
Regression Coverage 回归覆盖
Owner Coverage     责任覆盖
```

### 21.2 问题域 × 审计方法矩阵

| 问题域 | 静态扫描 | 动态测试 | 人工架构审查 | 历史承诺对账 | CI Gate | 回归种子 |
|---|---:|---:|---:|---:|---:|---:|
| Release claim 失真 | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Contract/schema/runtime drift | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Tenant isolation | 必须 | 必须 | 必须 | 可选 | 必须 | 必须 |
| Secret leakage | 必须 | 必须 | 必须 | 可选 | 必须 | 必须 |
| Plugin/SBOM/signature | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Queue/idempotency | 必须 | 必须 | 必须 | 可选 | 必须 | 必须 |
| Lease/fencing | 必须 | 必须 | 必须 | 可选 | 必须 | 必须 |
| Side-effect/receipt | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Audit/evidence chain | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Eval/redteam/golden fake pass | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| UI token/operator safety | 必须 | 必须 | 必须 | 可选 | 必须 | 必须 |
| Scripts/path/CI supply-chain | 必须 | 必须 | 必须 | 可选 | 必须 | 必须 |
| Mission/playbook lifecycle | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Domain prototype scope | 必须 | 可选 | 必须 | 必须 | 必须 | 必须 |
| Observability/runbook/SLO | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Governance/division/family/ROI | 必须 | 可选 | 必须 | 必须 | 必须 | 必须 |
| Architecture boundary | 必须 | 可选 | 必须 | 必须 | 必须 | 必须 |
| Docs/ADR/SOT drift | 必须 | 可选 | 必须 | 必须 | 必须 | 必须 |

### 21.3 覆盖不足判定

任何问题域如果满足以下任一条件，审计不得宣称 complete：

```text
1. 只有人工 review，没有静态扫描
2. 只有静态扫描，没有负样本验证
3. 只有脚本，没有接入 CI
4. 只有 CI，没有 release blocker
5. 只有文档，没有 issue ledger
6. 只有 issue，没有 owner / gate / regression test
7. 只有一次性 audit，没有 PR delta audit
```

---

## 22. Historical Issue Regression Map

### 22.1 原则

每一个历史已知问题，都必须反向映射到至少一个自动化规则。

```text
历史问题不是“修完就结束”，而是必须沉淀成 scanner / test / invariant / release gate。
```

### 22.2 映射格式

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

### 22.3 历史问题必须归档到四类

| 类别 | 说明 | 必须产物 |
|---|---|---|
| Fixed with Gate | 已修复且有 gate | regression test + CI rule |
| Fixed without Gate | 已修复但无 gate | 不允许关闭 issue |
| Accepted Risk | 明确接受 | owner + expiry + compensating control |
| Not Fixed | 未修复 | blocker / roadmap |

### 22.4 禁止关闭条件

以下情况不得关闭历史 issue：

```text
没有 regression test
没有 audit rule
没有 CI gate
没有 evidenceRef
没有 owner sign-off
没有验证同类问题不存在
```

---

## 23. Audit Tool Test Harness

### 23.1 为什么要测试审计器

如果 scanner 本身没有测试，会出现：

```text
scanner 跑了，但没抓住问题
regex 被轻易绕过
新增路径没被扫描
CI 通过但实际无效
```

### 23.2 每个 audit script 必须有三类测试

| 测试类型 | 目标 |
|---|---|
| Positive Seed | 确认已知坏样本必然被抓到 |
| Negative Seed | 确认合法样本不会误报 |
| Evasion Seed | 确认简单规避写法仍被抓到 |

### 23.3 示例：secret sink audit

必须能抓到：

```ts
console.error(process.env.AA_API_JWT_SECRET);
logger.info({ token: bearerToken });
throw new Error(`failed: ${dsn}`);
span.setAttribute("user.authorization", req.headers.authorization);
audit.record({ metadata: { apiKey } });
```

必须避免误报：

```ts
logger.info("secret redacted", { secret: "[REDACTED]" });
const publicTokenName = "token_budget";
```

必须抓规避：

```ts
const k = "AA_" + "API" + "_KEY";
console.log(env[k]);
```

---

## 24. Seeded Defect Test：故意植入漏洞验证 Gate

### 24.1 目标

每个 P0 audit gate 都必须有 seeded defect fixture，证明 gate 真的能抓到目标问题。

### 24.2 种子漏洞目录

当前仓库已经把 seeded defect 落到可执行 manifest 目录；目录名允许按审计器语义做规范化，但必须覆盖同一批 P0 问题族。

```text
tests/fixtures/seeded-defects/
  tenant-query-missing/        -> tenant-isolation
  secret-logged/               -> secret-sinks
  idempotency-missing-key/     -> idempotency
  eval-oracle/                 -> eval oracle anti-fake
  plugin-security/             -> plugin signature / SBOM / fail-closed
  release-claims/              -> release claim evidence
  contracts-sync/              -> contract drift
  execution-invariants/        -> lease / side-effect / receipt / truth invariants
  path-safety/                 -> path / sandbox / script safety
  architecture-boundary/       -> architecture boundary drift
  auth-role-mapping/           -> auth / service principal escalation
  docs-sot/                    -> docs source-of-truth drift
  fire-and-forget/             -> async reliability invariant
  ui-token-storage/            -> UI operator safety
  redteam/                     -> redteam anti-fake
  golden/                      -> golden anti-fake
  dataset/                     -> dataset / eval asset integrity
  test-disabled/               -> disabled/skip governance
  test-coverage/               -> issue/test binding coverage
```

要求不是“目录名逐字一致”，而是：

```text
每个 P0 audit family 都必须有 manifest + positive/negative/evasion seed；
seeded-defect runner 必须能输出 machine-readable report；
若某类 gate 因为是全局扫描无法按单文件复放，必须在 manifest / report 中显式标明 skip 原因，并由 dedicated auditor test 补足。
```

### 24.3 每次 CI 验证

```bash
npm run audit:seeded-defects
```

要求：

```text
所有 bad seeds 必须 fail
所有 good seeds 必须 pass
所有 evasion seeds 必须 fail
```

如果 audit tool 抓不到 seeded defect，审计结果无效。

---

## 25. N-way Reconciliation：多源交叉对账

### 25.1 为什么需要 N-way

二源对账不够。例如 contract docs 与 TS type 一致，但 runtime 没写；runtime 写了，但 OpenAPI 没暴露；OpenAPI 有，但测试没覆盖。

### 25.2 N-way 对账对象

| 对象 | 必须对账来源 |
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

### 25.3 缺一即 issue

N-way 对账中任一来源缺失，必须生成 issue：

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

## 26. PR Delta Audit：防止修完后再次产生

### 26.1 每个 PR 必跑

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

### 26.2 PR 风险升级规则

PR 若触碰以下路径，必须进入 P0/P1 审查：

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

### 26.3 PR 禁止合并条件

```text
新增 release claim 无 evidence
新增 contract 字段无 runtime/test
新增 route 无 tenant/auth test
新增 metric 无 emitter/exporter
新增 event 无 producer/consumer schema
新增 plugin path 无 SBOM/signature gate
新增 high-risk action 无 no-go/HITL policy
新增 script rm/mv/cp/write 无 root guard
```

---

## 27. Unknown-to-Issue Policy

### 27.1 原则

审计中任何“不确定”不得跳过，必须转成 issue 或 assumption。

```text
不确定是否实现 = issue: implementation_unverified
不确定是否安全 = issue: security_review_required
不确定是否被 CI 覆盖 = issue: gate_unverified
不确定是否历史承诺 = issue: promise_unclassified
```

### 27.2 Assumption Ledger

所有假设必须进入：

```text
artifacts/assurance/assumptions.jsonl
```

字段：

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

未验证 assumption 到期后自动升级为 issue。

---

## 28. Dedup / Cluster / Epic Policy

### 28.1 为什么要去重

5000+ raw issues 如果不去重，会变成不可执行噪声。

### 28.2 三层结构

```text
Raw Finding       原始发现，可以很多
Normalized Issue  归一化问题，合并同类重复
Epic              可交付工程包
```

### 28.3 去重规则

相同 root cause + 相同 invariant + 相同 fix strategy 的问题可以合并。

示例：

```text
多个 Date.now() 用于 ID / report / checkpoint hash
可以合并到 deterministic clock/id generator epic
但 security token random secret module load 不应与普通 Date.now 合并
```

对 `docs_zh/reviews/` 下的分片 review，还必须额外满足以下条件才允许去重：

```text
1. 保留原始权威编号：
   issues-table / platforme-full-review-a/b/c/d/e/ee / system-review / consistency-audit / ui-review
   的原始 rowId 不能丢，只能在 normalized issue 中挂 sourceRefs[]

2. 保留最后一次结论：
   若同一问题在 round / reaudit / follow-up review 中被再次复核，
   必须保留 latestStatus、latestReviewDate、latestClosureNote，不能只保留首条发现

3. 保留多来源证据：
   合并后的 issue 至少记录 sourceFiles[]、evidenceRefs[]、testRefs[]、docRefs[]

4. 仅当“问题对象”一致时才允许合并：
   同样是 timeout / retry / leak / missing test，不代表是同一 issue；
   若作用对象不同（API、worker、UI shell、CDC、DLQ、OIDC 等），默认拆开

5. review shard 之间优先“关联”而不是“吞并”：
   `platforme-full-review-ee.md` 并入 `platforme-full-review-e.md`
   这类场景，默认保留 shard 来源，并用 canonical id 建 linkedFindings[]
```

### 28.4 不允许过度合并

以下问题不能只合并成一个泛泛的“安全问题”：

```text
tenant isolation
secret leakage
plugin signature
approval bypass
SSRF
path traversal
```

它们必须分别有 gate。

此外，以下问题族也不允许被粗暴合并成“测试问题 / 文档问题 / 清理问题 / UI 问题”：

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

原因：

```text
这些问题的 root cause、风险面、修复策略、验证方式、CI gate 都不同。
如果过度合并，会让：
1. hard wait 被 cleanup leak 吞掉
2. release claim 夸大被普通文档错别字吞掉
3. UI bridge 命名错误被泛化成“前端问题”
4. 人工 system review 抽样发现的 runtime gap 被归并进旧问题后失去跟踪
```

因此，归一化台账至少应保证：

```text
一个 canonical issue 只对应一个清晰的 invariant 破坏点
一个 invariant 破坏点只绑定一套主要修复策略
一个修复策略必须能映射到明确的 regression / gate / closure evidence
```

---

## 29. Fix Verification Contract

### 29.1 每个修复必须包含

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

### 29.2 修复验收模板

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

### 29.3 禁止“只修代码”

以下修复无效：

```text
只改实现，不加测试
只加测试，不接 CI
只改文档，不改 runtime
只改 scanner，不加 seeded defect
只标 accepted risk，无 expiry/owner
```

---

## 30. Coverage Scorecard：审计覆盖率量化

### 30.1 分数不是 release 充分条件

Coverage score 只用于发现盲区，不用于替代 P0 blocker。

### 30.2 维度

| 维度 | 说明 | 目标 |
|---|---|---:|
| Source Coverage | 文件/文档/配置是否纳入 inventory | 100% |
| Promise Coverage | 历史承诺是否抽取 | ≥ 95%，P0 文档 100% |
| Contract Coverage | contract 是否 N-way 对账 | 100% P0 |
| Security Coverage | P0 security rules 是否有 seed | 100% |
| Execution Coverage | idempotency/lease/queue/side-effect invariants | 100% P0 |
| Eval Coverage | eval/redteam/golden anti-fake | 100% P0 |
| CI Coverage | P0 audit 是否在 CI/release gate | 100% |
| Regression Coverage | 历史 P0 是否有 regression seed | 100% |
| Owner Coverage | P0/P1 是否有 owner | 100% |

### 30.3 输出

```text
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/audit-coverage-scorecard.md
```

---

## 31. Anti-gaming Rules：防止规避审计

### 31.1 常见规避

```text
把 secret 字段改名为 credentialRef2
用字符串拼接绕过 scanner
把 dangerous path 包装到 helper
把 eval score 写成静态 builder
把 mock data 放到 shared api-client
把 production-ready claim 放到非 docs_zh 路径
把 event/metric 名称放到 JSON 而不是 TS
把 route 注册放到动态 dispatcher
```

### 31.2 反规避策略

```text
AST 扫描优先于 regex
taint tracking 覆盖 source→sink
配置/JSON/YAML/MD 全纳入扫描
新增 helper 必须被 scanner 展开识别
scanner 规则必须有 evasion seeds
release claim 扫描覆盖 README/docs/ui/config/release_notes
```

---

## 32. Dataflow & Threat Model Audit

### 32.1 为什么文件扫描不够

很多问题跨文件才出现：

```text
route 读取 tenantId → service 未使用 → repository 无过滤
LLM 输出 → learning object → promotion → knowledge store
token → offline queue → IndexedDB → replay
Tool output → handoff builder → audit receipt
```

### 32.2 必做数据流图

至少建 10 条核心 dataflow：

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

每条 dataflow 必须标注：

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

## 33. 人工 Review 防遗漏协议

### 33.1 Reviewer 不得自由发挥

每个 reviewer 必须按 checklist 填写：

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

### 33.2 双人独立审查

P0 域必须两人独立审查，先独立记录，再 merge findings。

### 33.3 Blind Spot Declaration

每份 review 必须声明：

```text
我没有覆盖哪些路径
哪些结论依赖假设
哪些检查无法自动验证
哪些需要 runtime/chaos 测试
```

没有 blind spot declaration 的 review 不能作为 release evidence。

---

## 34. 最小不可省略 Audit Set

如果时间有限，至少必须完成以下 15 项，否则不能宣称“全项目 audit”。

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

任一未完成，都只能声明：

```text
partial audit
```

不能声明：

```text
full audit
release-ready
final
production-ready
```

---

## 35. v1.1 增补后的审计完成标准（现并入 v1.3）

在原第 18 节基础上，追加以下硬条件：

```text
13. 每个 P0 问题域都有 coverage matrix 记录
14. 每个历史 P0 问题都有 regression seed
15. 每个 audit script 有 positive/negative/evasion tests
16. 每个 release claim 有 owner/evidenceRef/expiry
17. 每个 unknown assumption 进入 assumptions ledger
18. 每个 P0 fix 有 Fix Verification Contract
19. 每个 P0 gate 通过 seeded defect 验证
20. 每个 PR 触发 delta audit
21. 每个人工 review 有 blind spot declaration
22. audit coverage scorecard 生成并归档
```

如果这些条件未满足，审计结论只能写：

```text
本次审计覆盖主要问题域，但仍存在未量化漏检风险。
```

不能写：

```text
确保没有遗漏。
```

---

## 36. 最终防遗漏结论

v1.1 的策略是：

```text
不是承诺绝对没有遗漏，
而是建立一个让遗漏可发现、可追踪、可回归、可阻断的系统。
```

真正可靠的状态应满足：

```text
历史问题全部进入 ledger
历史承诺全部进入 promise ledger
P0 问题域全部有自动 gate
gate 自身有 seeded defect 验证
修复必须带 regression test
release claim 必须带 signed evidence
新增 PR 必须跑 delta audit
人工 review 必须声明 blind spot
```

只有这样，Automatic Agent System 才能从“人工反复发现大量问题”转成：

```text
已知类型问题自动阻断
历史承诺自动对账
release claim 自动降级或阻断
未知问题通过覆盖矩阵持续收敛
```

---

# 37. 自动化 Assurance Pipeline 设计

> 本节源自 v1.1 增补内容，现已并入 v1.3，用于把“全项目 review / audit 方法论”落成可执行、可持续、可阻断 release 的自动化流程。

## 20.1 核心结论

Automatic Agent System 的自动化审计不能只是一个扫描脚本，而必须是一套持续运行的 **Assurance Pipeline**：

```text
历史问题回收
→ 全仓 Inventory
→ 静态审计
→ 动态不变量测试
→ Contract / Docs / Runtime 对账
→ Eval / Redteam 防假通过
→ Issue Ledger 归并
→ Release Gate 阻断
→ Evidence Bundle 签名归档
```

它需要覆盖三种执行场景：

```text
PR:       assurance:delta
Nightly:  assurance:full
Release:  rc:check
```

目标不是承诺“绝对零遗漏”，而是做到：

```text
1. 历史问题不再靠人工记忆；
2. 历史承诺不再靠文档自称；
3. P0 类型问题不再靠人工 review 才发现；
4. release 不再靠主观判断；
5. 新增 PR 不能绕过已有问题类型的 gate；
6. 所有 release claim 必须有可验签 evidence。
```

---

## 20.2 自动化主入口

建议统一新增一个完整自动化入口：

```bash
npm run assurance:full
```

它内部串联：

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

Release 前必须跑：

```bash
npm run rc:check
```

`rc:check` 只允许在所有 P0 gate 通过后放行。

---

## 20.3 自动化流程总图

```text
                 ┌──────────────────────────┐
                 │  1. Source Inventory      │
                 └─────────────┬────────────┘
                               │
                 ┌─────────────▼────────────┐
                 │  2. Historical Promises   │
                 │  ADR / Release / Docs     │
                 └─────────────┬────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │  3. Static Audit Layer                       │
        │  contract / secret / tenant / path / import  │
        └──────────────────────┬──────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │  4. Dynamic Audit Layer                      │
        │  invariant / chaos / multi-tenant / replay   │
        └──────────────────────┬──────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │  5. Eval / Redteam / Golden Anti-fake        │
        └──────────────────────┬──────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │  6. Issue Ledger Normalize + Dedup           │
        └──────────────────────┬──────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │  7. P0/P1 Gate + Coverage Scorecard          │
        └──────────────────────┬──────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │  8. Release Evidence Bundle                  │
        └─────────────────────────────────────────────┘
```

---

## 20.4 Layer 1：全仓 Inventory

### 20.4.1 目标

先知道项目里到底有什么，不允许“未登记资产”进入 release。

### 20.4.2 输出

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

### 20.4.3 自动检查

```text
哪些模块无 owner
哪些模块无 tests
哪些 route 无 OpenAPI
哪些 event 无 schema
哪些 metric 无 emitter/exporter
哪些 docs claim 无 evidence
哪些 config 无 schema
哪些 workflow 未进入最小权限策略
哪些 domain 是 prototype 但未标 disabled_by_default
```

---

## 20.5 Layer 2：历史承诺回收

### 20.5.1 扫描来源

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
历史 Marp / PPT / Markdown
```

### 20.5.2 抽取关键词

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

### 20.5.3 输出

```text
artifacts/assurance/historical-promises.jsonl
artifacts/assurance/historical-promise-drift-report.json
artifacts/assurance/historical-promise-drift-report.md
```

### 20.5.4 阻断规则

```text
历史文档说 done，但没有 code/test/gate/evidence = issue
历史文档说 final，但 P0 未关闭 = release blocker
历史文档说 metric，但没有 emitter/exporter/alert = issue
历史文档说 API，但没有 route/OpenAPI/test = issue
历史文档说 event，但没有 schema/producer/consumer = issue
历史文档说 UI，但只有 placeholder/mock = issue
历史文档说 production-ready，但没有 signed evidence bundle = release blocker
```

---

## 20.6 Layer 3：静态审计层

### 20.6.1 建议脚本

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

### 20.6.2 重点扫描模式

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

### 20.6.3 静态审计必须输出

```text
artifacts/assurance/static-audit-report.json
artifacts/assurance/static-audit-report.md
artifacts/assurance/static-audit-findings.jsonl
```

---

## 20.7 Layer 4：动态不变量测试

静态扫描抓不到并发、崩溃、一致性和跨租户路径，必须补动态测试。

### 20.7.1 建议脚本

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

### 20.7.2 必测不变量

```text
A 租户不能读 B 租户对象
相同 idempotency key 并发只能写一次
旧 fencing token 不能释放新 lease
worker crash 后 active queue job 可恢复
外部副作用 commit 后必须有 receipt
truth mutation + event append 必须同事务
projection rebuild 不漏事件
DLQ retry 不重复造成副作用
replay 不能跨 tenant
recovery repair 不能产生 orphan ticket
```

### 20.7.3 输出

```text
artifacts/assurance/invariant-test-report.json
artifacts/assurance/chaos-test-report.json
```

---

## 20.8 Layer 5：Eval / Redteam / Golden 防假通过

### 20.8.1 建议脚本

```bash
npm run audit:eval-oracle
npm run audit:redteam-runner
npm run audit:golden-replay
npm run test:redteam:p0
npm run test:golden:strict
```

### 20.8.2 禁止模式

```text
expectedOutput 当 actualOutput
constant treatment/control score
judge 读取被测方自报分
dataset 只有 card 无 samples
frozenHash 是 sha256:<datasetId> 占位
redteam 只有 yaml 无 result
golden expected.length === 0 直接通过
golden 只检查子序列，额外事件不失败
scorecard 静态 builder 文本冒充真实评分
```

### 20.8.3 输出

```text
artifacts/assurance/eval-oracle-report.json
artifacts/assurance/redteam-report.json
artifacts/assurance/golden-replay-report.json
```

---

## 20.9 Layer 6：审计器自测

审计脚本本身也必须被测试，避免 scanner 只抓最简单模式。

### 20.9.1 每个 audit 脚本必须有三类 seed

```text
positive seed：真实问题必须抓到
negative seed：正常代码不能误报
evasion seed：换写法后仍能抓到
```

### 20.9.2 示例：secret sink 审计器必须抓到

```ts
logger.info({ token });
throw new Error(`dsn=${dsn}`);
eventBus.publish({ authorization });
span.setAttribute("user.jwt", jwt);
metric.labels({ apiKey });
audit.record({ metadata: { bearerToken } });
```

不能只抓：

```ts
console.log(token);
```

### 20.9.3 建议脚本

```bash
npm run test:audit-tools
npm run test:seeded-defects
```

### 20.9.4 输出

```text
artifacts/assurance/audit-tool-test-report.json
artifacts/assurance/seeded-defect-report.json
```

---

## 20.10 Layer 7：Issue Ledger 自动归并

所有审计结果统一进入 issue ledger。

### 20.10.1 输出文件

```text
artifacts/assurance/issues.raw.jsonl
artifacts/assurance/issues.normalized.jsonl
artifacts/assurance/issues.deduped.jsonl
docs_zh/quality/issue-ledger/automatic-agent-system-issues.md
```

### 20.10.2 归并规则

```text
同文件同根因合并
同 invariant 合并
同 historical promise 合并
同 P0 Epic 合并
同 contract drift 合并
同 release claim drift 合并
```

### 20.10.3 每条 issue 必须包含

```json
{
  "issueId": "AAS-ISSUE-000001",
  "source": "code|doc|adr|release|test|ci|runtime|manual|audit|review",
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

## 20.11 Layer 8：Coverage Scorecard

自动生成覆盖率评分，防止“看起来跑了很多脚本但问题域没有覆盖”。

### 20.11.1 输出

```text
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/audit-coverage-scorecard.md
artifacts/assurance/coverage-scorecard.json
```

### 20.11.2 评分维度

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

### 20.11.3 Release 最低要求

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

# 38. PR / Nightly / Release 三层流水线

## 21.1 PR Delta Audit

每个 PR 不必跑完整全量，但必须跑 delta audit：

```bash
npm run assurance:delta -- --base origin/main
```

Delta audit 检查变更文件及影响链：

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

### 21.1.1 PR 阻断条件

```text
新增 P0
新增 release claim 无 evidence
新增 API 无 OpenAPI/test
新增 event 无 schema
新增 metric 无 emitter/exporter
新增 high-risk action 无 policy/approval/receipt
新增 secret sink
新增 tenant query 无 tenantId
新增 fire-and-forget async
新增 process.env in library code
新增 in-memory truth store without experimental flag
新增 eval dataset card without samples/frozenHash
```

---

## 21.2 Nightly Full Assurance

每天跑完整版本：

```bash
npm run assurance:full
```

输出：

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

Nightly 目标：

```text
发现跨模块问题
发现历史 promise drift
发现未被 PR delta 覆盖的问题
发现文档状态漂移
发现 release claim 过期
发现新增 mock/placeholder 泄露到 production scope
```

---

## 21.3 Release rc:check

Release 前必须跑：

```bash
npm run rc:check
```

`rc:check` 内部应聚合：

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

### 21.3.2 Release 输出

```text
artifacts/release/rc-check-report.json
artifacts/release/evidence-bundle.json
artifacts/release/evidence-bundle.sig
```

---

# 39. 建议的 package.json 脚本结构

```json
{
  "scripts": {
    "assurance:full": "node scripts/assurance/run-full-assurance.mjs",
    "assurance:delta": "node scripts/assurance/run-delta-assurance.mjs",
    "assurance:inventory": "node scripts/assurance/collect-source-inventory.mjs",
    "assurance:review-import": "node scripts/assurance/review-import.mjs",
    "assurance:historical-promises": "node scripts/assurance/collect-historical-promises.mjs",
    "assurance:issue-ledger": "node scripts/assurance/build-issue-ledger.mjs",
    "assurance:coverage-scorecard": "node scripts/assurance/build-coverage-scorecard.mjs",

    "audit:docs-sync": "node scripts/ci/audit-docs-sync.mjs",
    "audit:leadership-claims": "node scripts/ci/audit-leadership-claims.mjs",
    "audit:contracts-sync": "node scripts/ci/audit-contracts-sync.mjs",
    "audit:release-claims": "node scripts/ci/audit-release-claims.mjs",
    "audit:secret-sinks": "node scripts/ci/audit-secret-sinks.mjs",
    "audit:tenant-isolation": "node scripts/ci/audit-tenant-isolation.mjs",
    "audit:plugin-security": "node scripts/ci/audit-plugin-security.mjs",
    "audit:path-safety": "node scripts/ci/audit-path-safety.mjs",
    "audit:eval-oracle": "node scripts/ci/audit-eval-oracle.mjs",
    "audit:architecture-boundary": "node scripts/ci/audit-architecture-boundary.mjs",

    "test:invariant": "npm run test:invariants",
    "test:p0": "npm run test:invariants && npm run test:regression:p0",
    "test:chaos:p0": "AA_RUNNING_TESTS=1 node scripts/assurance/run-test-suite-with-report.mjs --suite-id chaos-p0 --report artifacts/assurance/chaos-test-report.json -- node scripts/run-node-tests.mjs tests/chaos/p0/determinism-injection.test.ts",
    "test:redteam:p0": "AA_RUNNING_TESTS=1 node scripts/redteam/run-p0-redteam.mjs",
    "test:audit-tools": "AA_RUNNING_TESTS=1 node scripts/assurance/run-test-suite-with-report.mjs --suite-id audit-tools --report artifacts/assurance/audit-tool-test-report.json -- node scripts/run-node-tests.mjs tests/audit-tools/...",
    "test:seeded-defects": "node scripts/assurance/run-seeded-defect-tests.mjs",

    "evidence:bundle:create": "node scripts/assurance/create-release-evidence-bundle.mjs",
    "evidence:bundle:verify": "node scripts/assurance/verify-release-evidence-bundle.mjs",

    "rc:check": "node scripts/assurance/rc-check.mjs"
  }
}
```

---

# 40. 自动化落地路线

## 23.1 Stage 0：只生成报告，不阻断

```text
assurance:inventory
assurance:historical-promises
audit:release-claims
audit:contracts-sync
audit:secret-sinks
```

输出报告，但不 fail CI。

## 23.2 Stage 1：P0 Gate Observe Mode

```text
P0 问题记录为 blockers
CI 显示失败风险
但 release owner 可人工 override
```

override 必须写入：

```text
override owner
expiry
reason
risk acceptance
follow-up issue
```

## 23.3 Stage 2：P0 Gate Enforcing Mode

以下问题直接 fail：

```text
secret sink P0
tenant isolation P0
eval oracle fake pass
release claim unverified
plugin verification fail-open
contract drift P0
```

## 23.4 Stage 3：P1 Gate Observe Mode

将 P1 纳入 scorecard，不立即阻断。

## 23.5 Stage 4：Full Release Evidence Gate

Release 必须生成并验签：

```text
evidence-bundle.json
evidence-bundle.sig
rc-check-report.json
```

---

# 41. 自动化流程自身的防遗漏机制

自动化流程本身也可能遗漏问题，因此必须加入以下保护：

```text
1. 每个 audit gate 必须有 seeded defect test。
2. 每个历史问题类别必须至少映射到一个 scanner/test/gate。
3. 每个 scanner 必须有 evasion seed。
4. 每个 P0 修复必须新增 regression seed。
5. 每个 release claim 必须能反向追溯到 evidenceRef。
6. 每个 evidenceRef 必须能被 verifier 打开和验签。
7. 每个 generated report 必须有 schema。
8. 每个 schema 必须 additionalProperties:false，除非有明确理由。
9. 每个 warning-only gate 必须有升级日期。
10. 每个 manual override 必须有 expiry。
```

---

# 42. 自动化流程验收标准

自动化流程本身必须满足：

```text
assurance:full 可以在干净环境运行
assurance:delta 可以在 PR 中运行
rc:check 可以一键判断 release
所有输出 artifacts 都有 schema
所有 P0 gate 有 seeded defect test
所有 historical promises 有 ledger
所有 known issues 有 issue ledger entry
所有 release claims 有 evidenceRef
所有 evidence bundle 可验签
```

---

# 43. 与原 Review/Audit 文档的关系

原 v1.1 文档回答：

```text
应该怎么 review / audit？
```

本自动化章节回答：

```text
怎么把 review / audit 变成持续自动化流程？
```

两者关系：

```text
v1.1 方法论 = 审计标准
第 20–25 节 = 自动化执行系统
rc:check = release 阻断入口
issue-ledger = 问题闭环载体
evidence-bundle = release 事实证明
```

---

# 44. Tests 与 Assurance Pipeline 的关系

> 本节说明 `tests/` 在 Automatic Agent System Assurance Pipeline 中的位置、职责边界、目录结构建议、CI 接入方式，以及如何用测试体系防止历史问题再次遗漏。

## 44.1 核心关系

`tests/` 是 Assurance Pipeline 的核心输入层，但 Assurance Pipeline 不是普通 test runner，也不是 tests 的替代品。

更准确地说：

```text
tests 负责证明“代码行为是否符合预期”；
Assurance Pipeline 负责证明“整个项目是否可以被信任、是否可以 release、是否遗漏历史问题”。
```

因此：

```text
Tests 是 Assurance Pipeline 的证据来源之一；
Assurance Pipeline 是决定项目是否可信、是否能 release 的总控系统。
```

普通测试只能覆盖运行时行为。大量历史问题并不是普通 test 能发现的，例如：

```text
文档说 done 但代码没实现
release claim 没 evidence
contract enum 与 schema 不一致
CI 没跑某个 gate
OpenAPI 没声明 route
metric 只在文档里，没有 emitter
dataset-card 存在但没有样本
Docker/GHA supply-chain 风险
历史 ADR accepted 但验收标准未落地
```

这些必须靠 audit、scanner、schema 对账、release gate 和 evidence bundle，而不是只靠 `tests/`。

---

## 44.2 tests 在 Assurance Pipeline 中的位置

```text
Assurance Pipeline
├── Static Audit 静态审计
│   ├── contract drift scan
│   ├── secret sink scan
│   ├── tenant isolation scan
│   ├── path safety scan
│   └── architecture boundary scan
│
├── Tests 动态验证
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
├── Docs / Contract / Runtime 对账
├── Issue Ledger
├── Coverage Scorecard
└── Release Evidence Bundle
```

结论：

```text
tests 证明“实现能跑”；
audit 证明“实现没有偏离架构、安全、合约、发布承诺”；
rc:check 汇总 tests + audit + evidence，决定是否允许 release。
```

---

## 44.3 tests 目录结构建议

当前项目不应只按 `unit / integration / e2e` 三类组织测试。建议升级为：

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

每类测试承担不同职责，不能互相替代。

---

## 44.4 Unit Tests

### 职责

验证单个函数、类、纯逻辑是否正确。

### 示例

```text
parseSemver 是否拒绝 NaN
roundCurrency 是否符合货币规则
stableHash 是否确定性
normalizeTenantId 是否正确
strictIsoInstant 是否拒绝宽松日期
```

### 适合发现的问题

```text
局部算法错误
边界条件错误
schema 解析错误
小型状态机错误
```

### 不适合发现的问题

```text
跨租户泄露
跨模块事务不一致
release claim 造假
CI gate 未接入
文档承诺未落地
```

---

## 44.5 Integration Tests

### 职责

验证多个模块之间的协作路径。

### 示例

```text
HTTP route → auth → service → repository
ToolGateway → risk → approval → receipt
MissionResolver → MissionRepository → EventAppender
Queue → Lease → Worker → Writeback
```

### 必须覆盖的历史问题域

```text
auth / route / service / repository tenant propagation
approval / risk / policy / receipt 串联
truth write / event append / audit write 串联
plugin verification / registry / executor 串联
```

---

## 44.6 E2E Tests

### 职责

验证完整产品主链。

### 示例

```text
创建任务 → 规划 → 执行 → 写 evidence → 生成 receipt → UI 展示
Mission 创建 → 绑定 task → budget reserve → run → report
YONO market 创建 → comment → forecast → resolve → settlement
```

### 要求

E2E 不应只验证 happy path，还必须验证：

```text
失败路径
权限拒绝
审批路径
receipt 缺失时阻断
tenant 越权时拒绝
release claim 无 evidence 时拒绝
```

---

## 44.7 Invariant Tests

这是 Automatic Agent System 最关键、最需要补强的一类测试。

它不是测试某个功能，而是测试系统不变量。

### 必测不变量

```text
任何 tenant A 都不能读 tenant B 的对象
任何外部副作用必须有 receipt
任何 lease release 必须带 fencingToken
任何 event append 必须有 idempotencyKey
任何 high-risk action 必须经过 approval
任何 release claim 必须有 evidenceRef
任何 plugin 加载必须完成 signature/SBOM/waiver 检查
任何 production rollout 必须有 metrics gate
任何 truth mutation 必须与 event append 在同一事务或 outbox 边界内
```

### 建议目录

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

### Release 要求

P0 不变量测试必须进入：

```text
npm run test:invariant
npm run rc:check
```

---

## 44.8 Chaos Tests

### 职责

验证崩溃、并发、重试、恢复、部分提交、时钟漂移场景。

### 必测场景

```text
truth 写成功但 event 写失败
side-effect commit 成功但 receipt 写失败
worker 拿到 lease 后 crash
projection rebuild 中途新增 event
backup 上传失败后 cleanup 执行
restore 中途 SIGINT
queue job active 后 worker crash
lease renew 与 release 并发
budget reserve 与 settle 并发
```

### 建议目录

```text
tests/chaos/
├── p0/
│   ├── side-effect-receipt-crash.test.ts
│   ├── event-outbox-crash.test.ts
│   ├── lease-worker-crash.test.ts
│   └── projection-rebuild-concurrent-append.test.ts
└── p1/
```

Chaos test 的失败不应被简单标为 flaky。若涉及 P0 不变量，release 默认 hold。

---

## 44.9 Regression Tests

### 职责

每个历史问题修复后，必须沉淀成回归测试。

历史问题链路必须是：

```text
issue → fix → regression test → audit gate / test gate → evidenceRef
```

### 示例映射

```text
issue 2: Redis keyPrefix 双重 idempotency
  tests/regression/interface/idempotency-redis-prefix.test.ts

issue 12: service principal 被授予 admin
  tests/regression/interface/service-principal-role-mapping.test.ts

issue 524: SQLite queue 幂等 TOCTOU
  tests/regression/execution/sqlite-queue-idempotency-race.test.ts

issue 562: expectedOutput 当 actualOutput
  tests/regression/eval/eval-oracle-expected-as-actual.test.ts

issue 977: admin inventory endpoint 无审计
  tests/regression/interface/admin-inventory-audit.test.ts
```

### 规则

```text
P0 修复没有 regression test，不允许关闭 issue；
P1 修复没有 regression test，必须有书面理由；
regression test 必须进入 CI 或 rc:check；
regression test 必须引用 issueId。
```

---

## 44.10 Audit Tool Tests

Assurance Pipeline 新增一类特殊测试：测试审计器本身。

### 职责

验证 audit 脚本能发现真实问题，不只是“跑完”。

### 示例：secret sink auditor 必须抓到

```ts
logger.info({ token });
throw new Error(`dsn=${dsn}`);
eventBus.publish({ authorization });
span.setAttribute("user.jwt", jwt);
metric.labels({ apiKey });
audit.record({ metadata: { bearerToken } });
```

不能只抓：

```ts
console.log(token);
```

### 建议目录

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

### 每个 audit tool 必须有三类样本

```text
positive seed：真实问题必须抓到
negative seed：正常代码不能误报
evasion seed：换写法后仍能抓到
```

---

## 44.11 Seeded Defect Tests

### 职责

故意放入带漏洞 fixture，验证 gate 真能阻断。

### 建议目录

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

### 验收规则

```text
audit 脚本必须抓到 seeded defects；
抓不到说明 gate 无效；
P0 gate 没有 seeded defect test，不允许进入 enforcing mode。
```

---

## 44.12 Contract Tests

### 职责

验证 docs / TS type / Zod schema / JSON schema / OpenAPI / runtime 行为一致。

### 必测对象

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

### 要求

```text
contract test 不只检查类型，还要检查 producer/consumer/runtime validator。
```

示例：

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

必须从静态 YAML 升级为可执行 runner：

```text
redteam suite
→ runner
→ result
→ critical_success count
→ release gate
```

### 44.13.2 Eval Tests

必须验证：

```text
dataset 有 samples
frozenHash 是真实内容 hash
runner 可运行
judge 不读被测方自报分
threshold 来自 policy
```

### 44.13.3 Golden Tests

必须严格验证：

```text
frozen clock
deterministic id
seed injected
expected events exact match 或显式 allowlist diff
extra events 默认失败
```

---

## 44.14 tests 与 audit 的区别

| 维度 | tests | audit |
|---|---|---|
| 主要目标 | 行为是否正确 | 项目是否可信、是否漂移 |
| 输入 | 代码执行结果 | 代码、文档、配置、CI、schema、历史承诺 |
| 方式 | 执行代码 | 扫描 + 对账 + 部分执行 |
| 输出 | pass/fail | issue/finding/report/gate |
| 能发现 | runtime behavior bug | drift、claim、missing gate、security smell、contract mismatch |
| 典型问题 | queue enqueue 是否成功 | enqueue 是否有幂等唯一键、是否有 regression test、是否被 CI 跑 |

一句话：

```text
tests 证明“实现行为”；
audit 证明“项目事实”；
assurance 汇总二者，证明“能否 release”。
```

---

## 44.15 建议的 package.json 测试脚本

```json
{
  "scripts": {
    "test:unit": "node --test tests/unit/**/*.test.ts",
    "test:integration": "node --test tests/integration/**/*.test.ts",
    "test:e2e": "node --test tests/e2e/**/*.test.ts",

    "test:invariant": "npm run test:invariants",
    "test:p0": "npm run test:invariants && npm run test:regression:p0",
    "test:chaos:p0": "AA_RUNNING_TESTS=1 node scripts/assurance/run-test-suite-with-report.mjs --suite-id chaos-p0 --report artifacts/assurance/chaos-test-report.json -- node scripts/run-node-tests.mjs tests/chaos/p0/determinism-injection.test.ts",
    "test:regression:p0": "AA_RUNNING_TESTS=1 node scripts/run-node-tests.mjs tests/regression/p0/audit-tools-secret-sinks.test.ts",
    "test:audit-tools": "AA_RUNNING_TESTS=1 node scripts/assurance/run-test-suite-with-report.mjs --suite-id audit-tools --report artifacts/assurance/audit-tool-test-report.json -- node scripts/run-node-tests.mjs tests/audit-tools/...",
    "test:seeded-defects": "node scripts/assurance/run-seeded-defect-tests.mjs",
    "test:redteam:p0": "node scripts/redteam/run-p0-redteam.mjs",
    "test:golden:strict": "node scripts/golden/run-strict-golden.mjs",

    "assurance:full": "node scripts/assurance/run-full-assurance.mjs",
    "assurance:delta": "node scripts/assurance/run-delta-assurance.mjs",
    "rc:check": "node scripts/assurance/rc-check.mjs"
  }
}
```

关系：

```text
assurance:full 会调用关键 tests；
rc:check 会调用 P0 tests + audit gates + evidence verification；
普通 test 不再等于 release check。
```

### 44.15.1 Disabled / Skip / Flaky 测试治理

历史 review 已经证明，`skip`、`todo`、`only`、伪 flaky 豁免会直接制造假绿灯。因此测试方法论必须显式治理这些状态。

最少规则：

```text
禁止提交 .only
新增 .skip / test.skip / describe.skip / xit / xtest / todo 必须带 issueId + owner + expiry
P0/P1 测试默认不得 skip；若临时 skip，rc:check 必须失败
flaky 不能作为永久标签，必须进入 quarantine ledger 并设置退出时间
```

建议新增检查：

```bash
npm run test:disabled-audit
```

输出：

```text
artifacts/assurance/disabled-tests-report.json
artifacts/assurance/flaky-tests-report.json
artifacts/assurance/quarantine-tests-report.json
```

若以下任一成立，release 默认 hold：

```text
存在无 owner/expiry 的 disabled test
存在覆盖 P0 invariant 的 skipped test
存在超过 expiry 仍未恢复的 flaky quarantine test
存在为了通过 rc:check 新增的临时 skip
```

---

## 44.16 CI 接入关系

### PR 阶段

PR 主要跑：

```text
test:unit
test:integration impacted subset
test:regression impacted subset
test:audit-tools impacted subset
assurance:delta
```

目的：

```text
防止新增问题进入主干。
```

### Nightly 阶段

Nightly 跑：

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

目的：

```text
发现跨模块、慢路径、历史 drift、非 PR 层可发现问题。
```

### Release 阶段

Release 只看：

```text
npm run rc:check
```

内部必须包括：

```text
test:p0
test:invariants
test:chaos:p0
test:redteam:p0
test:golden:strict
assurance:full
evidence:bundle:verify
```

说明：

```text
test:invariants 是当前主脚本名
test:invariant 仅保留为兼容别名
```

目的：

```text
决定是否能 release。
```

---

## 44.17 tests 的 Coverage Scorecard

Assurance Coverage Scorecard 中必须单独包含 tests 维度：

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

最低要求：

```text
P0 historical issue regression coverage = 100%
P0 invariant test coverage = 100%
P0 audit tool seeded defect coverage = 100%
release claim evidence test coverage = 100%
eval anti-fake regression coverage = 100%
```

---

## 44.18 tests 的 Issue Ledger 绑定

每个测试都应能反向追踪到：

```text
issueId
invariantId
promiseId
contractId
releaseGateId
```

建议在测试文件头部加入 metadata 注释：

```ts
/**
 * @issue AAS-ISSUE-000524
 * @invariant INV-QUEUE-IDEMPOTENCY-001
 * @gate audit:execution-invariants
 * @severity P0
 */
```

Assurance Pipeline 应扫描这些 metadata，并生成：

```text
artifacts/assurance/test-to-issue-map.json
artifacts/assurance/issue-to-test-map.json
```

如果 P0 issue 没有测试绑定，`rc:check` 必须失败。

当前实现路径：

```text
assurance:test-to-issue -> 生成双向映射
assurance:verify-test-coverage -> 校验 P0 issue / invariant / promise-linked issue 绑定
assurance:full(required) -> 聚合 verify-test-coverage
rc:check -> 以 assurance:full 失败阻断 release
```

---

## 44.19 最终要求

后续项目不能只说：

```text
我们有很多 tests。
```

必须升级为：

```text
每个历史 P0 问题都有 regression test；
每个系统不变量都有 invariant test；
每个审计器都有 seeded defect test；
每个 release claim 都有 evidence test；
所有这些都被 rc:check 阻断。
```

这才是 Automatic Agent System 能减少问题遗漏的测试体系。
