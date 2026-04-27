平台总体架构 v4.0 — 方案设计审查
对象: docs_zh/architecture/00-platform-architecture.md | 日期: 2026-04-27 | 总计: 115项

Critical（10）
#	位置	问题	建议
1	§13/§45	OAPEFLIR 15状态 vs Harness 6状态描述同一实体，无权威声明	OAPEFLIR=概念，Harness=运行时，状态为投影
2	§33	128+周无人力模型无MVP，Phase 9线性48周	8-12周MVP仅P1+P3
3	§52.3/§54.2	手动故障转移 vs 99.99% SLA 不可兼得	自动转移或降至99.95%
4	§19.5	调用深度上限10 vs 5×3=15 矛盾	统一
5	§26.3	86表对Phase1 SQLite过重	按Phase定义子集
6	§25.6	跨区域active-active无冲突算法，CAS为单leader原语	single-leader或CRDT
7	§71/§15	量化交易<1ms vs LLM 30s超时，差6个数量级	双模式：离线规划+确定性执行
8	§45.24/§58.4	LLM不保证seed确定性，replay假设不成立	区分trace replay和re-execution
9	§18.3	Budget预检TOCTOU竞态，N并发可超限N×	原子compare-and-increment
10	§42.5	Trust降低操作固有风险→权限提升路径	Trust仅减审批摩擦不减风险分
设计缺陷（53）
#	位置	问题	建议
11	§14.11	SideEffect无approved→revoked转移	增revoked+commit重验证
12	§14.9	Scheduler依赖运行时状态replay不可重现	调度决策记为事件
13	§7.3	Outbox Poller lease过期间事件停滞无TTL	lease≤10s+热备
14	§25.9	Budget Ledger租户级序列化瓶颈	子账本分片
15	§25.10	RunVersionLock vs GraphPatch需新版本未定义	VersionLockOverridePolicy
16	§29.2	Memory 6层截断驱逐优先级未定义	ContextEvictionPolicy
17	§5.3	ControlDirective混合SRE/业务授权	拆分两类
18	§15.5	"语义缓存"实为句法hash	改名或embedding
19	§15.6	部分响应≥80%长度即接受结构可能无效	格式感知检查
20	§19.5	协作协议无状态机无排序	状态机+序列号
21	§17.5	LLM-as-Judge降级不可用canary质量门失效	D1+暂停canary
22	§20.4	休眠210天唤醒遇不兼容DomainDescriptor	快照+对比
23	§21.1	协作编辑无并发模型	锁/CRDT/分支选一
24	§23.2	Crypto-shredding打断跨租户审计链	存不含PII摘要
25	§37.4	域声明任意conflict_strategy平台不验证	闭合枚举+插件
26	§16.3/§16.4	Bundle原子性vs canary回滚后in-flight用坏版本	bundle_revocation
27	§44.5	单人模式高风险仅弹窗=零监督	冷却+dry-run
28	§45.5	Token budget从cost推导正交混淆	分离字段
29	§84-§94	24域风险评分无校准方法论	分段标准
30	§41.1	Trigger和用户共享预算无优先级	预留用户比例
31	§45.16/§45.23	Working Memory作用域vs多Agent隔离矛盾	每角色权限
32	§42.3	90天信任断崖瞬间降级	连续衰减
33	§45.20	五层Guardrails无冲突优先级无循环上限	最严胜出+上限
34	§45.10	Evaluator/Generator共享LLM共模失效	medium+不同model
35	§60.1	Panic TTL自动过期重启被入侵Agent	过期→重确认
36	§52.3	跨区域LLM仅检输入PII输出可能生成	输出扫描
37	§53.4	优先级auto-upgrade高负载系统崩溃	限额或权重老化
38	§62.2	边缘SyncQueue依赖链根被拒后续仍提交	拓扑序+中止
39	§61.3	Agent生命周期无testing→draft回退	增加回退
40	§29.1	Knowledge trust无降级路径	contested降级
41	§25.3	CAS+Lease+Fencing S4规模写放大	分区+批处理
42	§6.7	Webhook 50失败无退避429/500同阈值	指数退避+区分
43	§36.2	Budget预留无超时/释放/死锁	TTL+仲裁
44	§46.3	OrgTree级联无Saga/补偿	Saga
45	§48.2	SCIM DLQ无重试/对账	策略+周期对账
46	§47/§46	ApprovalRouteSnapshot可基于旧org版本	附orgVersion
47	§53.2	ResourceVector全量满足→队首阻塞	work-stealing
48	§54.1	SLATier模型无per-class SLO字段	增加结构
49	§57.1	Credential rotation双写窗口未定义时序	状态机
50	§50.3	Chinese Wall释放无原子性	2PC
51	§51.1	委托级联撤销无传播SLO	有界传播
52	§19.1	委托无timed_out终态deadline过期子run持预算	增终态+释放
53	§19.1	Broadcast聚合quorum不足无降级	降级路径
54	§20.2	ResumeCompatibilityCheck无超时	总超时
55	§20.3	Timer±30s但IT-ops/客服SLO<30s	高精度定时器
56	§17.2	Holdout隔离仅策略无技术强制	密封存储
57	§37.2/§20.4	Schema 2版本窗口vs休眠210天	延长或强制迁移
58	§19.5	协作消息无幂等键重试双结算	idempotency_key
59	§18.3	Sweeper无时钟偏差容忍	安全余量
60	§37.4/§19.3	跨域委托知识冲突策略无优先级	继承规则
61	§39.2	NL Router误路由无反馈弧	rejection→reroute
62	§21.1	审批委托重置TTL无上限	限制链长
63	§19.1	Broadcast bid落选者token无结算	计入父run
运行时与可靠性（20）
#	位置	问题	建议
64	§45.5	ContextSnapshot每迭代写P5无驱逐→存储无界增长	保留策略+compaction
65	§45.7/§45.21	Evaluator为唯一瓶颈降级无旁路/熔断	熔断策略
66	§62.3	Edge SyncQueue hash-chain vs非线性依赖图不可线性化	允许链分叉
67	§45.19	Run version lock使async run无法接收安全热补丁	force-upgrade机制
68	§56.4	Improvement released后无回滚状态	增加rollback转移
69	§59.6	Forensic budget P0事件时可能已耗尽	事件预留或无限额
70	§45.18	HITL takeover外部变更不进snapshot恢复后上下文过时	takeover变更记录
71	§53.2/§47	审批队列无基于审核者可用性的背压	准入控制
72	§66.2	合规报告signoff无超时可无限停generated	超时+升级
73	§60.3	Break-glass 72h review无强制	提醒+后果
74	§56.2	Feedback无统计检测协同偏差注入	集体异常检测
75	§67	容量预测无精度反馈/模型校准	forecast vs actual追踪
76	§6.3	废弃task_draft无过期清理→intake表无界增长	expires_at+sweeper
77	§14.10	Run终态无资源清理协议(lease/budget/secret)	RunTerminationCleanup序列
78	§8.2/§32	无graceful shutdown/drain协议	WorkerDrainProtocol
79	§28.3	EventEnvelope无spanId断event-to-span关联	增加spanId
80	§11.7	Plugin崩溃后无资源清理(文件/socket)	cleanup hook
81	§9.2/§6.2	Rate limit无per-endpoint粒度，贵/廉价共享	端点级分类
82	§11.3	Secret lease在NodeRun终态后仍有效至TTL过期	终态同步撤销
83	§7.1	WebSocket无租户级订阅过滤可泄露跨租户事件	强制tenantId过滤
运营与治理（12）
#	位置	问题	建议
84	§47.3	审批peer委托无利益冲突检查	冲突过滤
85	§50.3	Chinese Wall无过期/重置用户限制累积	WallExpiry策略
86	§55.5	Marketplace removed无迁移保障	≥80%迁移才可removed
87	§56.3	Few-shot harvesting无多样性/偏差防护	多样性评分器
88	§60.2	Panic传播无部分失败处理	未确认→强杀升级
89	§46.3	部门合并域冲突未定义	严格者胜
90	§31.2	Failover reconciliation无完成超时	max duration+升级
91	§31.3	DR drill无pass/fail标准	定义验收标准
92	§31.3/§23	Event replay恢复假设无限日志保留vs GDPR擦除	保留分层+tombstone
93	§32.1	D1→D2→D3部署演进无回滚路径	回滚runbook
94	§32.2	环境promotion无安全热补丁快速路径	emergency promotion
95	§30.5	Pack兼容测试套件"引用但未定义"	定义生成器+ownership
正反馈环路（4）
#	位置	问题
96	§45.16	Evaluator标记valuable→LTM→影响Evaluator→错误记忆自增强
97	§45.20/§45.25	Guardrail阻断→replan→再触发同guardrail→振荡耗尽预算
98	§53.4	优先级升级→全部同级→过载→更多排队→更多升级
99	§42.3/§42.5	Trust衰减→跑任务维持→低价值消耗预算→有价值无预算
一致性矛盾（8）
#	位置	问题
100	§54.2/§58.1	P95(SLA矩阵) vs P99(Harness观测) vs模型字段名P99
101	§58.5	Phase 6同属D3+S3和S4
102	§58.5/§58.9	双错误码命名空间无互操作
103	§58	§58.7-8缺失
104	AppH	引用§45.23-27但正文无此编号
105	§33.2	Batch B=Phase3-4但含Phase8b交付物
106	§47.2/§52	审批阈值仅CNY vs多区域
107	§58.1	harness.run.duration P99=业务域SLO=循环引用
基础设施与API（8）
#	位置	问题	建议
108	§14.9	Dispatch queue无max-depth仅lag触发背压→内存溢出	max_queue_depth+DLQ
109	§12.4	无orphaned budget reservation指标	gauge+告警
110	§6.8	Legacy projection adapter无contract test→升级静默回归	CI合约测试
111	§22.2	SDK无版本握手→升级后调废弃API	X-Platform-Version+兼容检查
112	§15.5	Cache无warming→冷启动直接D3/D4降级	启动预热策略
113	§6	List API无分页/游标/过滤	cursor pagination
114	§32.3	Worker pool间通信无mutual auth	mTLS+service identity
115	§24/§63	Config版本化但无运行时漂移检测	周期对账+drift告警
系统性主题
多步编排无原子性：Org级联/Chinese Wall/委托撤销/SCIM均缺Saga
4个正反馈环路无断路器：Memory自增强/Guardrail振荡/优先级膨胀/Trust维护
背压系统性缺失：Evaluator/Budget/Approval/Dispatch queue四个瓶颈无优雅降级
资源泄漏路径：Run终态/Plugin崩溃/Draft废弃/Secret lease/ContextSnapshot均无清理
统一架构服务不可调和需求：50μs量化交易 vs 30s LLM；成本推导token；24域未校准风险共用引擎平台总体架构 v4.0 — 方案设计审查
对象: docs_zh/architecture/00-platform-architecture.md | 日期: 2026-04-27 | 总计: 115项

Critical（10）
#	位置	问题	建议
1	§13/§45	OAPEFLIR 15状态 vs Harness 6状态描述同一实体，无权威声明	OAPEFLIR=概念，Harness=运行时，状态为投影
2	§33	128+周无人力模型无MVP，Phase 9线性48周	8-12周MVP仅P1+P3
3	§52.3/§54.2	手动故障转移 vs 99.99% SLA 不可兼得	自动转移或降至99.95%
4	§19.5	调用深度上限10 vs 5×3=15 矛盾	统一
5	§26.3	86表对Phase1 SQLite过重	按Phase定义子集
6	§25.6	跨区域active-active无冲突算法，CAS为单leader原语	single-leader或CRDT
7	§71/§15	量化交易<1ms vs LLM 30s超时，差6个数量级	双模式：离线规划+确定性执行
8	§45.24/§58.4	LLM不保证seed确定性，replay假设不成立	区分trace replay和re-execution
9	§18.3	Budget预检TOCTOU竞态，N并发可超限N×	原子compare-and-increment
10	§42.5	Trust降低操作固有风险→权限提升路径	Trust仅减审批摩擦不减风险分
设计缺陷（53）
#	位置	问题	建议
11	§14.11	SideEffect无approved→revoked转移	增revoked+commit重验证
12	§14.9	Scheduler依赖运行时状态replay不可重现	调度决策记为事件
13	§7.3	Outbox Poller lease过期间事件停滞无TTL	lease≤10s+热备
14	§25.9	Budget Ledger租户级序列化瓶颈	子账本分片
15	§25.10	RunVersionLock vs GraphPatch需新版本未定义	VersionLockOverridePolicy
16	§29.2	Memory 6层截断驱逐优先级未定义	ContextEvictionPolicy
17	§5.3	ControlDirective混合SRE/业务授权	拆分两类
18	§15.5	"语义缓存"实为句法hash	改名或embedding
19	§15.6	部分响应≥80%长度即接受结构可能无效	格式感知检查
20	§19.5	协作协议无状态机无排序	状态机+序列号
21	§17.5	LLM-as-Judge降级不可用canary质量门失效	D1+暂停canary
22	§20.4	休眠210天唤醒遇不兼容DomainDescriptor	快照+对比
23	§21.1	协作编辑无并发模型	锁/CRDT/分支选一
24	§23.2	Crypto-shredding打断跨租户审计链	存不含PII摘要
25	§37.4	域声明任意conflict_strategy平台不验证	闭合枚举+插件
26	§16.3/§16.4	Bundle原子性vs canary回滚后in-flight用坏版本	bundle_revocation
27	§44.5	单人模式高风险仅弹窗=零监督	冷却+dry-run
28	§45.5	Token budget从cost推导正交混淆	分离字段
29	§84-§94	24域风险评分无校准方法论	分段标准
30	§41.1	Trigger和用户共享预算无优先级	预留用户比例
31	§45.16/§45.23	Working Memory作用域vs多Agent隔离矛盾	每角色权限
32	§42.3	90天信任断崖瞬间降级	连续衰减
33	§45.20	五层Guardrails无冲突优先级无循环上限	最严胜出+上限
34	§45.10	Evaluator/Generator共享LLM共模失效	medium+不同model
35	§60.1	Panic TTL自动过期重启被入侵Agent	过期→重确认
36	§52.3	跨区域LLM仅检输入PII输出可能生成	输出扫描
37	§53.4	优先级auto-upgrade高负载系统崩溃	限额或权重老化
38	§62.2	边缘SyncQueue依赖链根被拒后续仍提交	拓扑序+中止
39	§61.3	Agent生命周期无testing→draft回退	增加回退
40	§29.1	Knowledge trust无降级路径	contested降级
41	§25.3	CAS+Lease+Fencing S4规模写放大	分区+批处理
42	§6.7	Webhook 50失败无退避429/500同阈值	指数退避+区分
43	§36.2	Budget预留无超时/释放/死锁	TTL+仲裁
44	§46.3	OrgTree级联无Saga/补偿	Saga
45	§48.2	SCIM DLQ无重试/对账	策略+周期对账
46	§47/§46	ApprovalRouteSnapshot可基于旧org版本	附orgVersion
47	§53.2	ResourceVector全量满足→队首阻塞	work-stealing
48	§54.1	SLATier模型无per-class SLO字段	增加结构
49	§57.1	Credential rotation双写窗口未定义时序	状态机
50	§50.3	Chinese Wall释放无原子性	2PC
51	§51.1	委托级联撤销无传播SLO	有界传播
52	§19.1	委托无timed_out终态deadline过期子run持预算	增终态+释放
53	§19.1	Broadcast聚合quorum不足无降级	降级路径
54	§20.2	ResumeCompatibilityCheck无超时	总超时
55	§20.3	Timer±30s但IT-ops/客服SLO<30s	高精度定时器
56	§17.2	Holdout隔离仅策略无技术强制	密封存储
57	§37.2/§20.4	Schema 2版本窗口vs休眠210天	延长或强制迁移
58	§19.5	协作消息无幂等键重试双结算	idempotency_key
59	§18.3	Sweeper无时钟偏差容忍	安全余量
60	§37.4/§19.3	跨域委托知识冲突策略无优先级	继承规则
61	§39.2	NL Router误路由无反馈弧	rejection→reroute
62	§21.1	审批委托重置TTL无上限	限制链长
63	§19.1	Broadcast bid落选者token无结算	计入父run
运行时与可靠性（20）
#	位置	问题	建议
64	§45.5	ContextSnapshot每迭代写P5无驱逐→存储无界增长	保留策略+compaction
65	§45.7/§45.21	Evaluator为唯一瓶颈降级无旁路/熔断	熔断策略
66	§62.3	Edge SyncQueue hash-chain vs非线性依赖图不可线性化	允许链分叉
67	§45.19	Run version lock使async run无法接收安全热补丁	force-upgrade机制
68	§56.4	Improvement released后无回滚状态	增加rollback转移
69	§59.6	Forensic budget P0事件时可能已耗尽	事件预留或无限额
70	§45.18	HITL takeover外部变更不进snapshot恢复后上下文过时	takeover变更记录
71	§53.2/§47	审批队列无基于审核者可用性的背压	准入控制
72	§66.2	合规报告signoff无超时可无限停generated	超时+升级
73	§60.3	Break-glass 72h review无强制	提醒+后果
74	§56.2	Feedback无统计检测协同偏差注入	集体异常检测
75	§67	容量预测无精度反馈/模型校准	forecast vs actual追踪
76	§6.3	废弃task_draft无过期清理→intake表无界增长	expires_at+sweeper
77	§14.10	Run终态无资源清理协议(lease/budget/secret)	RunTerminationCleanup序列
78	§8.2/§32	无graceful shutdown/drain协议	WorkerDrainProtocol
79	§28.3	EventEnvelope无spanId断event-to-span关联	增加spanId
80	§11.7	Plugin崩溃后无资源清理(文件/socket)	cleanup hook
81	§9.2/§6.2	Rate limit无per-endpoint粒度，贵/廉价共享	端点级分类
82	§11.3	Secret lease在NodeRun终态后仍有效至TTL过期	终态同步撤销
83	§7.1	WebSocket无租户级订阅过滤可泄露跨租户事件	强制tenantId过滤
运营与治理（12）
#	位置	问题	建议
84	§47.3	审批peer委托无利益冲突检查	冲突过滤
85	§50.3	Chinese Wall无过期/重置用户限制累积	WallExpiry策略
86	§55.5	Marketplace removed无迁移保障	≥80%迁移才可removed
87	§56.3	Few-shot harvesting无多样性/偏差防护	多样性评分器
88	§60.2	Panic传播无部分失败处理	未确认→强杀升级
89	§46.3	部门合并域冲突未定义	严格者胜
90	§31.2	Failover reconciliation无完成超时	max duration+升级
91	§31.3	DR drill无pass/fail标准	定义验收标准
92	§31.3/§23	Event replay恢复假设无限日志保留vs GDPR擦除	保留分层+tombstone
93	§32.1	D1→D2→D3部署演进无回滚路径	回滚runbook
94	§32.2	环境promotion无安全热补丁快速路径	emergency promotion
95	§30.5	Pack兼容测试套件"引用但未定义"	定义生成器+ownership
正反馈环路（4）
#	位置	问题
96	§45.16	Evaluator标记valuable→LTM→影响Evaluator→错误记忆自增强
97	§45.20/§45.25	Guardrail阻断→replan→再触发同guardrail→振荡耗尽预算
98	§53.4	优先级升级→全部同级→过载→更多排队→更多升级
99	§42.3/§42.5	Trust衰减→跑任务维持→低价值消耗预算→有价值无预算
一致性矛盾（8）
#	位置	问题
100	§54.2/§58.1	P95(SLA矩阵) vs P99(Harness观测) vs模型字段名P99
101	§58.5	Phase 6同属D3+S3和S4
102	§58.5/§58.9	双错误码命名空间无互操作
103	§58	§58.7-8缺失
104	AppH	引用§45.23-27但正文无此编号
105	§33.2	Batch B=Phase3-4但含Phase8b交付物
106	§47.2/§52	审批阈值仅CNY vs多区域
107	§58.1	harness.run.duration P99=业务域SLO=循环引用
基础设施与API（8）
#	位置	问题	建议
108	§14.9	Dispatch queue无max-depth仅lag触发背压→内存溢出	max_queue_depth+DLQ
109	§12.4	无orphaned budget reservation指标	gauge+告警
110	§6.8	Legacy projection adapter无contract test→升级静默回归	CI合约测试
111	§22.2	SDK无版本握手→升级后调废弃API	X-Platform-Version+兼容检查
112	§15.5	Cache无warming→冷启动直接D3/D4降级	启动预热策略
113	§6	List API无分页/游标/过滤	cursor pagination
114	§32.3	Worker pool间通信无mutual auth	mTLS+service identity
115	§24/§63	Config版本化但无运行时漂移检测	周期对账+drift告警
系统性主题
多步编排无原子性：Org级联/Chinese Wall/委托撤销/SCIM均缺Saga
4个正反馈环路无断路器：Memory自增强/Guardrail振荡/优先级膨胀/Trust维护
背压系统性缺失：Evaluator/Budget/Approval/Dispatch queue四个瓶颈无优雅降级
资源泄漏路径：Run终态/Plugin崩溃/Draft废弃/Secret lease/ContextSnapshot均无清理
统一架构服务不可调和需求：50μs量化交易 vs 30s LLM；成本推导token；24域未校准风险共用引擎