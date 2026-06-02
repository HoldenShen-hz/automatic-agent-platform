# Division Catalog

本目录用于维护 `divisions/` 的权威 family map。它既覆盖容易混淆的别名家族，也覆盖其余单体 division 的归属，避免把“名称相近”误读成“职责相同”，也避免目录已存在但 catalog 缺席。

## 质量家族

| division | 角色定位 | 说明 |
| --- | --- | --- |
| `quality-assurance` | canonical | 生产发布前的完整回归、缺陷归因、质量认证 |
| `qa` | legacy alias | 仅用于轻量 smoke validation / 快速回归分诊，不承担 release certification |

说明：`qa` 与 `quality-assurance` 故意使用不同 `default_workflow`。前者是 smoke alias，后者是 release certification canonical division，不能按同义目录处理。

## 运维家族

| division | 角色定位 | 说明 |
| --- | --- | --- |
| `engineering-ops` | build/release delivery | 工程交付、流水线、构建与发布协同 |
| `general-ops` | generic operator fallback | 通用兜底执行面，适合低专属度任务 |
| `operations` | service operations | 服务运行、值守、日常操作 |
| `it-operations` | workstation / identity ops | 终端、账号、设备与身份域操作 |

## 机器可校验来源

- `config/quality/division-catalog.json`
- `scripts/ci/audit-division-workflows.mjs`

## 机器字段对照

| config/quality/division-catalog.json | 文档含义 |
| --- | --- |
| `divisionId` | division 目录与 `division.yaml` 的 canonical ID |
| `family` | 治理分组，不等同于目录别名 |
| `scope` | 该 division 在 family 内的作用范围 |
| `canonicalDivisionId` | 仅用于显式 alias，例如 `qa -> quality-assurance` |

## 当前覆盖原则

- `divisions/` 目录中的活跃 division 都必须在 catalog 中登记。
- 只有 `qa -> quality-assurance` 这类显式 alias 才使用 `canonicalDivisionId`。
- 其余 division 至少要声明 `family` 与 `scope`，用于治理和审计分组。

## 全量 Division Matrix

当前 canonical catalog 覆盖 32 个活跃 division，以下矩阵必须与 `config/quality/division-catalog.json` 保持一致。

| division | family | scope | 角色 |
| --- | --- | --- | --- |
| `academic-research` | `research` | `academic_knowledge_workflows` | canonical |
| `advertising` | `growth` | `paid_media_campaigns` | canonical |
| `analytics` | `analytics` | `metrics_analysis` | canonical |
| `coding` | `engineering` | `software_delivery` | canonical |
| `content` | `content` | `editorial_production` | canonical |
| `content-moderation` | `safety` | `moderation_review` | canonical |
| `customer-service` | `customer-ops` | `support_resolution` | canonical |
| `data-engineering` | `data` | `pipelines_storage` | canonical |
| `design` | `product` | `design_systems` | canonical |
| `devops` | `operations` | `infra_automation` | canonical |
| `ecommerce` | `commerce` | `catalog_orders` | canonical |
| `qa` | `quality` | `smoke_validation_alias` | legacy alias -> `quality-assurance` |
| `quality-assurance` | `quality` | `release_certification` | canonical |
| `engineering-ops` | `operations` | `build_release_delivery` | canonical |
| `finance-accounting` | `finance` | `bookkeeping_reporting` | canonical |
| `financial-services` | `finance` | `regulated_financial_ops` | canonical |
| `general-ops` | `operations` | `generic_operator_fallback` | canonical |
| `healthcare` | `healthcare` | `clinical_ops_support` | canonical |
| `human-resources` | `people` | `workforce_processes` | canonical |
| `industry-research` | `research` | `market_industry_research` | canonical |
| `operations` | `operations` | `service_operations` | canonical |
| `it-operations` | `operations` | `workstation_identity_operations` | canonical |
| `knowledge-base` | `knowledge` | `internal_knowledge_ops` | canonical |
| `legal` | `legal` | `legal_review` | canonical |
| `live-streaming` | `media` | `live_stream_operations` | canonical |
| `product-management` | `product` | `roadmap_product_ops` | canonical |
| `project-management` | `delivery` | `project_execution` | canonical |
| `quant-trading` | `finance` | `market_execution` | canonical |
| `research` | `research` | `generic_research_fallback` | canonical |
| `security` | `security` | `security_operations` | canonical |
| `support` | `customer-ops` | `generic_support_fallback` | canonical |
| `user-operations` | `customer-ops` | `user_lifecycle_operations` | canonical |

## 非目标

- 本文档不是 plugin capability registry。
- plugin 的 `domainIds` / `capabilityIds` 权威来源在 `src/plugins/builtin-plugin-registry.ts` 和对应 runtime plugin 定义。
- `divisions/` 负责路由、角色、workflow 和风险边界，不负责维护 plugin 能力枚举。

## 优先级说明

- `division.yaml` 中的 `priority` 是粗粒度路由权重，不要求全局唯一。
- 同档位并列是允许的；真实路由仍需要结合 trigger 命中长度、显式 disambiguate 规则和稳定排序。
- 新增 division 时，先判断是否需要新的优先级带宽；若只是同一类能力中的并列候选，可以复用现有档位。

## 优先级档位

| priority | 语义 |
| --- | --- |
| `20` | 通用运行/值守兜底 |
| `30` | 轻量分析 / smoke / 内容类低侵入任务 |
| `35` | 研究 / 设计类中低优先入口 |
| `40` | 通用项目 / 数据 / 产品执行 |
| `45` | 高频业务执行面 |
| `50` | 工程交付主干 |
| `55` | IT 运维专属入口 |
| `60` | 高风险强治理域 |

## Workflow / Blueprint 语义

- `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref` 是当前的语义权威字段，用来区分“默认单任务计划”与“多步编排计划”。
- `default_workflow` / `orchestration_workflow` 只保留给 legacy loader；对于单 workflow division，两者可以暂时指向同一个 workflow id。
- 新增或补齐 division 定义时，应优先补 blueprint ref，而不是继续把语义塞进 legacy workflow alias。

## 维护规则

- 新增名称相近的 division 前，必须先补 family map。
- alias division 必须在描述、workflow、schema 上明确缩窄作用域，不能与 canonical division 形成同义重复。
