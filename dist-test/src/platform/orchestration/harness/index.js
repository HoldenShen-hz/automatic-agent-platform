import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { AsyncHarnessService } from "./async-harness-service.js";
import { ContextAssembler } from "./context-assembler.js";
import { DurableHarnessService } from "./durable/durable-harness-service.js";
import { GuardrailEngine } from "./guardrails/guardrail-engine.js";
import { HitlRuntime } from "./hitl-runtime.js";
import { EvalRunService } from "./evaluation/eval-run-service.js";
import { HarnessMemoryManager } from "./memory-manager.js";
import { HarnessLoopController } from "./loop/index.js";
import { mapHarnessStepToOapeflirPhase } from "./oapeflir-harness-mapping.js";
import { RecoveryController } from "./recovery-controller.js";
import { ToolbeltAssembler } from "./toolbelt-assembler.js";
export * from "./harness-baseline.js";
export * from "./harness-bootstrap.js";
export * from "./async-harness-service.js";
export * from "./context-assembler.js";
export * from "./durable/durable-harness-service.js";
export * from "./evaluation/eval-run-service.js";
export * from "./evaluation/task-outcome-grader.js";
export * from "./guardrails/guardrail-engine.js";
export * from "./hitl-runtime.js";
export * from "./loop/index.js";
export * from "./memory-manager.js";
export * from "./oapeflir-harness-mapping.js";
export * from "./recovery-controller.js";
export * from "./toolbelt-assembler.js";
export class HarnessRuntimeService {
    toolbeltAssembler;
    guardrailEngine;
    hitlRuntime;
    memoryManager;
    evalRunService;
    durableService;
    contextAssembler;
    recoveryController;
    constructor(options = {}) {
        this.toolbeltAssembler = options.toolbeltAssembler ?? new ToolbeltAssembler();
        this.guardrailEngine = options.guardrailEngine ?? new GuardrailEngine();
        this.hitlRuntime = options.hitlRuntime ?? new HitlRuntime();
        this.memoryManager = options.memoryManager ?? new HarnessMemoryManager();
        this.evalRunService = options.evalRunService ?? new EvalRunService();
        this.durableService = options.durableService ?? new DurableHarnessService();
        this.contextAssembler = options.contextAssembler ?? new ContextAssembler();
        this.recoveryController = new RecoveryController(this.durableService, this);
    }
    createRun(input) {
        const run = {
            runId: newId("harness_run"),
            taskId: input.taskId,
            domainId: input.domainId,
            constraintPack: input.constraintPack,
            steps: [],
            maxIterations: input.constraintPack.budget.maxSteps,
            currentIteration: 0,
            status: "created",
            createdAt: nowIso(),
            completedAt: null,
            decision: null,
            contextSnapshots: [],
            sleepLease: null,
            recoveryCheckpoint: null,
            feedbackEnvelope: null,
            toolbelt: null,
            guardrailAssessment: null,
            hitlRequest: null,
            timeline: [],
        };
        return this.appendTimelineEvent(run, "run_created", {
            taskId: input.taskId,
            domainId: input.domainId,
        });
    }
    appendStep(run, input) {
        const completedAt = nowIso();
        const iteration = input.iteration ?? Math.max(run.currentIteration, 1);
        const step = {
            stepId: newId("harness_step"),
            role: input.role,
            stage: input.stage,
            iteration,
            semanticPhase: mapHarnessStepToOapeflirPhase(input.role, input.stage),
            inputs: input.inputs,
            outputs: input.outputs,
            startedAt: completedAt,
            completedAt,
        };
        return {
            ...run,
            steps: [...run.steps, step],
            currentIteration: Math.max(run.currentIteration, iteration),
            timeline: [
                ...run.timeline,
                {
                    eventId: newId("timeline"),
                    runId: run.runId,
                    type: "step_completed",
                    payload: { stepId: step.stepId, role: step.role, stage: step.stage, iteration },
                    recordedAt: nowIso(),
                },
            ],
        };
    }
    captureContextSnapshot(run) {
        return {
            snapshotId: newId("ctx_snapshot"),
            runId: run.runId,
            domainId: run.domainId,
            iteration: run.currentIteration,
            stepCount: run.steps.length,
            lastDecisionId: run.decision?.decisionId ?? null,
            capturedAt: nowIso(),
        };
    }
    assembleContext(sources, tokenBudget) {
        return this.contextAssembler.assemble(sources, tokenBudget);
    }
    snapshotContext(run, context) {
        return this.contextAssembler.snapshot(run, context);
    }
    sleep(run, reason, resumeAt) {
        return {
            ...run,
            status: "sleeping",
            sleepLease: {
                leaseId: newId("sleep_lease"),
                runId: run.runId,
                reason,
                resumeAt,
                createdAt: nowIso(),
            },
            timeline: [
                ...run.timeline,
                {
                    eventId: newId("timeline"),
                    runId: run.runId,
                    type: "sleep_started",
                    payload: { reason, resumeAt },
                    recordedAt: nowIso(),
                },
            ],
        };
    }
    recover(run) {
        return {
            ...run,
            status: "recovering",
            recoveryCheckpoint: {
                checkpointId: newId("recovery_checkpoint"),
                runId: run.runId,
                lastCompletedStepId: run.steps.at(-1)?.stepId ?? null,
                statusBeforeRecovery: run.status,
                createdAt: nowIso(),
            },
            timeline: [
                ...run.timeline,
                {
                    eventId: newId("timeline"),
                    runId: run.runId,
                    type: "recovery_started",
                    payload: { statusBeforeRecovery: run.status },
                    recordedAt: nowIso(),
                },
            ],
        };
    }
    resume(run) {
        return {
            ...run,
            status: "running",
            sleepLease: null,
            recoveryCheckpoint: null,
        };
    }
    openHitlReview(run, reason, evidenceRefs) {
        return {
            ...run,
            status: "waiting_hitl",
            hitlRequest: this.hitlRuntime.open({
                runId: run.runId,
                domainId: run.domainId,
                reason,
                evidenceRefs,
            }),
            timeline: [
                ...run.timeline,
                {
                    eventId: newId("timeline"),
                    runId: run.runId,
                    type: "hitl_requested",
                    payload: { reason, evidenceCount: evidenceRefs.length },
                    recordedAt: nowIso(),
                },
            ],
        };
    }
    resolveHitlReview(run, resolution, actorId) {
        if (run.hitlRequest == null) {
            throw new Error(`harness.hitl.request_not_found_for_run:${run.runId}`);
        }
        const resolved = this.hitlRuntime.resolve(run.hitlRequest.requestId, resolution, actorId);
        return {
            ...run,
            status: resolution === "approved" ? "running" : "aborted",
            completedAt: resolution === "approved" ? null : nowIso(),
            hitlRequest: resolved,
            timeline: [
                ...run.timeline,
                {
                    eventId: newId("timeline"),
                    runId: run.runId,
                    type: "hitl_resolved",
                    payload: { resolution, actorId },
                    recordedAt: nowIso(),
                },
            ],
        };
    }
    listTimeline(run) {
        return run.timeline;
    }
    writeMemory(run, namespace, key, value) {
        const scopeId = namespace === "run" ? run.runId : namespace === "domain" ? run.domainId : "global";
        this.memoryManager.write(namespace, scopeId, key, value);
    }
    readMemory(run, namespace, key) {
        const scopeId = namespace === "run" ? run.runId : namespace === "domain" ? run.domainId : "global";
        return this.memoryManager.read(namespace, scopeId, key);
    }
    assertInvariants(run) {
        const violations = [];
        if (run.currentIteration > run.maxIterations) {
            violations.push("harness.invariant.iteration_exceeds_budget");
        }
        if ((run.status === "completed" || run.status === "aborted") && run.completedAt == null) {
            violations.push("harness.invariant.final_state_requires_completed_at");
        }
        if (run.status === "waiting_hitl" && run.hitlRequest == null) {
            violations.push("harness.invariant.waiting_hitl_requires_request");
        }
        if (run.decision != null && run.decision.action !== "accept" && run.feedbackEnvelope == null) {
            violations.push("harness.invariant.non_accept_decision_requires_feedback");
        }
        return { violations };
    }
    evaluateRun(run) {
        return this.evalRunService.evaluate(run);
    }
    createAsyncService() {
        return new AsyncHarnessService(this);
    }
    persistRun(run) {
        return this.durableService.persist(run);
    }
    checkpointRun(run) {
        return this.durableService.checkpoint(run);
    }
    restoreRun(runId) {
        return this.durableService.restore(runId);
    }
    restoreFromCheckpoint(checkpointRef) {
        return this.durableService.restoreFromCheckpoint(checkpointRef);
    }
    handleFailure(run, failure) {
        return this.recoveryController.handleFailure(run, failure);
    }
    appendTimelineEvent(run, type, payload) {
        return {
            ...run,
            timeline: [
                ...run.timeline,
                {
                    eventId: newId("timeline"),
                    runId: run.runId,
                    type,
                    payload,
                    recordedAt: nowIso(),
                },
            ],
        };
    }
    decide(input) {
        let action = "accept";
        const reasonCodes = [];
        if (input.maxIterationsReached) {
            action = "abort";
            reasonCodes.push("harness.max_iterations_reached");
        }
        else if (input.requiresHuman) {
            action = "escalate_to_human";
            reasonCodes.push("harness.human_required");
        }
        else if (input.evaluatorScore < 0.5) {
            action = "replan";
            reasonCodes.push("harness.eval_below_replan_threshold");
        }
        else if (input.evaluatorScore < 0.75) {
            action = "retry_same_plan";
            reasonCodes.push("harness.eval_below_accept_threshold");
        }
        else {
            reasonCodes.push("harness.accepted");
        }
        return {
            decisionId: newId("harness_decision"),
            action,
            reasonCodes,
            confidence: Number(input.evaluatorScore.toFixed(4)),
            createdAt: nowIso(),
        };
    }
    runLoop(input) {
        const loop = new HarnessLoopController(input.constraintPack, {}, {
            iteration: Math.max(0, (input.iteration ?? 1) - 1),
        });
        let run = this.createRun({
            taskId: input.taskId,
            domainId: input.domainId,
            constraintPack: input.constraintPack,
        });
        run = {
            ...run,
            status: "running",
            currentIteration: input.iteration ?? 1,
        };
        while (true) {
            const iteration = (input.iteration ?? 1) + loop.getState().iteration;
            run = this.appendStep(run, {
                role: "planner",
                stage: "plan",
                inputs: { taskId: input.taskId, domainId: input.domainId },
                outputs: input.plannerOutput,
                iteration,
            });
            run = this.appendStep(run, {
                role: "generator",
                stage: "execute",
                inputs: input.plannerOutput,
                outputs: input.generatorOutput,
                iteration,
            });
            run = this.appendStep(run, {
                role: "evaluator",
                stage: "evaluate",
                inputs: input.generatorOutput,
                outputs: input.evaluatorOutput,
                iteration,
            });
            const toolbelt = this.toolbeltAssembler.assemble({
                allowedTools: input.constraintPack.toolPolicy.allowedTools,
                requestedTools: [...(input.requestedTools ?? [])],
                requiredEvidence: input.constraintPack.output_policy.requiredEvidence,
            });
            const guardrailAssessment = this.guardrailEngine.assess({
                toolbelt,
                evidenceRefs: [...(input.producedEvidenceRefs ?? [])],
                riskScore: input.riskScore ?? Math.max(0, input.constraintPack.risk_policy.escalationThreshold - 1),
                maxRiskScore: input.constraintPack.risk_policy.maxRiskScore,
                escalationThreshold: input.constraintPack.risk_policy.escalationThreshold,
                currentStepCount: run.steps.length,
                maxSteps: input.constraintPack.budget.maxSteps,
            });
            this.memoryManager.write("run", run.runId, "last_guardrail_assessment", guardrailAssessment);
            this.memoryManager.write("domain", run.domainId, "last_evaluator_score", input.evaluatorScore);
            const decision = this.decide({
                evaluatorScore: input.evaluatorScore,
                requiresHuman: input.requiresHuman === true || guardrailAssessment.requiresHuman,
                maxIterationsReached: run.steps.length >= input.constraintPack.budget.maxSteps,
            });
            const contextSnapshot = this.captureContextSnapshot({
                ...run,
                decision,
            });
            let baseRun = {
                ...run,
                toolbelt,
                guardrailAssessment,
                hitlRequest: null,
                status: guardrailAssessment.suggestedAction === "abort" || decision.action === "abort"
                    ? "aborted"
                    : decision.action === "accept"
                        ? "completed"
                        : decision.action === "escalate_to_human"
                            ? "waiting_hitl"
                            : "running",
                completedAt: guardrailAssessment.suggestedAction === "abort" || decision.action === "accept" || decision.action === "abort"
                    ? nowIso()
                    : null,
                decision,
                contextSnapshots: [...run.contextSnapshots, contextSnapshot],
                feedbackEnvelope: {
                    feedbackId: newId("feedback"),
                    signals: [
                        ...(input.producedEvidenceRefs ?? []),
                        ...decision.reasonCodes,
                        ...guardrailAssessment.findings.map((finding) => finding.code),
                    ],
                    learnedActions: decision.action === "replan"
                        ? ["update_plan_bundle"]
                        : decision.action === "retry_same_plan"
                            ? ["tighten_generator"]
                            : [],
                    createdAt: nowIso(),
                },
            };
            baseRun = this.appendTimelineEvent(baseRun, "guardrails_evaluated", {
                passed: guardrailAssessment.passed,
                requiresHuman: guardrailAssessment.requiresHuman,
                suggestedAction: guardrailAssessment.suggestedAction,
            });
            baseRun = this.appendTimelineEvent(baseRun, "decision_recorded", {
                action: decision.action,
                confidence: decision.confidence,
            });
            loop.recordIteration();
            if (decision.action === "replan") {
                loop.recordReplan();
            }
            const progress = loop.evaluateProgress(decision.action, baseRun.steps.length + 3 <= input.constraintPack.budget.maxSteps);
            const shouldStop = baseRun.status !== "running" || !progress.shouldContinue;
            if (shouldStop) {
                const finalRun = progress.violation !== null && baseRun.status === "running"
                    ? {
                        ...baseRun,
                        status: "aborted",
                        completedAt: nowIso(),
                        decision: {
                            decisionId: newId("harness_decision"),
                            action: "abort",
                            reasonCodes: progress.reasonCodes,
                            confidence: baseRun.decision?.confidence ?? 0,
                            createdAt: nowIso(),
                        },
                        feedbackEnvelope: baseRun.feedbackEnvelope == null
                            ? null
                            : {
                                ...baseRun.feedbackEnvelope,
                                signals: [...baseRun.feedbackEnvelope.signals, ...progress.reasonCodes],
                            },
                    }
                    : baseRun;
                if (finalRun.status !== "waiting_hitl") {
                    this.durableService.persist(finalRun);
                    return finalRun;
                }
                const withHitl = this.openHitlReview(finalRun, "guardrail_or_operator_escalation", [...(input.producedEvidenceRefs ?? []), ...guardrailAssessment.findings.map((finding) => finding.code)]);
                this.durableService.persist(withHitl);
                return withHitl;
            }
            run = {
                ...baseRun,
                status: "running",
                completedAt: null,
            };
        }
    }
}
//# sourceMappingURL=index.js.map