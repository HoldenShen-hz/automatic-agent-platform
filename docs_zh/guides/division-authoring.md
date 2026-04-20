# Division Authoring

## 目标

事业部是平台扩展业务能力的基本单位。本指南定义如何新增或维护一个事业部配置，并尽量保证新增业务不会破坏平台的主链路约束。

## 最小结构

每个事业部至少应包含：

- `division.yaml`
- `roles/*.prompt.md`
- 可选的 `AGENT.md` 或规则文件

推荐模板：

```yaml
id: engineering
name: 编程事业部
description: 软件开发全流程
triggers:
  - "写代码|编程|开发|实现|修复|bug|feature|重构"

roles:
  - id: pm
    name: 产品经理
    prompt: roles/pm.prompt.md
    model: balanced
    tools: [read, write_doc]

  - id: developer
    name: 开发工程师
    prompt: roles/developer.prompt.md
    model: coding
    tools: [read, edit, bash]
    max_instances: 5

workflow:
  - step: analyze
    role: pm
    input: "{task}"
    output: user_stories

  - step: develop
    role: developer
    input: "{user_stories}"
    output: code_changes

retry:
  max_attempts: 3
  on_failure: [develop]
```

## 必填设计项

每个事业部都应明确：

- 它处理什么类型的任务。
- 它如何被 VP 运营命中。
- 它有哪些角色，各自边界是什么。
- workflow 如何传递输入输出。
- 哪些步骤允许重试。
- 哪些输出会变成 artifact。

## 角色设计规则

- `id` 应稳定、简短、机器友好。
- `triggers` 应覆盖高频表达，但避免过于宽泛。
- `roles` 只声明真正需要的角色，不要为了“看起来完整”而堆角色。
- `tools` 必须遵循最小权限原则。
- `model` 选择要与职责强度匹配。
- 每个角色都应写清职责与边界，避免两个角色都能做同一件核心事。

## 工作流规则

- `input` 引用上游输出时，字段名必须可追踪。
- `output` 应与下游消费字段对齐。
- 大输出优先设计为 artifact 引用，而不是无限制内联文本。
- 需要回退或返工的流程，优先通过显式步骤和限制次数建模。
- 若某步骤天然可能部分成功，应考虑如何通过 schema 和 precondition 表达。

## 契约与校验

新增角色或步骤时，应检查：

- 输入 schema 是否被上游输出满足。
- 输出 schema 是否足够清晰。
- 是否需要 precondition。
- 是否会与现有角色边界冲突。
- 是否引入了事业部内从未出现过的高风险工具。

## 与 HR Agent 的边界

- HR Agent 只能在现有事业部内补角色。
- HR Agent 给出的 workflow 变更默认只是建议，不自动生效。
- 新事业部必须人工添加。
- 若需要新增工具集合，优先由人工扩展事业部定义，再考虑让 HR 使用。

## 验收建议

新增事业部后，至少准备：

- 一个 `fast` 路径任务。
- 一个 `standard` 或 `full` 路径任务。
- 一个失败重试场景。
- 一个需要 artifact 输出的场景。

## 模板与信任提示

如果后续把事业部 / workflow 作为可分发模板或 recipe 暴露：

- 模板应显式展示 `title / description / instructions / parameters / required_extensions`。
- 首次执行或来源变更时，应显示 trust warning，而不是直接静默运行。
- 若模板内容检测到隐藏字符、可疑控制字符或其他风险信号，应默认阻断或至少强提醒。
- 体验层 trust warning 不能替代 runtime policy、sandbox 或 capability 校验。

## 推荐实践

- 先把事业部做小，再逐步加角色。
- 先保证 `fast` 或 `standard` 路径跑通，再扩展到 `full`。
- 先用 1-2 个高频任务验证命中率和成功率，再继续加能力。

## 关联文档

- [ADR-002 事业部系统](../adr/002-division-system.md)
- [ADR-004 工作流与路由](../adr/004-workflow-routing.md)
- [Quickstart](./quickstart.md)
