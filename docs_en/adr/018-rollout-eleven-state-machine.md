# ADR-018 Rollout 十一态Status机vs六阶段发布

- Status：Superseded by ADR-075
- Decision日期：2026-04-17
- 当前权威规范：ADR-075《六级受控发布vs Rollout Status机》

> Historical record only. Do not implement from this document.

## Background

ADR-018 曾via提出过一版 `RolloutStatus` 十一态vs六级发布模型，用来Description从Recommendation态到渐进式放量再到回滚的完整生命cycle。

随着受控发布链路、Status机边界和回滚门槛统一收敛到 ADR-075，本文件中的Status集合、流量分级、thresholdvs迁移步骤已via不再is当前实现的权威来源。

## Conclusion

- ADR-018 only保留为历史record，used for解释曾via为什么探索过更细粒度的 rollout Status拆分。
- 任何新的实现、测试、运维规则、thresholdconfigure或Status流转，均必须以 ADR-075 为准。
- 如需查阅当前发布链路，请directly参考 [ADR-075](./075-controlled-rollout-release.md)。

## 保留原因

- 历史审计vs评审文档仍会references用 ADR-018 #。
- 部分旧讨论record和设计分支曾以 ADR-018 作为Background材料，需要保留可追溯性。

## 迁移Description

- 如果你正在查找 rollout Statusdefines，请转到 ADR-075。
- 如果你正在查找自动回滚、灰度发布、阶段门禁或稳定态准入，请转到 ADR-075。
- 如果你正在修复旧文档中的 ADR-018 references用，请把“执lines依据”改写为 ADR-075，把 ADR-018 保留为历史Backgroundreferences用。
