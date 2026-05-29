# ADR-055 Agent 市场vs生态

- Status：Accepted
- Decision日期：2026-04-20

## Background

平台需要开放的 Agent 市场，让合作伙伴和社区能贡献和分享 Agent Pack。

## Decision

### Marketplace 结构

```typescript
interface MarketplaceListing {
  listing_id: string;
  pack_id: string;
  publisher: PublisherInfo;
  category: ListingCategory;
  pricing: PricingModel;
  rating: Rating;
  reviews: Review[];
  download_count: number;
}

type ListingCategory =
  | 'code_development'
  | 'content_creation'
  | 'customer_service'
  | 'data_analytics'
  | 'hr'
  | 'finance'
  | 'custom';
```

### 发布流程

1. 开发者开发 Pack
2. 本地测试（覆盖率 ≥80%）
3. 提交审核
4. authentication评估（Prompt Injection 检查、code签名验证、SBOM 审查、漏洞扫描）
5. 上架市场

### 定价模型

| 模型 | Description |
|------|------|
| free | 免费 |
| one_time | 一iterations性购买 |
| subscription | 订阅制 |
| usage_based | 按uses量计费 |

### 评价vs排lines

- user评价（1-5 星）
- 下载量排lines
- 趋势榜
- 编辑推荐

## Consequences

优点：

- 生态开放吸references合作伙伴
- 市场机制激励高质量 Pack
- authentication流程保证质量

代价：

- 平台治理复杂性
- 质量参差不齐风险

## 交叉references用

- [平台Architecture §22 SDK vs开发者体验](../architecture/00-platform-architecture.md)
- [平台Architecture §30 Business Pack 模型](../architecture/00-platform-architecture.md)

## 来源章节

- `§55` Agent 市场vs生态
