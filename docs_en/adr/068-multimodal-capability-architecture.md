# ADR-068 Multimodal Capability Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Users need to process multimodal content such as images, audio, and documents; text-only ModelGateway does not meet requirements.

## Decision

### Supported Modalities

| Modality | Input | Output | Use Cases |
|----------|-------|--------|-----------|
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
- Document security scanning

## Consequences

Positive:

- Expands applicable scope
- Improves user experience
- Supports more scenarios

Negative:

- Provider integration complex
- Multimodal understanding cost high

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [Platform Architecture §16 Prompt Management and Versioning](../architecture/00-platform-architecture.md)

## Source Sections

- `§68` Multimodal Capability Architecture