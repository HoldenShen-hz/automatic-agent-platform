# Source

> `src/` 包含 Automatic Agent Platform 的正式实现代码。

## 目录结构

```text
src/
├── platform/         # 五平面基础设施与 AI 运营核心
├── domains/          # 领域接入、descriptor、onboarding、prompt/eval 治理
├── interaction/      # 自然语言入口、目标分解、主动式 agent、dashboard、UX
├── org-governance/   # 组织模型、审批路由、SSO/SCIM、知识边界、委托治理
├── scale-ecosystem/  # 多 region、资源竞争、SLA、生态市场、反馈与集成
├── ops-maturity/     # explainability、panic/resume、edge、drift、cost、debugger
├── sdk/              # CLI 与 SDK 面向使用者的入口
└── plugins/          # 插件与扩展能力
```

## 平台核心

| 模块 | 说明 |
| --- | --- |
| `platform/five-plane-interface/` | API、channel gateway、ingress、scheduler、console/webhook 边界 |
| `platform/five-plane-control-plane/` | 配置、IAM、审批、事件导出、发布与事故控制 |
| `platform/five-plane-orchestration/` | OAPEFLIR、planner、routing、HITL |
| `platform/five-plane-execution/` | dispatcher、execution-engine、worker、queue、lease、recovery |
| `platform/five-plane-state-evidence/` | truth、events、checkpoints、artifacts、knowledge、memory |

## 说明

- `src/core/runtime/` 仅保留兼容性 re-export，不再承载 canonical 实现。
- 结构设计与覆盖矩阵请参考：
  - [平台架构设计](../docs_zh/architecture/00-platform-architecture.md)
  - [代码结构设计](../docs_zh/architecture/01-code-structure.md)
  - [架构覆盖矩阵](../docs_zh/analysis/00-architecture-coverage-matrix.md)
