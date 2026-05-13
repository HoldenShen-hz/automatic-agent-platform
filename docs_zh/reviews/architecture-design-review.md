# Architecture Design Review

**Review Date**: 2026/05/13
**Reviewer**: Automated Code Review
**Scope**: src, tests, ui, docs_zh, config, scripts

---

## 1. 代码质量和架构问题

### 1.1 项目结构概览
- **总源文件数**: 6,113 个 TypeScript 文件
- **运行时核心**: `src/platform/` 包含五层架构 (interface, control-plane, orchestration, execution, state-evidence)
- **上层业务**: `src/domains/` (34个领域), `src/interaction/`, `src/org-governance/`, `src/ops-maturity/`, `src/scale-ecosystem/`

### 1.2 架构观察

**优点**:
- 清晰的五层平台架构分离 (docs_zh/architecture/00-platform-architecture.md)
- 151个契约文档覆盖关键系统边界 (docs_zh/contracts/)
- 使用ESM模块系统和严格的TypeScript配置 (`"strict": true`, `noImplicitOverride`, `exactOptionalPropertyTypes`)
- 分散式领域架构允许独立扩展

**问题**:
1. **符号链接使用**: `src/platform/` 下存在多个符号链接 (`control-plane -> five-plane-control-plane`, `execution -> five-plane-execution` 等)，这可能导致:
   - IDE和工具的路径解析问题
   - Git历史追踪困难
   - 构建配置复杂化

2. **core/runtime 警告**: CLAUDE.md 明确指出 `src/core/runtime/` 是兼容性目录，不应添加新的规范运行时逻辑。但项目仍在使用，需要清理或重构。

3. **配置分散**: 配置分散在多个位置:
   - `config/` (主配置)
   - `.env.example` (环境变量模板)
   - `config/environments/` (dev/staging/prod等)
   - `config/security/` (安全配置)

4. **类型安全**: TypeScript配置中 `noUncheckedIndexedAccess: true` 和 `exactOptionalPropertyTypes: true` 已启用，这是好的实践。

### 1.3 代码组织问题

**过长的import语句**: 查看源文件发现大量deep import，例如:
```typescript
import { BudgetAllocator } from "../../../../src/platform/execution/budget-allocator.js";
```
应优先使用包导出 (`import { BudgetAllocator } from "@automatic-agent/platform/execution"`)

**测试文件与源文件比例**: 排除的测试文件列表过长 (在tsconfig.json的exclude中)，表明可能存在:
- 测试并行化问题
- 测试污染问题
- 循环依赖问题

---

## 2. 测试覆盖情况

### 2.1 测试统计
| 类型 | 数量 |
|------|------|
| 单元测试文件 | 3,584 |
| 集成测试文件 | 134 |
| E2E测试文件 | 834 |
| 源码文件 | 6,113 |

### 2.2 测试组织
```
tests/
├── unit/           # 单元测试 (87个子目录)
├── integration/    # 集成测试 (42个子目录)
├── e2e/           # E2E测试 (332个子目录)
├── golden/        # 金丝雀测试 (48个)
├── invariants/    # 不变式测试 (87个)
├── helpers/       # 测试辅助 (78个)
├── performance/  # 性能测试 (58个)
```

### 2.3 问题观察

**问题**:
1. **单元测试与源码比例异常**: 3,584个单元测试文件 vs 6,113个源文件，比例约0.59:1。可能存在:
   - 大量测试文件未被正确计数
   - 某些源文件没有对应测试
   - 测试文件过度拆分

2. **tsconfig.json exclude列表过长**: 排除了大量测试文件，表明:
   - 某些测试可能处于不稳定状态
   - 或存在循环依赖问题
   - 测试基础设施可能需要修复

3. **测试辅助代码量大**: 78个helpers文件说明测试基础设施复杂，可能表明:
   - 被测代码耦合度高
   - 测试设置复杂
   - Mock对象管理困难

4. **Golden测试**: 48个golden文件用于回归测试，这是良好实践。

---

## 3. 文档完整性

### 3.1 文档结构
```
docs_zh/
├── architecture/     # 架构文档 (728KB 00-platform-architecture.md)
├── contracts/        # 151个契约文档
├── adr/             # 架构决策记录
├── domains/         # 领域文档
├── guides/          # 快速入门、贡献指南等
├── operations/      # 运维文档 (runbook等)
├── reviews/         # 本次review位置
└── quality/         # 质量文档
```

### 3.2 文档观察

**优点**:
- 详尽的架构文档 (00-platform-architecture.md 728KB)
- 完整的契约文档集 (151个)
- ADR决策记录完整
- 运维文档包含runbook和检查清单

**问题**:
1. **文档版本控制**: 未明确看到API版本控制策略文档
2. **CHANGELOG.md**: 存在但大小仅6KB，相对较小，可能记录不完整
3. **跨语言文档**: docs_zh/ 和 docs_en/ 并存，需要确保同步
4. **CLAUDE.md**: 存在且包含有用信息，但可考虑增加更多示例

---

## 4. 配置问题

### 4.1 配置结构
```
config/
├── environments/    # dev.json, staging.json, prod.json等
├── security/       # 安全配置 (default.json, threat-matrix.json)
├── ...其他配置文件
```

### 4.2 安全配置
- `config/security/default.json`: 定义了approvalMode, sandboxMode等安全策略
- `config/security/threat-matrix.json`: STRIDE威胁矩阵完整
- JWT secret要求在生产环境必须配置

### 4.3 问题观察

1. **环境配置差异**: 检查发现 `config/security/dev.json` 和 `config/security/test.json` 内容相同 (都是`{}`)，但生产配置有实际内容。

2. **.env.example完整性**: `.env.example` 文件非常详尽 (8KB)，这是好的实践，但需要注意:
   - 包含大量注释说明
   - 生产环境需要填充真实值

3. **配置验证**: 未在代码库中看到明确的配置验证机制 (除了schema validation mentioned in threat-matrix)

4. **敏感信息**: 配置文件中的敏感信息处理需要确认是否通过环境变量注入

---

## 5. Bash脚本问题

### 5.1 脚本列表
```
scripts/
├── backup-sqlite.sh       # SQLite备份
├── restore-sqlite.sh     # SQLite恢复
├── ci/                   # CI脚本
│   ├── check-changelog.mjs
│   ├── check-coverage-baseline.mjs
│   ├── coverage-lib.mjs
│   ├── generate-coverage-report.mjs
│   ├── mutation-critical-tests.sh
│   └── update-coverage-baseline.mjs
├── clean-dist.mjs
├── generate-src-module-test-matrix.mjs
├── reorg-code-structure.mjs
├── run-curated-tests.mjs
├── run-layered-tests.mjs
└── run-tracked-tests.mjs
```

### 5.2 脚本质量观察

**backup-sqlite.sh 优点**:
- 使用 `set -euo pipefail` 正确处理错误
- 有PID锁文件防止并发运行
- 备份后验证完整性
- 清理过期备份

**restore-sqlite.sh 优点**:
- 创建预恢复快照
- 恢复前验证备份完整性
- 错误处理完善

**问题**:
1. **脚本位置**: 部分脚本在 `scripts/` 根目录，部分在 `scripts/ci/`，组织稍显混乱
2. **Python脚本**: 存在 `translate_docs.py` (10KB)，需要确认是否需要维护
3. **mjs vs sh**: 混用 `.mjs` (Node.js ESM) 和 `.sh` (Bash)，需要确认团队技能匹配

---

## 6. 安全问题

### 6.1 安全配置
- **JWT Secret**: 必须配置，用于API认证
- **MCP策略**: `config/security/default.json` 定义了MCP (Model Context Protocol) 策略
- **沙箱模式**: read_only 模式限制工具权限
- **远程Worker注册**: 使用challenge-based认证

### 6.2 威胁矩阵覆盖
STRIDE模型覆盖:
- **Spoofing**: JWT和workspace身份验证, challenge-based worker注册
- **Tampering**: 审计哈希链, 只追加事件证据, 配置schema验证
- **Repudiation**: 操作员行为审计证据, 事件时间线导出
- **Information Disclosure**: 字段加密, 网络出口策略, 内存加密
- **Denial of Service**: SLO告警, runbook引导的containment, rollout freeze gates
- **Elevation of Privilege**: 沙箱策略执行, 策略引擎能力检查

### 6.3 安全观察

**优点**:
- 完整的安全配置和威胁矩阵
- 内存隔离按workspace/session
- 配置更改审计日志

**问题**:
1. **Secret管理**: `.env.example` 中 `AA_API_JWT_SECRET=` 为空，生产必须配置，但:
   - 未看到secret轮换策略文档
   - 未看到secret存储方案 (应使用Vault/KMS等)

2. **MCP安全**: MCP策略允许 `allowedCapabilities: ["edit", "mcp"]`，需要确保:
   - 网络隔离配置正确
   - 传输层只允许stdio

3. **数据库凭证**: PostgreSQL DSN在环境变量中，需要确保:
   - 不是硬编码
   - 有安全的注入机制

4. **加密密钥**: 内存加密密钥管理未在代码中明确看到

---

## 7. UI代码审查

### 7.1 UI结构
```
ui/
├── apps/
├── packages/
├── tests/
├── .storybook/
├── eslint.config.js
├── lighthouserc.json
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

### 7.2 UI观察
- 使用TypeScript + Playwright进行E2E测试
- Storybook用于组件开发
- 独立的lighthouserc.json进行性能监控
- 独立包管理 (有自己的node_modules)

**问题**:
1. **UI与主项目分离**: UI有自己的package.json，表明可能需要独立部署
2. **测试配置**: Playwright配置存在，但需要确认CI中是否运行

---

## 8. 部署和基础设施

### 8.1 部署配置
```
deploy/
├── chaos/
├── grafana/
├── helm/
├── prometheus/
├── runbooks/
├── scripts/
└── terraform/
```

### 8.2 容器化
- `Dockerfile` 存在
- `docker-compose.yml` 存在 (3.2KB)
- `.dockerignore` 存在

---

## 9. 总结与建议

### 9.1 高优先级
1. **清理符号链接**: `src/platform/` 下的符号链接应转换为实际模块或移除
2. **Secret管理**: 建立正式的secret管理机制和轮换策略
3. **测试稳定性**: tsconfig.json中排除的大量测试文件应被修复或标记为已知问题
4. **core/runtime清理**: 按CLAUDE.md指示，清理或重构 `src/core/runtime/`

### 9.2 中优先级
1. **文档同步**: 确保 docs_zh 和 docs_en 内容同步
2. **配置验证**: 增加启动时配置验证
3. **测试基础设施**: 考虑简化78个测试helpers
4. **CI脚本组织**: 统一scripts目录结构

### 9.3 低优先级
1. **Python脚本维护**: 检查 `translate_docs.py` 是否需要
2. **UI独立部署**: 确认UI服务架构
3. **CHANGELOG完善**: 增加更多变更细节

---

## 2026/05/14 自动Review报告 (详细补充)

### 发现的问题

#### 1. [源代码] [高严重] [符号链接导致构建不一致]
- **文件/路径**: `src/platform/` 目录下的5个符号链接
- **问题描述**: `control-plane`, `execution`, `state-evidence`, `orchestration`, `interface` 均为符号链接指向 `five-plane-*` 目录。这导致：
  1. TypeScript 编译器路径解析可能不一致
  2. IDE 代码跳转和自动完成可能失效
  3. Git 历史追踪困难（无法追踪哪个文件实际被修改）
  4. 符号链接可能在不同操作系统或文件系统上表现不同
  5. 构建产物路径可能与源码路径不匹配
- **建议修复**: 将符号链接转换为实际目录或通过构建工具创建虚拟模块映射

#### 2. [源代码] [中严重] [巨型单文件问题]
- **文件/路径**: 
  - `src/platform/five-plane-execution/budget-allocator.ts` (931行)
  - `src/platform/five-plane-execution/runtime-state-machine.ts` (690行)
  - `src/platform/five-plane-state-evidence/events/durable-event-bus.ts` (1214行)
- **问题描述**: 多个核心模块文件行数过多，违反单一职责原则。这些文件包含过多功能：
  - `budget-allocator.ts`: 预算分配逻辑复杂，包含多个嵌套类型
  - `runtime-state-machine.ts`: 状态机实现过长
  - `durable-event-bus.ts`: 事件总线实现过于庞大
- **建议修复**: 将这些文件拆分为多个小模块，例如：
  - `budget-allocator/` 目录包含多个相关文件
  - `runtime-state-machine/` 目录包含状态转换、命令处理等
  - `durable-event-bus/` 目录包含消费者、投递、重试等子模块

#### 3. [源代码] [中严重] [tsconfig.json exclude列表过长]
- **文件/路径**: `tsconfig.json` exclude 部分
- **问题描述**: 排除了约80个测试文件和目录，包括：
  - 大量 `*.extended.test.ts` 文件
  - 整个 `tests/unit/platform/execution/**/*.test.ts` 目录
  - 整个 `tests/integration/platform/orchestration/**/*.test.ts` 目录
  - 多个 `tests/e2e/*.test.ts` 文件
  - 多个 `tests/unit/interaction/**/*.test.ts`, `tests/unit/ops-maturity/**/*.test.ts` 等
- **建议修复**: 调查这些测试被排除的根本原因：
  1. 如果是测试不稳定（flaky），应标记并修复
  2. 如果是循环依赖，应重构代码结构
  3. 如果是故意排除的扩展测试，应创建单独的 tsconfig 文件
  4. 如果是测试污染问题，应使用工作区隔离

#### 4. [源代码] [中严重] [core/runtime 兼容性目录未清理]
- **文件/路径**: `src/core/runtime/`
- **问题描述**: CLAUDE.md 明确指出 `src/core/runtime/` 是兼容性目录，不应添加新的规范运行时逻辑。但目录结构仍然存在，且与新的五层架构并行运行，可能导致维护困难和混淆
- **建议修复**: 
  1. 评估 `core/runtime` 中的代码是否已迁移到 `five-plane-*` 目录
  2. 如果已迁移，删除 `core/runtime` 目录
  3. 如果未迁移，制定迁移计划

#### 5. [源代码] [低严重] [直接使用console而非结构化日志]
- **文件/路径**: 约26个源文件直接使用 `console.log/debug/info/warn/error`
- **问题描述**: 项目定义了 `StructuredLogger` (`src/platform/shared/observability/structured-logger.ts`)，但仍有26个文件直接使用 console 方法，不利于日志集中管理和查询
- **建议修复**: 将所有 `console.*` 调用替换为 `StructuredLogger`

#### 6. [源代码] [低严重] [过深的import路径]
- **文件/路径**: 多个源文件
- **问题描述**: 发现类似 `../../../../src/platform/execution/budget-allocator.js` 的深层相对导入，这种写法：
  1. 暴露内部结构
  2. 使重构困难
  3. 与 package exports 导出方式不一致
- **建议修复**: 使用包导出方式 `import { BudgetAllocator } from "@automatic-agent/platform/execution"`

#### 7. [源代码] [中严重] [缺少包导出的barrel文件]
- **文件/路径**: `src/platform/` 各子目录
- **问题描述**: 虽然 `package.json` 定义了 exports 映射，但实际目录中某些 index.ts 为空或内容不完整。例如 `src/platform/five-plane-execution/` 的 index.ts 只有简单导出，缺少主要模块的重新导出
- **建议修复**: 确保每个模块的 index.ts 正确导出所有公共 API

#### 8. [源代码] [低严重] [TODO/FIXME/HACK注释未处理]
- **文件/路径**: 至少12个文件包含 TODO/FIXME/HACK/XXX 注释
- **问题描述**: 以下文件包含未完成的标记注释：
  - `src/domains/registry/plugin-spi.ts`
  - `src/org-governance/delegated-governance/governance-console-service.ts`
  - `src/sdk/plugin-sdk/plugin-test-harness.ts`
  - `src/platform/five-plane-interface/api/mission-control-service.ts`
  - `src/platform/five-plane-state-evidence/memory/trust-level-service.ts`
  - `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts`
  - 以及其他6个文件
- **建议修复**: 
  1. 将 TODO 转换为 issue tracker 中的任务
  2. 或创建代码任务（code task）跟踪
  3. 设置 lint 规则检查这些标记

#### 9. [测试] [高严重] [测试覆盖率分布不均]
- **文件/路径**: `tests/unit/platform/execution/` (整个目录被exclude)
- **问题描述**: 
  - `tests/unit/platform/execution/` 目录被完全排除在 TypeScript 编译之外
  - 包含 budget-allocator、dispatcher、execution-engine 等核心功能的测试
  - 这意味着这些关键路径没有 CI 级别的测试保护
- **建议修复**: 修复或重新启用这些测试

#### 10. [测试] [高严重] [大量集成测试被排除]
- **文件/路径**: 多个 `tests/integration/**` 目录
- **问题描述**: 以下集成测试目录被排除：
  - `tests/integration/platform/orchestration/**/*.test.ts`
  - `tests/integration/platform/execution/**/*.test.ts`
  - `tests/integration/platform/control-plane/**/*.test.ts`
  - `tests/integration/platform/interface/**/*.test.ts`
  - `tests/integration/platform/model-gateway/**/*.test.ts`
  - `tests/integration/platform/security/**/*.test.ts`
  - `tests/integration/platform/shared/cache/**/*.test.ts`
  - `tests/integration/platform/shared/stability/**/*.test.ts`
  - `tests/integration/platform/state-evidence/events/**/*.test.ts`
  - `tests/integration/platform/state-evidence/knowledge/**/*.test.ts`
  - `tests/integration/platform/state-evidence/memory/**/*.test.ts`
  - `tests/integration/domains/governance/**/*.test.ts`
  - `tests/integration/interaction/**/*.test.ts`
  - `tests/integration/org-governance/**/*.test.ts`
  - `tests/integration/sdk/cli/billing-cli.test.ts`
- **建议修复**: 这是巨大的测试覆盖缺口，需要逐个调查被排除原因并修复

#### 11. [测试] [中严重] [E2E测试被排除]
- **文件/路径**: 多个 E2E 测试文件
- **问题描述**: 以下 E2E 测试被排除：
  - `tests/e2e/execution-ticket-lifecycle.test.ts`
  - `tests/e2e/multi-region-failover.test.ts`
  - `tests/e2e/task-status-lifecycle.test.ts`
  - `tests/e2e/workflow-state-transitions.test.ts`
  - `tests/e2e/workflow-timeout-flow.test.ts`
- **建议修复**: 这些是核心工作流测试，应确保它们在 CI 中运行

#### 12. [测试] [中严重] [测试helpers过多]
- **文件/路径**: `tests/helpers/` (78个文件)
- **问题描述**: 
  - 78个测试辅助文件说明测试基础设施复杂
  - 可能表明被测代码耦合度高
  - Mock对象管理困难
  - 需要大量 setup/teardown 代码
- **建议修复**: 
  1. 评估这些 helpers 是否可以合并或简化
  2. 考虑在源码中引入更多可测试性的设计
  3. 检查是否有重复的 helper 功能

#### 13. [测试] [中严重] [Golden测试文件数量少]
- **文件/路径**: `tests/golden/` (48个)
- **问题描述**: 相对于 6113 个源文件和大量功能模块，只有 48 个 golden 测试文件可能不足以覆盖回归风险
- **建议修复**: 增加更多 golden 测试覆盖关键路径

#### 14. [配置] [中严重] [安全配置环境差异]
- **文件/路径**: `config/security/` 目录
- **问题描述**: 
  - `dev.json` 和 `test.json` 内容不同（dev 有 `approvalMode: strict`，test 为空 `{}`）
  - 这种差异可能导致开发环境行为与测试环境不一致
  - 生产配置 `prod.json` 和预生产 `pre-prod.json` 内容相同，都是 `approvalMode: supervised`
- **建议修复**: 明确每个环境的配置策略，确保测试环境能真实反映生产行为

#### 15. [配置] [高严重] [.env.example中敏感字段为空]
- **文件/路径**: `.env.example`
- **问题描述**: 
  - `AA_API_JWT_SECRET=` 为空，生产必须配置
  - 数据库连接字符串可能包含敏感信息
  - 虽然 `.env.example` 说明不要提交真实凭证，但缺少secret管理指引
- **建议修复**: 
  1. 在 `.env.example` 中添加 secret 管理指引注释
  2. 创建 `config/secrets/` 目录结构示例（不包含真实值）
  3. 文档化 secret 轮换策略

#### 16. [配置] [低严重] [配置验证机制缺失]
- **文件/路径**: 全局配置
- **问题描述**: 未在代码库中看到明确的配置验证机制（除了 schema validation in threat-matrix）
- **建议修复**: 在应用启动时添加配置验证步骤，确保所有必需配置都已填充

#### 17. [文档] [中严重] [docs_zh与docs_en同步问题]
- **文件/路径**: `docs_zh/` 和 `docs_en/`
- **问题描述**: 两个文档目录并列存在，需要确保内容同步。但未看到同步机制或自动化检查
- **建议修复**: 
  1. 创建文档同步检查的 CI 流程
  2. 或明确文档翻译流程和责任人
  3. 考虑使用自动化翻译工具

#### 18. [文档] [低严重] [CHANGELOG过小]
- **文件/路径**: `CHANGELOG.md` (仅6KB)
- **问题描述**: 相对于项目规模（6000+源文件，151个契约），CHANGELOG 仅6KB可能记录不完整
- **建议修复**: 增加更详细的变更记录，包括：
  1. 每个版本的变更描述
  2. 破坏性变更说明
  3. 迁移指南

#### 19. [文档] [中严重] [架构文档与实现不一致]
- **文件/路径**: `docs_zh/architecture/00-platform-architecture.md` (728KB)
- **问题描述**: 大型架构文档可能存在与实际实现不一致的地方，特别是在快速迭代期间
- **建议修复**: 
  1. 增加架构合规性检查的 CI 测试
  2. 使用 ADR (Architecture Decision Records) 记录所有重大变更
  3. 定期审查文档与实现的一致性

#### 20. [UI] [中严重] [UI独立部署复杂度]
- **文件/路径**: `ui/` 目录
- **问题描述**: 
  - UI 有独立的 `package.json` 和 `node_modules`
  - 使用 Turborepo 工作区
  - 需要单独部署流程
  - Playwright 配置存在但需确认 CI 是否运行
- **建议修复**: 
  1. 确保 Playwright E2E 测试在 CI 中运行
  2. 文档化 UI 服务的部署流程
  3. 考虑 UI 与主应用的一体化部署

#### 21. [UI] [低严重] [UI包结构复杂度]
- **文件/路径**: `ui/packages/`, `ui/apps/`
- **问题描述**: UI 包结构包含：
  - `packages/shared/` (31个子功能)
  - `packages/ui-core`
  - `packages/ui-mobile`
  - `apps/web`, `apps/mobile`, `apps/electron-win`, `apps/tauri-linux`, `apps/tauri-macos`
  - `packages/features/` (多个功能包)
- **建议修复**: 评估包的数量是否必要，考虑合并一些相关包

#### 22. [脚本] [中严重] [脚本组织混乱]
- **文件/路径**: `scripts/` 目录
- **问题描述**: 
  - 部分脚本在 `scripts/` 根目录（`.sh` 和部分 `.mjs`）
  - 部分在 `scripts/ci/` 目录
  - `deploy/scripts/` 也有脚本
  - 没有统一的脚本组织规范
- **建议修复**: 
  1. 创建 `scripts/README.md` 说明每个脚本的用途
  2. 将所有 CI 相关脚本统一到 `scripts/ci/` 
  3. 考虑使用单一语言（全部 mjs 或全部 ts）

#### 23. [脚本] [低严重] [Python脚本维护性问题]
- **文件/路径**: `translate_docs.py` (10KB)
- **问题描述**: 项目主要是 TypeScript/Node.js，但存在 Python 脚本需要额外维护 Python 环境和依赖
- **建议修复**: 
  1. 评估是否仍在使用
  2. 如果需要，考虑使用 TypeScript 重写
  3. 如果不用，删除

#### 24. [部署] [低严重] [临时构建产物未清理]
- **文件/路径**: 根目录的 `dist_*` 目录
- **问题描述**: 存在多个临时构建目录：
  - `dist/`
  - `dist_temp/`
  - `dist_test/`
  - `dist_test_compiled/`
  - `dist_1964/`
  - `dist_issue2014/`
  - `dist_lineage_test/`
- **建议修复**: 
  1. 清理所有临时构建目录
  2. 在 `.gitignore` 中添加 `dist_*` 模式
  3. 创建构建清理脚本

#### 25. [源代码] [高严重] [内存数据库文件残留]
- **文件/路径**: 根目录的 `:memory:` 文件
- **问题描述**: 存在多个内存数据库文件：
  - `:memory:aa-truth-append-*`
  - `:memory:aa-truth-cost-*`
  - `:memory:aa-truth-exec-*`
  - `:memory:aa-truth-session-*`
  - `:memory:aa-truth-status-*`
  - `:memory:aa-truth-wf-*`
  - `:memory:fence-count-*`
  - `:memory:fence-shared-*`
- **建议修复**: 
  1. 这些可能是测试过程中残留的文件
  2. 在 `.gitignore` 中添加 `:memory:*` 模式
  3. 确保测试完成后清理临时文件

#### 26. [源代码] [中严重] [session-replay目录过大]
- **文件/路径**: `session-replay/` (1561个条目)
- **问题描述**: session-replay 目录包含大量文件（可能来自测试或开发过程），占用约50KB
- **建议修复**: 
  1. 评估是否需要保留这些 replay 文件
  2. 如果不需要，在 `.gitignore` 中排除并清理
  3. 如果需要，考虑压缩或外部存储

#### 27. [源代码] [中严重] [artifacts目录过大]
- **文件/路径**: `artifacts/` (489个条目)
- **问题描述**: artifacts 目录包含大量文件，可能影响 git 操作性能
- **建议修复**: 
  1. 评估 artifacts 的保留策略
  2. 实现自动清理过期 artifacts 的机制
  3. 考虑将大型 artifacts 存储在外部存储

#### 28. [源代码] [低严重] [data目录无结构化组织]
- **文件/路径**: `data/` (35个条目)
- **问题描述**: data 目录包含 sqlite、stable-* 等子目录，但没有清晰的组织结构说明
- **建议修复**: 
  1. 在 `data/` 目录添加 README 说明目录结构
  2. 实现数据保留策略（自动清理旧数据）
  3. 区分临时数据和持久数据

#### 29. [部署] [中严重] [deploy目录结构不完整]
- **文件/路径**: `deploy/` 目录
- **问题描述**: 
  - 包含 terraform、helm、prometheus、grafana 等基础设施代码
  - 但 chaos 和 runbooks 目录为空或接近空
  - 缺少 Kubernetes 部署配置
- **建议修复**: 
  1. 完成 chaos 测试场景
  2. 增加 runbook 覆盖
  3. 添加 Kubernetes 部署配置（如果适用）

#### 30. [源代码] [低严重] [领域模块过多导致复杂性]
- **文件/路径**: `src/domains/` (60个条目，包括34个业务领域)
- **问题描述**: 
  - 34个业务领域（academic-research, advertising, agriculture等）
  - 每个领域可能需要独立维护和更新
  - 领域间的依赖关系不明确
- **建议修复**: 
  1. 创建领域依赖关系图
  2. 评估是否可以使用领域共享基础模块减少重复
  3. 考虑领域分组（相似领域放在一起）

#### 31. [源代码] [中严重] [contracts重复导出问题]
- **文件/路径**: `src/platform/contracts/` 和 `src/contracts/` 可能存在重复
- **问题描述**: 项目有两处 contracts 相关代码，需要确认是否有重复定义
- **建议修复**: 
  1. 确认 contracts 的单一真实来源
  2. 确保没有类型定义重复
  3. 统一 contracts 导入路径

#### 32. [测试] [中严重] [tests/unit/helpers/index.test.ts被排除]
- **文件/路径**: `tests/unit/helpers/index.test.ts`
- **问题描述**: 测试 helpers 本身的测试被排除，这可能意味着 helpers 缺乏测试保护
- **建议修复**: 
  1. 调查为什么这个测试被排除
  2. 启用该测试或删除（如果无意义）

#### 33. [配置] [低严重] [.c8rc.json与stryker.config.mjs并存]
- **文件/路径**: 根目录
- **问题描述**: 同时存在两个覆盖率配置文件：
  - `.c8rc.json` (Code coverage)
  - `stryker.config.mjs` (Mutation testing)
  可能导致覆盖率报告不一致
- **建议修复**: 
  1. 确保两个工具的覆盖率阈值一致
  2. 在 CI 中统一报告
  3. 考虑使用单一覆盖率工具

#### 34. [文档] [低严重] [operations文档与实际不完全匹配]
- **文件/路径**: `docs_zh/operations/current_todo_list.md` (38KB)
- **问题描述**: 存在一个大型 TODO 列表文件，说明有很多待办事项。这可能导致文档与实际状态脱节
- **建议修复**: 
  1. 定期同步 TODO 列表与实际代码状态
  2. 将已完成的项目移到 CHANGELOG
  3. 考虑使用 issue tracker 替代文档中的 TODO

#### 35. [源代码] [高严重] [源码文件数量统计矛盾]
- **文件/路径**: 全局
- **问题描述**: 
  - 使用 `find` 命令统计到 1795 个 .ts 文件
  - 但文档提到 6113 个源文件
  - 这个差异需要解释
- **建议修复**: 
  1. 确认 6113 是否包含 .js 文件（编译产物）
  2. 或确认是否包含测试文件
  3. 更新文档以反映准确数字

---

### 总结

本次自动Review发现了35个问题，其中：

**高优先级 (需要立即处理)**:
1. 测试目录大量被exclude (80+个)
2. 符号链接导致构建不一致
3. 内存数据库文件残留
4. 源码文件数量统计矛盾
5. JWT secret 管理不明确

**中优先级**:
1. 巨型单文件需要拆分
2. 配置环境差异
3. 文档同步问题
4. UI 独立部署复杂度
5. 脚本组织混乱
6. 部署配置不完整

**低优先级**:
1. 代码注释清理
2. 包结构优化
3. Python脚本维护
4. 数据目录组织

*Review generated: 2026/05/14*