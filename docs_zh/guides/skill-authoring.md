# Skill Authoring

## 目标

本指南定义如何使用系统内置的 `skill creator` 生成功能来初始化 skill 骨架，并把 skill 接入现有 governance/runtime。

## 最小流程

1. 使用 `skill creator` 生成 skill 目录骨架。
2. 编辑生成的 `SKILL.md`，补充真实 workflow、输入约束和安全说明。
3. 若需要，把 skill 注册到 skill registry。
4. 在上线前执行 scaffold validate、权限校验和 authoring review。

## 最小结构

每个 skill 至少应包含：

- `SKILL.md`

creator 可选生成：

- `scripts/`
- `references/`
- `assets/`
- `agents/openai.yaml`

## `SKILL.md` 必备章节

生成后的 `SKILL.md` 至少应保留并补全：

- `Description`
- `When To Use`
- `Inputs`
- `Workflow`
- `Safety Notes`

## Authoring 规则

- skill 名应使用稳定的 lowercase kebab-case `skill_id`。
- `required_tools` 应保持最小权限原则。
- `SKILL.md` 不得包含 secrets、私有 token、环境专属 endpoint。
- 依赖 `scripts/` 或 `references/` 的 skill，必须在 `Workflow` 里写明使用顺序。

## 注册建议

- 需要纳入平台治理的 skill，应在 scaffold 生成后进入 skill registry。
- registry 元数据应与 skill 文件保持一致，尤其是 `skill_id / version / required_tools / cache policy`。

## 关联文档

- [Tool Skill Plugin Contract](../contracts/tool_skill_plugin_contract.md)
- [Quickstart](./quickstart.md)
