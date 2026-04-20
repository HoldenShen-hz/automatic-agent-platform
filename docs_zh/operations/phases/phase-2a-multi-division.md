# Phase 2a Multi Division

## 1. 目标

验证平台不是单一编程工具，而是可挂载多个事业部的通用自动化公司运行时。

## 2. 进入条件

- Phase 1b orchestration 闭环已稳定
- division / role / workflow 基础加载链已可运行
- artifact 与恢复已能支撑跨 division trace
- 进入 2a 前已重新通过 `operations-checklist.md` 的当前阶段签收

## 3. 必做范围

- 至少两个以上事业部落地验证。
- `division.yaml`、role prompt、workflow schema 的正式加载链路。
- SubAgent 与 artifact 使用增强。
- 跨任务依赖与恢复增强。
- 更严格的 contract 对齐测试。

## 4. 非目标

- 感知模块全面上线。
- Enterprise 私有化矩阵。
- Marketplace。

## 5. 关键 contract / 主文档

- [division_definition_contract.md](../../contracts/division_definition_contract.md)
- [project_structure_contract.md](../../contracts/project_structure_contract.md)
- [artifact_unified_model_contract.md](../../contracts/artifact_unified_model_contract.md)
- [guides/division-authoring.md](../../guides/division-authoring.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- 多事业部样例与真实配置。
- division loader 与验证器。
- artifact 引用与回溯能力增强。
- Phase 2a 验收报告。

## 7. 验收与退出门槛

- 多事业部任务可稳定执行。
- division 配置新增无需改核心代码。
- 恢复和追踪能力覆盖跨事业部场景。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的“当前阶段可验收”标准。

## 8. 风险与控制点

- 风险：把“多 division”做成一堆硬编码样例。
- 控制：必须以可声明加载、可校验配置为准。
- 风险：artifact、sub-agent、跨任务依赖语义混乱。
- 控制：统一走 artifact / execution / workflow contract。

## 9. 向下一阶段交接

- 2b 接手的是长期稳定性、记忆和治理，不应回过头修基础 division loader。
