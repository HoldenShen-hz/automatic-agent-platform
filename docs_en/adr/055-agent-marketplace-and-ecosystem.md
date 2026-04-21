# ADR-055 Agent Marketplace and Ecosystem

- Status: Accepted
- Decision Date: 2026-04-20

## Context

A thriving ecosystem requires a marketplace where agents, plugins, and packs can be published, discovered, and consumed.

## Decision

### Marketplace Architecture

```
src/scale-ecosystem/marketplace/
```

### CatalogEntry

```typescript
interface CatalogEntry {
  entry_id: string;
  type: 'agent' | 'plugin' | 'pack';
  name: string;
  description: string;
  version: string;
  publisher: string;
  category: string[];
  tags: string[];
  rating: number;
  install_count: number;
  price: PriceModel;
  compatibility: CompatibilityInfo;
}
```

### Lifecycle States

| State | Description |
|-------|-------------|
| draft | Initial creation |
| certifying | Under review/certification |
| published | Available in marketplace |
| deprecated | No longer supported |
| archived | Removed from marketplace |

### Certification Pipeline

1. Code review and security scan
2. Functional testing
3. Compatibility verification
4. Manual review and approval

### Revenue Model

- Free tier for community contributions
- Revenue share for commercial entries
- Subscription model for enterprise packs

## Consequences

Positive:
- Centralized discovery increases adoption
- Certification ensures quality and security
- Revenue model incentivizes development

Negative:
- Marketplace maintenance overhead
- Certification may slow down publishing

Trade-offs:
- Quality vs. velocity
- Openness vs. control

## Cross-References

- [ADR-015 Unified Extension Marketplace](./015-unified-extension-marketplace.md)
- [ADR-066 Plugin SPI Framework](./066-plugin-spi-framework.md)

## Source Sections

- `§55` Agent Marketplace and Ecosystem