# Platform Overall Architecture v4.0 — Design Review

Target: docs_zh/architecture/00-platform-architecture.md | Date: 2026-04-27 | Total Items: 115

Critical (10)
#	Location	Issue	Recommendation
1	§13/§45	OAPEFLIR 15 states vs Harness 6 states describe the same entity, no authoritative declaration	OAPEFLIR=concept, Harness=runtime, states are projections
2	§33	128+ weeks without human model has no MVP, Phase 9 linear 48 weeks	8-12 week MVP only P1+P3
3	§52.3/§54.2	Manual failover vs 99.99% SLA are mutually exclusive	Automatic transfer or downgrade to 99.95%
4	§19.5	Call depth limit 10 vs 5×3=15 contradiction	Unify
5	§26.3	86 tables too heavy for Phase1 SQLite	Define subset per Phase
6	§25.6	Cross-region active-active has no conflict resolution algorithm; CAS is single-leader primitive	Single-leader or CRDT
7	§71/§15	Quant trading <1ms vs LLM 30s timeout, 6 orders of magnitude difference	Two modes: offline planning + deterministic execution
8	§45.24/§58.4	LLM does not guarantee seed determinism, replay assumption does not hold	Distinguish trace replay from re-execution
9	§18.3	Budget pre-check TOCTOU race, N concurrent can exceed limit N×	Atomic compare-and-increment
10	§42.5	Trust reduction operation has inherent risk → privilege escalation path	Trust only reduces approval friction, not risk score
Design Defects (53)
#	Location	Issue	Recommendation
11	§14.11	SideEffect has no approved→revoked transition	Add revoked + commit re-validation
12	§14.9	Scheduler depends on runtime state replay that cannot be reproduced	Record scheduling decisions as events
13	§7.3	Outbox Poller lease expiration causes event stagnation without TTL	Lease ≤10s + hot standby
14	§25.9	Budget Ledger tenant-level serialization bottleneck	Sub-ledger sharding
15	§25.10	RunVersionLock vs GraphPatch new version not defined	VersionLockOverridePolicy
16	§29.2	Memory 6-layer eviction priority not defined	ContextEvictionPolicy
17	§5.3	ControlDirective mixes SRE/business authorization	Split into two types
18	§15.5	"Semantic cache" is actually syntactic hash	Rename or use embedding
19	§15.6	Partial response ≥80% length accepts structure that may be invalid	Format-aware checking
20	§19.5	Collaboration protocol has no state machine or ordering	State machine + sequence number
21	§17.5	LLM-as-Judge degradation unusable, canary quality gate fails	D1 + pause canary
22	§20.4	210-day sleep wakeup encounters incompatible DomainDescriptor	Snapshot + comparison
23	§21.1	Collaborative editing has no concurrency model	Choose: lock/CRDT/branch
24	§23.2	Crypto-shredding breaks cross-tenant audit chain	Store non-PII digest
25	§37.4	Domain declares arbitrary conflict_strategy not verified by platform	Closed enum + plugin
26	§16.3/§16.4	Bundle atomicity vs canary rollback in-flight uses bad version	bundle_revocation
27	§44.5	Single-person mode high risk only popup = zero supervision	Cooling + dry-run
28	§45.5	Token budget derived from cost, orthogonal confusion	Separate fields
29	§84-§94	24 domain risk scores have no calibration methodology	Segmented standards
30	§41.1	Trigger and user share budget with no priority	Reserve user proportion
31	§45.16/§45.23	Working Memory scope vs multi-Agent isolation contradiction	Per-role permissions
32	§42.3	90-day trust cliff instant degradation	Continuous decay
33	§45.20	Five Guardrail layers have no conflict priority or loop ceiling	Toughest wins + ceiling
34	§45.10	Evaluator/Generator share LLM common-mode failure	Medium + different model
35	§60.1	Panic TTL auto-expire restart compromised Agent	Expire → re-confirm
36	§52.3	Cross-region LLM only checks input PII, output may generate	Output scanning
37	§53.4	Priority auto-upgrade crashes high-load system	Quota or weight aging
38	§62.2	Edge SyncQueue dependency chain root rejected, subsequent still committed	Topological order + abort
39	§61.3	Agent lifecycle has no testing→draft rollback	Add rollback
40	§29.1	Knowledge trust has no degradation path	Contested degradation
41	§25.3	CAS+Lease+Fencing S4 scale write amplification	Partition + batch processing
42	§6.7	Webhook 50 failures have no backoff, 429/500 same threshold	Exponential backoff + distinguish
43	§36.2	Budget reservation has no timeout/release/deadlock	TTL + arbitration
44	§46.3	OrgTree cascade has no Saga/compensation	Saga
45	§48.2	SCIM DLQ has no retry/reconciliation	Strategy + periodic reconciliation
46	§47/§46	ApprovalRouteSnapshot may be based on old org version	Attach orgVersion
47	§53.2	ResourceVector fully satisfied → head-of-queue blocking	Work-stealing
48	§54.1	SLATier model has no per-class SLO fields	Add structure
49	§57.1	Credential rotation dual-write window undefined timing	State machine
50	§50.3	Chinese Wall release has no atomicity	2PC
51	§51.1	Delegation cascade revocation has no propagation SLO	Bounded propagation
52	§19.1	Delegation has no timed_out final state, deadline expired child run holds budget	Add final state + release
53	§19.1	Broadcast aggregate quorum insufficient has no degradation	Degradation path
54	§20.2	ResumeCompatibilityCheck has no timeout	Total timeout
55	§20.3	Timer ±30s but IT-ops/客服 SLO<30s	High precision timer
56	§17.2	Holdout isolation only policy, no technical enforcement	Sealed storage
57	§37.2/§20.4	Schema 2-version window vs 210-day sleep	Extend or force migration
58	§19.5	Collaboration message has no idempotency key retry double settlement	idempotency_key
59	§18.3	Sweeper has no clock skew tolerance	Safe margin
60	§37.4/§19.3	Cross-domain delegation knowledge conflict strategy has no priority	Inheritance rules
61	§39.2	NL Router misroutes has no feedback arc	rejection→reroute
62	§21.1	Approval delegation resets TTL with no cap	Limit chain length
63	§19.1	Broadcast bid losing side token not settled	Charge to parent run
Runtime and Reliability (20)
#	Location	Issue	Recommendation
64	§45.5	ContextSnapshot writes every iteration P5 no eviction → storage unbounded growth	Retention policy + compaction
65	§45.7/§45.21	Evaluator is sole bottleneck degradation has no bypass/circuit breaker	Circuit breaker policy
66	§62.3	Edge SyncQueue hash-chain vs nonlinear dependency graph cannot linearize	Allow chain forks
67	§45.19	Run version lock makes async run unable to receive security hot patch	Force-upgrade mechanism
68	§56.4	Improvement released has no rollback state	Add rollback transition
69	§59.6	Forensic budget P0 event may already be exhausted	Event reservation or unlimited
70	§45.18	HITL takeover external changes not in snapshot, context stale after recovery	takeover change record
71	§53.2/§47	Approval queue has no backpressure based on reviewer availability	Admission control
72	§66.2	Compliance report signoff has no timeout may indefinitely pause generated	Timeout + escalation
73	§60.3	Break-glass 72h review not enforced	Reminder + consequences
74	§56.2	Feedback has no statistical detection of collaborative bias injection	Collective anomaly detection
75	§67	Capacity forecast has no accuracy feedback/model calibration	Forecast vs actual tracking
76	§6.3	Abandoned task_draft has no expiration cleanup → intake table unbounded growth	expires_at+sweeper
77	§14.10	Run final state has no resource cleanup protocol (lease/budget/secret)	RunTerminationCleanup sequence
78	§8.2/§32	No graceful shutdown/drain protocol	WorkerDrainProtocol
79	§28.3	EventEnvelope has no spanId breaks event-to-span association	Add spanId
80	§11.7	Plugin crash has no resource cleanup (file/socket)	cleanup hook
81	§9.2/§6.2	Rate limit has no per-endpoint granularity, expensive/cheap shared	Endpoint-level classification
82	§11.3	Secret lease remains valid after NodeRun final state until TTL expires	Final state sync revocation
83	§7.1	WebSocket has no tenant-level subscription filter may leak cross-tenant events	Enforce tenantId filtering
Operations and Governance (12)
#	Location	Issue	Recommendation
84	§47.3	Approval peer delegation has no conflict of interest check	Conflict filter
85	§50.3	Chinese Wall has no expiration/reset user limit accumulates	WallExpiry policy
86	§55.5	Marketplace removed has no migration guarantee	≥80% migration before removed
87	§56.3	Few-shot harvesting has no diversity/bias protection	Diversity scorer
88	§60.2	Panic propagation has no partial failure handling	Unconfirmed → force kill escalation
89	§46.3	Department merge domain conflict undefined	Strictest wins
90	§31.2	Failover reconciliation has no completion timeout	max duration + escalation
91	§31.3	DR drill has no pass/fail criteria	Define acceptance criteria
92	§31.3/§23	Event replay recovery assumes infinite log retention vs GDPR erasure	Retention tiering + tombstone
93	§32.1	D1→D2→D3 deployment evolution has no rollback path	Rollback runbook
94	§32.2	Environment promotion has no security hot patch fast path	Emergency promotion
95	§30.5	Pack compatibility test suite "referenced but not defined"	Definition generator + ownership
Positive Feedback Loops (4)
#	Location	Issue
96	§45.16	Evaluator marks valuable→LTM→influences Evaluator→error memory self-reinforcement
97	§45.20/§45.25	Guardrail blocks→replan→triggers same guardrail again→oscillation exhausts budget
98	§53.4	Priority upgrade→all same level→overload→more queuing→more upgrades
99	§42.3/§42.5	Trust decay→run tasks to maintain→low value consumes budget→high value no budget
Consistency Contradictions (8)
#	Location	Issue
100	§54.2/§58.1	P95(SLA matrix) vs P99(Harness observation) vs model field name P99
101	§58.5	Phase 6 belongs to both D3+S3 and S4
102	§58.5/§58.9	Two error code namespaces have no interoperability
103	§58	§58.7-8 missing
104	AppH	References §45.23-27 but body has no such numbers
105	§33.2	Batch B=Phase3-4 but contains Phase8b deliverables
106	§47.2/§52	Approval threshold CNY only vs multi-region
107	§58.1	harness.run.duration P99=business domain SLO=circular reference
Infrastructure and API (8)
#	Location	Issue	Recommendation
108	§14.9	Dispatch queue has no max-depth only lag triggers backpressure → memory overflow	max_queue_depth+DLQ
109	§12.4	No orphaned budget reservation metric	gauge+alert
110	§6.8	Legacy projection adapter has no contract test → upgrade silently regresses	CI contract test
111	§22.2	SDK has no version handshake → calls deprecated API after upgrade	X-Platform-Version+compatibility check
112	§15.5	Cache has no warming → cold start directly D3/D4 degradation	Startup warmup strategy
113	§6	List API has no pagination/cursor/filter	cursor pagination
114	§32.3	Worker pool inter-communication has no mutual auth	mTLS+service identity
115	§24/§63	Config versioned but no runtime drift detection	Periodic reconciliation+drift alert
Systematic Themes
Multi-step orchestration has no atomicity: Org cascade/Chinese Wall/delegation revocation/SCIM all lack Saga
4 positive feedback loops have no circuit breakers: Memory self-reinforcement/Guardrail oscillation/Priority inflation/Trust maintenance
Backpressure systematically missing: Evaluator/Budget/Approval/Dispatch queue four bottlenecks have no graceful degradation
Resource leak paths: Run final state/Plugin crash/Draft abandoned/Secret lease/ContextSnapshot all lack cleanup
Unified architecture serves irreconcilable requirements: 50μs quant trading vs 30s LLM; cost-derived token; 24 uncalibrated domains share engine
Platform Overall Architecture v4.0 — Design Review
Target: docs_zh/architecture/00-platform-architecture.md | Date: 2026-04-27 | Total Items: 115

Critical (10)
#	Location	Issue	Recommendation
1	§13/§45	OAPEFLIR 15 states vs Harness 6 states describe the same entity, no authoritative declaration	OAPEFLIR=concept, Harness=runtime, states are projections
2	§33	128+ weeks without human model has no MVP, Phase 9 linear 48 weeks	8-12 week MVP only P1+P3
3	§52.3/§54.2	Manual failover vs 99.99% SLA are mutually exclusive	Automatic transfer or downgrade to 99.95%
4	§19.5	Call depth limit 10 vs 5×3=15 contradiction	Unify
5	§26.3	86 tables too heavy for Phase1 SQLite	Define subset per Phase
6	§25.6	Cross-region active-active has no conflict resolution algorithm; CAS is single-leader primitive	Single-leader or CRDT
7	§71/§15	Quant trading <1ms vs LLM 30s timeout, 6 orders of magnitude difference	Two modes: offline planning + deterministic execution
8	§45.24/§58.4	LLM does not guarantee seed determinism, replay assumption does not hold	Distinguish trace replay from re-execution
9	§18.3	Budget pre-check TOCTOU race, N concurrent can exceed limit N×	Atomic compare-and-increment
10	§42.5	Trust reduction operation has inherent risk → privilege escalation path	Trust only reduces approval friction, not risk score
Design Defects (53)
#	Location	Issue	Recommendation
11	§14.11	SideEffect has no approved→revoked transition	Add revoked + commit re-validation
12	§14.9	Scheduler depends on runtime state replay that cannot be reproduced	Record scheduling decisions as events
13	§7.3	Outbox Poller lease expiration causes event stagnation without TTL	Lease ≤10s + hot standby
14	§25.9	Budget Ledger tenant-level serialization bottleneck	Sub-ledger sharding
15	§25.10	RunVersionLock vs GraphPatch new version not defined	VersionLockOverridePolicy
16	§29.2	Memory 6-layer eviction priority not defined	ContextEvictionPolicy
17	§5.3	ControlDirective mixes SRE/business authorization	Split into two types
18	§15.5	"Semantic cache" is actually syntactic hash	Rename or use embedding
19	§15.6	Partial response ≥80% length accepts structure that may be invalid	Format-aware checking
20	§19.5	Collaboration protocol has no state machine or ordering	State machine + sequence number
21	§17.5	LLM-as-Judge degradation unusable, canary quality gate fails	D1 + pause canary
22	§20.4	210-day sleep wakeup encounters incompatible DomainDescriptor	Snapshot + comparison
23	§21.1	Collaborative editing has no concurrency model	Choose: lock/CRDT/branch
24	§23.2	Crypto-shredding breaks cross-tenant audit chain	Store non-PII digest
25	§37.4	Domain declares arbitrary conflict_strategy not verified by platform	Closed enum + plugin
26	§16.3/§16.4	Bundle atomicity vs canary rollback in-flight uses bad version	bundle_revocation
27	§44.5	Single-person mode high risk only popup = zero supervision	Cooling + dry-run
28	§45.5	Token budget derived from cost, orthogonal confusion	Separate fields
29	§84-§94	24 domain risk scores have no calibration methodology	Segmented standards
30	§41.1	Trigger and user share budget with no priority	Reserve user proportion
31	§45.16/§45.23	Working Memory scope vs multi-Agent isolation contradiction	Per-role permissions
32	§42.3	90-day trust cliff instant degradation	Continuous decay
33	§45.20	Five Guardrail layers have no conflict priority or loop ceiling	Toughest wins + ceiling
34	§45.10	Evaluator/Generator share LLM common-mode failure	Medium + different model
35	§60.1	Panic TTL auto-expire restart compromised Agent	Expire → re-confirm
36	§52.3	Cross-region LLM only checks input PII, output may generate	Output scanning
37	§53.4	Priority auto-upgrade crashes high-load system	Quota or weight aging
38	§62.2	Edge SyncQueue dependency chain root rejected, subsequent still committed	Topological order + abort
39	§61.3	Agent lifecycle has no testing→draft rollback	Add rollback
40	§29.1	Knowledge trust has no degradation path	Contested degradation
41	§25.3	CAS+Lease+Fencing S4 scale write amplification	Partition + batch processing
42	§6.7	Webhook 50 failures have no backoff, 429/500 same threshold	Exponential backoff + distinguish
43	§36.2	Budget reservation has no timeout/release/deadlock	TTL + arbitration
44	§46.3	OrgTree cascade has no Saga/compensation	Saga
45	§48.2	SCIM DLQ has no retry/reconciliation	Strategy + periodic reconciliation
46	§47/§46	ApprovalRouteSnapshot may be based on old org version	Attach orgVersion
47	§53.2	ResourceVector fully satisfied → head-of-queue blocking	Work-stealing
48	§54.1	SLATier model has no per-class SLO fields	Add structure
49	§57.1	Credential rotation dual-write window undefined timing	State machine
50	§50.3	Chinese Wall release has no atomicity	2PC
51	§51.1	Delegation cascade revocation has no propagation SLO	Bounded propagation
52	§19.1	Delegation has no timed_out final state, deadline expired child run holds budget	Add final state + release
53	§19.1	Broadcast aggregate quorum insufficient has no degradation	Degradation path
54	§20.2	ResumeCompatibilityCheck has no timeout	Total timeout
55	§20.3	Timer ±30s but IT-ops/客服 SLO<30s	High precision timer
56	§17.2	Holdout isolation only policy, no technical enforcement	Sealed storage
57	§37.2/§20.4	Schema 2-version window vs 210-day sleep	Extend or force migration
58	§19.5	Collaboration message has no idempotency key retry double settlement	idempotency_key
59	§18.3	Sweeper has no clock skew tolerance	Safe margin
60	§37.4/§19.3	Cross-domain delegation knowledge conflict strategy has no priority	Inheritance rules
61	§39.2	NL Router misroutes has no feedback arc	rejection→reroute
62	§21.1	Approval delegation resets TTL with no cap	Limit chain length
63	§19.1	Broadcast bid losing side token not settled	Charge to parent run
Runtime and Reliability (20)
#	Location	Issue	Recommendation
64	§45.5	ContextSnapshot writes every iteration P5 no eviction → storage unbounded growth	Retention policy + compaction
65	§45.7/§45.21	Evaluator is sole bottleneck degradation has no bypass/circuit breaker	Circuit breaker policy
66	§62.3	Edge SyncQueue hash-chain vs nonlinear dependency graph cannot linearize	Allow chain forks
67	§45.19	Run version lock makes async run unable to receive security hot patch	Force-upgrade mechanism
68	§56.4	Improvement released has no rollback state	Add rollback transition
69	§59.6	Forensic budget P0 event may already be exhausted	Event reservation or unlimited
70	§45.18	HITL takeover external changes not in snapshot, context stale after recovery	takeover change record
71	§53.2/§47	Approval queue has no backpressure based on reviewer availability	Admission control
72	§66.2	Compliance report signoff has no timeout may indefinitely pause generated	Timeout + escalation
73	§60.3	Break-glass 72h review not enforced	Reminder + consequences
74	§56.2	Feedback has no statistical detection of collaborative bias injection	Collective anomaly detection
75	§67	Capacity forecast has no accuracy feedback/model calibration	Forecast vs actual tracking
76	§6.3	Abandoned task_draft has no expiration cleanup → intake table unbounded growth	expires_at+sweeper
77	§14.10	Run final state has no resource cleanup protocol (lease/budget/secret)	RunTerminationCleanup sequence
78	§8.2/§32	No graceful shutdown/drain protocol	WorkerDrainProtocol
79	§28.3	EventEnvelope has no spanId breaks event-to-span association	Add spanId
80	§11.7	Plugin crash has no resource cleanup (file/socket)	cleanup hook
81	§9.2/§6.2	Rate limit has no per-endpoint granularity, expensive/cheap shared	Endpoint-level classification
82	§11.3	Secret lease remains valid after NodeRun final state until TTL expires	Final state sync revocation
83	§7.1	WebSocket has no tenant-level subscription filter may leak cross-tenant events	Enforce tenantId filtering
Operations and Governance (12)
#	Location	Issue	Recommendation
84	§47.3	Approval peer delegation has no conflict of interest check	Conflict filter
85	§50.3	Chinese Wall has no expiration/reset user limit accumulates	WallExpiry policy
86	§55.5	Marketplace removed has no migration guarantee	≥80% migration before removed
87	§56.3	Few-shot harvesting has no diversity/bias protection	Diversity scorer
88	§60.2	Panic propagation has no partial failure handling	Unconfirmed → force kill escalation
89	§46.3	Department merge domain conflict undefined	Strictest wins
90	§31.2	Failover reconciliation has no completion timeout	max duration + escalation
91	§31.3	DR drill has no pass/fail criteria	Define acceptance criteria
92	§31.3/§23	Event replay recovery assumes infinite log retention vs GDPR erasure	Retention tiering + tombstone
93	§32.1	D1→D2→D3 deployment evolution has no rollback path	Rollback runbook
94	§32.2	Environment promotion has no security hot patch fast path	Emergency promotion
95	§30.5	Pack compatibility test suite "referenced but not defined"	Definition generator + ownership
Positive Feedback Loops (4)
#	Location	Issue
96	§45.16	Evaluator marks valuable→LTM→influences Evaluator→error memory self-reinforcement
97	§45.20/§45.25	Guardrail blocks→replan→triggers same guardrail again→oscillation exhausts budget
98	§53.4	Priority upgrade→all same level→overload→more queuing→more upgrades
99	§42.3/§42.5	Trust decay→run tasks to maintain→low value consumes budget→high value no budget
Consistency Contradictions (8)
#	Location	Issue
100	§54.2/§58.1	P95(SLA matrix) vs P99(Harness observation) vs model field name P99
101	§58.5	Phase 6 belongs to both D3+S3 and S4
102	§58.5/§58.9	Two error code namespaces have no interoperability
103	§58	§58.7-8 missing
104	AppH	References §45.23-27 but body has no such numbers
105	§33.2	Batch B=Phase3-4 but contains Phase8b deliverables
106	§47.2/§52	Approval threshold CNY only vs multi-region
107	§58.1	harness.run.duration P99=business domain SLO=circular reference
Infrastructure and API (8)
#	Location	Issue	Recommendation
108	§14.9	Dispatch queue has no max-depth only lag triggers backpressure → memory overflow	max_queue_depth+DLQ
109	§12.4	No orphaned budget reservation metric	gauge+alert
110	§6.8	Legacy projection adapter has no contract test → upgrade silently regresses	CI contract test
111	§22.2	SDK has no version handshake → calls deprecated API after upgrade	X-Platform-Version+compatibility check
112	§15.5	Cache has no warming → cold start directly D3/D4 degradation	Startup warmup strategy
113	§6	List API has no pagination/cursor/filter	cursor pagination
114	§32.3	Worker pool inter-communication has no mutual auth	mTLS+service identity
115	§24/§63	Config versioned but no runtime drift detection	Periodic reconciliation+drift alert
Systematic Themes
Multi-step orchestration has no atomicity: Org cascade/Chinese Wall/delegation revocation/SCIM all lack Saga
4 positive feedback loops have no circuit breakers: Memory self-reinforcement/Guardrail oscillation/Priority inflation/Trust maintenance
Backpressure systematically missing: Evaluator/Budget/Approval/Dispatch queue four bottlenecks have no graceful degradation
Resource leak paths: Run final state/Plugin crash/Draft abandoned/Secret lease/ContextSnapshot all lack cleanup
Unified architecture serves irreconcilable requirements: 50μs quant trading vs 30s LLM; cost-derived token; 24 uncalibrated domains share engine