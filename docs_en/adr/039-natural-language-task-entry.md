# ADR-039 自然语言任务入口Architecture

- Status：Accepted
- Decision日期：2026-04-20

## Background

非技术user需要via自然语言vs平台交互，平台需要将 NL 输入转换为结构化任务。

## Decision

### 核心组件

| 组件 | Description |
|------|------|
| IntentParser | 意图解析 |
| DomainRouter | 领域路由 |
| TaskBuilder | 任务构建 |
| AmbiguityDetector | 歧义检测 |

### IntentParseResult / DetectedIntent

```typescript
interface DetectedIntent {
  intent_type: IntentType;  // 6 种class型
  confidence: number;
  entities: Entity[];
  fallback_domain?: string;
}
```

### 6 种 intent_type（§6.3 reconciliation）

> 注意：`cancel_task` 已于 §6.3 中移除，请uses `abort_task`（中止进lines中的任务）、`pause_task`（暂停任务）或 `panic_kill`（紧急终止）替代。

| class型 | Description |
|------|------|
| create_task | 创建任务 |
| query_status | 查询Status |
| modify_task | 修改任务 |
| abort_task | 中止进lines中的任务（替代已移除的 cancel_task） |
| pause_task | 暂停任务 |
| create_goal | 创建目标 |
| decompress_goal | 分解目标 |
| panic_kill | 紧急终止（最高级别，used forsecuritycritical场景） |

### RiskPreview

```typescript
interface RiskPreview {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
}
```

### 多轮对话Status机

- 维护对话上下文
- supported追问和澄清

### 高风险 intent handle

- 高风险 intent 必须显式确认
- user确认后才能执lines

### LocaleConfig

| 语言 | Description |
|------|------|
| zh-CN | 简体中文 |
| en-US | 英语 |
| ja-JP | 日语 |
| de-DE | 德语 |

- fallback 到 en-US

## Consequences

优点：

- NL 入口降低uses门槛
- 歧义检测提高准确性
- 多语言supported扩大适用范围

代价：

- NLU 模型
- 歧义澄清可能delay简单任务

## 交叉references用

- [ADR-040 目标分解references擎Architecture](./040-goal-decomposition-engine.md)

## 来源章节

- Section 39
