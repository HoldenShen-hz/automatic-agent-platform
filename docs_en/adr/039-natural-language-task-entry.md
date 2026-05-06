# ADR-039 Natural Language Task Entry Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Non-technical users need to interact with the platform through natural language. The platform needs to convert NL input into structured tasks.

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

### 5 intent_type Types

| Type | Description |
|------|-------------|
| create_task | Create task |
| query_status | Query status |
| modify_task | Modify task |
| create_goal | Create goal |
| decompress_goal | Decompose goal |

Note: cancel_task has been removed from §6.3. Callers must use abort/pause/panic kill semantics instead.

### RiskPreview

```typescript
interface RiskPreview {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
}
```

### Multi-turn Conversation State Machine

- Maintains conversation context
- Supports follow-up questions and clarification

### High-risk Intent Handling

- High-risk intents must be explicitly confirmed
- Execution only after user confirmation

### LocaleConfig

| Language | Description |
|----------|-------------|
| zh-CN | Simplified Chinese |
| en-US | English |
| ja-JP | Japanese |
| de-DE | German |

- Fallback to en-US

## Consequences

Pros:

- NL entry lowers usage barrier
- Ambiguity detection improves accuracy
- Multi-language support expands scope

Cons:

- NLU model accuracy limitations
- Multi-language support increases complexity

## Cross-references

- [ADR-040 Goal Decomposition Engine Architecture](./040-goal-decomposition-engine.md)
- [ADR-042 Progressive Autonomy Model](./042-progressive-autonomy-model.md)

## Source Section

- `§39` Natural Language Task Entry Architecture
