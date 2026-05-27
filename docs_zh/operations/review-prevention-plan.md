# Review Prevention Plan

> 目标：把 `docs_zh/reviews/` 中反复出现的问题，从“review 时人工发现”转成“提交前和 CI 中自动阻止”。
> Last updated: 2026-05-27

## 1. 问题定义

当前 review 能一次性扫出大量问题，不代表 review 本身有效率高；更准确地说，是很多约束仍停留在“人知道”，没有被产品化为持续门禁。

高频问题集中在以下几类：

- 架构与导出边界：deep import、compat shim 漂移、公共出口绕路。
- 类型治理：`@ts-expect-error`、`@ts-ignore`、`as any`、双重断言。
- 外部 URL / 安全基线：硬编码第三方 URL、未走 outbound policy、错误测试分层。
- 文档与代码漂移：旧路径、旧脚本、旧仓库 URL、版本/Node 基线不一致。
- 测试治理：重名测试标题、spawn 误放 unit、历史平行目录残留。
- UI 声明漂移：`Implemented/*` 与实际未接后端不一致、按钮无真实动作。

## 2. 为什么问题会在 review 才暴露

根因不是“review 太晚”，而是“约束没有前移”。

- 现有测试更偏功能正确性，缺少结构正确性门禁。
- TypeScript 只能保证类型正确，不能自动约束架构边界、导出语义、文档时效性。
- 文档、脚本、测试、UI manifest、运行时出口分散演进，缺少统一对账。
- 历史兼容层和旧目录长期累积，没有持续清账机制。
- 很多问题属于横切面问题，单文件/单 PR review 不容易看全。

结论：

- review 应负责设计取舍、风险判断、需求偏差。
- review 不应继续承担机械扫描工作，例如找硬编码 URL、找 `@ts-expect-error`、找重复测试标题。

## 3. 预防原则

### 3.1 左移

- 新问题必须在本地提交前或 CI 首轮失败。
- 不允许依赖“大表 review 收口”作为常规发现手段。

### 3.2 机器优先

- 凡是能写成脚本的约束，不继续依赖人工记忆。
- 每关闭一类 review 问题，都要新增对应 guardrail。

### 3.3 权威源唯一

- 架构边界看 `docs_zh/contracts/`、`architecture/` 与 `AGENTS.md`。
- 测试执行约定看 `package.json` 和 `scripts/run-layered-tests.mjs`。
- 状态类 UI 声明看 feature manifest，不允许 view 层各说各话。

## 4. 必须落地的持续门禁

### 4.1 P0：一周内补齐

- 类型抑制审计：
  - 扫描新增 `@ts-expect-error`、`@ts-ignore`、`as any`、`as unknown as`。
  - 默认新增即失败；存量必须白名单化并逐步归零。
- 外部 URL 审计：
  - 扫描 `http://` / `https://` 字面量。
  - 仅允许 contract fixture、README 示例和明确白名单目录。
  - 运行时代码必须通过 outbound policy / helper 注册。
- 顶层出口审计：
  - 禁止 `src/index.ts` 直接拉深层内部模块。
  - 只允许通过 `src/platform/index.ts`、`src/sdk/index.ts` 等公开入口聚合。
- 重复测试标题审计：
  - 扫描同名 `test("...")`，跨文件重复超过阈值即失败。
- 文档 URL / 路径审计：
  - 扫描旧仓库 URL、个人绝对路径、失效脚本名、失效目录引用。

### 4.2 P1：两周内补齐

- 测试分层审计：
  - 扫描 `execFileSync` / `spawn` / `fork` 等进程调用。
  - 出现在 `tests/unit/` 默认失败，除非显式白名单。
- UI manifest 一致性审计：
  - `Implemented/Contracted` 或 `Implemented/Internal` 的特性必须满足：
    - 不为纯静态 hook；
    - workbench action 至少有一个真实 `onTrigger`；
    - 不得用占位文案伪装已接线。
- 大文件治理审计：
  - 接入行数阈值扫描。
  - 超阈值不一定直接失败，但必须出审计报告并要求 owner。
- compat shim 审计：
  - 新增 compat 入口必须有消费者证据和关闭计划。

### 4.3 P2：一个月内补齐

- review 根因标签化：
  - 每个 review 问题必须打标签，例如 `boundary`、`typing`、`docs-drift`、`test-hygiene`、`ui-status-drift`。
  - 每周统计新增量和复发量。
- PR 模板治理：
  - 新增“是否引入新 deep import / 新外部 URL / 新类型压制 / 新 compat shim”检查项。
- CODEOWNERS / owner 归属：
  - 架构边界、文档索引、测试基础设施、UI manifest 需明确 owner。

## 5. 建议新增的脚本与门禁位

建议新增或扩展以下脚本，并接入 `npm run audit:repo-hygiene` 或 `npm test`：

| 脚本 | 作用 | 推荐接入 |
| --- | --- | --- |
| `scripts/ci/audit-type-suppressions.mjs` | 扫描类型压制与双重断言 | `audit:repo-hygiene` |
| `scripts/ci/audit-outbound-urls.mjs` | 扫描运行时代码中的裸 URL | `audit:repo-hygiene` |
| `scripts/ci/audit-public-entrypoints.mjs` | 扫描顶层出口 deep import | `audit:repo-hygiene` |
| `scripts/ci/audit-duplicate-test-titles.mjs` | 扫描重复测试标题 | `audit:test-exclusions` 或 `audit:repo-hygiene` |
| `scripts/ci/audit-test-layering.mjs` | 检查 spawn/网络/文件系统重操作是否误放 unit | `audit:repo-hygiene` |
| `scripts/ci/audit-ui-feature-contracts.mjs` | 校验 UI feature status/action/hook 一致性 | UI test baseline |
| `scripts/ci/audit-doc-links-and-sources.mjs` | 扫描旧 URL、绝对路径、失效脚本引用 | `audit:docs-sync` |

## 6. Definition of Done 更新

以后一个问题只有在同时满足下面条件时，才算真正解决：

1. 当前代码/文档/测试已修复。
2. 有定向验证命令或证据。
3. 同类问题已补 guardrail，能防止复发。

不满足第 3 条时，只能算“本次修掉了”，不能算“体系已收口”。

## 7. review 后的标准动作

每次 review 结束后，必须按下面顺序处理：

1. 修复本轮发现的问题。
2. 归类前 10 个高频问题。
3. 选出其中能自动化的项补脚本。
4. 把脚本接到 CI。
5. 在 `review-closure-board.md` 记录该类问题是否已门禁化。

禁止只更新 review 文档，不补防回归机制。

## 8. 指标

建议按周跟踪以下指标：

- review 新增问题数
- 同类问题复发数
- 需要人工才能发现的问题占比
- 已门禁化问题占比
- `@ts-expect-error` / `as any` 存量
- 裸 URL 存量
- 重复测试标题存量

目标口径：

- 高频机械问题的人工发现比例逐步下降。
- review 逐步只剩设计和架构判断问题。

## 9. 本仓库下一步执行顺序

建议直接按这个顺序落地：

1. 先做类型压制、裸 URL、重复测试标题、deep import 四个 P0 脚本。
2. 再做测试分层和 UI manifest 一致性两个 P1 脚本。
3. 最后把 review 标签化和 owner 机制接到流程里。

## 10. 相关入口

- 当前 review 收口表：`docs_zh/reviews/platforme-full-review-b.md`
- review 状态口径：`docs_zh/operations/review-closure-board.md`
- 运维总索引：`docs_zh/operations/README.md`
- 轻量追踪入口：`docs_zh/operations/operations-tracker.md`
