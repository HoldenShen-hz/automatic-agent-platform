# ADR-068 Multimodal Capability Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Users need to process images, audio, documents and other multimodal content, and pure text ModelGateway does not meet requirements.

## Decision

### Supported Modalities

| Modality | Input | Output | Scenario |
|----------|-------|--------|----------|
| text | Text | Text | Conversation, writing |
| image | Image/video frame | Text | Image understanding |
| audio | Audio | Text | Voice input |
| document | PDF/Word | Text | Document understanding |
| video | Video | Text | Video analysis |

### Multimodal Gateway

```typescript
interface MultimodalGateway {
  process(input: MultimodalInput): Promise<MultimodalOutput>;
  supported_modalities: Modality[];
}

interface MultimodalInput {
  content: ContentItem[];
  task_type: TaskType;
  preferences?: ProcessingPreferences;
}
```

### Modality Processing Pipeline

```
Input → Preprocessing → Modality Router → Specialized Processor → Fusion → Output
```

### Provider Abstraction

- Each modality supports multiple Providers
- Automatic failover
- Cost and latency routing

### Fusion Strategies

| Strategy | Description |
|----------|-------------|
| early_fusion | Early feature fusion |
| late_fusion | Late decision fusion |
| hierarchical | Hierarchical fusion |

### Content Safety

- Image content moderation
- Audio content moderation
- Document security scan

## Consequences

Advantages:

- Expands applicable scope
- Improves user experience
- Supports more scenarios

Trade-offs:

- Provider integration complexity
- Multimodal understanding cost is high

## Cross References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [Platform Architecture §16 Prompt Management and Versioning](../architecture/00-platform-architecture.md)

## Source Section

- `§68` Multimodal Capability Architecture