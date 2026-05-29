# ADR-039 Natural Language Task Entry Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Non-technical users need to interact with the platform via natural language. The platform needs to convert NL input into structured tasks.

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

### 6 intent_type (§6.3 reconciliation)

> Note: `cancel_task` was removed in §6.3. Please use `abort_task` (abort task in progress), `pause_task` (pause task), or `panic_kill` (emergency termination) instead.

| Type | Description |
|------|-------------|
| create_task | Create task |
| query_status | Query status |
| modify_task | Modify task |
| abort_task | Abort task in progress (replaces removed cancel_task) |
| pause_task | Pause task |
| create_goal | Create goal |
| decompress_goal | Decompress goal |
| panic_kill | Emergency termination (highest level, for security-critical scenarios) |

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

- High-risk intent requires explicit confirmation
- User confirmation required before execution

### LocaleConfig

| Language | Description |
|----------|-------------|
| zh-CN | Simplified Chinese |
| en-US | English |
| ja-JP | Japanese |
| de-DE | German |

- Fallback to en-US

## Consequences

Benefits:

- NL entry lowers usage barrier
- Ambiguity detection improves accuracy
- Multi-language support expands scope

Costs:

- NLU model required
- Ambiguity clarification may delay simple tasks

## Cross-References

- [ADR-040 Goal Decomposition Engine Architecture](./040-goal-decomposition-engine.md)

## Source Sections

- Section 39