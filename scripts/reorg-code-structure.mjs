import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const root = process.cwd();
const SOURCE_ROOTS = ["src", "tests"];
const TEXT_FILE_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".json"]);

const DIRECTORY_PREFIX_MAP = [
  ["src/cli/", "src/sdk/cli/"],
  ["src/core/api/", "src/platform/interface/api/"],
  ["src/core/approvals/", "src/platform/control-plane/approval-center/"],
  ["src/core/artifacts/", "src/platform/state-evidence/artifacts/"],
  ["src/core/autonomy/", "src/interaction/autonomy/"],
  ["src/core/cache/", "src/platform/shared/cache/"],
  ["src/core/compliance/", "src/platform/control-plane/audit-export/"],
  ["src/core/config/", "src/platform/control-plane/config-center/"],
  ["src/core/constants/", "src/platform/contracts/constants/"],
  ["src/core/cost/", "src/platform/model-gateway/cost-tracker/"],
  ["src/core/dashboard/", "src/interaction/dashboard/"],
  ["src/core/deployment/", "src/platform/control-plane/rollout-controller/"],
  ["src/core/divisions/", "src/domains/governance/"],
  ["src/core/domain-registry/", "src/domains/registry/"],
  ["src/core/evaluation/", "src/platform/prompt-engine/eval/"],
  ["src/core/events/", "src/platform/state-evidence/events/"],
  ["src/core/feedback/", "src/scale-ecosystem/feedback-loop/collector/"],
  ["src/core/goal-decomposition/", "src/interaction/goal-decomposer/"],
  ["src/core/hr/", "src/org-governance/org-model/"],
  ["src/core/improvement/", "src/platform/orchestration/oapeflir/improve-rollout/"],
  ["src/core/knowledge/", "src/platform/state-evidence/knowledge/"],
  ["src/core/learning/", "src/platform/orchestration/oapeflir/learn/"],
  ["src/core/lifecycle/", "src/platform/shared/lifecycle/"],
  ["src/core/locking/", "src/platform/execution/distributed-lock/"],
  ["src/core/memory/", "src/platform/state-evidence/memory/"],
  ["src/core/messages/", "src/platform/model-gateway/messages/"],
  ["src/core/nl-entry/", "src/interaction/nl-gateway/"],
  ["src/core/observability/", "src/platform/shared/observability/"],
  ["src/core/orchestration/", "src/platform/orchestration/routing/"],
  ["src/core/planning/", "src/platform/orchestration/planner/"],
  ["src/core/product/", "src/scale-ecosystem/marketplace/"],
  ["src/core/proactive-agent/", "src/interaction/proactive-agent/"],
  ["src/core/providers/", "src/platform/model-gateway/provider-registry/"],
  ["src/core/queue/", "src/platform/execution/queue/"],
  ["src/core/resource/", "src/platform/execution/resource/"],
  ["src/core/results/", "src/platform/contracts/result-envelope/"],
  ["src/core/reliability/", "src/platform/execution/recovery/"],
  ["src/core/stability/", "src/platform/shared/stability/"],
  ["src/core/storage/", "src/platform/state-evidence/truth/"],
  ["src/core/tools/", "src/platform/execution/tool-executor/"],
  ["src/core/types/", "src/platform/contracts/types/"],
  ["src/core/utils/", "src/platform/shared/utils/"],
  ["src/core/workflow/", "src/platform/orchestration/oapeflir/workflow/"],
  ["src/core/agent-loop/", "src/platform/orchestration/oapeflir/"],
  ["src/core/evolution/", "src/ops-maturity/drift-detection/"],
  ["src/core/ops/", "src/platform/control-plane/incident-control/"],
  ["src/core/security/", "src/platform/control-plane/iam/"],
];

const DIRECT_FILE_MAP = new Map([
  ["src/core/errors.ts", "src/platform/contracts/errors.ts"],
  ["src/gateway/channel-gateway-delivery-service.ts", "src/platform/interface/channel-gateway/channel-gateway-delivery-service.ts"],
  ["src/gateway/channel-gateway-delivery-support.ts", "src/platform/interface/channel-gateway/channel-gateway-delivery-support.ts"],
  ["src/gateway/channel-gateway-retry-executor.ts", "src/platform/interface/channel-gateway/channel-gateway-retry-executor.ts"],
  ["src/gateway/channel-gateway-service.ts", "src/platform/interface/channel-gateway/channel-gateway-service.ts"],
  ["src/gateway/channel-gateway/errors.ts", "src/platform/interface/channel-gateway/errors.ts"],
  ["src/gateway/channel-gateway/helpers.ts", "src/platform/interface/channel-gateway/helpers.ts"],
  ["src/gateway/channel-gateway/types.ts", "src/platform/interface/channel-gateway/types.ts"],
  ["src/gateway/storage-adapter.ts", "src/platform/interface/channel-gateway/storage-adapter.ts"],
  ["src/gateway/storage-port.ts", "src/platform/interface/channel-gateway/storage-port.ts"],
  ["src/gateway/stream/stream-bridge.ts", "src/platform/interface/channel-gateway/stream-bridge.ts"],
  ["src/gateway/targets/gateway-target-directory-service.ts", "src/platform/interface/channel-gateway/gateway-target-directory-service.ts"],
  ["src/gateway/websocket-bridge.ts", "src/platform/interface/channel-gateway/websocket-bridge.ts"],
  ["src/gateway/index.ts", "src/platform/interface/channel-gateway/index.ts"],
  ["src/gateway/user-portal/index.ts", "src/interaction/ux/onboarding/index.ts"],
]);

const RUNTIME_FILE_MAP = new Map([
  ["src/core/runtime/admission-controller.ts", "src/platform/execution/dispatcher/admission-controller.ts"],
  ["src/core/runtime/execution-deviation-detector.ts", "src/platform/execution/dispatcher/execution-deviation-detector.ts"],
  ["src/core/runtime/execution-dispatch-reconciliation-service.ts", "src/platform/execution/dispatcher/execution-dispatch-reconciliation-service.ts"],
  ["src/core/runtime/execution-dispatch-service-async.ts", "src/platform/execution/dispatcher/execution-dispatch-service-async.ts"],
  ["src/core/runtime/execution-dispatch-service.ts", "src/platform/execution/dispatcher/execution-dispatch-service.ts"],
  ["src/core/runtime/execution-dispatch-support.ts", "src/platform/execution/dispatcher/execution-dispatch-support.ts"],
  ["src/core/runtime/execution-priority-preemption-service-async.ts", "src/platform/execution/dispatcher/execution-priority-preemption-service-async.ts"],
  ["src/core/runtime/execution-priority-preemption-service.ts", "src/platform/execution/dispatcher/execution-priority-preemption-service.ts"],
  ["src/core/runtime/execution-resource-ceiling-guard.ts", "src/platform/execution/dispatcher/execution-resource-ceiling-guard.ts"],
  ["src/core/runtime/execution-resource-monitor.ts", "src/platform/execution/dispatcher/execution-resource-monitor.ts"],
  ["src/core/runtime/dispatcher/index.ts", "src/platform/execution/dispatcher/index.ts"],

  ["src/core/runtime/execution-lease-service.ts", "src/platform/execution/lease/execution-lease-service.ts"],
  ["src/core/runtime/lease-repository-postgres.ts", "src/platform/execution/lease/lease-repository-postgres.ts"],
  ["src/core/runtime/lease-repository-sqlite.ts", "src/platform/execution/lease/lease-repository-sqlite.ts"],
  ["src/core/runtime/lease-repository.ts", "src/platform/execution/lease/lease-repository.ts"],
  ["src/core/runtime/execution-lease/execution-lease-factory.ts", "src/platform/execution/lease/execution-lease-factory.ts"],
  ["src/core/runtime/execution-lease/execution-lease-service-async.ts", "src/platform/execution/lease/execution-lease-service-async.ts"],
  ["src/core/runtime/execution-lease/types.ts", "src/platform/execution/lease/types.ts"],
  ["src/core/runtime/execution-lease/utils.ts", "src/platform/execution/lease/utils.ts"],

  ["src/core/runtime/worker-registry-service.ts", "src/platform/execution/worker-pool/worker-registry-service.ts"],
  ["src/core/runtime/worker-load-balancing.ts", "src/platform/execution/worker-pool/worker-load-balancing.ts"],
  ["src/core/runtime/worker-scheduling-status.ts", "src/platform/execution/worker-pool/worker-scheduling-status.ts"],
  ["src/core/runtime/remote-worker-registration-service.ts", "src/platform/execution/worker-pool/remote-worker-registration-service.ts"],
  ["src/core/runtime/remote-session-guard.ts", "src/platform/execution/worker-pool/remote-session-guard.ts"],
  ["src/core/runtime/execution-worker-handshake-service-async.ts", "src/platform/execution/worker-pool/execution-worker-handshake-service-async.ts"],
  ["src/core/runtime/execution-worker-handshake-service.ts", "src/platform/execution/worker-pool/execution-worker-handshake-service.ts"],
  ["src/core/runtime/execution-worker-handshake-support.ts", "src/platform/execution/worker-pool/execution-worker-handshake-support.ts"],
  ["src/core/runtime/execution-worker-handshake-types.ts", "src/platform/execution/worker-pool/execution-worker-handshake-types.ts"],
  ["src/core/runtime/execution-worker-writeback-service-async.ts", "src/platform/execution/worker-pool/execution-worker-writeback-service-async.ts"],
  ["src/core/runtime/execution-worker-writeback-service.ts", "src/platform/execution/worker-pool/execution-worker-writeback-service.ts"],
  ["src/core/runtime/execution-worker-writeback-support.ts", "src/platform/execution/worker-pool/execution-worker-writeback-support.ts"],
  ["src/core/runtime/worker/execution-worker-handshake-support.ts", "src/platform/execution/worker-pool/worker/execution-worker-handshake-support.ts"],
  ["src/core/runtime/worker/execution-worker-handshake-types.ts", "src/platform/execution/worker-pool/worker/execution-worker-handshake-types.ts"],
  ["src/core/runtime/worker/execution-worker-writeback-support.ts", "src/platform/execution/worker-pool/worker/execution-worker-writeback-support.ts"],
  ["src/core/runtime/worker/remote-worker-registration-service.ts", "src/platform/execution/worker-pool/worker/remote-worker-registration-service.ts"],
  ["src/core/runtime/worker/worker-load-balancing.ts", "src/platform/execution/worker-pool/worker/worker-load-balancing.ts"],
  ["src/core/runtime/worker/worker-registry-service.ts", "src/platform/execution/worker-pool/worker/worker-registry-service.ts"],
  ["src/core/runtime/worker/worker-scheduling-status.ts", "src/platform/execution/worker-pool/worker/worker-scheduling-status.ts"],

  ["src/core/runtime/agent-executor.ts", "src/platform/execution/execution-engine/agent-executor.ts"],
  ["src/core/runtime/agent-middleware-chain.ts", "src/platform/execution/execution-engine/agent-middleware-chain.ts"],
  ["src/core/runtime/call-governance.ts", "src/platform/execution/execution-engine/call-governance.ts"],
  ["src/core/runtime/complexity-router.ts", "src/platform/execution/execution-engine/complexity-router.ts"],
  ["src/core/runtime/context-compaction-service.ts", "src/platform/execution/execution-engine/context-compaction-service.ts"],
  ["src/core/runtime/effect-buffer.ts", "src/platform/execution/execution-engine/effect-buffer.ts"],
  ["src/core/runtime/kv-cache-prefix-config.ts", "src/platform/execution/execution-engine/kv-cache-prefix-config.ts"],
  ["src/core/runtime/loop-detection.ts", "src/platform/execution/execution-engine/loop-detection.ts"],
  ["src/core/runtime/middleware-init.ts", "src/platform/execution/execution-engine/middleware-init.ts"],
  ["src/core/runtime/model-call-provider.ts", "src/platform/execution/execution-engine/model-call-provider.ts"],
  ["src/core/runtime/multi-step-orchestration.ts", "src/platform/execution/execution-engine/multi-step-orchestration.ts"],
  ["src/core/runtime/orchestration/multi-step-tool-definitions.ts", "src/platform/execution/execution-engine/multi-step-tool-definitions.ts"],
  ["src/core/runtime/orchestration/multi-step-utils.ts", "src/platform/execution/execution-engine/multi-step-utils.ts"],
  ["src/core/runtime/orchestration/phase1b-tool-definitions.ts", "src/platform/execution/execution-engine/phase1b-tool-definitions.ts"],
  ["src/core/runtime/orchestration/phase1b-utils.ts", "src/platform/execution/execution-engine/phase1b-utils.ts"],
  ["src/core/runtime/orphan-cleanup-service.ts", "src/platform/execution/execution-engine/orphan-cleanup-service.ts"],
  ["src/core/runtime/output-continuation-service.ts", "src/platform/execution/execution-engine/output-continuation-service.ts"],
  ["src/core/runtime/phase1a-happy-path.ts", "src/platform/execution/execution-engine/phase1a-happy-path.ts"],
  ["src/core/runtime/phase1b-orchestration.ts", "src/platform/execution/execution-engine/phase1b-orchestration.ts"],
  ["src/core/runtime/prompt-partition-cache.ts", "src/platform/execution/execution-engine/prompt-partition-cache.ts"],
  ["src/core/runtime/runtime-context.ts", "src/platform/execution/execution-engine/runtime-context.ts"],
  ["src/core/runtime/runtime-factory.ts", "src/platform/execution/execution-engine/runtime-factory.ts"],
  ["src/core/runtime/session-lifecycle.ts", "src/platform/execution/execution-engine/session-lifecycle.ts"],
  ["src/core/runtime/single-task-execution.ts", "src/platform/execution/execution-engine/single-task-execution.ts"],
  ["src/core/runtime/single-task-happy-path.ts", "src/platform/execution/execution-engine/single-task-happy-path.ts"],
  ["src/core/runtime/tight-loop-detector.ts", "src/platform/execution/execution-engine/tight-loop-detector.ts"],

  ["src/core/runtime/state-transition-machine.ts", "src/platform/execution/state-transition/state-transition-machine.ts"],
  ["src/core/runtime/transition-service.ts", "src/platform/execution/state-transition/transition-service.ts"],

  ["src/core/runtime/control-plane-load-balancing-schema.ts", "src/platform/execution/ha/control-plane-load-balancing-schema.ts"],
  ["src/core/runtime/coordinator-load-balancing-service.ts", "src/platform/execution/ha/coordinator-load-balancing-service.ts"],
  ["src/core/runtime/cross-region-deployment-service.ts", "src/platform/execution/ha/cross-region-deployment-service.ts"],
  ["src/core/runtime/ha-coordinator-service.ts", "src/platform/execution/ha/ha-coordinator-service.ts"],
  ["src/core/runtime/ha-repository-postgres.ts", "src/platform/execution/ha/ha-repository-postgres.ts"],
  ["src/core/runtime/ha-repository-sqlite.ts", "src/platform/execution/ha/ha-repository-sqlite.ts"],
  ["src/core/runtime/ha-repository.ts", "src/platform/execution/ha/ha-repository.ts"],
  ["src/core/runtime/ha-coordinator/ha-coordinator-factory.ts", "src/platform/execution/ha/ha-coordinator-factory.ts"],
  ["src/core/runtime/ha-coordinator/ha-coordinator-service-async.ts", "src/platform/execution/ha/ha-coordinator-service-async.ts"],
  ["src/core/runtime/ha-coordinator/ha-coordinator-service.ts", "src/platform/execution/ha/ha-coordinator-service-inner.ts"],
  ["src/core/runtime/ha-coordinator/mappers.ts", "src/platform/execution/ha/mappers.ts"],
  ["src/core/runtime/ha-coordinator/types.ts", "src/platform/execution/ha/types.ts"],

  ["src/core/runtime/hot-upgrade-factory.ts", "src/platform/execution/hot-upgrade/hot-upgrade-factory.ts"],
  ["src/core/runtime/hot-upgrade-repository-postgres.ts", "src/platform/execution/hot-upgrade/hot-upgrade-repository-postgres.ts"],
  ["src/core/runtime/hot-upgrade-repository-sqlite.ts", "src/platform/execution/hot-upgrade/hot-upgrade-repository-sqlite.ts"],
  ["src/core/runtime/hot-upgrade-repository.ts", "src/platform/execution/hot-upgrade/hot-upgrade-repository.ts"],
  ["src/core/runtime/hot-upgrade-service-async.ts", "src/platform/execution/hot-upgrade/hot-upgrade-service-async.ts"],
  ["src/core/runtime/hot-upgrade-service.ts", "src/platform/execution/hot-upgrade/hot-upgrade-service.ts"],

  ["src/core/runtime/execution-db-queue-disconnect-repair-service.ts", "src/platform/execution/recovery/execution-db-queue-disconnect-repair-service.ts"],
  ["src/core/runtime/recovery/runtime-recovery-decision-service.ts", "src/platform/execution/recovery/runtime-recovery-decision-service.ts"],
  ["src/core/runtime/recovery/runtime-recovery-replay-service.ts", "src/platform/execution/recovery/runtime-recovery-replay-service.ts"],
  ["src/core/runtime/recovery/runtime-recovery-service.ts", "src/platform/execution/recovery/runtime-recovery-service.ts"],
  ["src/core/runtime/recovery/runtime-repair-service.ts", "src/platform/execution/recovery/runtime-repair-service.ts"],
  ["src/core/runtime/runtime-recovery-decision-service.ts", "src/platform/execution/recovery/runtime-recovery-decision-service-root.ts"],
  ["src/core/runtime/runtime-recovery-replay-service.ts", "src/platform/execution/recovery/runtime-recovery-replay-service-root.ts"],
  ["src/core/runtime/runtime-recovery-service.ts", "src/platform/execution/recovery/runtime-recovery-service-root.ts"],
  ["src/core/runtime/runtime-repair-service.ts", "src/platform/execution/recovery/runtime-repair-service-root.ts"],
  ["src/core/runtime/stalled-execution-detector.ts", "src/platform/execution/recovery/stalled-execution-detector.ts"],
  ["src/core/runtime/stalled-execution-escalation-service.ts", "src/platform/execution/recovery/stalled-execution-escalation-service.ts"],
  ["src/core/runtime/validation-repair-loop.ts", "src/platform/execution/recovery/validation-repair-loop.ts"],
  ["src/core/runtime/workflow-crash-simulator.ts", "src/platform/execution/recovery/workflow-crash-simulator.ts"],

  ["src/core/runtime/hitl-explainability-service.ts", "src/platform/orchestration/hitl/hitl-explainability-service.ts"],
  ["src/core/runtime/distributed-rate-limiter.ts", "src/platform/interface/ingress/distributed-rate-limiter.ts"],
  ["src/core/runtime/redis-rate-limiter.ts", "src/platform/interface/ingress/redis-rate-limiter.ts"],
  ["src/core/runtime/redis-client-options.ts", "src/platform/shared/utils/redis-client-options.ts"],
  ["src/core/runtime/process-error-handlers.ts", "src/platform/execution/startup/process-error-handlers.ts"],
  ["src/core/runtime/license-enforcement-service.ts", "src/scale-ecosystem/marketplace/license-enforcement-service.ts"],
  ["src/core/runtime/startup-consistency-checker.ts", "src/platform/execution/startup/startup-consistency-checker.ts"],
  ["src/core/runtime/startup-preflight.ts", "src/platform/execution/startup/startup-preflight.ts"],
  ["src/core/runtime/graceful-shutdown.ts", "src/platform/execution/startup/graceful-shutdown.ts"],
  ["src/core/runtime/workflow-step-checkpoint.ts", "src/platform/state-evidence/checkpoints/workflow-step-checkpoint.ts"],
]);

const TEST_UNIT_PREFIX_MAP = [
  ["tests/unit/api/", "tests/unit/platform/interface/api/"],
  ["tests/unit/approvals/", "tests/unit/platform/control-plane/approval-center/"],
  ["tests/unit/artifacts/", "tests/unit/platform/state-evidence/artifacts/"],
  ["tests/unit/cache/", "tests/unit/platform/shared/cache/"],
  ["tests/unit/cli/", "tests/unit/sdk/cli/"],
  ["tests/unit/compliance/", "tests/unit/platform/control-plane/audit-export/"],
  ["tests/unit/config/", "tests/unit/platform/control-plane/config-center/"],
  ["tests/unit/constants/", "tests/unit/platform/contracts/constants/"],
  ["tests/unit/cost/", "tests/unit/platform/model-gateway/cost-tracker/"],
  ["tests/unit/deployment/", "tests/unit/platform/control-plane/rollout-controller/"],
  ["tests/unit/divisions/", "tests/unit/domains/governance/"],
  ["tests/unit/evaluation/", "tests/unit/platform/prompt-engine/eval/"],
  ["tests/unit/events/", "tests/unit/platform/state-evidence/events/"],
  ["tests/unit/evolution/", "tests/unit/ops-maturity/drift-detection/"],
  ["tests/unit/gateway/", "tests/unit/platform/interface/channel-gateway/"],
  ["tests/unit/hr/", "tests/unit/org-governance/org-model/"],
  ["tests/unit/knowledge/", "tests/unit/platform/state-evidence/knowledge/"],
  ["tests/unit/lifecycle/", "tests/unit/platform/shared/lifecycle/"],
  ["tests/unit/locking/", "tests/unit/platform/execution/distributed-lock/"],
  ["tests/unit/memory/", "tests/unit/platform/state-evidence/memory/"],
  ["tests/unit/messages/", "tests/unit/platform/model-gateway/messages/"],
  ["tests/unit/observability/", "tests/unit/platform/shared/observability/"],
  ["tests/unit/ops/", "tests/unit/platform/control-plane/incident-control/"],
  ["tests/unit/orchestration/", "tests/unit/platform/orchestration/routing/"],
  ["tests/unit/product/", "tests/unit/scale-ecosystem/marketplace/"],
  ["tests/unit/providers/", "tests/unit/platform/model-gateway/provider-registry/"],
  ["tests/unit/queue/", "tests/unit/platform/execution/queue/"],
  ["tests/unit/reliability/", "tests/unit/platform/execution/recovery/"],
  ["tests/unit/resource/", "tests/unit/platform/execution/resource/"],
  ["tests/unit/results/", "tests/unit/platform/contracts/result-envelope/"],
  ["tests/unit/security/", "tests/unit/platform/control-plane/iam/"],
  ["tests/unit/stability/", "tests/unit/platform/shared/stability/"],
  ["tests/unit/storage/", "tests/unit/platform/state-evidence/truth/"],
  ["tests/unit/testing/", "tests/unit/platform/shared/stability/"],
  ["tests/unit/tools/", "tests/unit/platform/execution/tool-executor/"],
  ["tests/unit/types/", "tests/unit/platform/contracts/types/"],
  ["tests/unit/utils/", "tests/unit/platform/shared/utils/"],
  ["tests/unit/workflow/", "tests/unit/platform/orchestration/oapeflir/workflow/"],

  ["tests/unit/core/api/", "tests/unit/platform/interface/api/"],
  ["tests/unit/core/approvals/", "tests/unit/platform/control-plane/approval-center/"],
  ["tests/unit/core/artifacts/", "tests/unit/platform/state-evidence/artifacts/"],
  ["tests/unit/core/autonomy/", "tests/unit/interaction/autonomy/"],
  ["tests/unit/core/cache/", "tests/unit/platform/shared/cache/"],
  ["tests/unit/core/compliance/", "tests/unit/platform/control-plane/audit-export/"],
  ["tests/unit/core/config/", "tests/unit/platform/control-plane/config-center/"],
  ["tests/unit/core/constants/", "tests/unit/platform/contracts/constants/"],
  ["tests/unit/core/cost/", "tests/unit/platform/model-gateway/cost-tracker/"],
  ["tests/unit/core/dashboard/", "tests/unit/interaction/dashboard/"],
  ["tests/unit/core/deployment/", "tests/unit/platform/control-plane/rollout-controller/"],
  ["tests/unit/core/divisions/", "tests/unit/domains/governance/"],
  ["tests/unit/core/domain-registry/", "tests/unit/domains/registry/"],
  ["tests/unit/core/evaluation/", "tests/unit/platform/prompt-engine/eval/"],
  ["tests/unit/core/events/", "tests/unit/platform/state-evidence/events/"],
  ["tests/unit/core/evolution/", "tests/unit/ops-maturity/drift-detection/"],
  ["tests/unit/core/feedback/", "tests/unit/scale-ecosystem/feedback-loop/collector/"],
  ["tests/unit/core/goal-decomposition/", "tests/unit/interaction/goal-decomposer/"],
  ["tests/unit/core/hr/", "tests/unit/org-governance/org-model/"],
  ["tests/unit/core/improvement/", "tests/unit/platform/orchestration/oapeflir/improve-rollout/"],
  ["tests/unit/core/knowledge/", "tests/unit/platform/state-evidence/knowledge/"],
  ["tests/unit/core/learning/", "tests/unit/platform/orchestration/oapeflir/learn/"],
  ["tests/unit/core/lifecycle/", "tests/unit/platform/shared/lifecycle/"],
  ["tests/unit/core/locking/", "tests/unit/platform/execution/distributed-lock/"],
  ["tests/unit/core/memory/", "tests/unit/platform/state-evidence/memory/"],
  ["tests/unit/core/messages/", "tests/unit/platform/model-gateway/messages/"],
  ["tests/unit/core/nl-entry/", "tests/unit/interaction/nl-gateway/"],
  ["tests/unit/core/observability/", "tests/unit/platform/shared/observability/"],
  ["tests/unit/core/ops/", "tests/unit/platform/control-plane/incident-control/"],
  ["tests/unit/core/orchestration/", "tests/unit/platform/orchestration/routing/"],
  ["tests/unit/core/planning/", "tests/unit/platform/orchestration/planner/"],
  ["tests/unit/core/proactive-agent/", "tests/unit/interaction/proactive-agent/"],
  ["tests/unit/core/product/", "tests/unit/scale-ecosystem/marketplace/"],
  ["tests/unit/core/providers/", "tests/unit/platform/model-gateway/provider-registry/"],
  ["tests/unit/core/queue/", "tests/unit/platform/execution/queue/"],
  ["tests/unit/core/reliability/", "tests/unit/platform/execution/recovery/"],
  ["tests/unit/core/resource/", "tests/unit/platform/execution/resource/"],
  ["tests/unit/core/results/", "tests/unit/platform/contracts/result-envelope/"],
  ["tests/unit/core/security/", "tests/unit/platform/control-plane/iam/"],
  ["tests/unit/core/stability/", "tests/unit/platform/shared/stability/"],
  ["tests/unit/core/storage/", "tests/unit/platform/state-evidence/truth/"],
  ["tests/unit/core/tools/", "tests/unit/platform/execution/tool-executor/"],
  ["tests/unit/core/types/", "tests/unit/platform/contracts/types/"],
  ["tests/unit/core/utils/", "tests/unit/platform/shared/utils/"],
  ["tests/unit/core/workflow/", "tests/unit/platform/orchestration/oapeflir/workflow/"],
  ["tests/unit/core/agent-loop/", "tests/unit/platform/orchestration/oapeflir/"],
];

const INTEGRATION_PREFIX_MAP = [
  ["tests/integration/cli/", "tests/integration/sdk/cli/"],
  ["tests/integration/api/", "tests/integration/platform/interface/api/"],
  ["tests/integration/gateway/", "tests/integration/platform/interface/channel-gateway/"],
  ["tests/integration/approvals/", "tests/integration/platform/control-plane/approval-center/"],
  ["tests/integration/compliance/", "tests/integration/platform/control-plane/audit-export/"],
  ["tests/integration/config/", "tests/integration/platform/control-plane/config-center/"],
  ["tests/integration/deployment/", "tests/integration/platform/control-plane/rollout-controller/"],
  ["tests/integration/ops/", "tests/integration/platform/control-plane/incident-control/"],
  ["tests/integration/artifacts/", "tests/integration/platform/state-evidence/artifacts/"],
  ["tests/integration/cache/", "tests/integration/platform/shared/cache/"],
  ["tests/integration/constants/", "tests/integration/platform/contracts/constants/"],
  ["tests/integration/contract/", "tests/integration/platform/contracts/"],
  ["tests/integration/cost/", "tests/integration/platform/model-gateway/cost-tracker/"],
  ["tests/integration/data-integrity/", "tests/integration/platform/state-evidence/truth/data-integrity/"],
  ["tests/integration/evaluation/", "tests/integration/platform/prompt-engine/eval/"],
  ["tests/integration/events/", "tests/integration/platform/state-evidence/events/"],
  ["tests/integration/evolution/", "tests/integration/ops-maturity/drift-detection/"],
  ["tests/integration/hr/", "tests/integration/org-governance/org-model/"],
  ["tests/integration/lifecycle/", "tests/integration/platform/shared/lifecycle/"],
  ["tests/integration/locking/", "tests/integration/platform/execution/distributed-lock/"],
  ["tests/integration/memory/", "tests/integration/platform/state-evidence/memory/"],
  ["tests/integration/messages/", "tests/integration/platform/model-gateway/messages/"],
  ["tests/integration/migration/", "tests/integration/platform/state-evidence/truth/migration/"],
  ["tests/integration/observability/", "tests/integration/platform/shared/observability/"],
  ["tests/integration/product/", "tests/integration/scale-ecosystem/marketplace/"],
  ["tests/integration/providers/", "tests/integration/platform/model-gateway/provider-registry/"],
  ["tests/integration/queue/", "tests/integration/platform/execution/queue/"],
  ["tests/integration/recovery/", "tests/integration/platform/execution/recovery/"],
  ["tests/integration/reliability/", "tests/integration/platform/execution/recovery/reliability/"],
  ["tests/integration/resource/", "tests/integration/platform/execution/resource/"],
  ["tests/integration/results/", "tests/integration/platform/contracts/result-envelope/"],
  ["tests/integration/runtime/", "tests/integration/platform/execution/"],
  ["tests/integration/security/", "tests/integration/platform/security/"],
  ["tests/integration/session/", "tests/integration/platform/execution/session/"],
  ["tests/integration/storage/", "tests/integration/platform/state-evidence/truth/"],
  ["tests/integration/tools/", "tests/integration/platform/execution/tool-executor/"],
  ["tests/integration/types/", "tests/integration/platform/contracts/types/"],
  ["tests/integration/utils/", "tests/integration/platform/shared/utils/"],
  ["tests/integration/workflow/", "tests/integration/platform/orchestration/oapeflir/workflow/"],
  ["tests/integration/concurrency/", "tests/integration/platform/execution/concurrency/"],
  ["tests/integration/divisions/", "tests/integration/domains/governance/"],
  ["tests/integration/smoke/", "tests/integration/platform/execution/smoke/"],
  ["tests/integration/soak/", "tests/integration/platform/execution/soak/"],
];

const PLACEHOLDER_INDEX_DIRS = [
  "src/platform/interface/webhook",
  "src/platform/interface/scheduler",
  "src/platform/interface/console-backend",
  "src/platform/interface/ingress",
  "src/platform/control-plane/tenant",
  "src/platform/control-plane/policy-center",
  "src/platform/control-plane/replay-repair-control",
  "src/platform/orchestration/replan",
  "src/platform/orchestration/escalation",
  "src/platform/execution/plugin-executor",
  "src/platform/state-evidence/projections",
  "src/platform/state-evidence/audit",
  "src/platform/state-evidence/incident",
  "src/platform/state-evidence/dlq",
  "src/platform/model-gateway/router",
  "src/platform/model-gateway/cache",
  "src/platform/model-gateway/fallback",
  "src/platform/prompt-engine/registry",
  "src/platform/prompt-engine/renderer",
  "src/platform/prompt-engine/rollout",
  "src/platform/compliance/erasure",
  "src/platform/compliance/encryption",
  "src/platform/compliance/data-residency",
  "src/platform/compliance/lineage",
  "src/platform/contracts/request-envelope",
  "src/platform/contracts/control-directive",
  "src/platform/contracts/execution-plan",
  "src/platform/contracts/execution-receipt",
  "src/platform/contracts/state-command",
  "src/platform/contracts/delegation-request",
  "src/platform/contracts/model-request",
  "src/domains/risk-profile",
  "src/domains/knowledge-schema",
  "src/domains/eval-framework",
  "src/domains/prompt-library",
  "src/domains/recipes",
  "src/domains/interaction-policy",
  "src/domains/coding",
  "src/domains/operations",
  "src/interaction/ux/wizard",
  "src/interaction/ux/template-engine",
  "src/interaction/dashboard/metric-aggregator",
  "src/interaction/dashboard/health-scorer",
  "src/interaction/dashboard/alert-router",
  "src/interaction/autonomy/trust-scorer",
  "src/interaction/autonomy/level-manager",
  "src/interaction/autonomy/promotion-engine",
  "src/interaction/goal-decomposer/planner",
  "src/interaction/goal-decomposer/dependency-graph",
  "src/interaction/goal-decomposer/validator",
  "src/interaction/proactive-agent/trigger-engine",
  "src/interaction/proactive-agent/schedule-manager",
  "src/interaction/proactive-agent/event-watcher",
  "src/interaction/nl-gateway/intent-parser",
  "src/interaction/nl-gateway/slot-resolver",
  "src/interaction/nl-gateway/ambiguity-handler",
  "src/org-governance/org-model/hierarchy",
  "src/org-governance/org-model/org-node",
  "src/org-governance/org-model/sync",
  "src/org-governance/approval-routing/route-engine",
  "src/org-governance/approval-routing/escalation",
  "src/org-governance/approval-routing/delegation",
  "src/org-governance/sso-scim/saml",
  "src/org-governance/sso-scim/oidc",
  "src/org-governance/sso-scim/scim-sync",
  "src/org-governance/compliance-engine/policy-resolver",
  "src/org-governance/compliance-engine/inheritance",
  "src/org-governance/compliance-engine/audit-enforcer",
  "src/org-governance/knowledge-boundary/boundary-manager",
  "src/org-governance/knowledge-boundary/sharing-gate",
  "src/org-governance/knowledge-boundary/access-log",
  "src/org-governance/delegated-governance/scope-manager",
  "src/org-governance/delegated-governance/delegation-registry",
  "src/scale-ecosystem/multi-region/region-router",
  "src/scale-ecosystem/multi-region/data-replicator",
  "src/scale-ecosystem/multi-region/failover-controller",
  "src/scale-ecosystem/resource-manager/fair-queue",
  "src/scale-ecosystem/resource-manager/quota-enforcer",
  "src/scale-ecosystem/resource-manager/preemption",
  "src/scale-ecosystem/sla-engine/tier-resolver",
  "src/scale-ecosystem/sla-engine/resource-allocator",
  "src/scale-ecosystem/sla-engine/breach-detector",
  "src/scale-ecosystem/marketplace/catalog",
  "src/scale-ecosystem/marketplace/certification",
  "src/scale-ecosystem/marketplace/publisher",
  "src/scale-ecosystem/feedback-loop/analyzer",
  "src/scale-ecosystem/feedback-loop/improvement-tracker",
  "src/scale-ecosystem/integration/connector-registry",
  "src/scale-ecosystem/integration/connector-runtime",
  "src/scale-ecosystem/integration/health-monitor",
  "src/ops-maturity/explainability/evidence-collector",
  "src/ops-maturity/explainability/causal-chain-builder",
  "src/ops-maturity/explainability/explanation-renderer",
  "src/ops-maturity/explainability/explanation-cache",
  "src/ops-maturity/emergency/panic-controller",
  "src/ops-maturity/emergency/forensic-snapshot",
  "src/ops-maturity/emergency/resume-protocol",
  "src/ops-maturity/agent-lifecycle/agent-registry",
  "src/ops-maturity/agent-lifecycle/version-manager",
  "src/ops-maturity/agent-lifecycle/canary-controller",
  "src/ops-maturity/agent-lifecycle/retirement",
  "src/ops-maturity/edge-runtime/edge-orchestrator",
  "src/ops-maturity/edge-runtime/edge-executor",
  "src/ops-maturity/edge-runtime/local-model",
  "src/ops-maturity/edge-runtime/sync-queue",
  "src/ops-maturity/drift-detection/fingerprint-builder",
  "src/ops-maturity/drift-detection/changepoint-detector",
  "src/ops-maturity/drift-detection/cross-agent-analyzer",
  "src/ops-maturity/cost-optimizer/attribution-engine",
  "src/ops-maturity/cost-optimizer/recommendation-engine",
  "src/ops-maturity/cost-optimizer/simulator",
  "src/ops-maturity/workflow-debugger/timeline-renderer",
  "src/ops-maturity/workflow-debugger/breakpoint-manager",
  "src/ops-maturity/workflow-debugger/run-comparator",
  "src/ops-maturity/compliance-reporter/template-registry",
  "src/ops-maturity/compliance-reporter/evidence-mapper",
  "src/ops-maturity/compliance-reporter/report-renderer",
  "src/ops-maturity/capacity-planner/trend-analyzer",
  "src/ops-maturity/capacity-planner/forecaster",
  "src/ops-maturity/capacity-planner/simulator",
  "src/ops-maturity/multimodal/image-processor",
  "src/ops-maturity/multimodal/speech-processor",
  "src/ops-maturity/multimodal/document-parser",
  "src/ops-maturity/multimodal/modality-router",
  "src/ops-maturity/platform-ops-agent/incident-diagnoser",
  "src/ops-maturity/platform-ops-agent/config-optimizer",
  "src/ops-maturity/platform-ops-agent/capacity-predictor",
  "src/ops-maturity/platform-ops-agent/dev-assistant",
  "src/ops-maturity/platform-ops-agent/health-monitor",
  "src/sdk/pack-sdk",
  "src/sdk/plugin-sdk",
  "src/sdk/client-sdk",
  "src/apps/api",
  "src/apps/console",
  "src/apps/workers",
];

function normalizePath(filePath) {
  return filePath.split(sep).join("/");
}

function walkFiles(dir) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) {
    return [];
  }
  const entries = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const resolved = join(absolute, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkFiles(normalizePath(relative(root, resolved))));
      continue;
    }
    if (entry.isFile()) {
      entries.push(normalizePath(relative(root, resolved)));
    }
  }
  return entries.sort();
}

function applyPrefixMap(relPath, prefixMap) {
  for (const [from, to] of prefixMap) {
    if (relPath.startsWith(from)) {
      return `${to}${relPath.slice(from.length)}`;
    }
  }
  return relPath;
}

function mapSource(relPath) {
  if (DIRECT_FILE_MAP.has(relPath)) {
    return DIRECT_FILE_MAP.get(relPath);
  }
  if (RUNTIME_FILE_MAP.has(relPath)) {
    return RUNTIME_FILE_MAP.get(relPath);
  }
  return applyPrefixMap(relPath, DIRECTORY_PREFIX_MAP);
}

function mapTest(relPath) {
  if (relPath === "tests/unit/core/errors.test.ts") {
    return "tests/unit/platform/contracts/errors.test.ts";
  }
  if (relPath.startsWith("tests/unit/")) {
    return applyPrefixMap(relPath, TEST_UNIT_PREFIX_MAP);
  }
  if (relPath.startsWith("tests/integration/")) {
    return applyPrefixMap(relPath, INTEGRATION_PREFIX_MAP);
  }
  return relPath;
}

function buildMoveMap() {
  const oldFiles = SOURCE_ROOTS.flatMap((dir) => walkFiles(dir));
  const moveMap = new Map();
  for (const relPath of oldFiles) {
    let next = relPath;
    if (relPath.startsWith("src/")) {
      next = mapSource(relPath);
    } else if (relPath.startsWith("tests/")) {
      next = mapTest(relPath);
    }
    moveMap.set(relPath, next);
  }
  return moveMap;
}

function ensureDir(dirPath) {
  mkdirSync(join(root, dirPath), { recursive: true });
}

function moveFiles(moveMap) {
  const entries = [...moveMap.entries()].filter(([from, to]) => from !== to);
  entries.sort((left, right) => left[0].length - right[0].length);
  for (const [from, to] of entries) {
    const fromAbs = join(root, from);
    if (!existsSync(fromAbs)) {
      continue;
    }
    ensureDir(dirname(to));
    renameSync(fromAbs, join(root, to));
  }
}

function cleanupEmptyDirs(dir) {
  const absolute = join(root, dir);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    return false;
  }
  const entries = readdirSync(absolute);
  let hasFiles = false;
  for (const entry of entries) {
    const childRel = normalizePath(join(dir, entry));
    const childAbs = join(root, childRel);
    if (statSync(childAbs).isDirectory()) {
      const childHasFiles = cleanupEmptyDirs(childRel);
      if (childHasFiles) {
        hasFiles = true;
      }
      continue;
    }
    hasFiles = true;
  }
  if (!hasFiles) {
    rmSync(absolute, { recursive: true, force: true });
    return false;
  }
  return true;
}

function getOriginalPath(currentPath, reverseMap) {
  return reverseMap.get(currentPath) ?? currentPath;
}

function resolveOldTarget(fromOriginalPath, specifier) {
  const resolvedBase = normalizePath(resolve(root, dirname(fromOriginalPath), specifier));
  const candidates = [];
  if (specifier.endsWith(".js")) {
    candidates.push(`${resolvedBase.slice(0, -3)}.ts`);
    candidates.push(`${resolvedBase.slice(0, -3)}.mts`);
    candidates.push(`${resolvedBase.slice(0, -3)}.cts`);
  } else {
    candidates.push(`${resolvedBase}.ts`);
    candidates.push(`${resolvedBase}.mts`);
    candidates.push(`${resolvedBase}.cts`);
    candidates.push(normalizePath(join(resolvedBase, "index.ts")));
  }
  candidates.push(resolvedBase);
  return candidates.map((candidate) => normalizePath(relative(root, candidate)));
}

function toJsSpecifier(fromCurrentPath, targetCurrentPath) {
  let rel = normalizePath(relative(dirname(fromCurrentPath), targetCurrentPath));
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  if (rel.endsWith(".ts")) {
    return `${rel.slice(0, -3)}.js`;
  }
  if (rel.endsWith(".mts")) {
    return `${rel.slice(0, -4)}.mjs`;
  }
  if (rel.endsWith(".cts")) {
    return `${rel.slice(0, -4)}.cjs`;
  }
  return rel;
}

function rewriteImports(moveMap) {
  const reverseMap = new Map([...moveMap.entries()].map(([from, to]) => [to, from]));
  const currentFiles = SOURCE_ROOTS.flatMap((dir) => walkFiles(dir)).filter((file) => TEXT_FILE_EXTENSIONS.has(extname(file)));
  const patterns = [
    { regex: /((?:import|export)\s+[^"']*?\sfrom\s+)(["'])(\.[^"']+)(\2)/g, index: 3 },
    { regex: /((?:import|export)\s*\()(["'])(\.[^"']+)(\2\s*\))/g, index: 3 },
  ];

  for (const currentPath of currentFiles) {
    const absolute = join(root, currentPath);
    const originalPath = getOriginalPath(currentPath, reverseMap);
    let content = readFileSync(absolute, "utf8");
    let changed = false;

    for (const { regex } of patterns) {
      content = content.replace(regex, (match, prefix, quote, specifier, suffix) => {
        const candidates = resolveOldTarget(originalPath, specifier);
        let targetCurrent = null;
        for (const candidate of candidates) {
          const mapped = moveMap.get(candidate) ?? candidate;
          if (existsSync(join(root, mapped))) {
            targetCurrent = mapped;
            break;
          }
        }
        if (targetCurrent == null) {
          return match;
        }
        const nextSpecifier = toJsSpecifier(currentPath, targetCurrent);
        if (nextSpecifier === specifier) {
          return match;
        }
        changed = true;
        return `${prefix}${quote}${nextSpecifier}${suffix}`;
      });
    }

    if (changed) {
      writeFileSync(absolute, content, "utf8");
    }
  }
}

function rewriteLegacyImports(moveMap) {
  const currentFiles = SOURCE_ROOTS.flatMap((dir) => walkFiles(dir)).filter((file) => TEXT_FILE_EXTENSIONS.has(extname(file)));
  for (const currentPath of currentFiles) {
    const absolute = join(root, currentPath);
    let content = readFileSync(absolute, "utf8");
    let changed = false;
    content = content.replace(/(["'])(\.[^"']+)(["'])/g, (match, open, specifier, close) => {
      let mapped = null;
      const legacySourceMatch = specifier.match(/(?:^|\/)(src\/(?:core|gateway|cli)\/[^"']+)/);
      if (legacySourceMatch?.[1]) {
        const legacySourcePath = legacySourceMatch[1]
          .replace(/\.js$/, ".ts")
          .replace(/\.mjs$/, ".mts")
          .replace(/\.cjs$/, ".cts");
        const sourceTarget = mapSource(legacySourcePath);
        if (sourceTarget !== legacySourcePath && existsSync(join(root, sourceTarget))) {
          mapped = sourceTarget;
        }
      }
      if (mapped == null && currentPath.startsWith("tests/")) {
        const helperMatch = specifier.match(/(?:^|\/)(helpers\/[^"']+)/);
        if (helperMatch?.[1]) {
          const helperPath = `tests/${helperMatch[1].replace(/\.js$/, ".ts")}`;
          if (existsSync(join(root, helperPath))) {
            mapped = helperPath;
          }
        }
      }
      if (mapped == null) {
        return match;
      }
      const nextSpecifier = toJsSpecifier(currentPath, mapped);
      changed = true;
      return `${open}${nextSpecifier}${close}`;
    });
    if (changed) {
      writeFileSync(absolute, content, "utf8");
    }
  }
}

function writePackageJson() {
  const packageJsonPath = join(root, "package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  const updated = raw.replaceAll("dist/src/cli/", "dist/src/sdk/cli/");
  if (updated !== raw) {
    writeFileSync(packageJsonPath, updated, "utf8");
  }
}

function ensurePlaceholderIndexes() {
  for (const dir of PLACEHOLDER_INDEX_DIRS) {
    ensureDir(dir);
    const indexPath = join(root, dir, "index.ts");
    if (!existsSync(indexPath)) {
      writeFileSync(indexPath, "export {};\n", "utf8");
    }
  }
}

function ensureTopLevelIndexes() {
  const paths = [
    "src/platform/index.ts",
    "src/domains/index.ts",
    "src/interaction/index.ts",
    "src/org-governance/index.ts",
    "src/scale-ecosystem/index.ts",
    "src/ops-maturity/index.ts",
    "src/sdk/index.ts",
    "src/apps/index.ts",
  ];
  for (const relPath of paths) {
    const abs = join(root, relPath);
    ensureDir(dirname(relPath));
    if (!existsSync(abs)) {
      writeFileSync(abs, "export {};\n", "utf8");
    }
  }
}

function main() {
  const moveMap = buildMoveMap();
  moveFiles(moveMap);
  cleanupEmptyDirs("src/core");
  cleanupEmptyDirs("src/gateway");
  cleanupEmptyDirs("src/cli");
  cleanupEmptyDirs("tests/unit/core");
  rewriteImports(moveMap);
  rewriteLegacyImports(moveMap);
  writePackageJson();
  ensurePlaceholderIndexes();
  ensureTopLevelIndexes();
}

main();
