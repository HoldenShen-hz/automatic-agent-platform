export declare const META_MODEL_QUESTION_IDS: readonly ["Q1_primary_user", "Q2_primary_outcomes", "Q3_core_inputs", "Q4_authoritative_sources", "Q5_decision_scope", "Q6_risk_hotspots", "Q7_required_tools", "Q8_workflow_shape", "Q9_eval_metrics", "Q10_human_governance", "Q11_latency_sla", "Q12_pre_launch_certs"];
export type MetaModelQuestionId = (typeof META_MODEL_QUESTION_IDS)[number];
export interface MetaModelAnswer {
    readonly questionId: MetaModelQuestionId;
    readonly title: string;
    readonly answer: string;
    readonly evidenceRefs: readonly string[];
    readonly status: "complete" | "partial" | "pending";
}
export interface DomainMetaModel {
    readonly domainId: string;
    readonly displayName: string;
    readonly version: string;
    readonly answers: readonly MetaModelAnswer[];
}
export interface MetaModelValidationResult {
    readonly domainId: string;
    readonly valid: boolean;
    readonly completeness: number;
    readonly missingQuestionIds: readonly MetaModelQuestionId[];
    readonly findings: readonly string[];
}
