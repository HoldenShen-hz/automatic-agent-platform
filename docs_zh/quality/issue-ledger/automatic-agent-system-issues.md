# Automatic Agent System — Issue Ledger Mirror

> Generated: 2026-06-02T16:01:47.869Z
> Source: artifacts/assurance/issues.deduped.jsonl
> Total issues: 24502

| ID | Severity | Source | Category | Description |
|---|---|---|---|---|
| AAS-ISSUE-000001 | P1 | review | review.issue_summary | 符号链接导致构建不一致 |
| AAS-ISSUE-000002 | P1 | review | review.issue_summary | 巨型单文件问题 |
| AAS-ISSUE-000003 | P1 | review | review.issue_summary | tsconfig.json exclude列表过长 |
| AAS-ISSUE-000004 | P1 | review | review.issue_summary | core/runtime 兼容性目录未清理 |
| AAS-ISSUE-000005 | P1 | review | review.issue_summary | 直接使用console而非结构化日志 |
| AAS-ISSUE-000006 | P1 | review | review.issue_summary | 过深的import路径 |
| AAS-ISSUE-000007 | P1 | review | review.issue_summary | 缺少包导出的barrel文件 |
| AAS-ISSUE-000008 | P1 | review | review.issue_summary | TODO/FIXME/HACK注释未处理 |
| AAS-ISSUE-000009 | P1 | review | review.issue_summary | 测试覆盖率分布不均 |
| AAS-ISSUE-000010 | P1 | review | review.issue_summary | 大量集成测试被排除 |
| AAS-ISSUE-000011 | P1 | review | review.issue_summary | E2E测试被排除 |
| AAS-ISSUE-000012 | P1 | review | review.issue_summary | 测试helpers过多 |
| AAS-ISSUE-000013 | P1 | review | review.issue_summary | Golden测试文件数量少 |
| AAS-ISSUE-000014 | P1 | review | review.issue_summary | 安全配置环境差异 |
| AAS-ISSUE-000015 | P1 | review | review.issue_summary | .env.example中敏感字段为空 |
| AAS-ISSUE-000016 | P1 | review | review.issue_summary | 配置验证机制缺失 |
| AAS-ISSUE-000017 | P1 | review | review.issue_summary | docs_zh与docs_en同步问题 |
| AAS-ISSUE-000018 | P1 | review | review.issue_summary | CHANGELOG过小 |
| AAS-ISSUE-000019 | P1 | review | review.issue_summary | 架构文档与实现不一致 |
| AAS-ISSUE-000020 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI独立部署复杂度 |
| AAS-ISSUE-000021 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI包结构复杂度 |
| AAS-ISSUE-000022 | P1 | review | review.issue_summary | 脚本组织混乱 |
| AAS-ISSUE-000023 | P1 | review | review.issue_summary | Python脚本维护性问题 |
| AAS-ISSUE-000024 | P1 | review | review.issue_summary | 临时构建产物未清理 |
| AAS-ISSUE-000025 | P1 | review | review.issue_summary | 内存数据库文件残留 |
| AAS-ISSUE-000026 | P1 | review | review.issue_summary | session-replay目录过大 |
| AAS-ISSUE-000027 | P1 | review | ops_hygiene.temp_artifact_governance | artifacts目录过大 |
| AAS-ISSUE-000028 | P1 | review | review.issue_summary | data目录无结构化组织 |
| AAS-ISSUE-000029 | P1 | review | review.issue_summary | deploy目录结构不完整 |
| AAS-ISSUE-000030 | P1 | review | review.issue_summary | 领域模块过多导致复杂性 |
| AAS-ISSUE-000031 | P1 | review | review.issue_summary | contracts重复导出问题 |
| AAS-ISSUE-000032 | P1 | review | review.issue_summary | tests/unit/helpers/index.test.ts被排除 |
| AAS-ISSUE-000033 | P1 | review | review.issue_summary | .c8rc.json与stryker.config.mjs并存 |
| AAS-ISSUE-000034 | P1 | review | review.issue_summary | operations文档与实际不完全匹配 |
| AAS-ISSUE-000035 | P1 | review | review.issue_summary | 源码文件数量统计矛盾 |
| AAS-ISSUE-000036 | P1 | review | review.issue_summary | 巨型源文件 - budget-allocator.ts 超过900行 |
| AAS-ISSUE-000037 | P1 | review | review.issue_summary | 巨型源文件 - durable-event-bus.ts 超过1200行 |
| AAS-ISSUE-000038 | P1 | review | review.issue_summary | 巨型源文件 - runtime-state-machine.ts 近700行 |
| AAS-ISSUE-000039 | P1 | review | review.issue_summary | core/runtime 目录与五层架构并存 |
| AAS-ISSUE-000040 | P1 | review | review.issue_summary | 26个源文件直接使用 console.* 而非结构化日志 |
| AAS-ISSUE-000041 | P1 | review | review.issue_summary | 13个文件包含未完成的 TODO/FIXME/HACK 标记 |
| AAS-ISSUE-000042 | P1 | review | review.issue_summary | budget-allocator.test.ts 测试失败 |
| AAS-ISSUE-000043 | P1 | review | review.issue_summary | 测试文件与源文件比例严重失调 |
| AAS-ISSUE-000044 | P1 | review | review.issue_summary | config/security/dev.json 与 test.json 行为不一致 |
| AAS-ISSUE-000045 | P1 | review | review.issue_summary | .env.example 中 AA_API_JWT_SECRET 为空但无安全警告 |
| AAS-ISSUE-000046 | P1 | review | review.issue_summary | package.json scripts 过多且重复 |
| AAS-ISSUE-000047 | P1 | review | review.issue_summary | deploy/runbooks 目录为空 |
| AAS-ISSUE-000048 | P1 | review | review.issue_summary | deploy/chaos 目录为空 |
| AAS-ISSUE-000049 | P1 | review | review.issue_summary | src/platform/contracts/ 与 src/contracts/ 可能存在重复 |
| AAS-ISSUE-000050 | P1 | review | review.issue_summary | 大量临时构建目录未清理 |
| AAS-ISSUE-000051 | P1 | review | ops_hygiene.temp_artifact_governance | 内存数据库文件未在 .gitignore 中 |
| AAS-ISSUE-000052 | P1 | review | ops_hygiene.temp_artifact_governance | session-replay 目录未在 .gitignore 中 |
| AAS-ISSUE-000053 | P1 | review | ops_hygiene.temp_artifact_governance | artifacts 目录未在 .gitignore 中 |
| AAS-ISSUE-000054 | P1 | review | review.issue_summary | Buffer.from 使用可能存在安全问题 |
| AAS-ISSUE-000055 | P1 | review | review.issue_summary | process.env 访问次数过多 |
| AAS-ISSUE-000056 | P1 | review | review.issue_summary | .audit/delegation/delegation-audit-events.json 可能包含敏感数据 |
| AAS-ISSUE-000057 | P1 | review | review.issue_summary | .audit/quality.md 与实际测试状态不一致 |
| AAS-ISSUE-000058 | P1 | review | review.issue_summary | stryker.config.mjs 只变异少量关键文件 |
| AAS-ISSUE-000059 | P1 | review | review.issue_summary | .c8rc.json 和 stryker.config.mjs 配置分离 |
| AAS-ISSUE-000060 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI package.json 与主 package.json 分离 |
| AAS-ISSUE-000061 | P1 | review | review.issue_summary | tool-executor 目录文件过多 |
| AAS-ISSUE-000062 | P1 | review | review.issue_summary | hardcoded 配置散布在代码中 |
| AAS-ISSUE-000063 | P1 | review | review.issue_summary | 大量测试文件被 exclude 导致覆盖缺口 |
| AAS-ISSUE-000064 | P1 | review | review.issue_summary | src/platform/five-plane-control-plane/rollout-controller/ 最近的修改 |
| AAS-ISSUE-000065 | P1 | review | review.issue_summary | src/contracts/types/ids.ts 导出混乱 |
| AAS-ISSUE-000066 | P1 | review | review.issue_summary | tsconfig.json 存在多个变体 |
| AAS-ISSUE-000067 | P1 | review | review.issue_summary | 接口一致性问题 - five-plane-execution 导出路径混乱 |
| AAS-ISSUE-000068 | P1 | review | review.issue_summary | 接口一致性问题 - five-plane-control-plane IAM 模块导入混乱 |
| AAS-ISSUE-000069 | P1 | review | review.issue_summary | 接口一致性问题 - durable-event-bus 测试失败 |
| AAS-ISSUE-000070 | P1 | review | review.issue_summary | 接口一致性问题 - runtime-state-machine 导入路径错误 |
| AAS-ISSUE-000071 | P1 | review | review.issue_summary | 工具执行器模块 - 35个文件职责过多 |
| AAS-ISSUE-000072 | P1 | review | review.issue_summary | state-transition 服务 - 868行巨型服务 |
| AAS-ISSUE-000073 | P1 | review | review.issue_summary | 测试排除列表分析 - 根本原因未调查 |
| AAS-ISSUE-000074 | P1 | review | review.issue_summary | .audit/quality.md 与实际 git 状态不一致 |
| AAS-ISSUE-000075 | P1 | review | review.issue_summary | config/security 环境配置差异 - 严重程度被低估 |
| AAS-ISSUE-000076 | P1 | review | review.issue_summary | config/environments 与 config/security 配置不对齐 |
| AAS-ISSUE-000077 | P1 | review | ops_hygiene.temp_artifact_governance | 五个符号链接未在 gitignore 中 |
| AAS-ISSUE-000078 | P1 | review | review.issue_summary | multi-step-orchestration 模块 - 29个文件过多 |
| AAS-ISSUE-000079 | P1 | review | review.issue_summary | stryker.config.mjs 变异覆盖严重不足 |
| AAS-ISSUE-000080 | P1 | review | ops_hygiene.temp_artifact_governance | .gitignore 缺少多个临时文件 |
| AAS-ISSUE-000081 | P1 | review | review.issue_summary | process.env 访问模式不安全 |
| AAS-ISSUE-000082 | P1 | review | review.issue_summary | Buffer.from 使用可能存在安全风险 |
| AAS-ISSUE-000083 | P1 | review | review.issue_summary | deploy/chaos 场景配置不完整 |
| AAS-ISSUE-000084 | P1 | review | review.issue_summary | deploy/runbooks 只有一个文件 |
| AAS-ISSUE-000085 | P1 | review | review.issue_summary | oapeflir 目录与 five-plane-orchestration 职责不清 |
| AAS-ISSUE-000086 | P1 | review | review.issue_summary | ha (高可用) 模块结构复杂 |
| AAS-ISSUE-000087 | P1 | review | review.issue_summary | dispatcher 模块 - 14个文件 |
| AAS-ISSUE-000088 | P1 | review | review.issue_summary | recovery 模块 - 29个文件过于庞大 |
| AAS-ISSUE-000089 | P1 | review | review.issue_summary | 5个符号链接存在但未被文档化 |
| AAS-ISSUE-000090 | P1 | review | review.issue_summary | tests/unit/helpers/index.test.ts 被排除 |
| AAS-ISSUE-000091 | P1 | review | review.issue_summary | tsconfig.temp.json 存在 |
| AAS-ISSUE-000092 | P1 | review | review.issue_summary | docs_zh/operations/current_todo_list.md 过大 |
| AAS-ISSUE-000093 | P1 | review | review.issue_summary | memory 模块 - 27个文件可能过于庞大 |
| AAS-ISSUE-000094 | P1 | review | review.issue_summary | events 模块 - 22个文件结构复杂 |
| AAS-ISSUE-000095 | P1 | review | review.issue_summary | truth 模块 - 28个文件可能过于庞大 |
| AAS-ISSUE-000096 | P1 | review | review.issue_summary | checkpoint 模块 - 8个文件但有巨型文件 |
| AAS-ISSUE-000097 | P1 | review | review.issue_summary | E2E 测试被排除 - 关键工作流无保护 |
| AAS-ISSUE-000098 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI apps 目录结构 - 多平台支持复杂性 |
| AAS-ISSUE-000099 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI packages/features 数量过多 |
| AAS-ISSUE-000100 | P1 | review | ops_hygiene.temp_artifact_governance | .audit 目录未被 gitignore |
| AAS-ISSUE-000101 | P1 | review | review.issue_summary | platform-module-catalog.ts 与 platform-mainline-bootstrap.ts 并存 |
| AAS-ISSUE-000102 | P1 | review | review.issue_summary | contracts 目录两处存在需要整合 |
| AAS-ISSUE-000103 | P1 | review | review.issue_summary | 测试覆盖率与 mutation 测试覆盖分离 |
| AAS-ISSUE-000104 | P1 | review | review.issue_summary | 工具执行器 - MCP 工具 guard 存在 |
| AAS-ISSUE-000105 | P1 | review | review.issue_summary | 环境配置命名不一致 |
| AAS-ISSUE-000106 | P1 | review | review.issue_summary | Execution Lease 与 HA Lease 职责重叠 |
| AAS-ISSUE-000107 | P1 | review | review.issue_summary | budget-allocator.test.ts 测试失败 - 核心模块无 CI 保护 |
| AAS-ISSUE-000108 | P1 | review | review.issue_summary | worker-pool 测试失败 - 关键并发模块无保护 |
| AAS-ISSUE-000109 | P1 | review | review.issue_summary | dispatcher/admission-controller.js 复杂度高 |
| AAS-ISSUE-000110 | P1 | review | review.issue_summary | 架构文档与实现细节存在不一致风险 |
| AAS-ISSUE-000111 | P1 | review | review.issue_summary | 巨型源文件 - harness/index.ts 超过2300行 |
| AAS-ISSUE-000112 | P1 | review | review.issue_summary | process.env 访问次数严重低估 |
| AAS-ISSUE-000113 | P0 | review | review.review_table | 测试失败率2.8%，1620个失败测试 |
| AAS-ISSUE-000114 | P0 | review | review.review_table | stryker mutation 测试覆盖严重不足 |
| AAS-ISSUE-000115 | P1 | review | review.review_table | 多文件超过1000行未被报告 |
| AAS-ISSUE-000116 | P0 | review | ops_hygiene.temp_artifact_governance | .gitignore 遗漏大量临时文件和目录 |
| AAS-ISSUE-000117 | P1 | review | review.review_table | multiple bootstrap 文件导致混淆 |
| AAS-ISSUE-000118 | P1 | review | review.review_table | contracts 模块过大 (151个子目录) |
| AAS-ISSUE-000119 | P1 | review | review.review_table | domains 目录过大 (60个条目) |
| AAS-ISSUE-000120 | P1 | review | review.review_table | tool-executor 目录 35 个文件，包含巨型文件 |
| AAS-ISSUE-000121 | P1 | review | review.review_table | execution-engine 目录 32 个文件 |
| AAS-ISSUE-000122 | P1 | review | review.review_table | oapeflir 在 execution 和 orchestration 两处存在 |
| AAS-ISSUE-000123 | P1 | review | review.review_table | deploy/chaos 只有4个场景 |
| AAS-ISSUE-000124 | P0 | review | ops_hygiene.temp_artifact_governance | .audit 目录未被 gitignore，包含敏感数据 |
| AAS-ISSUE-000125 | P1 | review | review.review_table | .env.example 缺少安全警告和指引 |
| AAS-ISSUE-000126 | P2 | review | review.review_table | StructuredLogger 未被广泛采用 |
| AAS-ISSUE-000127 | P2 | review | review.review_table | 17个 TODO/FIXME/HACK 标记未处理 |
| AAS-ISSUE-000128 | P1 | review | review.review_table | docs_zh 与 docs_en 同步机制缺失 |
| AAS-ISSUE-000129 | P1 | review | review.review_table | 单元测试被 exclude 数量巨大 |
| AAS-ISSUE-000130 | P2 | review | ui_contract.bridge_or_endpoint_mismatch | UI 独立部署架构增加复杂性 |
| AAS-ISSUE-000131 | P1 | review | review.review_table | HA 和 Lease 模块职责重叠 |
| AAS-ISSUE-000132 | P1 | review | review.review_table | recovery 目录 29 个文件过于庞大 |
| AAS-ISSUE-000133 | P1 | review | review.review_table | memory 目录 27 个文件可能过于庞大 |
| AAS-ISSUE-000134 | P1 | review | review.review_table | truth 目录 28 个文件可能过于庞大 |
| AAS-ISSUE-000135 | P1 | review | review.review_table | events 目录 22 个文件结构复杂 |
| AAS-ISSUE-000136 | P2 | review | review.review_table | package.json scripts 数量过多 (100+) |
| AAS-ISSUE-000137 | P2 | review | review.review_table | 翻译脚本 translate_docs.py 维护性问题 |
| AAS-ISSUE-000138 | P1 | review | review.review_table | 多层模块间循环依赖风险 |
| AAS-ISSUE-000139 | P0 | review | review.review_table | 类型定义不一致 - 错误类型混乱 |
| AAS-ISSUE-000140 | P0 | review | review.review_table | 接口一致性 - 导入路径混乱 |
| AAS-ISSUE-000141 | P1 | review | review.review_table | monitoring/observability 配置不完整 |
| AAS-ISSUE-000142 | P1 | review | review.review_table | 权限控制实现分散 |
| AAS-ISSUE-000143 | P1 | review | review.review_table | 数据库 schema 不一致风险 |
| AAS-ISSUE-000144 | P1 | review | review.review_table | Event Bus 实现问题 |
| AAS-ISSUE-000145 | P1 | review | review.review_table | HA 模块与 Lease 模块职责不清 |
| AAS-ISSUE-000146 | P1 | review | review.review_table | secret 管理缺失 |
| AAS-ISSUE-000147 | P1 | review | review.review_table | Plugin 系统架构复杂度高 |
| AAS-ISSUE-000148 | P2 | review | review.review_table | 缓存实现一致性 |
| AAS-ISSUE-000149 | P1 | review | review.review_table | Kubernetes 部署配置缺失 |
| AAS-ISSUE-000150 | P2 | review | review.review_table | current_todo_list.md 过大 (38KB) |
| AAS-ISSUE-000151 | P1 | review | review.review_table | 事件类型定义重复 |
| AAS-ISSUE-000152 | P2 | review | review.review_table | 日志级别不一致 |
| AAS-ISSUE-000153 | P1 | review | review.review_table | PostgreSQL 配置缺失 |
| AAS-ISSUE-000154 | P1 | review | review.review_table | 安全配置分散 |
| AAS-ISSUE-000155 | P0 | review | review.review_table | integration 测试被大量排除 |
| AAS-ISSUE-000156 | P1 | review | review.review_table | multi-step-orchestration 模块过于庞大 |
| AAS-ISSUE-000157 | P1 | review | review.review_table | dispatcher/admission-controller 实现复杂度 |
| AAS-ISSUE-000158 | P1 | review | review.review_table | 架构文档与实现不同步 |
| AAS-ISSUE-000159 | P1 | review | review.review_table | MCP 工具 guard 实现验证 |
| AAS-ISSUE-000160 | P0 | review | review.review_table | 巨型源文件体积异常增大 |
| AAS-ISSUE-000161 | P0 | review | review.review_table | config/security/prod.json approvalMode 为 strict，但其他环境为 supervised |
| AAS-ISSUE-000162 | P1 | review | review.review_table | deploy/runbooks 目录内容过少 |
| AAS-ISSUE-000163 | P1 | review | review.review_table | deploy/chaos 目录场景不完整 |
| AAS-ISSUE-000164 | P1 | review | review.review_table | 12个源文件直接使用 console.* 而非结构化日志 |
| AAS-ISSUE-000165 | P1 | review | ops_hygiene.temp_artifact_governance | .gitignore 不完整 - 缺少多个临时文件模式 |
| AAS-ISSUE-000166 | P1 | review | review.review_table | .c8rc.json 和 stryker.config.mjs 配置分离导致覆盖缺口 |
| AAS-ISSUE-000167 | P1 | review | review.review_table | mutation 测试只在 main 分支推送时运行 |
| AAS-ISSUE-000168 | P2 | review | review.review_table | deploy/helm 和 deploy/terraform 内容不确定 |
| AAS-ISSUE-000169 | P0 | review | review.review_table | src/core/runtime/ 与五层架构职责不清 |
| AAS-ISSUE-000170 | P2 | review | ui_contract.bridge_or_endpoint_mismatch | UI package.json 与主 package.json 依赖版本可能不一致 |
| AAS-ISSUE-000171 | P1 | review | review.review_table | 安全配置分散在多个文件中 |
| AAS-ISSUE-000172 | P2 | review | review.review_table | contracts 模块过大 (2169行) |
| AAS-ISSUE-000173 | P2 | review | review.review_table | docs_zh/operations/ 与 deploy/runbooks 内容重复或不一致 |
| AAS-ISSUE-000174 | P1 | review | review.review_table | process.env 访问次数之前报告为5176次，但实际需要验证 |
| AAS-ISSUE-000175 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI Playwright 配置存在但未确认是否在 CI 中运行 |
| AAS-ISSUE-000176 | P2 | review | review.review_table | 源码统计：374,602 行 TypeScript，1795 个文件 |
| AAS-ISSUE-000177 | P1 | review | review.review_table | package.json scripts 过于复杂且重复 |
| AAS-ISSUE-000178 | P2 | review | review.review_table | .env.example 中 AA_API_JWT_SECRET 为空但已有说明 |
| AAS-ISSUE-000179 | P2 | review | review.review_table | .dockerignore 存在但需要验证完整性 |
| AAS-ISSUE-000180 | P2 | review | review.review_table | docs_zh/ 和 docs_en/ 并存但同步机制缺失 |
| AAS-ISSUE-000181 | P0 | review | review.review_table | .audit/quality.md 报告 14 个测试文件失败，但 git status 显示无更改 |
| AAS-ISSUE-000182 | P1 | review | review.review_table | 符号链接导致构建和路径解析问题 |
| AAS-ISSUE-000183 | P1 | review | review.review_table | 巨型源文件未拆分 - 违反单一职责原则 |
| AAS-ISSUE-000184 | P1 | review | review.review_table | 错误处理不一致 - 直接抛出 Error |
| AAS-ISSUE-000185 | P1 | review | review.review_table | 敏感信息暴露风险 - .env.example 未清理 |
| AAS-ISSUE-000186 | P1 | review | review.review_table | 路径遍历防护实现问题 |
| AAS-ISSUE-000187 | P1 | review | review.review_table | Redis 客户端在测试模式下使用内存实现 |
| AAS-ISSUE-000188 | P1 | review | review.review_table | 生产代码使用 console.log 而非结构化日志 |
| AAS-ISSUE-000189 | P1 | review | review.review_table | 配置管理分散 - 存在多个配置源 |
| AAS-ISSUE-000190 | P1 | review | review.review_table | JSON.parse 缺乏错误处理 |
| AAS-ISSUE-000191 | P1 | review | review.review_table | StructuredLogger 使用 stack trace 解析调用者路径 |
| AAS-ISSUE-000192 | P1 | review | review.review_table | StructuredLogger 内存缓冲可能耗尽 |
| AAS-ISSUE-000193 | P1 | review | review.review_table | 测试被大量 exclude |
| AAS-ISSUE-000194 | P1 | review | review.review_table | Mutation testing 覆盖严重不足 |
| AAS-ISSUE-000195 | P1 | review | review.review_table | 测试存在 TODO 注释表明未完成 |
| AAS-ISSUE-000196 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI 项目缺少安全配置 |
| AAS-ISSUE-000197 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI 项目缺少国际化 (i18n) 配置 |
| AAS-ISSUE-000198 | P1 | review | ui_contract.bridge_or_endpoint_mismatch | UI 组件响应式设计未验证 |
| AAS-ISSUE-000199 | P1 | review | review.review_table | 安全配置环境不一致 |
| AAS-ISSUE-000200 | P1 | review | review.review_table | 配置值文件中存在硬编码 |
