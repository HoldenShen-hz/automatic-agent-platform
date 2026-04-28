# ADR-037 业务域建模与接入架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

不同业务域（财务、HR、客服、代码研发等）在风险等级、知识结构、工具生态、评估标准上差异巨大。平台需要结构化的领域建模框架。

## 决策

### DomainDescriptor 接口（14 字段）

```typescript
interface DomainDescriptor {
  domain_id: string;
  name: string;
  description: string;
  domain_class: DomainClass;      // 24 种垂直域类型
  risk_profile: DomainRiskProfile;
  knowledge_schema: DomainKnowledgeSchema;
  eval_framework: DomainEvalFramework;
  prompt_library: DomainPromptLibrary;
  recipes: DomainRecipe[];
  interaction_policy: DomainInteractionPolicy;
  governance_policy: DomainGovernancePolicy;
  lifecycle_state: LifecycleState;
  created_at: string;
  updated_at: string;
}
```

### DomainClass 24 种类型

| 类型 | 说明 |
|------|------|
| quant_trading | 量化交易 |
| ecommerce | 电商 |
| ad_promotion | 广告推广 |
| financial_services | 金融服务 |
| data_processing | 数据处理 |
| code_development | 代码开发 |
| user_operations | 用户运营 |
| industry_research | 行业调研 |
| academic_research | 学术调研 |
| enterprise_knowledge | 企业知识库 |
| finance | 财务 |
| legal | 法务 |
| live_streaming | 在线直播 |
| ad_creative_production | 广告素材制作 |
| game_development | 游戏开发 |
| game_publishing | 游戏上架 |
| human_resources | 人力资源 |
| supply_chain_logistics | 供应链与物流 |
| healthcare | 医疗健康 |
| education_training | 教育培训 |
| customer_service | 客户服务 |
| content_moderation_safety | 内容审核与安全 |
| it_ops_sre_devops | IT 运维 SRE/DevOps |
| marketing_brand | 市场营销与品牌 |

### 领域风险画像

- `domains/risk-profile/`
- 可覆写平台级 risk_matrix

### 领域知识 Schema

- `domains/knowledge-schema/`
- 定义领域知识检索策略和时效性

### 领域评估框架

- `domains/eval-framework/`
- 定义领域特定的评估指标

### DomainRecipe 模板

- `domain-recipe-service.ts` (271 行)
- 4 个 archetype：prototype_analysis/prototype_implementation/prototype_review/prototype_release

### CLI 命令

- `domain init` 初始化
- `domain validate` 验证

## 后果

优点：

- 结构化建模使平台能理解领域差异
- 可覆写机制支持定制化
- CLI 工具简化接入

代价：

- DomainDescriptor 复杂度较高
- 领域建模需要领域专家参与

## v4.3 ADR Remediation

- A-32: 本 ADR 原先把 `DomainClass` 压缩成 7 种宽泛分类，根因是领域建模 ADR 形成时仍偏向产品市场分组，没有随着主架构把 24 个垂直域作为统一元模型实例化入口而扩展。修复：正文现把 `DomainClass` 收敛到 24 个垂直域类型，并与主架构 `§71-§94` 的域目录对齐。

## 交叉引用

- [ADR-030 Runtime 执行面](./030-runtime-execution-plane.md)
- [ADR-038 业务域接入 Runbook](./038-business-domain-onboarding-runbook.md)

## 来源章节

- `§37` 业务域建模与接入架构
