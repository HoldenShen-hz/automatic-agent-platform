# ADR-039 自然语言任务入口架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

非技术用户需要通过自然语言与平台交互，平台需要将 NL 输入转换为结构化任务。

## 决策

### 核心组件

| 组件 | 说明 |
|------|------|
| IntentParser | 意图解析 |
| DomainRouter | 领域路由 |
| TaskBuilder | 任务构建 |
| AmbiguityDetector | 歧义检测 |

### IntentParseResult / DetectedIntent

```typescript
interface DetectedIntent {
  intent_type: IntentType;  // 6 种类型
  confidence: number;
  entities: Entity[];
  fallback_domain?: string;
}
```

### 6 种 intent_type（§6.3 reconciliation）

> 注意：`cancel_task` 已于 §6.3 中移除，请使用 `abort_task`（中止进行中的任务）、`pause_task`（暂停任务）或 `panic_kill`（紧急终止）替代。

| 类型 | 说明 |
|------|------|
| create_task | 创建任务 |
| query_status | 查询状态 |
| modify_task | 修改任务 |
| abort_task | 中止进行中的任务（替代已移除的 cancel_task） |
| pause_task | 暂停任务 |
| create_goal | 创建目标 |
| decompress_goal | 分解目标 |
| panic_kill | 紧急终止（最高级别，用于安全critical场景） |

### RiskPreview

```typescript
interface RiskPreview {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
}
```

### 多轮对话状态机

- 维护对话上下文
- 支持追问和澄清

### 高风险 intent 处理

- 高风险 intent 必须显式确认
- 用户确认后才能执行

### LocaleConfig

| 语言 | 说明 |
|------|------|
| zh-CN | 简体中文 |
| en-US | 英语 |
| ja-JP | 日语 |
| de-DE | 德语 |

- fallback 到 en-US

## 后果

优点：

- NL 入口降低使用门槛
- 歧义检测提高准确性
- 多语言支持扩大适用范围

代价：

- NLU 模型