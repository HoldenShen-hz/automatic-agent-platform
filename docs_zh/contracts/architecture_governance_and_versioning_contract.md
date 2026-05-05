# Architecture Governance And Versioning Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义成熟工业平台所需的架构决策流程、模块边界治理和版本兼容策略。

相关文档：

- `project_structure_contract.md`
- `api_surface_contract.md`
- `control_vs_intelligence_boundary_contract.md`
- `workflow_static_analysis_and_compensation_contract.md`

## 2. 目标

- 让新增架构取舍进入正式 ADR 流程，而不是停留在聊天或代码注释里。
- 收紧领域层、编排层、运行时层、基础设施层之间的调用边界。
- 为 workflow DSL、role contract、tool schema、event schema、memory schema 建立统一版本治理。

## 3. ADR 治理要求

以下变化必须新增 ADR，或更新现有 ADR：

- 新增 authoritative store、queue、broker 或 cache。
- 新增跨边界安全模型、执行模型或租户隔离模型。
- 变更模型选择策略、fallback 策略或控制/智能边界。
- 变更 workflow DSL、event schema、tool schema 的兼容策略。
- 引入新的生产级依赖、插件分发机制或跨区域容灾方案。

每份 ADR 至少包含：

- context
- decision
- alternatives considered
- trade-offs
- adoption trigger
- rollback / exit criteria
- migration impact

补充要求：

- 若某项设计显式参考外部系统或外部框架，应记录“借鉴点”和“不直接采用的点”。
- 若决定不采用某个看似合理的外部方案，应保留最小拒绝理由，避免同一方案反复被重新提案。
- 对长期稳定边界，允许引入 architecture smell inventory 或 guard script，持续发现 facade 污染、越层依赖和 runtime service locator 膨胀。
- 对长期高频变更的核心模块，应持续审查模块膨胀风险；若中心模块长期吸纳无关职责，应优先拆分边界，而不是继续向“万能 core”堆积逻辑。

## 4. 模块边界

推荐层次：

| 层 | 负责内容 | 禁止直接依赖 |
| --- | --- | --- |
| `domain` | task、workflow、decision、result、policy objects | infra 细节、SDK 客户端 |
| `orchestration` | planner、orchestrator、transition service、recovery manager | 底层 DB driver、具体 web framework |
| `runtime` | execution、lease、worker、queue、sandbox、gateway | 产品叙事对象、UI 组件 |
| `infrastructure` | PostgreSQL、Redis、object store、provider adapter、observability adapter | 业务编排规则 |

边界规则：

- 跨层能力必须通过 interface / port 暴露。
- 不允许“上层直接偷调下层实现细节”。
- 领域对象不得持有基础设施 client。
- prompt、workflow、policy 文件不得替代强制系统代码边界。
- public facade 不得反向 re-export 私有实现，避免把偶然路径冻结成事实上的公共契约。
- 类型层 / contract 层不应直接绑定实现 shim；若必须 lazy/load，应通过明确 runtime boundary 承接。

## 5. 版本治理对象

必须显式版本化的对象：

- `workflow_dsl_version`
- `role_contract_version`
- `tool_schema_version`
- `event_schema_version`
- `message_parts_version`
- `memory_schema_version`
- `policy_bundle_version`
- `prompt_bundle_version`

## 6. 兼容性策略

| 对象 | 默认兼容策略 |
| --- | --- |
| workflow DSL | minor 向后兼容，major 允许 breaking change |
| role contract | minor 新增可选字段，major 改必填或语义 |
| tool schema | 生产内必须兼容两个相邻 minor |
| event schema | producer 与 consumer 至少兼容当前版和前一版 |
| memory schema | 升级时必须提供 migration 或 lazy upgrade 规则 |

## 7. 版本升级流程

```mermaid
flowchart TD
    A["Draft Schema / Boundary Change"] --> B["ADR / Contract Update"]
    B --> C["Compatibility Tests"]
    C --> D["Canary Rollout"]
    D --> E{"Metrics Healthy?"}
    E -- "Yes" --> F["Promote New Version"]
    E -- "No" --> G["Rollback / Dual-Read Continue"]
```

## 7.1 协议与恢复提示

对外协议或控制面握手至少应明确：

- protocol version negotiation
- role / scope boundary
- device / client identity shape
- structured recovery hint on auth or compatibility failure

规则：

- 协议变化属于 contract 变化，不应只靠实现细节悄悄漂移。
- 兼容失败时应尽量返回结构化恢复建议，而不是只暴露裸错误字符串。
- 对外方法、payload、notification 命名应遵循统一约定，例如 `*Params / *Response / *Notification` 或等价风格，不应在同一协议层混用多种命名体系。
- experimental / unstable surface 必须显式标记，并定义升格或删除路径，避免临时字段长期滞留为隐式正式接口。

## 8. 收口结论

成熟工业平台不能只靠“当前实现能跑”维持稳定。

正式的架构治理必须同时覆盖：

- 决策记录
- 层级边界
- schema 版本
- 兼容窗口
- 升级与回滚条件
