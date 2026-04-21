# ADR-068 多模态能力架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

用户需要处理图片、语音、文档等多模态内容，纯文本的 ModelGateway 不满足需求。

## 决策

### 支持的模态

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

### 模态处理管道

```
Input → Preprocessing → Modality Router → Specialized Processor → Fusion → Output
```

### Provider 抽象

- 每个模态支持多个 Provider
- 自动故障转移
- 成本和延迟路由

### 融合策略

| 策略 | 说明 |
|------|------|
| early_fusion | 早期特征融合 |
| late_fusion | 晚期决策融合 |
| hierarchical | 分层融合 |

### 内容安全

- 图片内容审核
- 音频内容审核
- 文档安全扫描

## 后果

优点：

- 扩大适用范围
- 提升用户体验
- 支持更多场景

代价：

- Provider 集成复杂
- 多模态理解成本高

## 交叉引用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-015 Prompt 管理与版本化架构](./015-prompt-management-and-versioning.md)

## 来源章节

- `§68` 多模态能力架构
