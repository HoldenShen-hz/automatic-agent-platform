# ADR-104 Domain Recipe Twelve Archetypes

---

## OAPEFLIR 关联

- **Observe**: 汇总 24 域 workflow 模式
- **Assess**: 归并成 archetype
- **Plan**: 为 archetype 生成 baseline recipe
- **Execute**: 驱动领域 baseline 创建
- **Feedback**: 校验 archetype 适配率
- **Learn**: 更新 archetype 分类
- **Improve**: 减少特化成本
- **Release**: archetype 成为域接入基线资产

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

原先 recipe 原型过少，无法覆盖 24 个垂直业务域。

## 决策

`DomainRecipe` 扩展为十二种 archetype，覆盖 CRUD、Analytics、Creative、Realtime、Trading、Compliance、Research、Adversarial、Moderation、Logistics、Conversational、IncidentOps。

### 与 DomainDescriptor.recipes 的绑定

十二种 archetype 必须绑定到 `DomainDescriptor.recipes` 字段（见 ADR-081 §1 和 ADR-100 §1），作为领域接入的必选扩展点。每个 archetype 在领域注册时必须声明：

- `archetype`: 对应十二种之一
- `baselineRecipe`: 该 archetype 的基线 recipe bundle
- `适配域`: 该 archetype 覆盖的具体业务域列表

### 与四阶段 onboarding 的集成

领域接入（ADR-103 四阶段 runbook）的第一阶段（建模）和第二阶段（开发）必须完成 archetype 选型与 baseline recipe 绑定，方可进入认证阶段。详见 ADR-081 §2 领域接入 runbook。

### 与 ADR-105 latency tier 的默认映射

十二种 archetype 在 domain registration 时还必须声明默认 `latency_tier`，避免 recipe 只描述工作流形态而不约束执行时延边界。推荐默认映射如下：

| Archetype | 默认 latency tier | 说明 |
|-----------|------------------|------|
| CRUD | 准实时 | 读写业务通常以秒级响应为主 |
| Analytics | 批处理 / 准实时 | 报表与聚合默认不走实时热路径 |
| Creative | 准实时 | 生成类任务允许 LLM + standard harness |
| Realtime | 实时 | 交互型控制面和协同场景 |
| Trading | 超低延迟（deterministic）或实时 | 若声明超低延迟，必须满足 ADR-105 的 `deterministic_hot_path_only` |
| Compliance | 准实时 / 批处理 | 规则扫描与审计评估通常非热路径 |
| Research | 批处理 | 深度检索、分析与探索默认离线优先 |
| Adversarial | 准实时 | 对抗评测与红队任务需保留分析链路 |
| Moderation | 实时 | 内容拦截与安全判定需快速反馈 |
| Logistics | 实时 / 准实时 | 调度与履约跟踪需看场景选择 |
| Conversational | 实时 | 对话与协同默认 <500ms P99 级别 |
| IncidentOps | 实时 / 准实时 | 告警处置实时优先，复盘分析可降级 |

规则：

- `DomainDescriptor.recipes[].archetype` 与 `latency_tier` 必须同时登记，不能只选 recipe 不声明执行时延边界。
- 若 archetype 默认映射为 `超低延迟（deterministic）`，则域风险画像必须同时满足 ADR-105 的 `deterministic_hot_path_only` 约束。
- 偏离默认映射时，必须在 domain review 中给出原因和补充 guardrail，避免 recipe 选择与运行时能力不匹配。

## 后果

- 24 域 baseline 有统一而可扩展的 recipe 模型
- archetype 选型是领域接入的必选步骤，不再是可选扩展
- recipe archetype 与 latency tier 形成显式绑定，避免 cross-ADR 语义断裂
