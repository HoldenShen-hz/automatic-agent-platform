# ADR-039 Natural Language Task Entry Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Non-technical users need to interact with the platform through natural language, and the platform needs to convert NL input into structured tasks.

## Decision

### Core Components

| Component | Description |
|-----------|-------------|
| IntentParser | Intent parsing |
| DomainRouter | Domain routing |
| TaskBuilder | Task building |
| AmbiguityDetector | Ambiguity detection |

### IntentParseResult / DetectedIntent

```typescript
interface DetectedIntent {
  intent_type: IntentType;  // 6 types
  confidence: number;
  entities: Entity[];
  fallback_domain?: string;
}
```

### 6 intent_types

| Type | Description |
|------|-------------|
| create_task | Create task |
| query_status | Query status |
| modify_task | Modify task |
| cancel_task | Cancel task |
| create_goal | Create goal |
| decompress_goal | Decompress goal |

### RiskPreview

```typescript
interface RiskPreview {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
}
```

### Multi-Turn Conversation State Machine

- Maintains conversation context
- Supports follow-up questions and clarifications

### High-Risk Intent Handling

- High-risk intents must be explicitly confirmed
- User confirmation required before execution

### LocaleConfig

| Language | Description |
|----------|-------------|
| zh-CN | Simplified Chinese |
| en-US | English |
| ja-JP | Japanese |
| de-DE | German |

- Falls back to en-US

## Consequences

Positive:
- NL entry lowers usage barrier
- Ambiguity detection improves accuracy
- Multi-language support expands scope

Negative:
- NLU model requires training and maintenance
- Ambiguity detection may not be 100% accurate

## Cross-References

- [ADR-040 Goal Decomposition Engine Architecture](./040-goal-decomposition-engine.md)
- [ADR-082 Natural Language Entry and Goal Decomposition](./082-natural-language-entry-and-goal-decomposition.md)

## Source Sections

- `§39` Natural Language Task Entry
