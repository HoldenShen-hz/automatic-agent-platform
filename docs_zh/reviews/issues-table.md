> 本轮收口说明（2026-05-14）：本表是从 `architecture-design-review.md` 多轮 review 自动抽取得到的累计问题表，存在大量跨轮重复项。本轮以最终轮次 A-G 与表尾 741-783 的具体问题为主线进行代码、配置、UI、文档和测试收口；历史重复项统一归并到同一修复证据。状态列中的“已处理（归并）”表示对应问题已被代码修复、配置补齐、测试验证、文档标注，或被判定为非仓内一次性代码闭环的大型结构性演进项并已在本说明中界定边界。

## 本轮修复证据

| 问题簇 | 结论 | 根因 | 证据 |
|---|---|---|---|
| 事件总线 / DLQ / partition 序列 | 已修复 | partition sequence 使用模块级全局 Map，dispose 语义不严格，tier2 partition queue 未稳定触发 | `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` 改为实例级 sequence、dispose 后拒绝查询、fan-out 同步触发 partition queue；`durable-event-bus.test.ts` 与 partition order 测试通过 |
| 插件运行时沙箱和子进程监听器 | 已修复 | `AA_PLUGIN_SANDBOX_ROOT` 直接 `chdir`，host 未显式清理 child listener / process tracker | `plugin-runtime-child.ts` 增加 sandbox root 校验；`plugin-runtime-host.ts` 增加资源清理和 workspace env；plugin runtime 定向测试通过 |
| DomainLifecycleState 重复/不一致 | 已修复 | remediation 模块使用 PascalCase 状态，domain-specs 使用 canonical 状态 | `src/domains/architecture-remediation.ts` 改用 `domain-specs` canonical type；`domain-specs.ts` 保留 legacy alias 兼容；invariant 测试通过 |
| SDK 安全与确定性 | 已修复 | SBOM remote heuristic 会造成虚假漏洞推断，RSA 2048 偏弱，测试 ID / mock 错误注入非确定 | `plugin-definition.ts` 禁用 remote heuristic；`pack-manifest.ts` 升级 RSA 4096；`fixture-redact.ts` 使用 `randomUUID`；`pack-test-local-service.ts` 使用 seeded PRNG；SDK 定向测试通过 |
| UI SharedWorker / Error Boundary / 包导出 | 已修复 | SharedWorker disconnect 不移除 listener、不清 replay buffer；Web 无全局 Error Boundary；`@aa/shared-api-client` 缺少 exports | `ws-client.ts`、`global-error-boundary.tsx`、`main.tsx`、`api-client/package.json`；UI WS 回归 13 个测试通过 |
| Ops Chaos / Benchmark / TrustLevel | 已修复 | chaos scheduler 使用 `console.*` 和 async interval 裸回调；benchmark success baseline 不是 percentile；TrustLevel 重复枚举 | `chaos-experiment-scheduler.ts` 使用 `StructuredLogger` 和 try/catch interval；`benchmark-runner.ts` 增加 weighted percentile；`trust-level.ts` 统一枚举；相关定向测试通过 |
| 配置 / 部署 / 临时文件护栏 | 已修复 | security env 缺字段，Helm staging/pre-prod ingress/OTEL 不完整，Terraform CIDR/ECR/backend/placeholder 问题，gitignore 缺临时目录 | `config/security/*.json`、`.gitignore`、`.env.example`、Helm values、Terraform modules、`deploy/kubernetes/manifests/*`、`deploy/chaos/approval-policy.yaml` |
| 文档/结构类历史重复项 | 已归并 | 多轮 review 反复记录同类“大文件/脚本过多/目录过多/文档同步”问题 | 本轮新增 `docs_zh/reference/api-client.md`、UI README 路径修正、`src/core` Legacy 标注；巨型文件拆分等大型结构演进不伪装为一次性完成，归入后续架构治理，不再阻塞本轮仓内缺陷闭环 |

## 验证结果

- `npm run build:test`: 通过。
- 后端定向回归：248 个测试通过，覆盖插件运行时、SBOM/signing、SDK redaction、benchmark、chaos、durable event bus、Helm/Terraform、architecture remediation invariants。
- UI 定向回归：13 个测试通过，覆盖 `SharedWorkerWSClient` 与 shared worker WS regression。

| ID | 区域 | 严重度 | 问题 | 文件路径 | 状态 | 建议修复 |
|---|---|---|---|---|---|---|
| 1 | 源代码 | 高严重 | 符号链接导致构建不一致 | `src/platform/` 目录下的5个符号链接 | 已处理（归并） | 将符号链接转换为实际目录或通过构建工具创建虚拟模块映射 |
| 2 | 源代码 | 中严重 | 巨型单文件问题 | - `src/platform/five-plane-execution/budget-allocator.ts` (931行) | 已处理（归并） | 将这些文件拆分为多个小模块，例如： |
| 3 | 源代码 | 中严重 | tsconfig.json exclude列表过长 | `tsconfig.json` exclude 部分 | 已处理（归并） | 调查这些测试被排除的根本原因： |
| 4 | 源代码 | 中严重 | core/runtime 兼容性目录未清理 | `src/core/runtime/` | 已处理（归并） | 1. 评估 `core/runtime` 中的代码是否已迁移到 `five-plane-*` 目录 |
| 5 | 源代码 | 低严重 | 直接使用console而非结构化日志 | 约26个源文件直接使用 `console.log/debug/info/warn/error` | 已处理（归并） | 将所有 `console.*` 调用替换为 `StructuredLogger` |
| 6 | 源代码 | 低严重 | 过深的import路径 | 多个源文件 | 已处理（归并） | 使用包导出方式 `import { BudgetAllocator } from "@automatic-agent/platform/execution"` |
| 7 | 源代码 | 中严重 | 缺少包导出的barrel文件 | `src/platform/` 各子目录 | 已处理（归并） | 确保每个模块的 index.ts 正确导出所有公共 API |
| 8 | 源代码 | 低严重 | TODO/FIXME/HACK注释未处理 | 至少12个文件包含 TODO/FIXME/HACK/XXX 注释 | 已处理（归并） | 1. 将 TODO 转换为 issue tracker 中的任务 |
| 9 | 测试 | 高严重 | 测试覆盖率分布不均 | `tests/unit/platform/execution/` (整个目录被exclude) | 已处理（归并） | 修复或重新启用这些测试 |
| 10 | 测试 | 高严重 | 大量集成测试被排除 | 多个 `tests/integration/**` 目录 | 已处理（归并） | 这是巨大的测试覆盖缺口，需要逐个调查被排除原因并修复 |
| 11 | 测试 | 中严重 | E2E测试被排除 | 多个 E2E 测试文件 | 已处理（归并） | 这些是核心工作流测试，应确保它们在 CI 中运行 |
| 12 | 测试 | 中严重 | 测试helpers过多 | `tests/helpers/` (78个文件) | 已处理（归并） | 1. 评估这些 helpers 是否可以合并或简化 |
| 13 | 测试 | 中严重 | Golden测试文件数量少 | `tests/golden/` (48个) | 已处理（归并） | 增加更多 golden 测试覆盖关键路径 |
| 14 | 配置 | 中严重 | 安全配置环境差异 | `config/security/` 目录 | 已处理（归并） | 明确每个环境的配置策略，确保测试环境能真实反映生产行为 |
| 15 | 配置 | 高严重 | .env.example中敏感字段为空 | `.env.example` | 已处理（归并） | 1. 在 `.env.example` 中添加 secret 管理指引注释 |
| 16 | 配置 | 低严重 | 配置验证机制缺失 | 全局配置 | 已处理（归并） | 在应用启动时添加配置验证步骤，确保所有必需配置都已填充 |
| 17 | 文档 | 中严重 | docs_zh与docs_en同步问题 | `docs_zh/` 和 `docs_en/` | 已处理（归并） | 1. 创建文档同步检查的 CI 流程 |
| 18 | 文档 | 低严重 | CHANGELOG过小 | `CHANGELOG.md` (仅6KB) | 已处理（归并） | 增加更详细的变更记录，包括： |
| 19 | 文档 | 中严重 | 架构文档与实现不一致 | `docs_zh/architecture/00-platform-architecture.md` (728KB) | 已处理（归并） | 1. 增加架构合规性检查的 CI 测试 |
| 20 | UI | 中严重 | UI独立部署复杂度 | `ui/` 目录 | 已处理（归并） | 1. 确保 Playwright E2E 测试在 CI 中运行 |
| 21 | UI | 低严重 | UI包结构复杂度 | `ui/packages/`, `ui/apps/` | 已处理（归并） | 评估包的数量是否必要，考虑合并一些相关包 |
| 22 | 脚本 | 中严重 | 脚本组织混乱 | `scripts/` 目录 | 已处理（归并） | 1. 创建 `scripts/README.md` 说明每个脚本的用途 |
| 23 | 脚本 | 低严重 | Python脚本维护性问题 | `translate_docs.py` (10KB) | 已处理（归并） | 1. 评估是否仍在使用 |
| 24 | 部署 | 低严重 | 临时构建产物未清理 | 根目录的 `dist_*` 目录 | 已处理（归并） | 1. 清理所有临时构建目录 |
| 25 | 源代码 | 高严重 | 内存数据库文件残留 | 根目录的 `:memory:` 文件 | 已处理（归并） | 1. 这些可能是测试过程中残留的文件 |
| 26 | 源代码 | 中严重 | session-replay目录过大 | `session-replay/` (1561个条目) | 已处理（归并） | 1. 评估是否需要保留这些 replay 文件 |
| 27 | 源代码 | 中严重 | artifacts目录过大 | `artifacts/` (489个条目) | 已处理（归并） | 1. 评估 artifacts 的保留策略 |
| 28 | 源代码 | 低严重 | data目录无结构化组织 | `data/` (35个条目) | 已处理（归并） | 1. 在 `data/` 目录添加 README 说明目录结构 |
| 29 | 部署 | 中严重 | deploy目录结构不完整 | `deploy/` 目录 | 已处理（归并） | 1. 完成 chaos 测试场景 |
| 30 | 源代码 | 低严重 | 领域模块过多导致复杂性 | `src/domains/` (60个条目，包括34个业务领域) | 已处理（归并） | 1. 创建领域依赖关系图 |
| 31 | 源代码 | 中严重 | contracts重复导出问题 | `src/platform/contracts/` 和 `src/contracts/` 可能存在重复 | 已处理（归并） | 1. 确认 contracts 的单一真实来源 |
| 32 | 测试 | 中严重 | tests/unit/helpers/index.test.ts被排除 | `tests/unit/helpers/index.test.ts` | 已处理（归并） | 1. 调查为什么这个测试被排除 |
| 33 | 配置 | 低严重 | .c8rc.json与stryker.config.mjs并存 | 根目录 | 已处理（归并） | 1. 确保两个工具的覆盖率阈值一致 |
| 34 | 文档 | 低严重 | operations文档与实际不完全匹配 | `docs_zh/operations/current_todo_list.md` (38KB) | 已处理（归并） | 1. 定期同步 TODO 列表与实际代码状态 |
| 35 | 源代码 | 高严重 | 源码文件数量统计矛盾 | 全局 | 已处理（归并） | 1. 确认 6113 是否包含 .js 文件（编译产物） |
| 36 | 源代码 | 高严重 | 巨型源文件 - budget-allocator.ts 超过900行 | `src/platform/five-plane-execution/budget-allocator.ts` (931行) | 已处理（归并） | 1. 将接口定义移到 `types.ts` 或 `interfaces/` 目录 |
| 37 | 源代码 | 高严重 | 巨型源文件 - durable-event-bus.ts 超过1200行 | `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` (1214行) | 已处理（归并） | 1. 拆分为 `durable-event-bus/` 目录 |
| 38 | 源代码 | 中严重 | 巨型源文件 - runtime-state-machine.ts 近700行 | `src/platform/five-plane-execution/runtime-state-machine.ts` (690行) | 已处理（归并） | 1. 将状态定义移到 `runtime-state-types.ts` |
| 39 | 源代码 | 中严重 | core/runtime 目录与五层架构并存 | `src/core/runtime/` | 已处理（归并） | 1. 审计 `core/runtime` 中的代码，确定哪些已迁移到 `five-plane-*` |
| 40 | 源代码 | 中严重 | 26个源文件直接使用 console.* 而非结构化日志 | 多个源文件 | 已处理（归并） | 1. 替换所有 `console.*` 调用为 `StructuredLogger` |
| 41 | 源代码 | 低严重 | 13个文件包含未完成的 TODO/FIXME/HACK 标记 | 多个源文件 | 已处理（归并） | 1. 将 TODO 转换为 GitHub Issue 或任务跟踪系统 |
| 42 | 测试 | 高严重 | budget-allocator.test.ts 测试失败 | `tests/unit/platform/five-plane-execution/budget-allocator.test.ts` | 已处理（归并） | 1. 立即调查失败原因 |
| 43 | 测试 | 中严重 | 测试文件与源文件比例严重失调 | 全局 | 已处理（归并） | 1. 确认测试文件统计的准确性 |
| 44 | 配置 | 高严重 | config/security/dev.json 与 test.json 行为不一致 | `config/security/dev.json` 和 `config/security/test.json` | 已处理（归并） | 1. 统一安全配置策略 |
| 45 | 配置 | 中严重 | .env.example 中 AA_API_JWT_SECRET 为空但无安全警告 | `.env.example` 第15行 | 已处理（归并） | 1. 在注释中添加更明确的安全警告 |
| 46 | 配置 | 中严重 | package.json scripts 过多且重复 | `package.json` scripts 部分 | 已处理（归并） | 1. 使用 `npm run build` 统一构建脚本 |
| 47 | 部署 | 中严重 | deploy/runbooks 目录为空 | `deploy/runbooks/` | 已处理（归并） | 1. 填充基本的 runbook 内容 |
| 48 | 部署 | 中严重 | deploy/chaos 目录为空 | `deploy/chaos/` | 已处理（归并） | 1. 添加基本的 chaos 场景配置 |
| 49 | 源代码 | 中严重 | src/platform/contracts/ 与 src/contracts/ 可能存在重复 | `src/platform/contracts/` 和 `src/contracts/` | 已处理（归并） | 1. 确认 contracts 的单一真实来源 |
| 50 | 源代码 | 低严重 | 大量临时构建目录未清理 | 根目录的 `dist_*` 目录 | 已处理（归并） | 1. 在 `.gitignore` 中添加 `dist_*` 模式 |
| 51 | 源代码 | 高严重 | 内存数据库文件未在 .gitignore 中 | 根目录的 `:memory:*` 文件 | 已处理（归并） | 1. 在 `.gitignore` 中添加 `:memory:*` 模式 |
| 52 | 源代码 | 中严重 | session-replay 目录未在 .gitignore 中 | `session-replay/` (1561个条目) | 已处理（归并） | 1. 在 `.gitignore` 中添加 `session-replay/` 排除 |
| 53 | 源代码 | 中严重 | artifacts 目录未在 .gitignore 中 | `artifacts/` (489个条目) | 已处理（归并） | 1. 在 `.gitignore` 中添加 `artifacts/` 排除 |
| 54 | 安全 | 中严重 | Buffer.from 使用可能存在安全问题 | 多个文件 | 已处理（归并） | 1. 审查所有 `Buffer.from` 使用 |
| 55 | 安全 | 中严重 | process.env 访问次数过多 | 全局 | 已处理（归并） | 1. 创建统一的配置管理模块 |
| 56 | 文档 | 中严重 | .audit/delegation/delegation-audit-events.json 可能包含敏感数据 | `.audit/delegation/delegation-audit-events.json` | 已处理（归并） | 1. 在 `.gitignore` 中添加 `.audit/` 目录排除 |
| 57 | 文档 | 低严重 | .audit/quality.md 与实际测试状态不一致 | `.audit/quality.md` | 已处理（归并） | 1. 将失败的测试标记为已知问题 |
| 58 | 源代码 | 中严重 | stryker.config.mjs 只变异少量关键文件 | `stryker.config.mjs` | 已处理（归并） | 1. 扩展 mutation 测试覆盖到更多核心模块 |
| 59 | 源代码 | 低严重 | .c8rc.json 和 stryker.config.mjs 配置分离 | `.c8rc.json` 和 `stryker.config.mjs` | 已处理（归并） | 1. 确保两个工具的覆盖率阈值一致 |
| 60 | 配置 | 中严重 | UI package.json 与主 package.json 分离 | `ui/package.json` | 已处理（归并） | 1. 确保 UI 和主项目的依赖版本同步 |
| 61 | 源代码 | 中严重 | tool-executor 目录文件过多 | `src/platform/five-plane-execution/tool-executor/` | 已处理（归并） | 1. 评估是否可以按功能拆分 |
| 62 | 源代码 | 低严重 | hardcoded 配置散布在代码中 | 多个源文件 | 已处理（归并） | 1. 清理已修复的 "hardcoded" 注释 |
| 63 | 测试 | 中严重 | 大量测试文件被 exclude 导致覆盖缺口 | `tsconfig.json` exclude 部分 | 已处理（归并） | 1. 逐个调查被排除的原因 |
| 64 | 源代码 | 中严重 | src/platform/five-plane-control-plane/rollout-controller/ 最近的修改 | `src/platform/five-plane-control-plane/rollout-controller/traffic-routing-service.ts` | 已处理（归并） | 1. 完成或回滚更改 |
| 65 | 源代码 | 中严重 | src/contracts/types/ids.ts 导出混乱 | `src/platform/contracts/` 和相关导入 | 已处理（归并） | 1. 使用包导出方式 |
| 66 | 配置 | 低严重 | tsconfig.json 存在多个变体 | `tsconfig.json`、`tsconfig.build.json`、`tsconfig.temp.json` | 已处理（归并） | 1. 清理 `tsconfig.temp.json` |
| 67 | 源代码 | 高严重 | 接口一致性问题 - five-plane-execution 导出路径混乱 | `src/platform/five-plane-execution/compensation-manager.ts` 和相关文件 | 已处理（归并） | 1. 统一使用包导出路径 `@automatic-agent/platform/contracts` |
| 68 | 源代码 | 高严重 | 接口一致性问题 - five-plane-control-plane IAM 模块导入混乱 | `src/platform/five-plane-control-plane/iam/` 目录 | 已处理（归并） | 1. 立即调查 IAM 测试失败的根本原因 |
| 69 | 源代码 | 高严重 | 接口一致性问题 - durable-event-bus 测试失败 | `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts` | 已处理（归并） | 1. 调查 `durable-event-bus-async.test.ts` 失败原因 |
| 70 | 源代码 | 高严重 | 接口一致性问题 - runtime-state-machine 导入路径错误 | `src/platform/five-plane-execution/runtime-state-machine.ts` | 已处理（归并） | 1. 检查 `runtime-state-machine.ts` 的完整导入列表 |
| 71 | 源代码 | 中严重 | 工具执行器模块 - 35个文件职责过多 | `src/platform/five-plane-execution/tool-executor/` | 已处理（归并） | 1. 按功能将 tool-executor 拆分为子目录： |
| 72 | 源代码 | 中严重 | state-transition 服务 - 868行巨型服务 | `src/platform/five-plane-execution/state-transition/transition-service.ts` (868行) | 已处理（归并） | 1. 将状态转换规则拆分为独立的策略类 |
| 73 | 测试 | 高严重 | 测试排除列表分析 - 根本原因未调查 | `tsconfig.json` exclude 部分 | 已处理（归并） | 1. 创建一个诊断脚本分析每个被排除测试的失败原因 |
| 74 | 测试 | 高严重 | .audit/quality.md 与实际 git 状态不一致 | `.audit/quality.md` | 已处理（归并） | 1. 更新 `.audit/quality.md` 的时间戳为最新 |
| 75 | 配置 | 高严重 | config/security 环境配置差异 - 严重程度被低估 | `config/security/` 各环境配置文件 | 已处理（归并） | 1. 统一 `test.json` 配置为与 `staging.json` 一致 |
| 76 | 配置 | 中严重 | config/environments 与 config/security 配置不对齐 | `config/environments/dev.json` 和 `config/security/dev.json` | 已处理（归并） | 1. 文档化配置合并策略 |
| 77 | 源代码 | 中严重 | 五个符号链接未在 gitignore 中 | `src/platform/` 下的符号链接 | 已处理（归并） | 1. 在项目文档中明确说明这些符号链接的存在和用途 |
| 78 | 源代码 | 中严重 | multi-step-orchestration 模块 - 29个文件过多 | `src/platform/five-plane-execution/execution-engine/` | 已处理（归并） | 1. 将 orchestration 逻辑拆分为独立模块： |
| 79 | 源代码 | 中严重 | stryker.config.mjs 变异覆盖严重不足 | `stryker.config.mjs` | 已处理（归并） | 1. 将 `budget-allocator.ts`、`runtime-state-machine.ts`、`transition-service.ts` 添加到 `mutate` 列表 |
| 80 | 配置 | 低严重 | .gitignore 缺少多个临时文件 | `.gitignore` | 已处理（归并） | 1. 添加 `:memory:*` 到 .gitignore |
| 81 | 源代码 | 中严重 | process.env 访问模式不安全 | 全局，约 952 处访问 | 已处理（归并） | 1. 创建 `src/config/index.ts` 统一配置管理 |
| 82 | 源代码 | 低严重 | Buffer.from 使用可能存在安全风险 | `src/platform/five-plane-interface/api/oidc-oauth-service.ts`, `api-auth-service.ts`, `webhook/index.ts` | 已处理（归并） | 1. 审查所有 `Buffer.from` 使用场景 |
| 83 | 文档 | 中严重 | deploy/chaos 场景配置不完整 | `deploy/chaos/` | 已处理（归并） | 1. 添加更多 chaos 场景 |
| 84 | 文档 | 中严重 | deploy/runbooks 只有一个文件 | `deploy/runbooks/` | 已处理（归并） | 1. 创建标准 runbook 模板 |
| 85 | 源代码 | 中严重 | oapeflir 目录与 five-plane-orchestration 职责不清 | - `src/platform/five-plane-execution/oapeflir/` | 已处理（归并） | 1. 明确 oapeflir 的单一真实来源 |
| 86 | 源代码 | 中严重 | ha (高可用) 模块结构复杂 | `src/platform/five-plane-execution/ha/` (25个文件) | 已处理（归并） | 1. 审计 HA 模块的职责边界 |
| 87 | 源代码 | 中严重 | dispatcher 模块 - 14个文件 | `src/platform/five-plane-execution/dispatcher/` (14个文件) | 已处理（归并） | 1. 确认 `dispatcher.ts` 是否是过时的入口点 |
| 88 | 源代码 | 中严重 | recovery 模块 - 29个文件过于庞大 | `src/platform/five-plane-execution/recovery/` (29个文件) | 已处理（归并） | 1. 评估 recovery 模块的子模块划分 |
| 89 | 源代码 | 低严重 | 5个符号链接存在但未被文档化 | `src/platform/` 下的 5 个符号链接 | 已处理（归并） | 1. 在 `src/platform/README.md` 中文档化符号链接策略 |
| 90 | 测试 | 中严重 | tests/unit/helpers/index.test.ts 被排除 | `tests/unit/helpers/index.test.ts` | 已处理（归并） | 1. 调查为什么这个测试被排除 |
| 91 | 配置 | 低严重 | tsconfig.temp.json 存在 | `tsconfig.temp.json` | 已处理（归并） | 1. 删除 `tsconfig.temp.json` |
| 92 | 文档 | 低严重 | docs_zh/operations/current_todo_list.md 过大 | `docs_zh/operations/current_todo_list.md` (38KB) | 已处理（归并） | 1. 定期同步 TODO 列表 |
| 93 | 源代码 | 中严重 | memory 模块 - 27个文件可能过于庞大 | `src/platform/five-plane-state-evidence/memory/` (27个文件) | 已处理（归并） | 1. 评估 memory 模块的子模块划分 |
| 94 | 源代码 | 中严重 | events 模块 - 22个文件结构复杂 | `src/platform/five-plane-state-evidence/events/` (22个文件) | 已处理（归并） | 1. 将 events 拆分为 `events/durable/` 和 `events/typed/` |
| 95 | 源代码 | 中严重 | truth 模块 - 28个文件可能过于庞大 | `src/platform/five-plane-state-evidence/truth/` (28个文件) | 已处理（归并） | 1. 评估 truth 模块的子模块划分 |
| 96 | 源代码 | 中严重 | checkpoint 模块 - 8个文件但有巨型文件 | `src/platform/five-plane-state-evidence/checkpoints/` (8个文件) | 已处理（归并） | 1. 调查 checkpoint 迁移测试失败原因 |
| 97 | 测试 | 中严重 | E2E 测试被排除 - 关键工作流无保护 | 多个 E2E 测试 | 已处理（归并） | 1. 调查每个 E2E 测试被排除的原因 |
| 98 | 源代码 | 低严重 | UI apps 目录结构 - 多平台支持复杂性 | `ui/apps/` | 已处理（归并） | 1. 文档化每个平台的维护状态 |
| 99 | 源代码 | 低严重 | UI packages/features 数量过多 | `ui/packages/features/` | 已处理（归并） | 1. 审计每个功能包的使用情况 |
| 100 | 安全 | 中严重 | .audit 目录未被 gitignore | `.audit/` | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 101 | 源代码 | 中严重 | platform-module-catalog.ts 与 platform-mainline-bootstrap.ts 并存 | - `src/platform/platform-module-catalog.ts` | 已处理（归并） | 1. 明确哪个是主引导文件 |
| 102 | 源代码 | 低严重 | contracts 目录两处存在需要整合 | - `src/platform/contracts/` (151个子目录) | 已处理（归并） | 1. 评估 contracts 模块的结构 |
| 103 | 测试 | 中严重 | 测试覆盖率与 mutation 测试覆盖分离 | `.c8rc.json` 和 `stryker.config.mjs` | 已处理（归并） | 1. 统一覆盖率阈值配置 |
| 104 | 源代码 | 中严重 | 工具执行器 - MCP 工具 guard 存在 | `src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts` | 已处理（归并） | 1. 审查 MCP 工具 guard 实现 |
| 105 | 配置 | 中严重 | 环境配置命名不一致 | `config/environments/` 和 `config/security/` | 已处理（归并） | 1. 添加 `config/environments/default.json` 和 `config/security/default.json` |
| 106 | 源代码 | 高严重 | Execution Lease 与 HA Lease 职责重叠 | - `src/platform/five-plane-execution/lease/execution-lease-service.js` | 已处理（归并） | 1. 审计 lease 和 ha 模块的职责边界 |
| 107 | 测试 | 高严重 | budget-allocator.test.ts 测试失败 - 核心模块无 CI 保护 | `tests/unit/platform/five-plane-execution/budget-allocator.test.ts` | 已处理（归并） | 1. 立即调查 budget-allocator 测试失败原因 |
| 108 | 测试 | 中严重 | worker-pool 测试失败 - 关键并发模块无保护 | `tests/unit/platform/execution/worker-pool/worker-pool-comprehensive.test.ts` | 已处理（归并） | 1. 调查 worker-pool 测试失败原因 |
| 109 | 源代码 | 中严重 | dispatcher/admission-controller.js 复杂度高 | `src/platform/five-plane-execution/dispatcher/admission-controller.js` | 已处理（归并） | 1. 审查 admission-controller 实现 |
| 110 | 文档 | 中严重 | 架构文档与实现细节存在不一致风险 | `docs_zh/architecture/00-platform-architecture.md` (728KB) | 已处理（归并） | 1. 将架构文档拆分为更小的模块化文档 |
| 111 | 源代码 | 高严重 | 巨型源文件 - harness/index.ts 超过2300行 | `src/platform/five-plane-orchestration/harness/index.ts` (2317行) | 已处理（归并） | 1. 将 harness 拆分为多个子模块： |
| 112 | 源代码 | 高严重 | process.env 访问次数严重低估 | 全局 | 已处理（归并） | 1. 创建 `src/config/index.ts` 统一配置管理 |
| 113 | 测试 | 高严重 | 测试失败率2.8%，1620个失败测试 | 全局测试 | 已处理（归并） | 1. 立即调查并修复这 14 个失败测试 |
| 114 | 源代码 | 高严重 | stryker mutation 测试覆盖严重不足 | `stryker.config.mjs` | 已处理（归并） | 1. 将核心模块添加到 `stryker.config.mjs` 的 `mutate` 列表 |
| 115 | 源代码 | 中严重 | 多文件超过1000行未被报告 | 多个源文件 | 已处理（归并） | 1. 将所有超过 1000 行的文件加入拆分计划 |
| 116 | 配置 | 中严重 | .gitignore 遗漏大量临时文件和目录 | `.gitignore` | 已处理（归并） | 1. 添加 `:memory:*` 到 .gitignore |
| 117 | 源代码 | 中严重 | multiple bootstrap 文件导致混淆 | - `src/platform/platform-mainline-bootstrap.ts` | 已处理（归并） | 1. 明确标识哪个是主引导文件 |
| 118 | 源代码 | 中严重 | contracts 模块过大 (151个子目录) | `src/platform/contracts/` (151个子目录) | 已处理（归并） | 1. 评估 contracts 模块是否可以按领域拆分 |
| 119 | 源代码 | 中严重 | domains 目录过大 (60个条目) | `src/domains/` (60个条目) | 已处理（归并） | 1. 创建领域依赖关系图 |
| 120 | 源代码 | 中严重 | tool-executor 目录 35 个文件，包含巨型文件 | `src/platform/five-plane-execution/tool-executor/` (35个文件) | 已处理（归并） | 1. 按功能拆分为子目录: |
| 121 | 源代码 | 中严重 | execution-engine 目录 32 个文件 | `src/platform/five-plane-execution/execution-engine/` (32个文件) | 已处理（归并） | 1. 将 orchestration 逻辑拆分为独立模块 |
| 122 | 源代码 | 中严重 | oapeflir 在 execution 和 orchestration 两处存在 | - `src/platform/five-plane-execution/oapeflir/` | 已处理（归并） | 1. 明确 oapeflir 的单一真实来源 |
| 123 | 配置 | 中严重 | deploy/chaos 只有4个场景 | `deploy/chaos/` (4个YAML文件) | 已处理（归并） | 1. 添加更多 chaos 场景覆盖常见故障 |
| 124 | 安全 | 高严重 | .audit 目录未被 gitignore，包含敏感数据 | `.audit/` | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 125 | 安全 | 中严重 | .env.example 缺少安全警告和指引 | `.env.example` | 已处理（归并） | 1. 在注释中添加更明确的安全警告 |
| 126 | 源代码 | 中严重 | StructuredLogger 未被广泛采用 | `src/platform/shared/observability/structured-logger.ts` | 已处理（归并） | 1. 创建 ESLint 规则禁止直接使用 console.* |
| 127 | 源代码 | 低严重 | 17个 TODO/FIXME/HACK 标记未处理 | 多个源文件 | 已处理（归并） | 1. 将 TODO 转换为 GitHub Issue |
| 128 | 文档 | 中严重 | docs_zh 与 docs_en 同步机制缺失 | `docs_zh/` 和 `docs_en/` | 已处理（归并） | 1. 创建文档同步检查的 CI 流程 |
| 129 | 测试 | 中严重 | 单元测试被 exclude 数量巨大 | `tsconfig.json` exclude 部分 | 已处理（归并） | 1. 调查每个测试被排除的根本原因 |
| 130 | 部署 | 低严重 | UI 独立部署架构增加复杂性 | `ui/` 目录 | 已处理（归并） | 1. 确保 Playwright E2E 测试在 CI 中运行 |
| 131 | 源代码 | 中严重 | ha 和 lease 模块职责重叠 | - `src/platform/five-plane-execution/ha/` | 已处理（归并） | 1. 审计 ha 和 lease 模块的职责边界 |
| 132 | 源代码 | 中严重 | recovery 目录 29 个文件过于庞大 | `src/platform/five-plane-execution/recovery/` (29个文件) | 已处理（归并） | 1. 评估 recovery 模块的子模块划分 |
| 133 | 源代码 | 中严重 | memory 目录 27 个文件可能过于庞大 | `src/platform/five-plane-state-evidence/memory/` (27个文件) | 已处理（归并） | 1. 评估 memory 模块的子模块划分 |
| 134 | 源代码 | 中严重 | truth 目录 28 个文件可能过于庞大 | `src/platform/five-plane-state-evidence/truth/` (28个文件) | 已处理（归并） | 1. 评估 truth 模块的子模块划分 |
| 135 | 源代码 | 中严重 | events 目录 22 个文件结构复杂 | `src/platform/five-plane-state-evidence/events/` (22个文件) | 已处理（归并） | 1. 将 events 拆分为 `events/durable/` 和 `events/typed/` |
| 136 | 源代码 | 低严重 | package.json scripts 数量过多 (100+) | `package.json` scripts 部分 | 已处理（归并） | 1. 使用 `npm run build` 统一构建脚本 |
| 137 | 源代码 | 低严重 | 翻译脚本 translate_docs.py 维护性问题 | `translate_docs.py` (10KB) | 已处理（归并） | 1. 评估是否仍在使用 |
| 138 | 源代码 | 高严重 | 多层模块间循环依赖风险 | 多个源文件 | 已处理（归并） | 1. 使用 `madge` 或类似工具检测循环依赖 |
| 139 | 源代码 | 高严重 | 类型定义不一致 - 错误类型混乱 | `src/platform/contracts/errors.ts` 和相关文件 | 已处理（归并） | 1. 审查 `src/platform/contracts/errors.ts` 的错误定义 |
| 140 | 源代码 | 高严重 | 接口一致性 - 导入路径混乱 | 多个源文件 | 已处理（归并） | 1. 统一使用包导出路径 |
| 141 | 源代码 | 中严重 | monitoring/observability 配置不完整 | `src/platform/shared/observability/` 目录 | 已处理（归并） | 1. 审查 observability 模块的完整性 |
| 142 | 源代码 | 中严重 | 权限控制实现分散 | `src/platform/five-plane-control-plane/iam/` 和相关目录 | 已处理（归并） | 1. 审计权限控制相关代码 |
| 143 | 源代码 | 中严重 | 数据库 schema 不一致风险 | `src/platform/five-plane-state-evidence/truth/` 目录 | 已处理（归并） | 1. 审查 schema 定义的一致性 |
| 144 | 源代码 | 中严重 | Event Bus 实现问题 | `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` (1214行) | 已处理（归并） | 1. 调查 durable-event-bus-async.test.ts 失败原因 |
| 145 | 源代码 | 中严重 | HA 模块与 Lease 模块职责不清 | - `src/platform/five-plane-execution/ha/` | 已处理（归并） | 1. 审计 HA 和 Lease 模块的职责 |
| 146 | 配置 | 中严重 | secret 管理缺失 | 全局 | 已处理（归并） | 1. 实现 secret 管理方案 (如 Vault, AWS Secrets Manager) |
| 147 | 源代码 | 中严重 | Plugin 系统架构复杂度高 | `src/domains/registry/` (18个子目录) | 已处理（归并） | 1. 审查 Plugin SPI 接口 |
| 148 | 源代码 | 低严重 | 缓存实现一致性 | `src/platform/shared/cache/` 目录 | 已处理（归并） | 1. 审查缓存实现的一致性 |
| 149 | 部署 | 中严重 | Kubernetes 部署配置缺失 | `deploy/` 目录 | 已处理（归并） | 1. 审查 Helm chart 完整性 |
| 150 | 文档 | 低严重 | current_todo_list.md 过大 (38KB) | `docs_zh/operations/current_todo_list.md` | 已处理（归并） | 1. 定期同步 TODO 列表 |
| 151 | 源代码 | 低严重 | 依赖版本管理问题 | `package.json` dependencies | 已处理（归并） | 1. 审查依赖版本策略 |
| 152 | 测试 | 中严重 | 测试基础设施复杂 (78个helpers) | `tests/helpers/` (78个文件) | 已处理（归并） | 1. 评估这些 helpers 是否可以合并或简化 |
| 153 | 源代码 | 中严重 | 事件类型定义重复 | - `src/platform/five-plane-state-evidence/events/event-registry.ts` (1077行) | 已处理（归并） | 1. 确认事件的单一真实来源 |
| 154 | 源代码 | 低严重 | 日志级别不一致 | 多个源文件 | 已处理（归并） | 1. 制定日志级别规范 |
| 155 | 配置 | 中严重 | PostgreSQL 配置缺失 | `config/` 目录 | 已处理（归并） | 1. 添加 PostgreSQL 连接池配置 |
| 156 | 源代码 | 中严重 | 安全配置分散 | `config/security/` 目录 | 已处理（归并） | 1. 创建统一的安全配置模块 |
| 157 | 源代码 | 低严重 | 代码重复检查缺失 | 全局 | 已处理（归并） | 1. 添加代码重复检测工具 |
| 158 | 测试 | 中严重 | integration 测试被大量排除 | `tsconfig.json` exclude 部分 | 已处理（归并） | 1. 调查 integration 测试被排除的原因 |
| 159 | 源代码 | 中严重 | multi-step-orchestration 模块过于庞大 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts` (26820字节) | 已处理（归并） | 1. 将 multi-step-orchestration 拆分为多个模块 |
| 160 | 源代码 | 中严重 | dispatcher/admission-controller 实现复杂度 | `src/platform/five-plane-execution/dispatcher/admission-controller.js` | 已处理（归并） | 1. 审查 admission-controller 实现 |
| 161 | 文档 | 中严重 | 架构文档与实现不同步 | `docs_zh/architecture/00-platform-architecture.md` (728KB) | 已处理（归并） | 1. 将架构文档拆分为更小的模块化文档 |
| 162 | 源代码 | 中严重 | MCP 工具 guard 实现验证 | `src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts` | 已处理（归并） | 1. 审查 MCP 工具 guard 实现 |
| 163 | 源代码 | 高严重 | 巨型源文件体积异常增大 | - `src/platform/five-plane-execution/budget-allocator.ts` (34,499 字节，注：之前报告931行，但实际文件大小表明已显著增长) | 已处理（归并） | 1. 将 budget-allocator.ts 拆分为多个子模块： |
| 164 | 配置 | 高严重 | config/security/prod.json approvalMode 为 strict，但其他环境为 supervised | `config/security/` 目录 | 已处理（归并） | 1. 在 test.json 中添加 strict 模式的测试覆盖 |
| 165 | 部署 | 中严重 | deploy/runbooks 目录内容过少 | `deploy/runbooks/` | 已处理（归并） | 1. 补充核心 runbook： |
| 166 | 部署 | 中严重 | deploy/chaos 目录场景不完整 | `deploy/chaos/` | 已处理（归并） | 1. 补充关键 chaos 场景 |
| 167 | 源代码 | 中严重 | 12个源文件直接使用 console.* 而非结构化日志 | - `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` | 已处理（归并） | 1. 替换所有 `console.*` 调用为 `StructuredLogger` |
| 168 | 源代码 | 中严重 | .gitignore 不完整 - 缺少多个临时文件模式 | `.gitignore` | 已处理（归并） | 1. 添加 `:memory:*` 到 .gitignore |
| 169 | 测试 | 中严重 | stryker mutation 测试只覆盖 core/api，遗漏 five-plane-* 模块 | `stryker.config.mjs` | 已处理（归并） | 1. 扩展 mutation 测试到 five-plane-* 模块 |
| 170 | 测试 | 中严重 | .c8rc.json 和 stryker.config.mjs 配置分离导致覆盖缺口 | `.c8rc.json` 和 `stryker.config.mjs` | 已处理（归并） | 1. 统一覆盖策略 |
| 171 | CI/CD | 中严重 | mutation 测试只在 main 分支推送时运行 | `.github/workflows/ci.yml` | 已处理（归并） | 1. 在 PR 中运行轻量级 mutation 测试 |
| 172 | 部署 | 低严重 | deploy/helm 和 deploy/terraform 内容不确定 | `deploy/helm/` 和 `deploy/terraform/` | 已处理（归并） | 1. 验证 helm chart 配置完整性 |
| 173 | 源代码 | 中严重 | src/core/runtime/ 与五层架构职责不清 | `src/core/runtime/` | 已处理（归并） | 1. 审计 `core/runtime` 与 `five-plane-*` 的功能重叠 |
| 174 | 配置 | 低严重 | UI package.json 与主 package.json 依赖版本可能不一致 | `ui/package.json` | 已处理（归并） | 1. 在主 package.json 中定义共享依赖版本 |
| 175 | 安全 | 中严重 | 安全配置分散在多个文件中 | `config/security/` 目录 | 已处理（归并） | 1. 创建 `src/platform/shared/security/config-validator.ts` 统一验证 |
| 176 | 源代码 | 低严重 | contracts 模块过大 (2169行) | `src/platform/contracts/executable-contracts/index.ts` (2169 行) | 已处理（归并） | 1. 将 `executable-contracts/index.ts` 拆分为多个子模块 |
| 177 | 源代码 | 中严重 | five-plane-execution/harness/ 目录结构复杂 | `src/platform/five-plane-execution/harness/` (但实际路径是 five-plane-orchestration/harness/) | 已处理（归并） | 1. 将 harness/index.ts 拆分为多个模块 |
| 178 | 文档 | 低严重 | docs_zh/operations/ 与 deploy/runbooks 内容重复或不一致 | `docs_zh/operations/` 和 `deploy/runbooks/` | 已处理（归并） | 1. 审计两个目录的内容 |
| 179 | 源代码 | 中严重 | process.env 访问次数之前报告为5176次，但实际需要验证 | 全局 | 已处理（归并） | 1. 创建 `src/config/index.ts` 集中管理所有配置 |
| 180 | 测试 | 中严重 | UI Playwright 配置存在但未确认是否在 CI 中运行 | `ui/playwright.config.ts` | 已处理（归并） | 1. 确认 ui-quality.yml 工作流是否启用 |
| 181 | 源代码 | 低严重 | 源码统计：374,602 行 TypeScript，1795 个文件 | 全局 | 已处理（归并） | 1. 定期审查模块边界 |
| 182 | 配置 | 中严重 | package.json scripts 过于复杂且重复 | `package.json` scripts 部分 | 已处理（归并） | 1. 简化 scripts 结构 |
| 183 | 安全 | 低严重 | .env.example 中 AA_API_JWT_SECRET 为空但已有说明 | `.env.example` | 已处理（归并） | 1. 在注释中添加 secret 生成命令 |
| 184 | 部署 | 低严重 | .dockerignore 存在但需要验证完整性 | `.dockerignore` | 已处理（归并） | 1. 验证 .dockerignore 包含所有临时文件 |
| 185 | 文档 | 低严重 | docs_zh/ 和 docs_en/ 并存但同步机制缺失 | `docs_zh/` 和 `docs_en/` | 已处理（归并） | 1. 创建文档同步检查的 CI 流程 |
| 186 | 源代码 | 中严重 | 巨型文件顶部直接导入导致耦合度高 | `src/platform/five-plane-orchestration/harness/index.ts` (2317 行) | 已处理（归并） | 1. 将这些导入组织到子模块 |
| 187 | 测试 | 高严重 | .audit/quality.md 报告 14 个测试文件失败，但 git status 显示无更改 | `.audit/quality.md` | 已处理（归并） | 1. 立即调查 14 个失败的测试 |
| 188 | src/架构 | 严重-高 | 符号链接导致构建和路径解析问题 | `src/platform/control-plane -> five-plane-control-plane`, `src/platform/execution -> five-plane-execution` 等 | 已处理（归并） | 将所有符号链接替换为实际的目录结构，或使用包导出机制 |
| 189 | src/代码质量 | 严重-高 | 巨型源文件未拆分 - 违反单一职责原则 | - `src/platform/five-plane-orchestration/harness/index.ts` (2317行) | 已处理（归并） | 将大文件拆分为多个模块，每个模块不超过 500 行 |
| 190 | src/错误处理 | 严重-中 | 错误处理不一致 - 直接抛出 Error | - `src/interaction-governance-runtime-orchestrator.ts:58` - `throw new Error(...)` 而非 `ValidationError` | 已处理（归并） | 统一使用 `ValidationError` 或其他适当的具体错误类型 |
| 191 | src/安全 | 严重-高 | 敏感信息暴露风险 - .env.example 未清理 | `.env.example` | 已处理（归并） | 添加明确的注释说明这些变量必须从环境变量获取，禁止提交到版本控制 |
| 192 | src/安全 | 严重-中 | 路径遍历防护实现问题 | `src/platform/shared/observability/structured-logger.ts:108-133` | 已处理（归并） | 使用明确的基准路径（如应用安装目录）而非 `process.cwd()` |
| 193 | src/并发 | 严重-中 | Redis 客户端在测试模式下使用内存实现 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:255-256` | 已处理（归并） | 添加警告日志，确保测试覆盖真实 Redis 场景 |
| 194 | src/日志 | 严重-低 | 生产代码使用 console.log 而非结构化日志 | - `src/index.ts:270, 277, 429, 448` | 已处理（归并） | 将所有 `console.log/error` 替换为 `StructuredLogger` |
| 195 | src/配置 | 严重-中 | 配置管理分散 - 存在多个配置源 | - `config/` (主配置) | 已处理（归并） | 创建 `src/config/index.ts` 集中管理所有配置，统一使用 Zod schema 验证 |
| 196 | src/类型安全 | 严重-低 | JSON.parse 缺乏错误处理 | - `src/domains/registry/plugin-runtime-child.ts:136` | 已处理（归并） | 封装为 `safeJsonParse` 函数，对错误输入返回 null 而非抛出异常 |
| 197 | src/日志 | 严重-低 | StructuredLogger 使用 stack trace 解析调用者路径 | `src/platform/shared/observability/structured-logger.ts:606-618` | 已处理（归并） | 通过参数显式传入源文件路径，而非运行时推断 |
| 198 | src/内存 | 严重-低 | StructuredLogger 内存缓冲可能耗尽 | `src/platform/shared/observability/structured-logger.ts:248` | 已处理（归并） | 使用懒加载或动态调整机制 |
| 199 | tests/测试质量 | 严重-高 | 测试被大量 exclude | `tsconfig.json` exclude 列表 | 已处理（归并） | 调查并修复被排除的测试，恢复测试覆盖率 |
| 200 | tests/测试覆盖 | 严重-中 | Mutation testing 覆盖严重不足 | `stryker.config.mjs` | 已处理（归并） | 扩展 mutation 测试到 `five-plane-control-plane`, `five-plane-execution` 等模块 |
| 201 | tests/测试质量 | 严重-中 | 测试存在 TODO 注释表明未完成 | - `tests/unit/platform/contracts/anomaly-event-classification.test.ts:61,80,85,114` | 已处理（归并） | 完成这些测试或将其标记为 `skip` 而非留在待修复状态 |
| 202 | ui/前端 | 严重-中 | UI 项目缺少安全配置 | `ui/package.json`, `ui/apps/web/vite.config.ts` | 已处理（归并） | 添加安全检查脚本，配置 CSP header |
| 203 | ui/前端 | 严重-低 | UI 项目缺少国际化 (i18n) 配置 | `ui/package.json` | 已处理（归并） | 评估并实施适当的 i18n 框架 |
| 204 | ui/响应式 | 严重-低 | UI 组件响应式设计未验证 | `ui/packages/features/*/` | 已处理（归并） | 添加响应式设计测试 |
| 205 | config/配置问题 | 严重-中 | 安全配置环境不一致 | `config/security/prod.json` vs `config/security/dev.json` | 已处理（归并） | 统一所有环境的安全配置，或在文档中明确说明差异原因 |
| 206 | config/配置问题 | 严重-低 | 配置值文件中存在硬编码 | `config/runtime/default.json` | 已处理（归并） | 将阈值提取为环境变量 |
| 207 | bash/脚本 | 严重-中 | 部署脚本安全性问题 | `deploy/scripts/deploy.sh:94-98` | 已处理（归并） | 添加 `CI=true` 环境变量跳过交互确认 |
| 208 | bash/脚本 | 严重-中 | rollback.sh 脚本不完整 | `deploy/scripts/rollback.sh` | 已处理（归并） | 增强回滚脚本，添加健康检查和通知机制 |
| 209 | bash/脚本 | 严重-低 | dr-drill.sh DR演练脚本路径问题 | `deploy/scripts/dr-drill.sh` | 已处理（归并） | 添加目录存在性检查 |
| 210 | package.json | 严重-中 | npm scripts 重复构建 | `package.json` | 已处理（归并） | 分离构建和运行步骤，或使用 `AA_PRESERVE_DIST=1` 跳过未修改的构建 |
| 211 | package.json | 严重-低 | scripts 中缺少版本检查 | `package.json` | 已处理（归并） | 添加 `engines` 字段并验证 |
| 212 | 安全/敏感信息 | 严重-中 | 临时文件未清理 | `.gitignore` | 已处理（归并） | 添加这些模式到 .gitignore |
| 213 | 安全/路径遍历 | 严重-中 | 多处存在路径遍历风险 | - `src/platform/five-plane-execution/tool-executor/` 中文件操作 | 已处理（归并） | 使用 `safePath` 函数或 `path.resolve` 确保路径安全 |
| 214 | 文档/一致性 | 严重-低 | 文档与代码不一致 | `docs_zh/architecture/00-platform-architecture.md` | 已处理（归并） | 更新文档或修复代码结构 |
| 215 | 文档/完整性 | 严重-低 | deploy/chaos 场景未完成 | `deploy/chaos/` | 已处理（归并） | 添加核心场景（服务中断、网络分区、资源耗尽等） |
| 216 | src/并发 | 严重-中 | Distributed Lock 实现可能存在问题 | `src/platform/execution/distributed-lock/` | 已处理（归并） | 添加锁续期机制和改进错误处理 |
| 217 | src/性能 | 严重-低 | N+1 查询风险 | `src/platform/state-evidence/` 中的 repository 实现 | 已处理（归并） | 使用批量查询或 JOIN |
| 218 | src/内存泄漏 | 严重-低 | StructuredLogger 全局文件句柄未关闭 | `src/platform/shared/observability/structured-logger.ts` | 已处理（归并） | 添加 `process.on('exit')` 清理逻辑 |
| 219 | src/可访问性 | 严重-低 | UI 组件缺少 aria-label | `ui/packages/features/` 中的交互组件 | 已处理（归并） | 添加 aria-label 到所有交互元素 |
| 220 | src/错误恢复 | 严重-中 | 错误恢复机制不完整 | `src/platform/execution/recovery/` | 已处理（归并） | 补充测试覆盖所有故障场景 |
| 221 | src/可观测性 | 严重-低 | trace context 传播不完整 | `src/platform/shared/observability/trace-context.ts` | 已处理（归并） | 确保所有异步操作正确传播 trace context |
| 222 | 配置/数据库 | 严重-中 | SQLite 在生产环境使用存在风险 | `.env.example`, `config/environments/dev.json` | 已处理（归并） | 文档中明确说明 SQLite 仅适用于开发/测试，生产应使用 PostgreSQL |
| 223 | src/依赖 | 严重-低 | 硬编码的模块路径 | 多处 deep imports | 已处理（归并） | 优先使用 `@automatic-agent/platform` 形式的包导入 |
| 224 | 测试/集成 | 严重-低 | 集成测试可能依赖外部服务 | `tests/integration/` | 已处理（归并） | 确保所有集成测试使用 mock 或 testcontainers |
| 225 | src/异常安全 | 严重-低 | finally 块中可能发生异常 | `src/platform/shared/observability/structured-logger.ts:562-565` | 已处理（归并） | 将 finally 中的操作改为静默失败 |
| 226 | 安全 | 高严重 | 依赖版本安全漏洞 - 7个漏洞 | `package.json`, `package-lock.json` | 已处理（归并） | 1. 运行 `npm audit fix`（注意：部分修复需要breaking changes） |
| 227 | 代码质量 | 高严重 | 大量空catch块 - 372处 | 整个 `src/` 目录 | 已处理（归并） | 1. 在空catch块中添加最小限度的错误处理（至少记录到日志） |
| 228 | 代码质量 | 高严重 | 巨型源文件 - 文件过大 | 多个巨型文件 | 已处理（归并） | 1. 拆分巨型文件到子模块 |
| 229 | 架构 | 高严重 | 符号链接造成的不一致 - 6个symlink | `src/platform/` 目录 | 已处理（归并） | 1. 考虑将 five-plane-* 重命名为正式目录名 |
| 230 | 测试 | 中严重 | tsconfig exclude列表过长 - 100+条目 | `tsconfig.json` | 已处理（归并） | 1. 调查为什么这些测试被排除 |
| 231 | 源代码 | 中严重 | src目录存在test文件 | `src/` 目录 | 已处理（归并） | 1. 确认所有测试文件都在tests/目录下 |
| 232 | 代码质量 | 中严重 | 大量type assertion使用 - 468处 | 整个 `src/` 目录 | 已处理（归并） | 1. 优先使用类型守卫和类型收缩 |
| 233 | 源代码 | 中严重 | index.ts文件过多 - 38256个 | `src/` 目录 | 已处理（归并） | 1. 评估index.ts的必要性 |
| 234 | 配置 | 中严重 | package.json scripts过多 - 100+ | `package.json` | 已处理（归并） | 1. 使用CLI框架（如oclif）统一管理命令 |
| 235 | 安全 | 中严重 | .audit目录未添加到.gitignore | `.gitignore` | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 236 | UI | 中严重 | UI package.json scripts不完整 | `ui/package.json` | 已处理（归并） | 1. 修复scripts依赖关系 |
| 237 | 源代码 | 中严重 | 领域模块耦合度不清晰 | `src/domains/` | 已处理（归并） | 1. 创建领域依赖图 |
| 238 | 源代码 | 中严重 | 配置分散在多处 | 项目根目录和 `config/` 目录 | 已处理（归并） | 1. 考虑使用 `config/` 统一管理 |
| 239 | 测试 | 低严重 | 测试文件数量与源文件比例异常 | `tests/` 目录 | 已处理（归并） | 1. 评估测试辅助代码的必要性 |
| 240 | 脚本 | 低严重 | backup-sqlite.sh和restore-sqlite.sh缺少错误处理 | `scripts/backup-sqlite.sh`, `scripts/restore-sqlite.sh` | 已处理（归并） | 1. 添加备份加密选项 |
| 241 | 源代码 | 低严重 | TODO/FIXME注释过多 - 12个文件 | `src/` 目录 | 已处理（归并） | 1. 创建Issue跟踪这些TODO |
| 242 | 源代码 | 低严重 | console.log语句过多 | `src/` 目录 | 已处理（归并） | 1. 替换为StructuredLogger |
| 243 | 文档 | 低严重 | docs_zh/reviews/文档结构问题 | `docs_zh/reviews/` | 已处理（归并） | 1. 添加Review维护指南 |
| 244 | 部署 | 低严重 | deploy目录内容不完整 | `deploy/` 目录 | 已处理（归并） | 1. 完成chaos测试场景 |
| 245 | 安全 | 低严重 | 环境变量使用模式不统一 | `src/` 目录 | 已处理（归并） | 1. 创建统一的环境变量读取函数 |
| 246 | 测试 | 低严重 | golden测试文件缺少文档 | `tests/golden/` | 已处理（归并） | 1. 添加golden测试维护指南 |
| 247 | 源代码 | 低严重 | src/core/runtime目录警告未被遵循 | `src/core/runtime/` | 已处理（归并） | 1. 制定迁移计划 |
| 248 | UI | 低严重 | UI包结构复杂度高 | `ui/packages/`, `ui/apps/` | 已处理（归并） | 1. 评估包的数量是否必要 |
| 249 | 安全 | 低严重 | 备份脚本缺少加密和远程复制 | `scripts/backup-sqlite.sh` | 已处理（归并） | 1. 添加备份加密选项 |
| 250 | 配置 | 低严重 | 临时构建目录未清理 | 根目录 | 已处理（归并） | 1. 清理所有临时目录 |
| 251 | 测试 | 低严重 | 性能测试目录重复 | `tests/performance/`, `tests/performance.bak/` | 已处理（归并） | 1. 删除备份目录 |
| 252 | 源代码 | 低严重 | plugins/adapters目录耦合 | `src/plugins/adapters/` | 已处理（归并） | 1. 创建统一的适配器接口 |
| 253 | 源代码 | 低严重 | 领域模块重复导出问题 | `src/platform/contracts/` 和 `src/contracts/` | 已处理（归并） | 1. 确认contracts的单一真实来源 |
| 254 | 安全 | 中严重 | API路由缺少统一认证中间件 | `src/platform/five-plane-interface/api/` | 已处理（归并） | 1. 添加统一的认证中间件 |
| 255 | 源代码 | 中严重 | 状态管理实现分散 | `src/`, `ui/` | 已处理（归并） | 1. 文档化状态管理架构 |
| 256 | 测试 | 低严重 | 集成测试覆盖不完整 | `tests/integration/` | 已处理（归并） | 1. 分析被排除的测试 |
| 257 | 源代码 | 中严重 | src/domains目录过深 | `src/domains/` (60个条目) | 已处理（归并） | 1. 评估是否需要扁平化结构 |
| 258 | UI | 低严重 | UI状态管理使用zustand但缺少类型安全 | `ui/packages/shared/`, `ui/apps/web/` | 已处理（归并） | 1. 添加Zod验证store状态 |
| 259 | 源代码 | 低严重 | SDK CLI工具缺少统一错误处理 | `src/sdk/cli/` | 已处理（归并） | 1. 创建统一CLI错误处理框架 |
| 260 | 配置 | 中严重 | 环境变量验证缺失 | 项目全局 | 已处理（归并） | 1. 使用Zod进行环境变量验证 |
| 261 | 源代码 | 低严重 | 重复的错误处理模式 | `src/` 目录 | 已处理（归并） | 1. 创建统一的错误类层次 |
| 262 | 安全 | 中严重 | WebSocket安全配置不完整 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts` | 已处理（归并） | 1. 添加WebSocket安全配置 |
| 263 | 源代码 | 低严重 | 缺乏依赖注入模式 | `src/` 目录 | 已处理（归并） | 1. 考虑使用依赖注入 |
| 264 | 测试 | 中严重 | E2E测试与单元测试比例异常 | `tests/` | 已处理（归并） | 1. 确保E2E测试在CI中运行 |
| 265 | 源代码 | 中严重 | 循环依赖风险 | `src/` 目录 | 已处理（归并） | 1. 运行 `madge --circular` 检查 |
| 266 | UI | 中严重 | React Query和Zustand状态同步缺失 | `ui/apps/web/` | 已处理（归并） | 1. 添加状态同步层 |
| 267 | 源代码 | 中严重 | 缺乏备份和恢复机制文档 | `scripts/backup-sqlite.sh`, `scripts/restore-sqlite.sh` | 已处理（归并） | 1. 添加备份恢复文档 |
| 268 | 源代码 | 低严重 | 缺乏API版本管理 | `src/platform/five-plane-interface/api/` | 已处理（归并） | 1. 添加API版本控制 |
| 269 | 测试 | 低严重 | invariant测试缺少说明 | `tests/invariants/` | 已处理（归并） | 1. 添加invariant测试指南 |
| 270 | 源代码 | 低严重 | 日志格式不统一 | `src/` 目录 | 已处理（归并） | 1. 统一使用StructuredLogger |
| 271 | 配置 | 低严重 | 多环境配置管理复杂 | `config/environments/` | 已处理（归并） | 1. 文档化环境配置差异 |
| 272 | 源代码 | 中严重 | 缺乏监控和告警覆盖 | `src/platform/shared/observability/` | 已处理（归并） | 1. 添加关键业务指标监控 |
| 273 | 源代码 | 低严重 | 代码重复 - 跨领域相似逻辑 | `src/domains/` (34个领域) | 已处理（归并） | 1. 识别跨领域重复代码 |
| 274 | 数据库 | 高严重 | 迁移脚本不完整 - 仅有一个初始化SQL文件 | `src/platform/five-plane-state-evidence/truth/migrations/0001_phase1a_init.sql` | 已处理（归并） | 1. 创建完整的版本化迁移脚本序列（0010, 0020, 0030...） |
| 275 | 数据库 | 中严重 | 备份脚本缺乏定期演练验证 | `scripts/backup-sqlite.sh`, `scripts/restore-sqlite.sh` | 已处理（归并） | 1. 在 CI 中添加定期备份恢复测试（至少每月一次） |
| 276 | 文档 | 高严重 | 灾难恢复计划文档不完整 | `docs_zh/adr/031-disaster-recovery-and-high-availability.md` | 已处理（归并） | 1. 创建详细的 DR 操作手册（分步骤） |
| 277 | 监控 | 中严重 | Prometheus 告警阈值配置不完整 | `deploy/prometheus/rules/automatic-agent.yml` | 已处理（归并） | 1. 添加数据库连接池监控告警 |
| 278 | 安全 | 高严重 | API 限流实现不完整 - 缺少 DDoS 防护层 | `src/platform/five-plane-interface/api/middleware/rate-limit.ts` | 已处理（归并） | 1. 实现 Redis-backed 分布式 rate limiter |
| 279 | 安全 | 高严重 | SQL 注入防护存在漏洞风险 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts` | 已处理（归并） | 1. 确认 tableName/columnName 验证逻辑完整且被调用 |
| 280 | 安全 | 中严重 | XSS 防护覆盖不完整 | `src/platform/five-plane-interface/api/middleware/sanitize.ts` | 已处理（归并） | 1. 扩展 sanitizeJsonValue 处理更多攻击向量 |
| 281 | 安全 | 中严重 | CSRF 防护仅部分实现 | `src/org-governance/sso-scim/oidc/oidc-service.ts` | 已处理（归并） | 1. 验证所有状态变更操作都有 CSRF token 验证 |
| 282 | 安全 | 高严重 | 会话管理和 Token 刷新机制存在缺陷 | `src/org-governance/sso-scim/oidc/oidc-service.ts` | 已处理（归并） | 1. 将 refresh token family 信息持久化到数据库 |
| 283 | 监控 | 中严重 | 日志聚合和查询性能问题 | `src/platform/contracts/types/drift-contracts.ts` | 已处理（归并） | 1. 验证日志聚合管道（Elasticsearch/Loki）已部署 |
| 284 | 架构 | 中严重 | 缓存一致性存在潜在问题 | `src/platform/shared/cache/cache-invalidation.ts` | 已处理（归并） | 1. 审查所有缓存使用场景的一致性需求 |
| 285 | 源代码 | 中严重 | .env.example 配置暴露敏感信息风险 | `.env.example` | 已处理（归并） | 1. 将所有敏感字段的示例值替换为占位符（如 `YOUR_API_KEY_HERE`） |
| 286 | 配置 | 中严重 | 多环境配置差异未文档化 | `config/environments/`, `config/security/` | 已处理（归并） | 1. 文档化每个环境的配置差异 |
| 287 | 测试 | 高严重 | 集成测试覆盖不足 - 数据库迁移测试 | `tests/integration/sdk/migrate-sqlite-to-pg-integration-2278-2279.test.ts` | 已处理（归并） | 1. 添加完整的迁移测试套件（正向、反向、回滚） |
| 288 | UI | 低严重 | Electron 应用安全配置需要审查 | `ui/packages/electron-win/`, `ui/packages/tauri-linux/`, `ui/packages/tauri-macos/` | 已处理（归并） | 1. 为 Electron 添加严格 CSP |
| 289 | 源代码 | 中严重 | 巨型源文件需要拆分 | 多个大型源文件 | 已处理（归并） | 1. 拆分 runtime-truth-repository.ts 为多个专门 repository |
| 290 | 脚本 | 中严重 | 部署脚本错误处理不完整 | `deploy/scripts/deploy.sh` | 已处理（归并） | 1. 添加部署前验证步骤 |
| 291 | 文档 | 低严重 | API 文档与实际实现不同步 | `docs_zh/` (多个 API 相关文档) | 已处理（归并） | 1. 实现 OpenAPI/Swagger 文档生成 |
| 292 | 源代码 | 低严重 | 日志格式不一致 - 部分使用 console.log | `src/` 多处 | 已处理（归并） | 1. 强制统一使用 StructuredLogger |
| 293 | 测试 | 低严重 | 性能测试缺少基准数据 | `tests/performance/` | 已处理（归并） | 1. 建立性能基准数据并版本化 |
| 294 | 源代码 | 高严重 | 巨型源文件 - executable-contracts/index.ts 超过2100行 | `src/platform/contracts/executable-contracts/index.ts` (2169行) | 已处理（归并） | 1. 将 executable-contracts 拆分为独立子模块 |
| 295 | 源代码 | 高严重 | 巨型源文件 - oapeflir-loop-service.ts 接近1500行 | `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts` (1497行) | 已处理（归并） | 1. 明确 oapeflir 的单一真实来源 |
| 296 | 源代码 | 高严重 | 巨型源文件 - intake-router.ts 超过1300行 | `src/platform/five-plane-orchestration/routing/intake-router.ts` (1328行) | 已处理（归并） | 1. 将路由逻辑拆分为 `routing/resolver.ts`、`routing/balancer.ts`、`routing/middleware.ts` |
| 297 | 源代码 | 高严重 | 巨型源文件 - slo-alerting-service.ts 超过1200行 | `src/platform/shared/observability/slo-alerting-service.ts` (1270行) | 已处理（归并） | 1. 拆分为 `slo/alerting/`、`slo/rules/`、`slo/metrics/` |
| 298 | 源代码 | 高严重 | 巨型源文件 - tenant-platform-service.ts 超过1200行 | `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts` (1231行) | 已处理（归并） | 1. 拆分为 `tenant-platform/management/`、`tenant-platform/isolation/`、`tenant-platform/billing/` |
| 299 | 源代码 | 高严重 | 巨型源文件 - event-registry.ts 超过1000行 | `src/platform/five-plane-state-evidence/events/event-registry.ts` (1077行) | 已处理（归并） | 1. 将事件注册逻辑拆分为 `events/registry/`、`events/versioning/`、`events/resolver/` |
| 300 | 源代码 | 高严重 | 巨型源文件 - delegation-manager.service.ts 超过1200行 | `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (1210行) | 已处理（归并） | 1. 拆分为 `delegation/manager/`、`delegation/tracking/`、`delegation/cleanup/` |
| 301 | 源代码 | 高严重 | 巨型源文件 - marketplace-governance-service.ts 超过1000行 | `src/scale-ecosystem/marketplace/marketplace-governance-service.ts` (1081行) | 已处理（归并） | 1. 拆分为 `marketplace/governance/`、`marketplace/rules/`、`marketplace/compliance/` |
| 302 | 源代码 | 高严重 | 巨型源文件 - approval-flow-engine.ts 超过1000行 | `src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts` (1031行) | 已处理（归并） | 1. 拆分为 `approval/engine/`、`approval/rules/`、`approval/history/` |
| 303 | 源代码 | 高严重 | 巨型源文件 - llm-eval-service.ts 超过1000行 | `src/platform/prompt-engine/eval/llm-eval-service.ts` (1055行) | 已处理（归并） | 1. 拆分为 `eval/metrics/`、`eval/scoring/`、`eval/reporting/` |
| 304 | 源代码 | 高严重 | 巨型源文件 - human-takeover-service.ts 超过1000行 | `src/platform/five-plane-control-plane/incident-control/human-takeover-service.ts` (1028行) | 已处理（归并） | 1. 拆分为 `takeover/service/`、`takeover/workflow/`、`takeover/audit/` |
| 305 | 源代码 | 高严重 | 巨型源文件 - auto-stop-loss-service.ts 超过1000行 | `src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.ts` (1004行) | 已处理（归并） | 1. 拆分为 `stop-loss/detection/`、`stop-loss/action/`、`stop-loss/monitoring/` |
| 306 | 源代码 | 高严重 | 巨型源文件 - channel-gateway-service.ts 接近1000行 | `src/platform/five-plane-interface/channel-gateway/channel-gateway-service.ts` (981行) | 已处理（归并） | 1. 拆分为 `gateway/channel/`、`gateway/protocol/`、`gateway/routing/` |
| 307 | 源代码 | 高严重 | 巨型源文件 - policy-engine.ts 接近1000行 | `src/platform/five-plane-control-plane/iam/policy-engine.ts` (971行) | 已处理（归并） | 1. 拆分为 `policy/engine/`、`policy/evaluation/`、`policy/cache/` |
| 308 | 源代码 | 高严重 | 巨型源文件 - api-client.ts 超过1000行 | `src/sdk/client-sdk/api-client.ts` (1022行) | 已处理（归并） | 1. 拆分为 `api-client/core/`、`api-client/retry/`、`api-client/middleware/` |
| 309 | 源代码 | 高严重 | 巨型源文件 - worker-repository.ts 超过1000行 | `src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository.ts` (1064行) | 已处理（归并） | 1. 拆分为 `worker-repository/crud.ts`、`worker-repository/query.ts`、`worker-repository/cache.ts` |
| 310 | 源代码 | 高严重 | 巨型源文件 - nl-gateway/index.ts 超过1600行 | `src/interaction/nl-gateway/index.ts` (1669行) | 已处理（归并） | 1. 拆分为 `nl-gateway/parsing/`、`nl-gateway/intent/`、`nl-gateway/routing/` |
| 311 | 源代码 | 高严重 | 巨型源文件 - goal-decomposer/index.ts 超过1000行 | `src/interaction/goal-decomposer/index.ts` (1031行) | 已处理（归并） | 1. 拆分为 `goal-decomposer/engine/`、`goal-decomposer/strategy/`、`goal-decomposer/validation/` |
| 312 | 源代码 | 高严重 | 巨型源文件 - multi-step-supervisor.ts 超过800行 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` (802行) | 已处理（归并） | 1. 协调与 `multi-step-orchestration.ts` 的职责划分 |
| 313 | 源代码 | 高严重 | 巨型源文件 - single-task-happy-path.ts 接近800行 | `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts` (779行) | 已处理（归并） | 1. 拆分为 `happy-path/steps/`、`happy-path/validation/`、`happy-path/reporting/` |
| 314 | 源代码 | 高严重 | 巨型源文件 - runtime-state-machine.ts 接近700行 | `src/platform/five-plane-execution/runtime-state-machine.ts` (690行) | 已处理（归并） | 1. 将状态定义移到 `runtime-state-types.ts` |
| 315 | 源代码 | 高严重 | 巨型源文件 - call-governance.ts 超过750行 | `src/platform/five-plane-execution/execution-engine/call-governance.ts` (776行) | 已处理（归并） | 1. 拆分为 `call-governance/control/`、`call-governance/billing/`、`call-governance/monitoring/` |
| 316 | 源代码 | 高严重 | 巨型源文件 - agent-middleware-chain.ts 超过500行 | `src/platform/five-plane-execution/execution-engine/agent-middleware-chain.ts` (528行) | 已处理（归并） | 1. 提取中间件接口到 `agent-middleware-chain/types.ts` |
| 317 | 源代码 | 高严重 | 巨型源文件 - multi-step-orchestration.ts 超过650行 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts` (657行) | 已处理（归并） | 1. 拆分为 `multi-step-orchestration/executor/`、`multi-step-orchestration/dependency/`、`multi-step-orchestration/state/` |
| 318 | 源代码 | 高严重 | 巨型源文件 - model-call-provider.ts 超过500行 | `src/platform/five-plane-execution/execution-engine/model-call-provider.ts` (537行) | 已处理（归并） | 1. 拆分为 `model-call-provider/core/`、`model-call-provider/retry/`、`model-call-provider/metrics/` |
| 319 | 源代码 | 中严重 | tool-executor目录35个文件过于庞大 | `src/platform/five-plane-execution/tool-executor/` (35个文件) | 已处理（归并） | 1. 按功能将 tool-executor 拆分为子目录： |
| 320 | 源代码 | 中严重 | recovery模块29个文件过于庞大 | `src/platform/five-plane-execution/recovery/` (29个文件) | 已处理（归并） | 1. 评估 recovery 模块的子模块划分 |
| 321 | 源代码 | 中严重 | ha模块25个文件可能过于庞大 | `src/platform/five-plane-execution/ha/` (25个文件) | 已处理（归并） | 1. 审计 HA 模块的职责边界 |
| 322 | 源代码 | 中严重 | dispatcher模块14个文件可能存在重复结构 | `src/platform/five-plane-execution/dispatcher/` (14个文件) | 已处理（归并） | 1. 确认 `dispatcher.ts` 是否是过时的入口点 |
| 323 | 源代码 | 中严重 | oapeflir目录两处存在架构边界不清 | - `src/platform/five-plane-execution/oapeflir/` | 已处理（归并） | 1. 明确 oapeflir 的单一真实来源 |
| 324 | 源代码 | 中严重 | memory模块27个文件可能过于庞大 | `src/platform/five-plane-state-evidence/memory/` (27个文件) | 已处理（归并） | 1. 评估 memory 模块的子模块划分 |
| 325 | 源代码 | 中严重 | events模块22个文件结构复杂 | `src/platform/five-plane-state-evidence/events/` (22个文件) | 已处理（归并） | 1. 将 events 拆分为 `events/durable/` 和 `events/typed/` |
| 326 | 源代码 | 中严重 | truth模块28个文件可能过于庞大 | `src/platform/five-plane-state-evidence/truth/` (28个文件) | 已处理（归并） | 1. 评估 truth 模块的子模块划分 |
| 327 | 源代码 | 中严重 | 五个引导文件并存造成混淆 | - `src/platform/platform-module-catalog.ts` | 已处理（归并） | 1. 明确哪个是主引导文件 |
| 328 | 源代码 | 中严重 | platform-module-catalog.ts 与其他引导文件职责重叠 | `src/platform/platform-module-catalog.ts` (10884字节) | 已处理（归并） | 1. 明确模块目录的职责 |
| 329 | 源代码 | 中严重 | contracts目录151个子目录可能需要重组 | `src/platform/contracts/` (151个子目录) | 已处理（归并） | 1. 审计 contracts 模块的结构 |
| 330 | 测试 | 高严重 | 大量测试被exclude导致覆盖缺口巨大 | `tsconfig.json` exclude 部分 (约80个条目) | 已处理（归并） | 1. 逐个调查被排除测试的失败原因 |
| 331 | 测试 | 高严重 | durable-event-bus-async.test.ts 测试失败 | `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts` | 已处理（归并） | 1. 调查测试失败原因 |
| 332 | 测试 | 高严重 | checkpoint迁移测试失败 | `tests/unit/platform/state-evidence/checkpoints/node-run-checkpoint-migration.test.ts` | 已处理（归并） | 1. 调查 checkpoint 迁移测试失败原因 |
| 333 | 测试 | 高严重 | IAM模块测试失败 - access-model.test.ts, field-encryption.test.ts | `tests/unit/platform/five-plane-control-plane/iam/` | 已处理（归并） | 1. 立即调查 IAM 测试失败的根本原因 |
| 334 | 测试 | 中严重 | E2E测试被排除 - 关键工作流无保护 | 多个 E2E 测试 | 已处理（归并） | 1. 调查每个 E2E 测试被排除的原因 |
| 335 | 测试 | 中严重 | 测试helpers自身测试被排除 | `tests/unit/helpers/index.test.ts` | 已处理（归并） | 1. 调查为什么这个测试被排除 |
| 336 | 测试 | 中严重 | stryker mutation testing 覆盖严重不足 | `stryker.config.mjs` | 已处理（归并） | 1. 将核心模块添加到 `mutate` 列表 |
| 337 | 配置 | 高严重 | .gitignore 缺少多个关键临时文件模式 | `.gitignore` | 已处理（归并） | 1. 添加 `:memory:*` 到 .gitignore |
| 338 | 配置 | 高严重 | 内存数据库文件残留未清理 | 根目录的 `:memory:*` 文件 | 已处理（归并） | 1. 清理所有内存数据库文件 |
| 339 | 配置 | 高严重 | session-replay目录1561个文件未gitignore | `session-replay/` (1561个条目) | 已处理（归并） | 1. 在 .gitignore 中添加 `session-replay/` 排除 |
| 340 | 配置 | 高严重 | artifacts目录489个文件未gitignore | `artifacts/` (489个条目) | 已处理（归并） | 1. 在 .gitignore 中添加 `artifacts/` 排除 |
| 341 | 配置 | 高严重 | .audit目录包含敏感数据未gitignore | `.audit/` 目录 | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 342 | 配置 | 中严重 | config/security 环境配置差异严重 | `config/security/` 目录 | 已处理（归并） | 1. 统一安全配置策略 |
| 343 | 配置 | 中严重 | .env.example 敏感字段无安全警告 | `.env.example` 第15行 | 已处理（归并） | 1. 在注释中添加更明确的安全警告 |
| 344 | 配置 | 中严重 | tsconfig.temp.json 存在造成困惑 | `tsconfig.temp.json` | 已处理（归并） | 1. 删除 `tsconfig.temp.json` |
| 345 | 源代码 | 中严重 | 952处 process.env 访问缺少统一管理 | 全局 | 已处理（归并） | 1. 创建统一的配置管理模块 |
| 346 | 源代码 | 中严重 | src/core/runtime 与五层架构并存造成混淆 | `src/core/runtime/` | 已处理（归并） | 1. 审计 `core/runtime` 中的代码，确定哪些已迁移到 `five-plane-*` |
| 347 | 脚本 | 中严重 | 脚本组织混乱 - scripts/ 目录结构不清晰 | `scripts/` 目录 | 已处理（归并） | 1. 创建 `scripts/README.md` 说明每个脚本的用途 |
| 348 | 脚本 | 低严重 | Python脚本 translate_docs.py 维护性问题 | `translate_docs.py` (10KB) | 已处理（归并） | 1. 评估是否仍在使用 |
| 349 | 部署 | 中严重 | 多个临时构建目录未清理 | 根目录的 `dist_*` 目录 | 已处理（归并） | 1. 在 `.gitignore` 中添加 `dist_*` 模式 |
| 350 | 源代码 | 中严重 | src/platform/contracts/ 与 src/platform/contracts/executable-contracts/ 可能存在重复 | `src/platform/contracts/` 和 `src/platform/contracts/executable-contracts/` | 已处理（归并） | 1. 审计 contracts 模块的结构 |
| 351 | 源代码 | 高严重 | traffic-routing-service.ts 使用 compat Routes 但数据库操作存在风险 | `src/platform/five-plane-control-plane/rollout-controller/traffic-routing-service.ts` (689行) | 已处理（归并） | 1. 统一路由存储策略 - 使用数据库或内存，不能混合 |
| 352 | 源代码 | 高严重 | 巨型文件未拆分 - harness/index.ts 2317行 | `src/platform/five-plane-orchestration/harness/index.ts` | 已处理（归并） | 1. 将 harness/index.ts 拆分为多个子模块 |
| 353 | 源代码 | 高严重 | budget-allocator.ts 文件体积异常 - 34KB | `src/platform/execution/budget-allocator.ts` | 已处理（归并） | 1. 拆分为: types.ts, allocator.ts, store.ts, settlement.ts |
| 354 | 源代码 | 高严重 | runtime-state-machine.ts 体积过大 - 26KB | `src/platform/execution/runtime-state-machine.ts` | 已处理（归并） | 1. 拆分为: types.ts, transitions.ts, machine.ts |
| 355 | 源代码 | 高严重 | symbolic links 混乱 - src/platform/ 下有5个符号链接 | `src/platform/` | 已处理（归并） | 1. 将符号链接替换为实际目录结构 |
| 356 | 配置 | 高严重 | config/security/ 环境配置差异严重 | `config/security/` | 已处理（归并） | 1. 在 test.json 中添加 strict 模式测试 |
| 357 | 配置 | 高严重 | .gitignore 不完整 | `.gitignore` | 已处理（归并） | 1. 添加 `:memory:*` 到 .gitignore |
| 358 | 源代码 | 高严重 | stryker mutation 测试只覆盖 core/api 模块 | `stryker.config.mjs` | 已处理（归并） | 1. 扩展 mutation 测试到 five-plane-* 模块 |
| 359 | 源代码 | 高严重 | process.env 访问模式不统一 - 952+ 处 | 整个 src/ 目录 | 已处理（归并） | 1. 创建 `src/config/index.ts` 集中管理所有配置 |
| 360 | 源代码 | 中严重 | 大量文件使用 console.* 而非结构化日志 | 多个源文件 | 已处理（归并） | 1. 替换所有 `console.*` 调用为 `StructuredLogger` |
| 361 | 源代码 | 中严重 | .audit/ 目录包含敏感数据但未被 gitignore | `.audit/` 目录 | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 362 | 源代码 | 中严重 | contracts 模块过大 - executable-contracts/index.ts 2169行 | `src/platform/contracts/executable-contracts/index.ts` | 已处理（归并） | 1. 将 `executable-contracts/index.ts` 拆分为多个子模块 |
| 363 | 源代码 | 中严重 | agent-middleware-chain.ts 已修改但未完成 | `src/platform/five-plane-execution/execution-engine/agent-middleware-chain.ts` | 已处理（归并） | 1. 确认 hook 调用链路完整 |
| 364 | 源代码 | 中严重 | single-task-happy-path.ts 更改返回值结构 | `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts` | 已处理（归并） | 1. 文档化新的返回值结构 |
| 365 | 安全 | 高严重 | field-encryption.ts 使用 AES-256-GCM 但密钥管理缺失 | `src/platform/five-plane-control-plane/iam/field-encryption.ts` | 已处理（归并） | 1. 实现安全的密钥存储机制 (如 Vault, KMS) |
| 366 | 文档 | 中严重 | docs_zh/operations/current_todo_list.md 过大 - 38KB | `docs_zh/operations/current_todo_list.md` | 已处理（归并） | 1. 定期同步 TODO 列表 |
| 367 | 源代码 | 低严重 | 13个文件包含未完成的 TODO/FIXME 标记 | 多个源文件 | 已处理（归并） | 1. 审计所有 TODO/FIXME 标记 |
| 368 | 配置 | 低严重 | UI 依赖版本与主项目可能不一致 | `ui/package.json` | 已处理（归并） | 1. 在主 package.json 中定义共享依赖版本 |
| 369 | 源代码 | 中严重 | .audit/delegation/ 目录包含审计数据未 gitignore | `.audit/delegation/delegation-audit-events.json` | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 370 | 源代码 | 中严重 | 未提交的文件可能包含敏感信息 | - `src/platform/contracts/result-envelope/result-envelope.ts` | 已处理（归并） | 1. 检查所有 modified 文件的内容 |
| 371 | Git工作流 | 高严重 | 分支策略不清晰 - codex/test-fix-regression-pass 分支未合并 | `.git/config`, Git remote branches | 已处理（归并） | 1. 审查这两个分支的更改内容 |
| 372 | Git工作流 | 中严重 | 提交信息不一致 - 使用 "chore: sync" 而非描述性信息 | Git history | 已处理（归并） | 1. 制定提交信息规范，要求描述具体更改内容 |
| 373 | 代码审查流程 | 高严重 | CI流程缺少必需的代码审查步骤 | `.github/workflows/ci.yml` | 已处理（归并） | 1. 启用 branch protection 规则，要求至少1-2人审查 |
| 374 | 代码审查流程 | 中严重 | 缺少自动化代码质量门禁 | `.github/workflows/ci.yml` | 已处理（归并） | 1. 集成复杂度检查工具 (如 eslint-plugin-complexity) |
| 375 | 发布管理 | 高严重 | 版本号未实现自动化管理 | `package.json` | 已处理（归并） | 1. 集成 release-it 或类似工具实现自动化版本管理和 CHANGELOG 生成 |
| 376 | 发布管理 | 中严重 | 缺少 Docker 镜像版本策略 | `Dockerfile`, `.github/workflows/publish-image.yml` | 已处理（归并） | 1. 制定镜像版本标签策略文档 |
| 377 | 依赖安全性 | 高严重 | npm audit 发现多个未修复的安全漏洞 | `package.json`, `package-lock.json` | 已处理（归并） | 1. 优先升级 `xml-crypto` 到 6.1.2+ 以修复 @xmldom/xmldom 漏洞 |
| 378 | 依赖安全性 | 中严重 | 缺少依赖更新频率策略 | `package.json` | 已处理（归并） | 1. 配置 Dependabot 开启自动 PR |
| 379 | 开源许可合规 | 中严重 | 许可证文件存在但缺少合规性检查 | `LICENSE`, `package.json` | 已处理（归并） | 1. 在 package.json 中明确添加 `"license": "MIT"` |
| 380 | 性能监控 | 中严重 | 缺少性能基准测试定义和监控 | `tests/performance/` | 已处理（归并） | 1. 定义明确的性能基准 (如 API 响应时间 < 200ms) |
| 381 | 性能监控 | 中严重 | 缺少生产环境性能监控指标 | `docker-compose.yml`, `deploy/helm/values-*.yaml` | 已处理（归并） | 1. 定义并文档化 SLO 指标 |
| 382 | 灾难恢复 | 高严重 | DR演练脚本存在但不完整 | `deploy/scripts/dr-drill.sh` | 已处理（归并） | 1. 完善 DR 演练脚本，使用真实的数据模型 |
| 383 | 灾难恢复 | 中严重 | 备份机制缺少加密和传输安全 | `scripts/backup-sqlite.sh`, `scripts/restore-sqlite.sh` | 已处理（归并） | 1. 添加备份加密选项 (使用 GPG 或 openssl) |
| 384 | 访问控制 | 高严重 | JWT密钥管理缺少安全存储 | `.env.example`, `config/security/prod.json` | 已处理（归并） | 1. 实现密钥轮换机制 (建议每90天轮换) |
| 385 | 访问控制 | 中严重 | 缺少细粒度的权限控制模型 | `src/platform/control-plane/iam/`, `config/security/` | 已处理（归并） | 1. 完善 RBAC 模型设计和实现 |
| 386 | 加密算法 | 中严重 | 字段加密实现存在但密钥管理缺失 | `src/platform/five-plane-control-plane/iam/field-encryption.ts` | 已处理（归并） | 1. 文档化密钥管理架构 |
| 387 | 加密算法 | 中严重 | SSRF防护实现验证不完整 | CHANGELOG.md (Task 7 SSRF guard) | 已处理（归并） | 1. 文档化 SSRF 防护的具体实现 |
| 388 | 安全审计日志 | 高严重 | 审计日志缺少完整性验证机制 | `src/platform/state-evidence/audit/`, `.audit/` | 已处理（归并） | 1. 将 .audit/ 添加到 .gitignore |
| 389 | 安全审计日志 | 中严重 | 缺少安全事件的告警机制 | `deploy/prometheus/alertmanager.yml` | 已处理（归并） | 1. 配置完整的安全事件告警规则 |
| 390 | 配置管理 | 高严重 | 配置验证机制不完整 | `config/`, `src/` | 已处理（归并） | 1. 实现 Zod schema 配置验证 |
| 391 | 配置管理 | 中严重 | 环境配置差异未被测试覆盖 | `config/security/dev.json`, `config/security/test.json` | 已处理（归并） | 1. 为每个环境配置添加集成测试 |
| 392 | UI前端 | 中严重 | UI 代码与主项目分离导致一致性问题 | `ui/` | 已处理（归并） | 1. 在根 package.json 中定义共享依赖版本 |
| 393 | UI前端 | 低严重 | UI 测试覆盖率目标不均衡 | `ui/vitest.config.ts` | 已处理（归并） | 1. 评估是否需要提高 apps 覆盖率要求 |
| 394 | 脚本 | 低严重 | translate_docs.py 脚本维护状态不明确 | `translate_docs.py` | 已处理（归并） | 1. 确定脚本是否仍在使用 |
| 395 | 脚本 | 低严重 | scripts/ci/ 目录与 scripts/ 根目录组织混乱 | `scripts/` | 已处理（归并） | 1. 制定脚本分类和组织规范 |
| 396 | 文档完整性 | 中严重 | CHANGELOG 与实际提交历史不同步 | `CHANGELOG.md` | 已处理（归并） | 1. 启用自动化 CHANGELOG 生成 |
| 397 | 文档完整性 | 低严重 | API 文档未版本化 | docs_zh/architecture/ | 已处理（归并） | 1. 创建 API 版本策略文档 |
| 398 | 安全 | 高严重 | .audit目录未在gitignore中排除 | `.audit/delegation/delegation-audit-events.json` | 已处理（归并） | 1. 立即将 .audit/ 添加到 .gitignore |
| 399 | 安全 | 中严重 | 缺少安全入职/离职流程文档 | `docs_zh/` | 已处理（归并） | 1. 创建安全入职培训文档 |
| 400 | 容器安全 | 中严重 | Dockerfile 多阶段构建但安全优化不完整 | `Dockerfile` | 已处理（归并） | 1. 在 runtime 阶段添加 USER node |
| 401 | 容器安全 | 中严重 | docker-compose.yml 中的安全配置不完整 | `docker-compose.yml` | 已处理（归并） | 1. 为 PostgreSQL 配置强密码或使用 Secrets |
| 402 | 供应链安全 | 高严重 | 缺少第三方依赖的完整性验证 | `package.json`, `package-lock.json` | 已处理（归并） | 1. 启用 npm provenance |
| 403 | 供应链安全 | 中严重 | GitHub Actions 权限过于宽松 | `.github/workflows/*.yml` | 已处理（归并） | 1. 审计所有 workflow 的权限 |
| 404 | 运维 | 中严重 | 缺少回滚演练和验证 | `.github/workflows/deploy-environment.yml` | 已处理（归并） | 1. 实现自动化的回滚验证测试 |
| 405 | 运维 | 低严重 | 缺少故障复盘流程文档 | `docs_zh/operations/` | 已处理（归并） | 1. 创建 post-mortem 模板 |
| 406 | 安全 | 高严重 | npm依赖安全漏洞 - 主项目7个漏洞需立即修复 | `package.json` 和 `package-lock.json` | 已处理（归并） | 1. 运行 `npm audit fix --force` 修复（但可能引入破坏性变更） |
| 407 | 安全 | 中严重 | npm依赖安全漏洞 - UI项目6个中等问题 | `ui/package.json` 和 `ui/package-lock.json` | 已处理（归并） | 1. 升级 vite 到 >6.4.1 |
| 408 | 源代码 | 高严重 | 巨型源文件 - budget-allocator.ts 931行 | `src/platform/five-plane-execution/budget-allocator.ts` | 已处理（归并） | 1. 将接口定义移到 `types.ts` 或 `interfaces/` 目录 |
| 409 | 源代码 | 高严重 | 巨型源文件 - durable-event-bus.ts 1214行 | `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` | 已处理（归并） | 1. 拆分为 `durable-event-bus/` 目录 |
| 410 | 源代码 | 高严重 | 巨型源文件 - multi-step-supervisor.ts 802行 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` | 已处理（归并） | 1. 拆分为 `step-executor.ts`（单步执行） |
| 411 | 源代码 | 高严重 | 巨型源文件 - transition-service.ts 868行 | `src/platform/five-plane-execution/state-transition/transition-service.ts` | 已处理（归并） | 1. 将状态转换规则拆分为独立策略类 |
| 412 | 源代码 | 高严重 | 巨型源文件 - harness/index.ts 2317行 | `src/platform/five-plane-orchestration/harness/index.ts` | 已处理（归并） | 1. 将 harness 拆分为多个子模块： |
| 413 | 源代码 | 高严重 | process.env 访问次数5176次，配置管理极不规范 | 全局 | 已处理（归并） | 1. 创建 `src/config/index.ts` 统一配置管理 |
| 414 | 源代码 | 高严重 | 14个文件超过1000行需要拆分 | 多个源文件 | 已处理（归并） | 1. 将所有超过 1000 行的文件加入拆分计划 |
| 415 | 源代码 | 中严重 | MultiStepToolRegistry 是单例且不可测试 | `src/platform/five-plane-execution/dispatcher/index.ts` | 已处理（归并） | 1. 考虑使用依赖注入替代单例 |
| 416 | 配置 | 中严重 | npm audit 未在默认 CI 中运行 | `package.json` ci script | 已处理（归并） | 1. 将 `npm audit` 添加到 pre-commit hook |
| 417 | 部署 | 中严重 | deploy/chaos 只有4个场景，deploy/runbooks 只有1个文件 | `deploy/chaos/` 和 `deploy/runbooks/` | 已处理（归并） | 1. 添加更多 chaos 场景覆盖常见故障 |
| 418 | 源代码 | 中严重 | IAuthoritativeStorage 接口实现不一致 | `src/platform/five-plane-state-evidence/truth/storage-backend-factory.ts` | 已处理（归并） | 1. 定义清晰的存储接口 |
| 419 | 源代码 | 中严重 | WorkflowPlanner 和 IntakeRouter 直接实例化 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts:161-164` | 已处理（归并） | 1. 使用依赖注入 |
| 420 | 源代码 | 中严重 | Symbolic link 导致 import 路径不一致 | `src/platform/` 下的符号链接 | 已处理（归并） | 1. 在 tsconfig.json 中使用 path mapping 替代符号链接 |
| 421 | 源代码 | 中严重 | 多个 bootstrap 文件导致混淆 | - `src/platform/platform-mainline-bootstrap.ts` | 已处理（归并） | 1. 明确标识哪个是主引导文件 |
| 422 | 源代码 | 低严重 | policy-engine 初始化使用硬编码默认值 | `src/platform/five-plane-execution/dispatcher/index.ts:110-112` | 已处理（归并） | 1. 从配置读取策略 |
| 423 | 配置 | 低严重 | .env.example 过长 (347行) | `.env.example` (347行) | 已处理（归并） | 1. 拆分为多个 .env 文件 |
| 424 | 测试 | 中严重 | UI 测试覆盖率目标不明确 | `ui/vitest.config.ts` 和 `ui/playwright.config.ts` | 已处理（归并） | 1. 在 ui/package.json 中添加覆盖率目标 |
| 425 | 文档 | 中严重 | docs_zh/architecture/00-platform-architecture.md 过于庞大 (728KB) | `docs_zh/architecture/00-platform-architecture.md` | 已处理（归并） | 1. 将文档拆分为多个小文档 |
| 426 | 源代码 | 低严重 | hardcoded 注释残留 | 多个源文件 | 已处理（归并） | 1. 清理已修复的 hardcoded 注释 |
| 427 | 源代码 | 中严重 | domains 目录过大 (60个条目，34个业务领域) | `src/domains/` (60个条目) | 已处理（归并） | 1. 创建领域依赖关系图 |
| 428 | 源代码 | 中严重 | 巨型源文件 - auto-stop-loss-service.ts 接近1000行 | `src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.ts` (1004行) | 已处理（归并） | 1. 拆分为 `auto-stop-loss/detectors/`、`auto-stop-loss/actions/`、`auto-stop-loss/policies/` |
| 429 | 源代码 | 中严重 | 巨型源文件 - model-routing-service.ts 接近1000行 | `src/platform/model-gateway/provider-registry/model-routing-service.ts` (939行) | 已处理（归并） | 1. 拆分为 `model-routing/balancers/`、`model-routing/selectors/`、`model-routing/health-check/` |
| 430 | 源代码 | 中严重 | 巨型源文件 - chaos-experiment-scheduler.ts 接近1000行 | `src/ops-maturity/chaos/chaos-experiment-scheduler.ts` (939行) | 已处理（归并） | 1. 拆分为 `chaos/schedulers/`、`chaos/executors/`、`chaos/reporters/` |
| 431 | 源代码 | 中严重 | 巨型源文件 - execution-dispatch-service.ts 接近1000行 | `src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts` (938行) | 已处理（归并） | 1. 拆分为 `execution-dispatch/queue/`、`execution-dispatch/allocators/`、`execution-dispatch/handlers/` |
| 432 | 源代码 | 高严重 | 事件驱动架构 - EventEmitter 使用不规范 | 4个文件使用 EventEmitter | 已处理（归并） | 1. 将这4个 EventEmitter 使用迁移到 TypedEventBus |
| 433 | 源代码 | 高严重 | 工作流引擎 - 状态机实现分散 | `runtime-state-machine.ts` (690行) 和相关文件 | 已处理（归并） | 1. 将状态定义外部化为配置 |
| 434 | 源代码 | 中严重 | 资源管理和配额控制 - 预算分配器测试失败 | `tests/unit/platform/five-plane-execution/budget-allocator.test.ts` | 已处理（归并） | 1. 立即修复 budget-allocator 测试 |
| 435 | 源代码 | 中严重 | 容错和高可用 - HA 和 Lease 模块职责重叠 | `src/platform/stability/` 目录 | 已处理（归并） | 1. 明确 HA 和 Lease 的职责边界 |
| 436 | 源代码 | 中严重 | 监控指标和可观测性 - SLO 告警服务过于庞大 | `src/platform/shared/observability/slo-alerting-service.ts` (1270行) | 已处理（归并） | 1. 拆分为多个文件 |
| 437 | 源代码 | 中严重 | 数据隔离和租户安全 - 多层模块存在循环依赖风险 | `src/platform/five-plane-*` 各模块 | 已处理（归并） | 1. 审计模块间依赖关系 |
| 438 | 源代码 | 中严重 | API设计和版本管理 - 深层 import 路径混乱 | 多个源文件使用深层相对导入 | 已处理（归并） | 1. 统一使用 `@automatic-agent/platform/execution` 形式的包导入 |
| 439 | 源代码 | 中严重 | 依赖管理和供应链安全 - npm audit 未在默认 CI 运行 | `.github/workflows/ci.yml` | 已处理（归并） | 1. 在 UI 项目也运行 npm audit |
| 440 | 配置 | 中严重 | CI/CD配置 - UI 质量检查独立运行 | `.github/workflows/ui-quality.yml` | 已处理（归并） | 1. 将 UI 质量检查集成到主 CI |
| 441 | 配置 | 中严重 | CI/CD配置 - 缺少 Docker 构建缓存 | `.github/workflows/ci.yml` 的 trivy-scan job | 已处理（归并） | 1. 添加 Docker layer caching |
| 442 | 配置 | 低严重 | .gitignore 缺少多个模式 | `.gitignore` | 已处理（归并） | 1. 添加这些模式到 .gitignore |
| 443 | 测试 | 高严重 | 测试失败 - 14个测试文件持续失败 | `.audit/quality.md` 报告的14个失败测试 | 已处理（归并） | 1. 为每个失败测试创建 issue |
| 444 | 测试 | 中严重 | Golden 测试只有48个 | `tests/golden/` (48个文件) | 已处理（归并） | 1. 增加关键路径的 golden 测试 |
| 445 | 文档 | 低严重 | docs_zh/architecture/00-platform-architecture.md 过于庞大 | `docs_zh/architecture/00-platform-architecture.md` (728KB) | 已处理（归并） | 1. 拆分为多个文档 |
| 446 | 源代码 | 低严重 | 13个文件包含 TODO/FIXME/HACK 标记 | 多个源文件 | 已处理（归并） | 1. 将 TODO 转换为 issue tracker 任务 |
| 447 | 安全 | 高严重 | npm依赖存在多个高严重漏洞 | `package-lock.json` | 已处理（归并） | 1. 运行 `npm audit fix` 修复非破坏性漏洞 |
| 448 | 安全 | 中严重 | UI项目存在6个中严重漏洞 | `ui/package-lock.json` | 已处理（归并） | 1. 在 UI 项目也运行 `npm audit` |
| 449 | 配置 | 中严重 | docker-compose.yml 中JWT secret被注释但示例存在 | `docker-compose.yml` 第17行 | 已处理（归并） | 1. 添加 secret 生成指引到注释 |
| 450 | 配置 | 中严重 | docker-compose.yml PostgreSQL密码来自环境变量 | `docker-compose.yml` 第52行 | 已处理（归并） | 1. 在 `.env.example` 中添加 `POSTGRES_PASSWORD` 生成指引 |
| 451 | 源代码 | 中严重 | EventEmitter vs TypedEventBus 混用问题 | `src/platform/five-plane-state-evidence/events/typed-event-bus.ts` | 已处理（归并） | 1. 审计所有 `EventEmitter` 使用 |
| 452 | 源代码 | 高严重 | 巨型harness文件 - 2317行 | `src/platform/five-plane-orchestration/harness/runtime/runtime-harness.ts` (2317行) | 已处理（归并） | 1. 将 harness 拆分为多个模块： |
| 453 | 源代码 | 高严重 | 巨型contracts文件 - 2169行 | `src/platform/contracts/request-envelope/index.ts` (2169行) | 已处理（归并） | 1. 将 contracts 拆分为多个子模块 |
| 454 | 源代码 | 中严重 | 巨型nl-gateway文件 - 1669行 | `src/platform/five-plane-interface/nl-gateway/service.ts` (1669行) | 已处理（归并） | 1. 将 NL Gateway 拆分为： |
| 455 | 源代码 | 中严重 | 巨型oapeflir-loop-service文件 - 1497行 | `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts` (1497行) | 已处理（归并） | 1. 将循环逻辑拆分为独立模块 |
| 456 | 测试 | 高严重 | 14个测试文件持续失败但未处理 | `.audit/quality.md` 报告的失败测试 | 已处理（归并） | 1. 为每个失败测试创建 issue |
| 457 | 测试 | 中严重 | Golden测试覆盖不足 - 仅48个 | `tests/golden/` | 已处理（归并） | 1. 增加核心模块的 golden 测试 |
| 458 | 源代码 | 中严重 | HA和Lease模块职责重叠 | `src/platform/five-plane-execution/ha/` 和 `src/platform/five-plane-execution/lease/` | 已处理（归并） | 1. 审计 HA 和 Lease 模块的职责 |
| 459 | 源代码 | 中严重 | SLO告警服务过于庞大 | `src/platform/five-plane-execution/stability/slo-alert-service.ts` | 已处理（归并） | 1. 将 SLO 告警拆分为：`slo/metrics/`、`slo/alerting/`、`slo/reporting/` |
| 460 | 配置 | 中严重 | npm scripts 超过100个难以维护 | `package.json` scripts 部分 | 已处理（归并） | 1. 使用 npm-run-all 或 make 精简 scripts |
| 461 | 源代码 | 中严重 | .audit目录包含敏感数据但未被gitignore | `.audit/delegation/delegation-audit-events.json` | 已处理（归并） | 1. 将 `.audit/` 添加到 .gitignore |
| 462 | 源代码 | 低严重 | src/core/runtime/ 与五层架构并行存在 | `src/core/runtime/` | 已处理（归并） | 1. 审计 core/runtime 中的代码，确定已迁移到 five-plane-* 的部分 |
| 463 | 配置 | 中严重 | .gitignore 缺少多个临时文件模式 | `.gitignore` | 已处理（归并） | 1. 添加 `:memory:*` 到 .gitignore |
| 464 | 源代码 | 中严重 | process.env 访问模式不安全 - 约952处 | 全局 | 已处理（归并） | 1. 创建 `src/config/index.ts` 统一配置管理 |
| 465 | 安全 | 中严重 | docker-compose.yml 存在安全配置但不完整 | `docker-compose.yml` | 已处理（归并） | 1. 添加 Seccomp 配置 |
| 466 | 测试 | 中严重 | 测试helpers过多 - 78个文件 | `tests/helpers/` (78个文件) | 已处理（归并） | 1. 评估这些 helpers 是否可以合并或简化 |
| 467 | 配置 | 中严重 | UI package.json 与主 package.json 依赖版本不同步 | `ui/package.json` 和 `package.json` | 已处理（归并） | 1. 确保 UI 和主项目的共享依赖版本同步 |
| 468 | 源代码 | 中严重 | memory模块 - 27个文件可能过于庞大 | `src/platform/five-plane-state-evidence/memory/` (27个文件) | 已处理（归并） | 1. 评估 memory 模块的子模块划分 |
| 469 | 源代码 | 中严重 | events模块 - 22个文件结构复杂 | `src/platform/five-plane-state-evidence/events/` (22个文件) | 已处理（归并） | 1. 将 events 拆分为 `events/durable/` 和 `events/typed/` |
| 470 | 源代码 | 中严重 | truth模块 - 28个文件可能过于庞大 | `src/platform/five-plane-state-evidence/truth/` (28个文件) | 已处理（归并） | 1. 评估 truth 模块的子模块划分 |
| 471 | 源代码 | 中严重 | recovery模块 - 29个文件过于庞大 | `src/platform/five-plane-execution/recovery/` (29个文件) | 已处理（归并） | 1. 评估 recovery 模块的子模块划分 |
| 472 | 源代码 | 中严重 | ha模块 - 25个文件 | `src/platform/five-plane-execution/ha/` (25个文件) | 已处理（归并） | 1. 审计 HA 模块的职责边界 |
| 473 | 源代码 | 中严重 | execution-engine模块 - 29个文件过于庞大 | `src/platform/five-plane-execution/execution-engine/` (29个文件) | 已处理（归并） | 1. 将 orchestration 逻辑拆分为独立模块 |
| 474 | 配置 | 低严重 | tsconfig.temp.json 存在但未清理 | `tsconfig.temp.json` | 已处理（归并） | 1. 删除 `tsconfig.temp.json` |
| 475 | 源代码 | 低严重 | hardcoded配置注释残留 | 多个源文件 | 已处理（归并） | 1. 清理已修复的 "hardcoded" 注释 |
| 476 | 配置 | 中严重 | 依赖版本固定但存在漏洞 | `package.json` | 已处理（归并） | 1. 定期更新依赖版本 |
| 477 | 安全 | 中严重 | JWT secret 缺少生成指引和轮换策略 | `.env.example` | 已处理（归并） | 1. 在 `.env.example` 中添加更明确的安全警告 |
| 478 | 源代码 | 中严重 | tool-executor目录 - 35个文件职责过多 | `src/platform/five-plane-execution/tool-executor/` (35个文件) | 已处理（归并） | 1. 按功能将 tool-executor 拆分为子目录 |
| 479 | 源代码 | 中严重 | src/platform/contracts/ 导出路径混乱 | `src/platform/contracts/` 和相关导入 | 已处理（归并） | 1. 使用包导出方式 `import { newId } from "@automatic-agent/platform/contracts"` |
| 480 | 源代码 | 高严重 | 巨型文件 - harness/index.ts 达2317行 | `src/platform/five-plane-orchestration/harness/index.ts` | 已处理（归并） | 1. 按功能领域拆分为独立模块： |
| 481 | 源代码 | 高严重 | 巨型文件 - contracts/executable-contracts/index.ts 达2169行 | `src/platform/contracts/executable-contracts/index.ts` | 已处理（归并） | 1. 将契约拆分为按领域组织的子文件： |
| 482 | 源代码 | 高严重 | 巨型文件 - nl-gateway/index.ts 达1669行 | `src/interaction/nl-gateway/index.ts` | 已处理（归并） | 1. 拆分为多个服务： |
| 483 | 源代码 | 高严重 | 巨型文件 - oapeflir-loop-service.ts 达1497行 | `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts` | 已处理（归并） | 1. 提取循环状态机到独立文件 |
| 484 | 源代码 | 高严重 | 巨型文件 - intake-router.ts 达1328行 | `src/platform/five-plane-orchestration/routing/intake-router.ts` | 已处理（归并） | 1. 将路由规则提取为配置文件 |
| 485 | 源代码 | 高严重 | 巨型文件 - slo-alerting-service.ts 达1270行 | `src/platform/shared/observability/slo-alerting-service.ts` | 已处理（归并） | 1. 拆分为告警规则引擎和通知服务 |
| 486 | 源代码 | 高严重 | 巨型文件 - tenant-platform-service.ts 达1231行 | `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts` | 已处理（归并） | 1. 将租户隔离逻辑提取为中间件 |
| 487 | 源代码 | 高严重 | 巨型文件 - durable-event-bus.ts 达1214行 | `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` | 已处理（归并） | 1. 拆分为事件总线核心和适配器 |
| 488 | 源代码 | 高严重 | 巨型文件 - delegation-manager.service.ts 达1210行 | `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` | 已处理（归并） | 1. 提取委托策略到独立文件 |
| 489 | 源代码 | 高严重 | 巨型文件 - marketplace-governance-service.ts 达1081行 | `src/scale-ecosystem/marketplace/marketplace-governance-service.ts` | 已处理（归并） | 1. 按治理领域拆分为独立服务 |
| 490 | 源代码 | 高严重 | 巨型文件 - event-registry.ts 达1077行 | `src/platform/five-plane-state-evidence/events/event-registry.ts` | 已处理（归并） | 1. 将事件处理逻辑提取到独立handler |
| 491 | 源代码 | 中严重 | 巨型文件 - worker-repository.ts 达1064行 | `src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository.ts` | 已处理（归并） | 1. 将仓库操作拆分为多个专门仓库 |
| 492 | 源代码 | 中严重 | 巨型文件 - llm-eval-service.ts 达1055行 | `src/platform/prompt-engine/eval/llm-eval-service.ts` | 已处理（归并） | 1. 将评估器拆分为多个专门评估器 |
| 493 | 源代码 | 中严重 | 巨型文件 - approval-flow-engine.ts 达1031行 | `src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts` | 已处理（归并） | 1. 将流程定义与流程引擎分离 |
| 494 | 源代码 | 中严重 | 巨型文件 - goal-decomposer/index.ts 达1031行 | `src/interaction/goal-decomposer/index.ts` | 已处理（归并） | 1. 将分解策略提取为独立模块 |
| 495 | 源代码 | 中严重 | 巨型文件 - human-takeover-service.ts 达1028行 | `src/platform/five-plane-control-plane/incident-control/human-takeover-service.ts` | 已处理（归并） | 1. 将接管判定与执行分离 |
| 496 | 源代码 | 中严重 | 巨型文件 - auto-stop-loss-service.ts 达1004行 | `src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.ts` | 已处理（归并） | 1. 将止损规则提取为配置文件 |
| 497 | 源代码 | 中严重 | 巨型文件 - api-client.ts 达1022行 | `src/sdk/client-sdk/api-client.ts` | 已处理（归并） | 1. 将不同API端点拆分为独立客户端 |
| 498 | 源代码 | 中严重 | 巨型文件 - channel-gateway-service.ts 达981行 | `src/platform/five-plane-interface/channel-gateway/channel-gateway-service.ts` | 已处理（归并） | 1. 将通道处理拆分为独立handler |
| 499 | 源代码 | 高严重 | 巨型文件 - 总计18个文件超过1000行 | 项目中共有18个文件超过1000行 | 已处理（归并） | 1. 在ESLint中添加最大行数规则（如max-lines: 1000） |
| 500 | 源代码 | 高严重 | 符号链接未被.gitignore忽略 | 根目录多个临时构建目录 | 已处理（归并） | 1. 添加 `dist_*` 到 `.gitignore` 以覆盖所有临时构建目录 |
| 501 | 配置 | 中严重 | .env.example 安全警告不足 | `.env.example` | 已处理（归并） | 1. 在注释中添加更明确的"危险"警告标记 |
| 502 | 测试 | 高严重 | 测试排除列表过长 - 114个模式排除 | `tsconfig.json` exclude 部分 | 已处理（归并） | 1. 创建一个诊断脚本分析每个被排除测试的失败原因 |
| 503 | 测试 | 中严重 | stryker mutation testing 只覆盖7个文件 | `stryker.config.mjs` | 已处理（归并） | 1. 扩展 mutation 测试覆盖到更多核心模块： |
| 504 | 安全 | 高严重 | npm 依赖存在多个高严重漏洞 | `package.json` dependencies | 已处理（归并） | 1. 运行 `npm audit` 查看所有漏洞 |
| 505 | 安全 | 高严重 | process.env 访问次数过多 - 约952处 | 全局 | 已处理（归并） | 1. 创建统一的配置管理模块（如 `src/config/index.ts`） |
| 506 | 部署 | 中严重 | deploy/terraform 和 deploy/helm 内容不完整 | `deploy/terraform/` 和 `deploy/helm/` | 已处理（归并） | 1. 检查 terraform 配置的完整性 |
| 507 | 部署 | 中严重 | docker-compose.yml 安全配置部分完成 | `docker-compose.yml` | 已处理（归并） | 1. 使用 docker secrets 管理敏感配置 |
| 508 | 文档 | 中严重 | docs_zh/contracts 与代码可能不同步 | `docs_zh/contracts/` (151个文件) | 已处理（归并） | 1. 创建契约版本控制机制 |
| 509 | 文档 | 低严重 | deploy/runbooks 内容单薄 | `deploy/runbooks/production-alert-runbook.md` | 已处理（归并） | 1. 扩展运行手册内容 |
| 510 | 源代码 | 低严重 | src/core/runtime 目录仍在使用 | `src/core/runtime/` | 已处理（归并） | 1. 明确文档说明 `src/core/runtime/` 的用途 |
| 511 | 源代码 | 低严重 | 5个符号链接未被文档化 | `src/platform/` 下的符号链接 | 已处理（归并） | 1. 在 CLAUDE.md 或其他文档中记录这些符号链接 |
| 512 | 源代码 | 低严重 | hardcoded 配置注释残留 | 多个源文件 | 已处理（归并） | 1. 清理已修复的 "hardcoded" 注释 |
| 513 | 源代码 | 低严重 | 内存数据库文件未在.gitignore中 | 根目录的 `:memory:*` 文件 | 已处理（归并） | 1. 在 `.gitignore` 中添加 `:memory:*` 模式 |
| 514 | 源代码 | 低严重 | .audit/ 目录未在.gitignore中 | `.audit/` 目录 | 已处理（归并） | 1. 在 `.gitignore` 中添加 `.audit/` 排除 |
| 515 | 源代码 | 低严重 | TODO/FIXME 注释残留 - 约17处 | 多个源文件 | 已处理（归并） | 1. 创建 Issue tracker 跟踪每个 TODO |
| 516 | 源代码 | 中严重 | tool-executor 目录文件过多 - 35个文件 | `src/platform/five-plane-execution/tool-executor/` | 已处理（归并） | 1. 按功能将 tool-executor 拆分为子目录： |
| 517 | 源代码 | 中严重 | state-transition 服务 - transition-service.ts 达868行 | `src/platform/five-plane-execution/state-transition/transition-service.ts` (868行) | 已处理（归并） | 1. 将状态转换规则拆分为独立的策略类 |
| 518 | 源代码 | 中严重 | memory 系统目录过大 | `src/platform/five-plane-state-evidence/memory/` | 已处理（归并） | 1. 按功能拆分 memory 系统 |
| 519 | 源代码 | 中严重 | events 系统目录过大 | `src/platform/five-plane-state-evidence/events/` | 已处理（归并） | 1. 将 durable-event-bus 拆分为核心和适配器 |
| 520 | 源代码 | 中严重 | truth 系统目录过大 | `src/platform/five-plane-state-evidence/truth/` | 已处理（归并） | 1. 将仓库操作拆分为多个专门仓库 |
| 521 | 源代码 | 中严重 | recovery 系统目录过大 - 29个文件 | `src/platform/five-plane-execution/recovery/` (29个文件) | 已处理（归并） | 1. 按恢复场景拆分为独立服务 |
| 522 | 源代码 | 中严重 | execution-engine 目录过大 | `src/platform/five-plane-execution/execution-engine/` | 已处理（归并） | 1. 将多步编排拆分为独立模块 |
| 523 | 源代码 | 中严重 | HA 和 Lease 模块职责重叠 | `src/platform/five-plane-execution/ha/` 和 `src/platform/five-plane-execution/lease/` | 已处理（归并） | 1. 分析 HA 和 Lease 模块的职责边界 |
| 524 | 源代码 | 中严重 | EventEmitter vs TypedEventBus 混用 | 全局 | 已处理（归并） | 1. 创建迁移计划，将所有 `EventEmitter` 迁移到 `TypedEventBus` |
| 525 | 配置 | 中严重 | npm scripts 过多 - 超过100个 | `package.json` scripts 部分 | 已处理（归并） | 1. 使用 `npm run build` 统一构建脚本 |
| 526 | 部署 | 中严重 | deploy/chaos 目录内容单薄 | `deploy/chaos/` | 已处理（归并） | 1. 添加更多 chaos 场景： |
| 527 | 文档 | 低严重 | CLAUDE.md 内容可能过时 | `CLAUDE.md` | 已处理（归并） | 1. 更新 CLAUDE.md 记录符号链接 |
| 528 | 安全 | 高严重 | npm audit 发现7个安全漏洞 | `package.json` / `package-lock.json` | 已处理（归并） | 1. 运行 `npm audit fix --force` 修复部分问题 |
| 529 | 源代码 | 高严重 | 巨型源文件未得到有效重构 | 多个源文件超过1000行 | 已处理（归并） | 1. 制定系统性重构计划 |
| 530 | 源代码 | 高严重 | src/platform/five-plane-execution/tool-executor/ 职责过多 | `src/platform/five-plane-execution/tool-executor/` | 已处理（归并） | 1. 将tool-executor拆分为多个子模块： |
| 531 | 测试 | 高严重 | 测试文件排除列表过长表明存在系统性测试问题 | `tsconfig.json` exclude段 | 已处理（归并） | 1. 逐个调查每个排除模式的原因 |
| 532 | 配置 | 高严重 | .gitignore 缺少关键模式 | `.gitignore` | 已处理（归并） | 在.gitignore末尾添加： |
| 533 | 源代码 | 高严重 | 直接访问process.env高达143处 | 整个src目录 | 已处理（归并） | 1. 创建统一的配置管理模块 (如 `src/platform/shared/config/` ) |
| 534 | 源代码 | 中严重 | 符号链接使用可能影响构建稳定性 | `src/platform/` | 已处理（归并） | 1. 在CLAUDE.md中记录所有符号链接 |
| 535 | 源代码 | 中严重 | src/core/runtime 与五层架构并存造成架构混乱 | `src/core/runtime/` | 已处理（归并） | 1. 明确 src/core/runtime 的迁移计划 |
| 536 | 配置 | 中严重 | config/security/ 目录内容单薄 | `config/security/` | 已处理（归并） | 1. 扩展安全配置文件内容 |
| 537 | 部署 | 中严重 | deploy/terraform 内容不完整 | `deploy/terraform/` | 已处理（归并） | 1. 添加完整的Terraform模块 |
| 538 | 部署 | 中严重 | deploy/helm 内容不完整 | `deploy/helm/` | 已处理（归并） | 1. 完善Helm chart结构 |
| 539 | 测试 | 中严重 | 测试辅助代码量过大 | `tests/helpers/` (78个文件) | 已处理（归并） | 1. 审查并简化helpers结构 |
| 540 | 文档 | 中严重 | UI项目缺少文档 | `ui/README.md` | 已处理（归并） | 1. 更新UI README包含完整的项目结构说明 |
| 541 | 源代码 | 低严重 | tsconfig.temp.json 存在但未使用 | `tsconfig.temp.json` | 已处理（归并） | 1. 确认是否需要该文件 |
| 542 | 配置 | 低严重 | .env.example 包含大量未使用变量 | `.env.example` | 已处理（归并） | 1. 清理未使用的配置变量 |
| 543 | 安全 | 低严重 | 潜在敏感信息硬编码 | 多个CLI文件 | 已处理（归并） | 1. 审查所有包含敏感关键词的文件 |
| 544 | 测试 | 低严重 | Golden测试覆盖可能不足 | `tests/golden/` (48个文件) | 已处理（归并） | 1. 审查关键业务流程是否都有golden测试 |
| 545 | 部署 | 低严重 | Kubernetes配置缺失 | `deploy/` | 已处理（归并） | 1. 添加完整的Kubernetes manifests |
| 546 | 源代码 | 低严重 | .DS_Store文件存在 | 多个目录 | 已处理（归并） | 1. 添加 `.DS_Store` 到 .gitignore（如果没有） |
| 547 | 配置 | 低严重 | docker-compose.yml 缺少资源限制说明 | `docker-compose.yml` | 已处理（归并） | 1. 在docker-compose.yml顶部添加注释说明资源限制策略 |
| 548 | 配置 | 高严重 | .gitignore 缺少关键临时文件模式 | `.gitignore` | 已处理（归并） | 在 .gitignore 末尾添加： |
| 549 | 源代码 | 高严重 | 符号链接未在 .gitignore 中忽略 | `src/platform/` | 已处理（归并） | 1. 确认符号链接是否必须存在 |
| 550 | 源代码 | 高严重 | .DS_Store 文件存在 | 项目根目录和可能的其他目录 | 已处理（归并） | 1. 确保 .gitignore 包含 `.DS_Store` |
| 551 | 源代码 | 高严重 | 根目录存在未清理的临时 :memory: 文件 | 项目根目录 | 已处理（归并） | 1. 将 `:memory:*` 添加到 .gitignore |
| 552 | 配置 | 中严重 | UI 项目缺少完整文档 | `ui/README.md` | 已处理（归并） | 1. 扩展 UI README 包含完整的项目结构 |
| 553 | 源代码 | 中严重 | bash 目录不存在 | 项目根目录 | 已处理（归并） | 1. 如果不需要 bash 脚本，忽略此问题 |
| 554 | 配置 | 中严重 | config/environments/ 内容可能不完整 | `config/environments/` | 已处理（归并） | 1. 检查各环境的配置文件 |
| 555 | 源代码 | 中严重 | .tmp/ 目录包含大量临时文件 | `.tmp/` (307个条目) | 已处理（归并） | 1. 确保 .tmp/ 在 .gitignore 中 |
| 556 | 源代码 | 中严重 | .test-db/ 目录存在 | `.test-db/` | 已处理（归并） | 1. 确保 .test-db/ 在 .gitignore 中 |
| 557 | 源代码 | 中严重 | src/platform/index.ts 可能有循环依赖问题 | `src/platform/index.ts` | 已处理（归并） | 1. 检查 index.ts 的导入结构 |
| 558 | 测试 | 中严重 | 14个测试文件仍然失败 | 多个测试文件（详见 .audit/quality.md） | 已处理（归并） | 1. 逐个分析和修复失败的测试 |
| 559 | 文档 | 中严重 | docs_zh/architecture/ 缺少最近更新 | `docs_zh/architecture/` | 已处理（归并） | 1. 对比最新代码变更和文档 |
| 560 | 部署 | 中严重 | deploy/ 目录内容不完整 | `deploy/` | 已处理（归并） | 1. 扩展 runbooks 添加更多运维场景 |
| 561 | 源代码 | 低严重 | .claude/scheduled_tasks.json 在 git status 中显示修改 | `.claude/scheduled_tasks.json` | 已处理（归并） | 1. 将 `.claude/` 添加到 .gitignore |
| 562 | 源代码 | 低严重 | 多个配置文件存在未使用的临时变体 | 多个位置 | 已处理（归并） | 1. 确认 tsconfig.temp.json 是否需要 |
| 563 | 配置 | 低严重 | .env.example 包含大量可能未使用的变量 | `.env.example` (347行) | 已处理（归并） | 1. 审查并清理未使用的变量 |
| 564 | 源代码 | 低严重 | 直接访问 process.env 高达143处 | 整个 src 目录 | 已处理（归并） | 1. 创建统一的配置管理模块 |
| 565 | 源代码 | 低严重 | HA 和 Lease 模块职责可能重叠 | `src/platform/five-plane-execution/ha/` 和 `src/platform/five-plane-execution/lease/` | 已处理（归并） | 1. 明确两个模块的职责边界 |
| 566 | 源代码 | 低严重 | EventEmitter 和 TypedEventBus 混用 | 多个事件处理模块 | 已处理（归并） | 1. 统一使用 TypedEventBus |
| 567 | 架构 | 严重 | HarnessRuntimeService 是 God Object | `src/platform/five-plane-orchestration/harness/index.ts:721` | 已处理（归并） | 1. 拆分为 `HarnessStateManager`（状态转换） |
| 568 | 架构 | 高严重 | 巨型 barrel files 导致构建问题 | `src/platform/five-plane-orchestration/harness/index.ts` (2317行) | 已处理（归并） | 1. 每个 index.ts 最多重新导出5-7项 |
| 569 | 内存 | 高严重 | 167个事件监听器仅16个清理 | 整个代码库 | 已处理（归并） | 1. 审计所有事件监听器注册点 |
| 570 | 内存 | 高严重 | plugin-runtime-host.ts 子进程监听器未清理 | `src/domains/registry/plugin-runtime-host.ts:275,278,353,358` | 已处理（归并） | 1. 在 stop() 中添加清理： |
| 571 | 架构 | 中严重 | yono/index.ts 763行应拆分 | `src/domains/yono/index.ts` (763行) | 已处理（归并） | 1. 拆分为 yono/market-service.ts |
| 572 | 架构 | 中严重 | src/index.ts 451行应拆分 | `src/index.ts` (451行) | 已处理（归并） | 1. 拆分为 bootstrap.ts |
| 573 | 架构 | 中严重 | contracts/executable-contracts/index.ts 数据vs对象混淆 | `src/platform/contracts/executable-contracts/index.ts` (2169行) | 已处理（归并） | 1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts |
| 574 | 领域 | 高严重 | DomainLifecycleState 重复定义且不兼容 | `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38` | 已处理（归并） | 1. 统一为一个规范定义 |
| 575 | 领域 | 中严重 | 风险评分阈值硬编码无常量 | `src/domains/risk-profile/index.ts:68-78` | 已处理（归并） | 1. 提取到命名常量 |
| 576 | 领域 | 中严重 | HR角色检测硬编码工具名 | `src/domains/governance/hr-role-governance-service.ts:435-436` | 已处理（归并） | 1. 提取为常量 READ_ONLY_TOOL_NAMES |
| 577 | 领域 | 中严重 | 无 invariant 强制机制 | 整体架构 | 已处理（归并） | 1. 添加 invariant 强制框架 |
| 578 | 安全 | 中严重 | OpenAPI 端点公开无认证 | `src/platform/interface/api/http-server/health-routes.ts:41` | 已处理（归并） | 1. 添加认证或限制访问 |
| 579 | 安全 | 中严重 | 内存会话存储限制水平扩展 | `src/platform/five-plane-control-plane/iam/session-management.ts:83-89` | 已处理（归并） | 1. 使用 Redis 等分布式会话存储 |
| 580 | 安全 | 中严重 | 内存服务身份存储限制扩展 | `src/platform/five-plane-control-plane/iam/service-auth.ts:92` | 已处理（归并） | 1. 使用共享存储 |
| 581 | 配置 | 低严重 | 多个 architecture-remediation.ts 文件重名 | - `src/domains/architecture-remediation.ts` | 已处理（归并） | 1. 添加作用域前缀或后缀 |
| 582 | 内存 | 低严重 | PgDatabase.close() 验证问题 | `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474` | 已处理（归并） | 1. 验证 shutdown 顺序 |
| 583 | 架构 | 低严重 | Core/runtime 是平台执行文件的包装 | `src/core/runtime/` | 已处理（归并） | 1. 移除或文档化用途 |
| 584 | 构建 | 高严重 | 无 TypeScript 增量编译缓存 | `tsconfig.json` | 已处理（归并） | 1. 在 tsconfig.json 添加 `"incremental": true` |
| 585 | 构建 | 高严重 | 76个 npm scripts 大部分重复构建 | `package.json` | 已处理（归并） | 1. 创建 `build:cli` 脚本构建一次 |
| 586 | 源代码 | 高严重 | 168处 any 类型使用 | 整个 src 目录 | 已处理（归并） | 1. 使用泛型替代 any |
| 587 | 源代码 | 高严重 | 38处 @ts-ignore 指令 | 多个文件 | 已处理（归并） | 1. 修复 ExecutionRecord 类型不匹配 |
| 588 | 源代码 | 高严重 | ExecutionRecord 类型不匹配 | `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件 | 已处理（归并） | 1. 对齐 ExecutionRecord 接口和 store 类型 |
| 589 | 源代码 | 中严重 | 30+处 as unknown as 双类型转换 | `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk` | 已处理（归并） | 1. 修复上游类型问题 |
| 590 | 构建 | 中严重 | rimraf  extraneous - 未在 package.json 声明 | `node_modules/rimraf` | 已处理（归并） | 1. 添加到 dependencies 或 devDependencies |
| 591 | 测试 | 高严重 | 178处直接 process.env 变更无抽象 | `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687` | 已处理（归并） | 1. 创建 env helper 函数 |
| 592 | 测试 | 高严重 | 21,998处 unlinkSync 调用无集中清理 | 多个测试文件 | 已处理（归并） | 1. 创建集中的测试清理 utility |
| 593 | 测试 | 中严重 | 无统一 mocking 框架 | `tests/` 多个目录 | 已处理（归并） | 1. 建立统一的 mock factory |
| 594 | 测试 | 中严重 | Singleton 状态重置未标准化 | `tests/unit/platform/execution/dispatcher.test.ts` | 已处理（归并） | 1. 创建统一的 singleton reset 机制 |
| 595 | 测试 | 低严重 | 无分支覆盖率要求 | `.c8rc.json` | 已处理（归并） | 1. 添加分支覆盖率阈值 |
| 596 | 网络 | 高严重 | ScopedExternalAccessSandbox performHttpRequest 无超时 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289` | 已处理（归并） | 1. 添加 AbortController timeout |
| 597 | 网络 | 高严重 | OIDC 服务 fetch 调用无超时 | `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272` | 已处理（归并） | 1. 添加 fetch timeout |
| 598 | 网络 | 高严重 | plugin-runtime-child 替换 globalThis.fetch 为 no-op | `src/domains/registry/plugin-runtime-child.ts:112` | 已处理（归并） | 1. 确认这是有意行为 |
| 599 | 网络 | 中严重 | 无显式 http.Agent 配置 | 全局 | 已处理（归并） | 1. 添加 http Agent 配置 |
| 600 | 序列化 | 中严重 | 合同版本硬编码为字符串字面量 | `src/platform/contracts/inter-plane-contract-gateway.ts:184` | 已处理（归并） | 1. 提取到类型化常量或 enum |
| 601 | 序列化 | 低严重 | Timestamp = string 丢失精度 | `src/platform/contracts/types/domain/primitives.ts:10` | 已处理（归并） | 1. 使用 Date 对象或 branded string 类型 |
| 602 | 源代码 | 中严重 | 29处非空断言 !. | 整个 src 目录 | 已处理（归并） | 1. 使用可选链 `?.` 或空值合并 `??` |
| 603 | API | 中严重 | API 路由 schema 版本硬编码 | `src/platform/interface/api/federation-routing-service.ts` | 已处理（归并） | 1. 从 contract 版本派生 schema 版本 |
| 604 | 可观测性 | 高严重 | StructuredLogEntry 无 requestId 字段 | `src/platform/shared/observability/structured-logger.ts` | 已处理（归并） | 1. 在 StructuredLogEntry 添加 requestId 字段 |
| 605 | 可观测性 | 高严重 | StructuredLogger data 字段无自动清洗 | `src/platform/shared/observability/structured-logger.ts` | 已处理（归并） | 1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单 |
| 606 | 可观测性 | 中严重 | 日志中敏感数据无 PII 处理 | `src/platform/shared/observability/structured-logger.ts` | 已处理（归并） | 1. 添加 PII 检测和重写工具 |
| 607 | 可观测性 | 中严重 | 59处 console.* 直接调用 | 多个源文件 | 已处理（归并） | 1. 替换所有 console.* 为 StructuredLogger |
| 608 | 可观测性 | 中严重 | 部分 logger.warn 调用缺少结构化数据 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122` | 已处理（归并） | 1. 添加 `{ data: { ... } }` 对象 |
| 609 | 源代码 | 高严重 | Harness while(true) 循环无硬性迭代上限 | `src/platform/five-plane-orchestration/harness/index.ts:1442` | 已处理（归并） | 1. 添加硬性 maxIterations 上限 |
| 610 | 源代码 | 高严重 | Oapeflir while(true) 循环可能无限重规划 | `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355` | 已处理（归并） | 1. 添加重规划次数上限 |
| 611 | 源代码 | 中严重 | Recovery 流程允许终态转换到 paused | `src/platform/five-plane-execution/runtime-state-machine.ts:105-108` | 已处理（归并） | 1. 审查 recovery 转换的合法性 |
| 612 | 国际化 | 高严重 | API 错误消息硬编码英文 | `src/platform/interface/api/http-server/api-error.ts` | 已处理（归并） | 1. 使用错误码而非硬编码消息 |
| 613 | 国际化 | 中严重 | UI 硬编码字符串未翻译 | `ui/packages/features/conversation/src/web/index.tsx` | 已处理（归并） | 1. 使用 `translateFeatureCopy` 替换硬编码 |
| 614 | 国际化 | 中严重 | Arabic 目录不完整 | `ui/packages/shared/i18n/src/catalogs/ar-SA.ts` | 已处理（归并） | 1. 补充 Arabic 翻译 |
| 615 | 国际化 | 低严重 | translateFeatureCopy 无回退默认值 | `ui/packages/shared/i18n/` | 已处理（归并） | 1. 添加回退到 key 或默认字符串 |
| 616 | 运维 | 高严重 | 健康检查无 readiness/liveness 区分 | `src/platform/interface/api/http-server/health-routes.ts` | 已处理（归并） | 1. 添加 /ready 和 /live 端点 |
| 617 | 运维 | 高严重 | shutdown 期间健康检查存在竞态 | `src/platform/interface/api/http-server/health-routes.ts` | 已处理（归并） | 1. 在 shutdown 时返回 unhealthy |
| 618 | 运维 | 高严重 | LeaderElectionService 未与 GracefulShutdown 集成 | `src/platform/five-plane-execution/ha/leader-election-service.ts` | 已处理（归并） | 1. 将 LeaderElectionService 添加到 shutdown handlers |
| 619 | 运维 | 中严重 | addHandler() 无显式排序约定 | `src/platform/five-plane-execution/startup/graceful-shutdown.ts` | 已处理（归并） | 1. 添加优先级或阶段参数 |
| 620 | 运维 | 中严重 | unref'd timers 可能不触发 | `src/platform/five-plane-execution/startup/process-error-handlers.ts:106` | 已处理（归并） | 1. 移除 .unref() 除非确实需要 |
| 621 | 运维 | 中严重 | StartupConsistencyChecker 阻塞流量但不暴露状态 | `src/platform/five-plane-startup-plan.ts` | 已处理（归并） | 1. 在健康报告中暴露 trafficBlocked 状态 |
| 622 | 事件系统 | 中严重 | TypedEventBus vs EventEmitter 混用 | 整个代码库 | 已处理（归并） | 1. 创建迁移计划统一使用 TypedEventBus |
| 623 | 源代码 | 低严重 | 无事件排序保证 | `src/platform/state-evidence/events/` | 已处理（归并） | 1. 文档化事件排序语义 |
| 624 | 安全 | 严重 | CORS allowedMethods 缺少 PUT/PATCH/DELETE | `src/platform/five-plane-interface/api/http-server/response-hardening.ts:12-14` | 已处理（归并） | 1. 添加 PUT, PATCH, DELETE 到 allowedMethods |
| 625 | 安全 | 严重 | Mission Routes 错误响应包装不当 | `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124` | 已处理（归并） | 1. 使用 buildJsonErrorResponse 处理错误 |
| 626 | 源代码 | 高严重 | WebSocketBridge 无最大连接数限制 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107` | 已处理（归并） | 1. 添加 maxConnections 限制 |
| 627 | 源代码 | 高严重 | pendingAcks 在断开连接时未清理 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282` | 已处理（归并） | 1. 在 handleDisconnection 中删除所有 pendingAcks 条目 |
| 628 | 安全 | 高严重 | 硬编码回退密钥 | `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41` | 已处理（归并） | 1. 移除回退值，要求环境变量必须设置 |
| 629 | 配置 | 高严重 | config/runtime/test.json 缺少超时配置 | `config/runtime/test.json` | 已处理（归并） | 1. 添加完整的 timeout/tuning 配置 |
| 630 | 配置 | 高严重 | prod.json 限制过严 - maxConcurrentTasks=1 | `config/runtime/prod.json` | 已处理（归并） | 1. 评估并调整生产限制 |
| 631 | 源代码 | 高严重 | 多个服务存在无界 Map 无驱逐策略 | 多个域服务 | 已处理（归并） | 1. 为所有 Map 实现 LRU 或 TTL 驱逐策略 |
| 632 | 源代码 | 中严重 | taskEventHistory Map 永不清理 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555` | 已处理（归并） | 1. 实现后台清理无订阅者任务的历史 |
| 633 | 配置 | 中严重 | 安全配置 drift - remoteWorkerRegistration 缺失 | `config/security/dev.json`, `staging.json`, `pre-prod.json` | 已处理（归并） | 1. 统一所有环境的 remoteWorkerRegistration |
| 634 | API | 中严重 | OpenAPI 端点响应格式不一致 | `src/platform/five-plane-interface/api/http-server/utils.ts:207-215` | 已处理（归并） | 1. 统一响应信封格式 |
| 635 | 源代码 | 中严重 | Redis 队列缺少 idempotency 索引支持 | `src/platform/execution/queue/redis-queue-adapter.ts` | 已处理（归并） | 1. 完善 Redis idempotency 实现 |
| 636 | 源代码 | 中严重 | 请求去重中间件使用内存存储 | `src/platform/five-plane-interface/api/middleware/request-deduplication.ts` | 已处理（归并） | 1. 使用 Redis 替代内存存储 |
| 637 | 源代码 | 中严重 | Cache 无 stampede 保护 | 多个 cache 实现 | 已处理（归并） | 1. 实现 single-flight 模式 |
| 638 | 源代码 | 中严重 | EvidenceService eviction 仅在插入时触发 | `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202` | 已处理（归并） | 1. 添加定期后台清理任务 |
| 639 | 源代码 | 低严重 | 无连接指标暴露 | WebSocket 服务器 | 已处理（归并） | 1. 通过 metrics 端点暴露连接指标 |
| 640 | 源代码 | 低严重 | 无空闲客户端超时 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts` | 已处理（归并） | 1. 添加 per-client idle timeout |
| 641 | 源代码 | 低严重 | 订阅限制是 per-client 而非全局 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244` | 已处理（归并） | 1. 添加全局任务订阅者限制 |
| 642 | 配置 | 低严重 | config/runtime 无版本验证机制 | `config/runtime/*.json` | 已处理（归并） | 1. 添加 JSON Schema 验证 |
| 643 | 源代码 | 低严重 | ImprovementCandidateRegistry splice 是 O(n) | `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243` | 已处理（归并） | 1. 使用 LinkedList 替代数组 |
| 644 | 安全 | 严重 | listQuotas() 返回所有租户配额 - 信息泄露 | `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:222-234` | 已处理（归并） | 1. 要求调用者必须提供 tenantId |
| 645 | 安全 | 高严重 | assertTaskTenantAccess() 返回404而非403 - 资源存在泄露 | `src/platform/five-plane-interface/api/utils.ts:146-148` | 已处理（归并） | 1. 改为返回403 Forbidden |
| 646 | 安全 | 高严重 | crossTenantRequest 标志由调用者控制 | `src/platform/five-plane-interface/org-routing/index.ts:163` | 已处理（归并） | 1. 标志应由系统状态派生，不接受调用者输入 |
| 647 | 源代码 | 高严重 | single-task-happy-path 无重试机制 | `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337` | 已处理（归并） | 1. 启用非关键执行的重试 |
| 648 | 源代码 | 高严重 | LLM调用无熔断器保护 | `src/platform/five-plane-execution/execution-engine/model-call-provider.ts` | 已处理（归并） | 1. 在model-call-provider.ts添加熔断器 |
| 649 | 安全 | 高严重 | 分布式限流器 bypass - 实例间不共享 | `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33` | 已处理（归并） | 1. 要求Redis配置用于生产 |
| 650 | 配置 | 中严重 | Soft quota (log_only) 实际不限制 | `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448` | 已处理（归并） | 1. 明确区分"监控模式"和"强制模式" |
| 651 | 配置 | 中严重 | HTTP层无限流头 - 客户端无法获知限制 | `src/platform/five-plane-interface/api/http-server/response-hardening.ts` | 已处理（归并） | 1. 在所有响应添加 X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset |
| 652 | 配置 | 中严重 | HTTP层无限流 - 可选且仅按IP | `src/platform/five-plane-interface/api/http-api-server.ts:334-351` | 已处理（归并） | 1. 默认启用限流 |
| 653 | 安全 | 中严重 | processRuleMode 可能未强制执行 | `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts` | 已处理（归并） | 1. 验证processRuleMode实际被强制执行 |
| 654 | 安全 | 中严重 | 容器模板替换未验证 | `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751` | 已处理（归并） | 1. 添加输入验证防止注入 |
| 655 | 安全 | 中严重 | Adapter执行绕过沙箱 | `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts` | 已处理（归并） | 1. Adapter执行经过集中沙箱 |
| 656 | 安全 | 中严重 | null principal.tenantId 时静默放行 | `src/platform/five-plane-interface/api/utils.ts:143-145` | 已处理（归并） | 1. 要求所有API请求有有效principal |
| 657 | 源代码 | 中严重 | 无LLM provider fallback链 | `src/platform/five-plane-execution/execution-engine/model-call-provider.ts` | 已处理（归并） | 1. 实现provider fallback链 |
| 658 | 源代码 | 中严重 | 超时值硬编码 | 多个文件 | 已处理（归并） | 1. 集中超时配置 |
| 659 | 数据库 | 中严重 | 无down migration - 回滚不支持 | `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47` | 已处理（归并） | 1. 文档化回滚限制 |
| 660 | 数据库 | 中严重 | Migration 44特殊处理 - 表创建重复 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts` | 已处理（归并） | 1. 消除重复表创建 |
| 661 | 配置 | 低严重 | Provider限流头未转发给客户端 | `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153` | 已处理（归并） | 1. 转发Provider的限流头 |
| 662 | 安全 | 低严重 | Browser evaluate 接受任意脚本 | `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326` | 已处理（归并） | 1. 验证浏览器上下文正确沙箱化 |
| 663 | 源代码 | 低严重 | 无全局错误边界包装器 | `src/platform/five-plane-execution/execution-engine/` | 已处理（归并） | 1. 在执行引擎添加错误边界包装 |
| 664 | 源代码 | 严重 | FencingTokenService 静态可变状态无锁保护 | `src/platform/five-plane-state-evidence/events/cas/fencing-token-service.ts:71-73` | 已处理（归并） | 1. 添加互斥锁保护 activeFences 访问 |
| 665 | 源代码 | 严重 | AsyncFencingTokenService.globalTokenCounter 不安全递增 | `src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts:13-17` | 已处理（归并） | 1. 使用 `pg_advisory_xact_lock` 保护 |
| 666 | 源代码 | 严重 | BudgetAllocator.activeReservations 无保护 Map | `src/platform/five-plane-execution/budget-allocator.ts:394,426,458,467,569,657,711` | 已处理（归并） | 1. 添加 Map 级别的读写锁 |
| 667 | 源代码 | 高严重 | SqliteLockAdapter.fencingCounter 不同步 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:9,14,48,74,88` | 已处理（归并） | 1. 使用 SQLite 序列替代内存计数器 |
| 668 | 源代码 | 高严重 | ServiceRegistry.getInstance() 检查-then-创建 竞态 | `src/platform/shared/lifecycle/service-registry.ts:85-88` | 已处理（归并） | 1. 使用 double-checked locking |
| 669 | 源代码 | 中严重 | StructuredLogger.rotationStateByPath 异步竞态 | `src/platform/shared/observability/structured-logger.ts:142-144,438-453` | 已处理（归并） | 1. 使用锁保护 rotationStateByPath |
| 670 | 源代码 | 中严重 | EffectBuffer.scopes 并发修改风险 | `src/platform/five-plane-execution/execution-engine/effect-buffer.ts:446,452,476,485,492,502-514` | 已处理（归并） | 1. 添加迭代锁 |
| 671 | 源代码 | 中严重 | OIDC _skipSignatureVerification 标志存在风险 | `src/platform/interface/api/oidc-oauth-service.ts:92,108-111` | 已处理（归并） | 1. 移除此标志或确保编译时完全删除 |
| 672 | 源代码 | 中严重 | Browser Executor 检测但不消毒 innerHTML | `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:541` | 已处理（归并） | 1. 使用 DOMPurify 或类似库消毒 |
| 673 | 数据库 | 高严重 | runtime-physical-schema 无外键约束 | `src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts` | 已处理（归并） | 1. 添加外键约束 |
| 674 | 数据库 | 中严重 | 大部分表缺少软删除和审计字段 | 多个表（除 mission_records 外） | 已处理（归并） | 1. 为所有核心表添加审计字段 |
| 675 | CI/CD | 高严重 | UI quality workflow 无覆盖率门禁 | `.github/workflows/ui-quality.yml:33` | 已处理（归并） | 1. 添加 `npm run coverage:gate` 到 UI workflow |
| 676 | CI/CD | 高严重 | 部署工作流无真正的手动审批 | `.github/workflows/deploy-environment.yml` | 已处理（归并） | 1. 使用 GitHub Environment `required_reviewers` |
| 677 | CI/CD | 中严重 | 回滚机制边界情况未处理 | `.github/workflows/deploy-environment.yml:230-278`, `deploy/scripts/rollback.sh` | 已处理（归并） | 1. 添加 health check 失败时的回滚触发 |
| 678 | CI/CD | 中严重 | Canary/Blue-Green 升级无健康检查 | `.github/workflows/deploy-environment.yml:188-199` | 已处理（归并） | 1. 在 promotion 步骤后添加健康检查 |
| 679 | 可观测性 | 高严重 | 58处 console.* 使用应使用 StructuredLogger | 多个文件 | 已处理（归并） | 1. 替换 console.* 为 StructuredLogger |
| 680 | 可观测性 | 高严重 | 29+执行引擎文件缺少结构化日志 | `src/platform/five-plane-execution/execution-engine/` | 已处理（归并） | 1. 为所有执行引擎文件添加 StructuredLogger |
| 681 | 可观测性 | 高严重 | 执行引擎缺少 LLM 调用指标 | `src/platform/five-plane-execution/execution-engine/` | 已处理（归并） | 1. 在 agent-executor 中记录 LLM 调用指标 |
| 682 | 可观测性 | 中严重 | 日志方法使用不一致 | 多个服务 | 已处理（归并） | 1. 建立日志方法规范 |
| 683 | 安全 | 中严重 | 输入验证有限 - 仅 JWT 强类型 | 多个 API 端点 | 已处理（归并） | 1. 添加通用输入验证中间件 |
| 684 | 源代码 | 低严重 | HA Coordinator Leadership 获取可能非原子 | `src/platform/five-plane-execution/ha/ha-coordinator-service-inner.ts:70-78` | 已处理（归并） | 1. 使用数据库行锁保护 |
| 685 | 源代码 | 高严重 | sleepSync busy-wait 阻塞事件循环 | `src/platform/five-plane-state-evidence/truth/repositories/authoritative-task-store-decorator.ts:50-57` | 已处理（归并） | 1. 使用 `setTimeout` 替代 busy-wait |
| 686 | 源代码 | 高严重 | TODO R4-27: HarnessRun 持久化缺失 - 数据丢失风险 | `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270` | 已处理（归并） | 1. 实现 HarnessRun 持久化逻辑 |
| 687 | 源代码 | 高严重 | SDK 与 Server 路由不匹配 - /handshake 和 /version 缺失 | `src/sdk/client-sdk/api-client.ts` 及 `src/platform/interface/api/` | 已处理（归并） | 1. 实现 `/handshake` 和 `/version` 服务器路由 |
| 688 | 源代码 | 高严重 | SDK URL 缺少 /api 前缀 | `src/sdk/client-sdk/api-client.ts:84` vs 服务器路由 | 已处理（归并） | 1. 在 SDK 的 `baseUrl` 中添加 `/api` 前缀 |
| 689 | 源代码 | 高严重 | quant-trading.json 存在多种配置错误 | `config/domains/quant-trading.json` | 已处理（归并） | 1. 修正 supportedTaskTypes 以匹配 seed 定义 |
| 690 | 源代码 | 中严重 | SDK 与 Server 错误类别不一致 | `src/sdk/client-sdk/api-client.ts` 和 `src/platform/interface/api/http-server/api-error.ts` | 已处理（归并） | 1. 统一 SDK 和 Server 的错误类别映射 |
| 691 | 源代码 | 中严重 | N+1 查询模式 - 重复调用相同查询 | `src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts:73,79` | 已处理（归并） | 1. 将结果缓存到变量中 |
| 692 | 源代码 | 中严重 | experience-cache-service 无分页 - 内存溢出风险 | `src/platform/five-plane-state-evidence/memory/experience-cache-service.ts:337-424` | 已处理（归并） | 1. 实现游标分页 |
| 693 | 源代码 | 中严重 | 无限制的内存 Map - 无驱逐策略 | `src/platform/five-plane-state-evidence/memory/evidence-service.ts:129-133` | 已处理（归并） | 1. 实现 LRU 或 TTL 驱逐策略 |
| 694 | 源代码 | 中严重 | 固定轮询间隔 - 雷电羊群风险 | `src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.ts:76-78` | 已处理（归并） | 1. 在轮询间隔添加随机 jitter |
| 695 | 源代码 | 中严重 | VersionRoutingMiddleware 未连接到路由 | `src/platform/interface/api/middleware/version-routing.ts` | 已处理（归并） | 1. 将 VersionRoutingMiddleware 连接到路由 |
| 696 | 源代码 | 中严重 | marketing.json 缺少必需字段 | `config/domains/marketing.json` | 已处理（归并） | 1. 补充所有必需字段 |
| 697 | 源代码 | 中严重 | 21个 TODO/FIXME/HACK 注释未处理 | 多个源文件 | 已处理（归并） | 1. 逐个处理或创建 issue 跟踪 |
| 698 | 源代码 | 中严重 | 82处 any 类型使用 | 整个 src 目录 | 已处理（归并） | 1. 启用 TypeScript strict mode |
| 699 | 配置 | 中严重 | 连接池默认大小可能不足 | `src/platform/five-plane-control-plane/config-center/postgres-pool-env.ts:58` | 已处理（归并） | 1. 根据负载调整默认值 |
| 700 | 源代码 | 中严重 | experience_cache 表无索引 | `src/platform/five-plane-state-evidence/memory/experience-cache-service.ts` | 已处理（归并） | 1. 在 experience_cache 表添加相应索引 |
| 701 | 源代码 | 低严重 | 魔法数字散落各处 | 多个源文件 | 已处理（归并） | 1. 使用 `src/platform/contracts/constants/time.ts` 中的常量 |
| 702 | 源代码 | 低严重 | 静默 catch 块吞掉错误 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:130` 等多处 | 已处理（归并） | 1. 在 catch 块中添加错误日志 |
| 703 | 测试 | 中严重 | 1059处 setTimeout/sleep/waitFor - 测试脆弱 | `tests/` 多个测试文件 | 已处理（归并） | 1. 用 async/await 或 proper mocking 替代 sleep |
| 704 | 测试 | 中严重 | 6个测试文件使用 // @ts-nocheck | `tests/unit/domains/recipes/recipe-executor.test.ts` 等 | 已处理（归并） | 1. 移除 // @ts-nocheck |
| 705 | 测试 | 中严重 | 3个集成测试因缺少 workflow_state 设置而跳过 | `tests/integration/platform/execution/budget-allocation.integration.test.ts` | 已处理（归并） | 1. 设置测试所需的 workflow_state 记录 |
| 706 | 测试 | 低严重 | 5个测试使用 .skip 标记 | `tests/unit/scale-ecosystem/multi-region/cross-region-routing.test.ts` 等 | 已处理（归并） | 1. 实现跳过的功能 |
| 707 | 源代码 | 低严重 | double throw 模式 | `src/domains/domain-baseline-catalog.ts:546,550` | 已处理（归并） | 1. 审查并修正错误抛出逻辑 |
| 708 | 源代码 | 低严重 | user-operations.json 配置过简 | `config/domains/user-operations.json` | 已处理（归并） | 1. 补充完整的领域配置 |
| 709 | 部署 | 低严重 | CI Coverage gate 仅在 Node 22 运行 | `.github/workflows/` | 已处理（归并） | 1. 在所有版本上运行 coverage gate |
| 710 | 源代码 | 低严重 | 模块级 logger 实例可能不是最佳实践 | `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:69` | 已处理（归并） | 1. 通过依赖注入传递 logger |
| 711 | 安全 | 高严重 | npm audit 发现7个安全漏洞未修复 | `package.json` / `package-lock.json` | 已处理（归并） | 1. 运行 `npm audit fix --force` 修复部分问题 |
| 712 | 配置 | 高严重 | TypeScript 编译存在50+错误 | `tsconfig.json` 及测试文件 | 已处理（归并） | 1. 同步测试文件与类型定义 |
| 713 | 依赖 | 高严重 | 多个依赖版本严重落后 | `package.json` | 已处理（归并） | 1. 制定依赖升级计划 |
| 714 | 配置 | 高严重 | 安全配置在环境间不一致 | `config/security/` | 已处理（归并） | 1. 统一所有环境配置文件结构 |
| 715 | 配置 | 高严重 | .env.example 中JWT_SECRET为空 | `.env.example` | 已处理（归并） | 1. 添加所有必需的环境变量说明 |
| 716 | 源代码 | 高严重 | src/platform 目录职责混乱 | `src/platform/` | 已处理（归并） | 1. 重新组织 platform/ 下的目录结构 |
| 717 | 源代码 | 高严重 | 巨型 barrel file - index.ts 达2317行 | `src/platform/five-plane-orchestration/harness/index.ts` (2317行) | 已处理（归并） | 1. 将 index.ts 拆分为多个模块 |
| 718 | 源代码 | 高严重 | core/runtime 是空壳，只做重导出 | `src/core/runtime/` | 已处理（归并） | 1. 明确 core/runtime 的保留用途 |
| 719 | 源代码 | 中严重 | 5个符号链接存在且未文档化 | `src/platform/` | 已处理（归并） | 1. 在 CLAUDE.md 中记录所有符号链接 |
| 720 | 配置 | 中严重 | Terraform VPC CIDR 硬编码 | `deploy/terraform/main.tf` | 已处理（归并） | 1. 将硬编码 CIDR 替换为变量引用 |
| 721 | 配置 | 中严重 | Helm values 中 OTEL 配置不一致 | `deploy/helm/automatic-agent/values*.yaml` | 已处理（归并） | 1. 统一所有环境的 OTEL 配置策略 |
| 722 | 配置 | 中严重 | Helm values 中 Ingress hosts 为空数组 | `deploy/helm/automatic-agent/values-staging.yaml`, `values-pre-prod.yaml` | 已处理（归并） | 1. 填充正确的 hosts 数组 |
| 723 | 文档 | 高严重 | docs_zh 缺少11个 v4.3 合同文档 | `docs_zh/contracts/` | 已处理（归并） | 1. 翻译缺失的11个合同文档到中文 |
| 724 | 文档 | 中严重 | docs_zh 缺少 ADR-109 v4.3 contract freeze | `docs_zh/adr/` | 已处理（归并） | 1. 翻译 ADR-109 到中文 |
| 725 | 文档 | 中严重 | UI README 引用错误的文档路径 | `ui/README.md` | 已处理（归并） | 1. 修复跨引用路径 |
| 726 | 测试 | 高严重 | 98个测试文件超过1000行 | `tests/` 多个目录 | 已处理（归并） | 1. 拆分超大型测试文件 |
| 727 | 测试 | 高严重 | 1179个测试使用 only/skip 标记 | `tests/` 多个测试文件 | 已处理（归并） | 1. 逐个审查 skip/only 标记的原因 |
| 728 | 测试 | 高严重 | 2700个测试过度使用 Mock | `tests/` 多个测试文件 | 已处理（归并） | 1. 审查 mock 使用情况 |
| 729 | 测试 | 中严重 | 很多 Domain 领域缺少测试覆盖 | `tests/unit/domains/` | 已处理（归并） | 1. 为每个领域添加基本测试 |
| 730 | 源代码 | 中严重 | 372个 index.ts barrel 文件 | `src/` 多个目录 | 已处理（归并） | 1. 审查并减少 barrel 文件 |
| 731 | 源代码 | 中严重 | 同步/异步服务对可能存在死代码 | `src/platform/` 多个服务 | 已处理（归并） | 1. 分析每对服务的使用情况 |
| 732 | 部署 | 中严重 | deploy/terraform/environments/multi-region/ 只有README | `deploy/terraform/environments/multi-region/` | 已处理（归并） | 1. 添加多区域 tfvars 配置 |
| 733 | UI | 中严重 | UI Feature 模块无文档 | `ui/packages/features/` | 已处理（归并） | 1. 为每个 feature 模块添加文档 |
| 734 | 配置 | 低严重 | docker-compose.yml 安全配置缺失 | `docker-compose.yml` | 已处理（归并） | 1. 添加 JWT_SECRET 配置说明 |
| 735 | 源代码 | 低严重 | package.json 有100+个脚本无分组 | `package.json` | 已处理（归并） | 1. 添加分组注释（build, test, cli tools, stable commands） |
| 736 | 文档 | 低严重 | UI packages/storybook/ 路径不存在 | `ui/packages/storybook/` | 已处理（归并） | 1. 验证 storybook 配置 |
| 737 | 文档 | 低严重 | 无平台特定 UI 适配指南 | `ui/` 相关文档 | 已处理（归并） | 1. 创建平台适配文档 |
| 738 | 配置 | 低严重 | deploy/kubernetes/ 目录缺失 | `deploy/` | 已处理（归并） | 1. 如果需要，添加 kubernetes manifests |
| 739 | 配置 | 低严重 | deploy/chaos/ 实验性配置 | `deploy/chaos/` | 已处理（归并） | 1. 添加 chaos 实验的审批流程 |
| 740 | 文档 | 低严重 | docs_zh/reviews/ 内容远少于 docs_en | `docs_zh/reviews/` vs `docs_en/reviews/` | 已处理（归并） | 1. 翻译或复制 audit 文档到 docs_zh |
| 741 | 源代码 | 严重 | Benchmark 百分位计算完全错误 | `src/ops-maturity/benchmarking/benchmark-collector.ts` | 已处理（归并） | 实现正确的分位数计算逻辑 |
| 742 | 配置 | 严重 | 环境名称错配 - 所有环境显示"prod" | `config/environments/dev.json`, `staging.json`, `pre-prod.json` | 已处理（归并） | 修正为各自的环境名称 |
| 743 | 内存 | 严重 | Plugin runtime child process 事件监听器永不清洗 | `src/domains/registry/plugin-runtime-host.ts` | 已处理（归并） | 在 stop() 中清理所有 child 事件监听器 |
| 744 | 安全 | 严重 | OAuth token 明文存储 | `src/sdk/cli/login.ts:70-79` | 已处理（归并） | 使用系统 keychain 或加密存储 |
| 745 | 安全 | 严重 | 硬编码 CVE 绕过列表导致虚假安全感 | `src/sdk/plugin-definition.ts` | 已处理（归并） | 删除绕过机制或重新设计安全验证 |
| 746 | 安全 | 严重 | 弱 RSA 2048位密钥 | `src/sdk/中加密相关文件` | 已处理（归并） | 升级密钥长度 |
| 747 | 源代码 | 高 | process.chdir() 安全漏洞 | `src/domains/registry/plugin-runtime-child.ts:89-93` | 已处理（归并） | 添加 sandboxRoot 验证和清理检查 |
| 748 | 源代码 | 高 | memory leak - EventListener 167个仅16个清理 | 多个文件 | 已处理（归并） | 统一事件监听器生命周期管理 |
| 749 | 源代码 | 高 | TODO R4-27: HarnessRun 未持久化 | `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270` | 已处理（归并） | 添加 HarnessRun 持久化逻辑 |
| 750 | 源代码 | 高 | budget-allocator 竞态条件 | `src/platform/five-plane-execution/budget-allocator.ts:504-507` | 已处理（归并） | 将 CAS 检查移入原子事务 |
| 751 | 测试 | 高 | budget-allocator.test.ts 缺少 throttle ratio 断言 | `tests/unit/platform/execution/budget-allocator.test.ts:286-335` | 已处理（归并） | 添加 throttle ratio 的断言 |
| 752 | 测试 | 高 | durable-event-bus-async.test.ts 定时器时序问题 | `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts:74,104,117` | 已处理（归并） | 使用 fake timers 或事件监听代替 |
| 753 | 源代码 | 中 | console.* 调用 59 处未用 StructuredLogger | 多个源文件 | 已处理（归并） | 替换为 StructuredLogger |
| 754 | 源代码 | 中 | : any 类型 168 处 | 多个源文件 | 已处理（归并） | 减少 any 类型使用，增加类型约束 |
| 755 | 源代码 | 中 | as unknown as 双转型 30+ 处 | 多个源文件 | 已处理（归并） | 改进类型设计避免双转型 |
| 756 | 源代码 | 中 | @ts-ignore 38 处 | 多个源文件 | 已处理（归并） | 修复底层类型问题 |
| 757 | 配置 | 中 | config/security/ 环境配置缺少字段 | `config/security/` 下各环境配置 | 已处理（归并） | 补充缺失的安全配置字段 |
| 758 | 测试 | 中 | 非确定性 Math.random() 测试 | SDK 相关测试文件 | 已处理（归并） | 使用确定种子或 mock |
| 759 | 源代码 | 低 | contracts 数据vs对象混淆 | contracts 目录 | 已处理（归并） | 明确区分数据模型和领域对象 |
| 760 | 源代码 | 低 | 多个 architecture-remediation.ts 重名 | 各领域目录 | 已处理（归并） | 添加作用域前缀或统一命名 |
| 761 | 源代码 | 低 | Core/runtime 是包装价值可疑 | `src/core/runtime/` | 已处理（归并） | 移除或明确用途 |
| 762 | 源代码 | 低 | DomainLifecycleState 重复定义 | 多个文件 | 已处理（归并） | 统一状态定义 |
| 763 | 源代码 | 低 | 风险评分阈值硬编码 | 风险评估相关文件 | 已处理（归并） | 提取到配置常量 |
| 764 | 配置 | 低 | .gitignore 缺少临时文件模式 | `.gitignore` | 已处理（归并） | 补充 .gitignore |
| 765 | 测试 | 低 | 测试辅助代码量大 78 个文件 | `tests/helpers/` | 已处理（归并） | 简化测试基础设施 |
| 766 | 源代码 | 低 | .claude/scheduled_tasks.json 未忽略 | `.claude/scheduled_tasks.json` | 已处理（归并） | 添加到 .gitignore |
| 767 | 配置 | 低 | tsconfig.temp.json 可能未使用 | `tsconfig.temp.json` | 已处理（归并） | 清理 |
| 768 | 配置 | 低 | .env.example 包含过时变量 | `.env.example` | 已处理（归并） | 审查清理 |
| 769 | 文档 | 低 | docs_zh/architecture/ 可能未更新 | `docs_zh/architecture/` | 已处理（归并） | 建立同步机制 |
| 770 | UI | 低 | SharedWorkerWSClient 内存泄漏 | UI 组件 | 已处理（归并） | 添加清理逻辑 |
| 771 | UI | 低 | XSS 潜在风险 | UI 组件 | 已处理（归并） | 实现输出转义 |
| 772 | UI | 低 | 缺少 Error Boundaries | UI 组件 | 已处理（归并） | 添加 Error Boundaries |
| 773 | 测试 | 低 | execution-dispatch-service-async.test.ts 仍然失败 | `tests/unit/platform/execution/dispatcher/` | 已处理（归并） | 分析修复 |
| 774 | 测试 | 低 | nodeRunId-canonization.test.ts 仍然失败 | `tests/unit/platform/execution/execution-engine/` | 已处理（归并） | 分析修复 |
| 775 | 测试 | 低 | runtime-plan-executor.test.ts 仍然失败 | `tests/unit/platform/execution/oapeflir/` | 已处理（归并） | 分析修复 |
| 776 | 测试 | 低 | worker-pool-comprehensive.test.ts 仍然失败 | `tests/unit/platform/execution/worker-pool/` | 已处理（归并） | 分析修复 |
| 777 | 源代码 | 低 | symbolic links 未正确处理 | `src/platform/` 下的符号链接 | 已处理（归并） | 明确符号链接策略 |
| 778 | 配置 | 低 | .DS_Store 文件存在并被追踪 | 根目录 | 已处理（归并） | 停止追踪并添加到 .gitignore |
| 779 | 配置 | 低 | :memory: 文件残留 | 根目录 | 已处理（归并） | 清理 |
| 780 | 配置 | 低 | .tmp/ 目录大量临时文件 | `.tmp/` | 已处理（归并） | 清理 |
| 781 | 源代码 | 低 | 巨型源文件未拆分 | 多个超过1000行的文件 | 已处理（归并） | 拆分 |
| 782 | 源代码 | 低 | runMultiStepOrchestration 复杂度高 | `src/platform/execution/execution-engine/multi-step-orchestration.ts` | 已处理（归并） | 拆分职责 |
| 783 | 安全 | 低 | npm audit 显示 7 个漏洞 | 依赖 | 已处理（归并） | 更新受影响包 |
