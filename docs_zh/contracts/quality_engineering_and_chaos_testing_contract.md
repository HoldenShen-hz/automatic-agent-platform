# Quality Engineering And Chaos Testing Contract

## 1. 范围

本 contract 定义正式测试矩阵、回归基准库和混沌工程范围。

相关文档：

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. 目标

- 让质量工程从“测试类型列表”升级为“覆盖矩阵”。
- 建立跨运行模式、跨存储、跨租户的回归基线。
- 通过混沌演练验证恢复、告警和止损逻辑。

## 3. 正式测试矩阵

至少覆盖以下维度交叉：

- 单机 / 分布式
- SQLite / PostgreSQL
- supervised / auto / full-auto
- 单租户 / 多租户
- 本地工具 / MCP 工具 / 远程 worker
- 小上下文 / 超长上下文 / 恶意输入
- OAPEFLIR 闭环阶段 / rollout / feedback / learning

## 4. 回归基准库

固定任务集至少包含：

- 编程类
- 研究类
- 内容类
- 数据类
- 跨事业部类
- 高风险审批类
- 崩溃恢复类
- OAPEFLIR 闭环类
- rollout / rollback 类
- Observe-compatible 产品链路类

每个基准任务至少记录：

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. 可测试性设计要求

关键运行链应优先暴露窄依赖注入面，而不是依赖全局 patch 或模块级 monkey patch。

至少适用于：

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

规则：

- 依赖注入面应尽量窄，只覆盖高频变化点。
- 生产实现和测试假实现应复用同一签名，避免测试专用旁路接口。
- 若某模块只能通过全局状态替换来测试，应被视为质量债务并进入治理台账。

## 6. 混沌工程范围

成熟工业平台至少演练：

- 随机 kill worker
- 随机 provider 429 / 500
- 随机 DB 锁冲突
- 随机 queue 延迟
- 随机事件重复 / 丢失
- 随机 MCP 超时
- 随机 OAPEFLIR stage 中断
- 随机 rollout gate 阻断

## 7. 发布门禁

发布前必须有：

- regression baseline pass
- fixture / VCR pass
- recovery drill pass
- migration compatibility pass
- chaos smoke scenario pass
- OAPEFLIR loop regression pass
- rollout / rollback regression pass

## 8. 测试工件

- `RegressionSuite`
- `ScenarioMatrix`
- `ChaosExperiment`
- `ReleaseGateReport`
- `FailureInjectionProfile`
- `ContractSuite`
- `InventoryBaseline`

## 8.1 Registry-backed contract suite

对稳定注册表或生态边界，优先建立共享 contract suite，而不是为每个接入面重复写零散断言。

适用对象包括：

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

规则：

- 共享 contract suite 应验证“是否已注册、字段是否对齐、fallback 是否符合预期、排序/输出是否稳定”。
- 对长期稳定的边界，允许保留 inventory baseline，并在变更时显式审查差异。

## 8.2 Hook / lifecycle event contract suite

对 hook、lifecycle callback、integration event 这类边界，优先使用正式事件枚举与 contract suite，而不是自由字符串。

适用对象包括：

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

规则：

- hook 事件名应集中定义并版本化。
- 不允许各插件、各集成层随意创造语义相近但名称不同的事件字符串。
- 相关测试应验证：事件名合法、顺序合法、缺失关键事件时有明确失败语义。

## 9. 收口结论

工业级质量工程不是“写几类测试”。

它必须回答：

- 哪些场景被覆盖了
- 哪些环境组合被验证了
- 哪些故障被注入过
- 失败后系统是否能恢复和止损
