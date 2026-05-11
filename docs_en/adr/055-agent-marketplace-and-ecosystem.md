# ADR-055 Agent Marketplace and Ecosystem

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs an open Agent marketplace where partners and the community can contribute and share Agent Packs.

## Decision

### Marketplace Structure

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

### Publishing Process

1. Developer builds Pack
2. Local testing (coverage >= 80%)
3. Submit for review
4. Certification evaluation (Prompt Injection checks, code signature verification, SBOM review, vulnerability scanning)
5. List on marketplace

### Pricing Models

| Model | Description |
|-------|-------------|
| free | Free |
| one_time | One-time purchase |
| subscription | Subscription |
| usage_based | Usage-based billing |

### Ratings and Rankings

- User ratings (1-5 stars)
- Download rankings
- Trending list
- Editor's picks

## Consequences

Advantages:

- Open ecosystem attracts partners
- Market mechanism incentivizes high-quality Packs
- Certification process ensures quality

Costs:

- Platform governance complexity
- Quality inconsistency risk

## Cross-References

- [Platform Architecture §22 SDK and Developer Experience](../architecture/00-platform-architecture.md)
- [Platform Architecture §30 Business Pack Model](../architecture/00-platform-architecture.md)

## Source Section

- `§55` Agent Marketplace and Ecosystem