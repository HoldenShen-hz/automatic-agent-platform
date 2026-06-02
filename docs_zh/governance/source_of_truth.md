# Source Of Truth Governance

## 1. 目标

确保同一份事实只维护一份主版本，避免平台设计、主干文档、ADR 和 contract 互相打架。

## 2. 主规则

- 字段、状态、协议问题以 `contracts/` 为准。
- 长期架构边界问题以 `docs_zh/architecture/00-*.md` ~ `04-*.md` 为准。
- 方案取舍问题以 `adr/` 为准。
- 新平台设计与迁移边界以本项目 `docs_zh/architecture/` 下的平台架构文档为准。
- 当前推进动作以 `operations/` 为准。
- 根级 `CHANGELOG.md` 只记录发布与变更事实，不重新定义 contract、ADR 或架构边界；若条目与治理链冲突，以治理链为准并在同次变更中回写。

补充：

- 老系统 `18_code_architecture.md` 与其他旧文档只作为迁移参考，不再作为当前项目事实源。

## 3. 变更顺序

1. 改主干文档。
2. 改 contract。
3. 补 ADR。
4. 更新 governance / glossary / source-of-truth。
5. 更新 operations。
6. 如需保留老系统对照信息，只在迁移说明中补充，不回灌旧 review。

## 4. 禁止事项

- 在旧 review 文档中重定义 contract。
- 在 operations 中发明新状态机。
- 在历史参考材料中继续维护活跃设计。
- 在 README 中写当前完成度。
- 让 ADR、contract、governance 的术语长期与当前实现边界失配。
