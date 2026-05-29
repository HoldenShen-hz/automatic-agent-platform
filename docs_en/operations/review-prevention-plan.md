# Review Prevention Plan

> 目标：把 `docs_zh/reviews/` 中反复出现的Issue，从“review 时人工发现”转成“提交前和 CI 中自动阻止”。
> Last updated: 2026-05-27

## 1. Issuedefines

当前 review 能一iterations性扫出大量Issue，不代table review 本身有效率高；更准确地说，is很多约束仍停留在“人知道”，没有被产品化为持续门禁。

高频Issue集中在以下几class：

- Architecturevsexport边界：deep import、compat shim 漂移、公共出口绕路。
- class型治理：`@ts-expect-error`、`@ts-ignore`、`as any`、双重断言。
- 外部 URL / security基线：hardcodes第三方 URL、未走 outbound policy、错误测试分层。
- 文档vscode漂移：旧路径、旧脚本、旧仓库 URL、版本/Node 基线inconsistent。
- 测试治理：重名测试标题、spawn 误放 unit、历史平lines目录残留。
- UI 声明漂移：`Implemented/*` vs实际未接后端inconsistent、按钮no真实动作。

## 2. 为什么Issue会在 review 才暴露

Root Cause不is“review 太晚”，而is“约束没有前移”。

- 现有测试更偏功能正确性，缺少结构正确性门禁。
- TypeScript 只能保证class型正确，不能自动约束Architecture边界、export语义、文档时效性。
- 文档、脚本、测试、UI manifest、运lines时出口分散演进，缺少统一对账。
- 历史兼容层和旧目录长期累积，没有持续清账机制。
- 很多Issuebelongs to横切面Issue，单文件/单 PR review 不容易看全。

Conclusion：

- review 应负责设计取舍、风险判断、需求偏差。
- review 不应继续承担机械扫描工作，例如找hardcodes URL、找 `@ts-expect-error`、找repeats测试标题。

## 3. 预防principle

### 3.1 左移

- 新Issue必须在本地提交前或 CI 首轮failed。
- 不允许relies on“大table review 收口”作为常规发现手段。

### 3.2 机器优先

- 凡is能写成脚本的约束，不继续relies on人工记忆。
- 每关闭一class review Issue，都要新增对应 guardrail。

### 3.3 权威源唯一

- Architecture边界看 `docs_zh/contracts/`、`architecture/` vs `AGENTS.md`。
- 测试执lines约定看 `package.json` 和 `scripts/run-layered-tests.mjs`。
- Statusclass UI 声明看 feature manifest，不允许 view 层各说各话。

## 4. 必须落地的持续门禁

### 4.1 P0：一周内补齐

- 已落地（2026-05-27）：
  - `scripts/ci/audit-type-suppressions.mjs`
  - `scripts/ci/audit-outbound-urls.mjs`
  - `scripts/ci/audit-public-entrypoints.mjs`
  - `scripts/ci/audit-duplicate-test-titles.mjs`
  - 已接入 `npm run audit:repo-hygiene`
  - 当前采用“存量基线 + 禁止回升”策略；后续治理目标不is放宽基线，而is持续下压并回写基线
- class型抑制审计：
  - 扫描新增 `@ts-expect-error`、`@ts-ignore`、`as any`、`as unknown as`。
  - defaults to新增即failed；存量必须白名单化并逐步归零。
- 外部 URL 审计：
  - 扫描 `http://` / `https://` 字面量。
  - only允许 contract fixture、README 示例和明确白名单目录。
  - 运lines时code必须via outbound policy / helper 注册。
- 顶层出口审计：
  - 禁止 `src/index.ts` directly拉深层内部模块。
  - 只允许via `src/platform/index.ts`、`src/sdk/index.ts` 等公开入口聚合。
- repeats测试标题审计：
  - 扫描同名 `test("...")`，跨文件repeatsexceeds过threshold即failed。
- 文档 URL / 路径审计：
  - 扫描旧仓库 URL、个人绝对路径、失效脚本名、失效目录references用。

### 4.2 P1：两周内补齐

- 测试分层审计：
  - 扫描 `execFileSync` / `spawn` / `fork` 等进程call。
  - 出现在 `tests/unit/` defaults tofailed，除非显式白名单。
- UI manifest 一致性审计：
  - `Implemented/Contracted` 或 `Implemented/Internal` 的特性必须满足：
    - 不为纯静态 hook；
    - workbench action 至少有一个真实 `onTrigger`；
    - 不得用占位文案伪装已接线。
- 大文件治理审计：
  - 接入lines数threshold扫描。
  - exceedsthreshold不一定directlyfailed，但必须出审计报告并要求 owner。
- compat shim 审计：
  - 新增 compat 入口必须有消费者证据和关闭计划。

### 4.3 P2：一个月内补齐

- review Root Cause标签化：
  - 每个 review Issue必须打标签，例如 `boundary`、`typing`、`docs-drift`、`test-hygiene`、`ui-status-drift`。
  - 每周统计新增量和复发量。
- PR 模板治理：
  - 新增“isnoreferences入新 deep import / 新外部 URL / 新class型压制 / 新 compat shim”检查项。
- CODEOWNERS / owner 归属：
  - Architecture边界、文档索references、测试基础设施、UI manifest 需明确 owner。

## 5. Recommendation新增的脚本vs门禁位

Recommendation新增或扩展以下脚本，并接入 `npm run audit:repo-hygiene` 或 `npm test`：

| 脚本 | 作用 | 推荐接入 |
|---|-------|--------|
| `scripts/ci/audit-type-suppressions.mjs` | 扫描class型压制vs双重断言 | `audit:repo-hygiene` |
| `scripts/ci/audit-outbound-urls.mjs` | 扫描运lines时code中的裸 URL | `audit:repo-hygiene` |
| `scripts/ci/audit-public-entrypoints.mjs` | 扫描顶层出口 deep import | `audit:repo-hygiene` |
| `scripts/ci/audit-duplicate-test-titles.mjs` | 扫描repeats测试标题 | `audit:test-exclusions` 或 `audit:repo-hygiene` |
| `scripts/ci/audit-test-layering.mjs` | 检查 spawn/network/文件系统重操作isno误放 unit | `audit:repo-hygiene` |
| `scripts/ci/audit-ui-feature-contracts.mjs` | 校验 UI feature status/action/hook 一致性 | UI test baseline |
| `scripts/ci/audit-doc-links-and-sources.mjs` | 扫描旧 URL、绝对路径、失效脚本references用 | `audit:docs-sync` |

## 6. Definition of Done 更新

以后一个Issue只有在同时满足下面条件时，才算真正解决：

1. 当前code/文档/测试已修复。
2. 有定向验证命令或证据。
3. 同classIssue已补 guardrail，能防止复发。

不满足第 3 条时，只能算“本iterations修掉了”，不能算“体系已收口”。

## 7. review 后的标准动作

每iterations review 结束后，必须按下面顺序handle：

1. 修复本轮发现的Issue。
2. 归class前 10 个高频Issue。
3. 选出其中能自动化的项补脚本。
4. 把脚本接到 CI。
5. 在 `review-closure-board.md` record该classIssueisno已门禁化。

禁止只更新 review 文档，不补防回归机制。

## 8. 指标

Recommendation按周跟踪以下指标：

- review 新增Issue数
- 同classIssue复发数
- 需要人工才能发现的Issue占比
- 已门禁化Issue占比
- `@ts-expect-error` / `as any` 存量
- 裸 URL 存量
- repeats测试标题存量

目标口径：

- 高频机械Issue的人工发现比例逐步下降。
- review 逐步只剩设计和Architecture判断Issue。

## 9. 本仓库下一步执lines顺序

Recommendationdirectly按这个顺序落地：

1. 先做class型压制、裸 URL、repeats测试标题、deep import 四个 P0 脚本。
2. 再做测试分层和 UI manifest 一致性两个 P1 脚本。
3. 最后把 review 标签化和 owner 机制接到流程里。

## 10. 相关入口

- 当前 review 收口table：`docs_zh/reviews/platforme-full-review-b.md`
- review Status口径：`docs_zh/operations/review-closure-board.md`
- 运维总索references：`docs_zh/operations/README.md`
- 轻量追踪入口：`docs_zh/operations/operations-tracker.md`
