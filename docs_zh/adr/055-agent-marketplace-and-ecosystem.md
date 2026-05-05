# ADR-055 Agent 市场与生态

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

平台需要开放的 Agent 市场，让合作伙伴和社区能贡献和分享 Agent Pack。

## 决策

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
4. 认证评估（见下节）
5. 上架市场

### 认证评估（§11.7）

| 检查项 | 说明 |
|--------|------|
| Prompt Injection 检测 | 检测恶意提示词注入攻击 |
| 签名验证 | Pack 签名验证，确保来源可信 |
| SBOM 完整性 | 软件物料清单，披露所有依赖 |
| 依赖漏洞扫描 | CVES 扫描，零高危漏洞 |
| 最小权限原则 | 仅申请必要权限，拒绝冗余授权 |
| Sandbox Egress 控制 | 出站流量受限于声明的端点白名单 |
| Tool-call 攻击模拟 | 验证工具调用边界，防止 prompt 逃逸 |

所有 Pack 上架前必须通过以上全部认证检查。

### 定价模型

| 模型 | 说明 |
|------|------|
| free | 免费 |
| one_time | 一次性购买 |
| subscription | 订阅制 |
| usage_based | 按使用量计费 |

### 评价与排行

- 用户评价（1-5 星）
- 下载量排行
- 趋势榜
- 编辑推荐

## 后果

优点：

- 生态开放吸引合作伙伴
- 市场机制激励高质量 Pack
- 认证流程保证质量

代价：

- 平台治理复杂性
- 质量参差不齐风险

## 交叉引用

- [平台架构 §22 SDK 与开发者体验](../architecture/00-platform-architecture.md)
- [平台架构 §30 Business Pack 模型](../architecture/00-platform-architecture.md)

## 来源章节

- `§55` Agent 市场与生态
