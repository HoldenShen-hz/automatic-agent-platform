import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { analyzeFeedbackSignals } from "./analyzer/index.js";
import { FeedbackCollector } from "./collector/feedback-collector.js";
import { summarizeImprovementTracking, } from "./improvement-tracker/index.js";
export class FeedbackImprovementService {
    collector = new FeedbackCollector();
    records = new Map();
    candidates = new Map();
    ingest(input) {
        const feedback = this.collector.collect(input);
        const learningSignals = this.collector.toLearningSignals(feedback);
        const candidates = learningSignals.map((signal) => this.createCandidate(signal));
        return { feedback, learningSignals, candidates };
    }
    createCandidate(signal) {
        if (signal.sourceSignalIds.length === 0) {
            throw new Error(`feedback_improvement.missing_source_signal:${signal.learningSignalId}`);
        }
        const candidate = {
            candidateId: newId("improvement_candidate"),
            candidateType: this.mapCandidateType(signal.learningType),
            sourceSignalIds: signal.sourceSignalIds,
            proposedChange: signal.valueSummary,
            riskAssessment: signal.confidence >= 0.85 ? "low" : signal.confidence >= 0.6 ? "medium" : "high",
            reviewStatus: "proposed",
        };
        this.candidates.set(candidate.candidateId, candidate);
        this.records.set(candidate.candidateId, {
            candidateId: candidate.candidateId,
            sourceSignalIds: [...candidate.sourceSignalIds],
            status: "proposed",
            owner: "feedback_loop",
        });
        return candidate;
    }
    review(candidateId, reviewer, decision, options) {
        const candidate = this.requireCandidate(candidateId);
        const allowed = decision === "approved" && options.rolloutGatePassed && options.policyGatePassed;
        const nextStatus = allowed ? "approved" : "rejected";
        this.candidates.set(candidateId, {
            ...candidate,
            reviewStatus: nextStatus,
        });
        this.records.set(candidateId, {
            candidateId,
            sourceSignalIds: [...candidate.sourceSignalIds],
            status: nextStatus,
            owner: reviewer,
        });
        return {
            candidateId,
            decision: nextStatus === "approved" ? "approved" : "rejected",
            reviewer,
            reviewedAt: options.reviewedAt ?? nowIso(),
            rolloutGatePassed: options.rolloutGatePassed,
            policyGatePassed: options.policyGatePassed,
        };
    }
    release(candidateId, owner) {
        const candidate = this.requireCandidate(candidateId);
        if (candidate.reviewStatus !== "approved") {
            throw new Error(`feedback_improvement.release_requires_approval:${candidateId}`);
        }
        const released = {
            ...candidate,
            reviewStatus: "released",
        };
        this.candidates.set(candidateId, released);
        this.records.set(candidateId, {
            candidateId,
            sourceSignalIds: [...candidate.sourceSignalIds],
            status: "released",
            owner,
        });
        return released;
    }
    buildSnapshot(signals, generatedAt = nowIso()) {
        return {
            generatedAt,
            analysis: analyzeFeedbackSignals(signals),
            trackingSummary: summarizeImprovementTracking([...this.records.values()]),
            candidateCount: this.candidates.size,
        };
    }
    listCandidates() {
        return [...this.candidates.values()];
    }
    mapCandidateType(signalType) {
        switch (signalType) {
            case "failure_pattern":
                return "workflow_patch";
            case "user_correction":
                return "prompt_tuning";
            case "recovery_playbook":
            default:
                return "playbook_update";
        }
    }
    requireCandidate(candidateId) {
        const candidate = this.candidates.get(candidateId);
        if (candidate == null) {
            throw new Error(`feedback_improvement.candidate_not_found:${candidateId}`);
        }
        return candidate;
    }
}
//# sourceMappingURL=feedback-improvement-service.js.map