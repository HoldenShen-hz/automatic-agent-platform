# ADR-068 多模态能力Architecture

- Status：Accepted
- Decision日期：2026-04-20

## Background

user需要handle图片、语音、文档等多模态内容，纯文本的 ModelGateway 不满足需求。

## Decision

### supported的模态

| 模态 | 输入 | 输出 | 场景 |
|------|------|------|------|
| text | 文本 | 文本 | 对话、写作 |
| image | 图片/视频帧 | 文本 | 看图理解 |
| audio | 音频 | 文本 | 语音输入 |
| document | PDF/Word | 文本 | 文档理解 |
| video | 视频 | 文本 | 视频分析 |

### 多模态网关

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

### 模态handle管道

```
Input → Preprocessing → Modality Router → Specialized Processor → Fusion → Output
```

### Provider 抽象

- 每个模态supported多个 Provider
- 自动故障转移
- 成本和delay路由

### 融合策略

| 策略 | Description |
|------|------|
| early_fusion | 早期特征融合 |
| late_fusion | 晚期Decision融合 |
| hierarchical | 分层融合 |

### 内容security

- 图片内容审核
- 音频内容审核
- 文档security扫描

## Consequences

优点：

- 扩大适用范围
- 提升user体验
- supported更多场景

代价：

- Provider 集成复杂
- 多模态理解成本高

## 交叉references用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [平台Architecture §16 Prompt managevs版本化](../architecture/00-platform-architecture.md)

## 来源章节

- `§68` 多模态能力Architecture
