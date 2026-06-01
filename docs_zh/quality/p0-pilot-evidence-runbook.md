# P0 Pilot Evidence 接入说明

本说明对应三条 P0 主线：

- `coding`
- `knowledge-base`
- `customer-service`

目标不是伪造“真实 pilot 结果”，而是把真实样本输入收成统一证据包，用于：

- `真实 pilot`
- `真实 eval`
- `真实 red-team`
- `真实 ROI`
- `真实外部 benchmark 对打`

## 初始化

先生成输入模板目录：

```bash
npm run pilot:evidence:p0:init
```

会生成：

- `data/pilot-evidence-inputs/coding/`
- `data/pilot-evidence-inputs/knowledge-base/`
- `data/pilot-evidence-inputs/customer-service/`

每个目录固定包含：

- `eval-cases.json`
- `redteam-results.json`
- `roi-samples.json`
- `benchmark-results.json`
- `pilot-observations.json`
- `README.json`

## 运行

全部 P0 一起跑：

```bash
npm run pilot:evidence:p0
```

只跑单个 division：

```bash
npm run pilot:evidence:p0 -- --division=coding
```

## 输出

结果会写到：

- `artifacts/validation/p0-pilot-evidence/`

其中包括：

- 每个 division 的 `evidence-package.json`
- 每个 division 的 `summary.md`
- 聚合的 `p0-pilot-evidence-report.json`
- 聚合的 `p0-pilot-evidence-summary.md`

## 校验规则

运行器现在会严格校验输入，不再接受隐式类型转换。常见失败包括：

- 布尔字段写成字符串
- benchmark `metricId` 不在 family 映射里
- 缺失必需输入文件
- observation / ROI / red-team 条目字段缺失

缺真实输入时，会直接报：

- `pilot_evidence.input_missing:<path>`

字段类型错误会直接报：

- `pilot_evidence.invalid_*:<fieldPath>`

## 当前边界

这条链已经完成的是：

- 统一输入契约
- 统一聚合逻辑
- readiness 阈值判定
- 证据包落盘

还需要真实运营侧继续提供的，是各 division 的真实样本本身，而不是更多占位代码。
