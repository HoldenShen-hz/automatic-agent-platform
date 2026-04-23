/**
 * Proposal Engine
 *
 * Converts reflections into actionable improvement proposals.
 * Each proposal is categorized by type and risk level.
 */
import type { ReflectionRecord } from './reflection-engine.js';
export type ProposalKind = 'prompt_patch' | 'tool_routing_rule' | 'workflow_template' | 'skill_doc' | 'threshold_tuning';
export type ProposalStatus = 'proposed' | 'testing' | 'canary' | 'active' | 'rejected' | 'rolled_back';
export interface ImprovementProposal {
    id: string;
    title: string;
    description: string;
    kind: ProposalKind;
    target: string;
    patch: string;
    rationale: string;
    risk: 'low' | 'medium' | 'high';
    evidenceIds: string[];
    status: ProposalStatus;
    createdAt: string;
    updatedAt: string;
    expectedBenefit?: {
        quality?: number;
        latency?: number;
        cost?: number;
        stability?: number;
    };
}
export interface ProposalEngine {
    propose(reflections: ReflectionRecord[]): Promise<ImprovementProposal[]>;
    proposeFromReflection(reflection: ReflectionRecord): Promise<ImprovementProposal[]>;
    create(input: {
        title: string;
        description: string;
        kind: ProposalKind;
        target: string;
        risk: 'low' | 'medium' | 'high';
        agentId: string;
        evidenceIds: string[];
    }): Promise<ImprovementProposal>;
    submitForApproval(proposalId: string): Promise<void>;
    listPending(): Promise<ImprovementProposal[]>;
    listActive(): Promise<ImprovementProposal[]>;
}
export declare class SimpleProposalEngine implements ProposalEngine {
    private proposalIdCounter;
    private proposals;
    private readonly AUTO_PROMOTE_KINDS;
    private readonly MANUAL_ONLY_KINDS;
    propose(reflections: ReflectionRecord[]): Promise<ImprovementProposal[]>;
    proposeFromReflection(reflection: ReflectionRecord): Promise<ImprovementProposal[]>;
    canAutoPromote(kind: ProposalKind): boolean;
    requiresManualApproval(kind: ProposalKind): boolean;
    create(input: {
        title: string;
        description: string;
        kind: ProposalKind;
        target: string;
        risk: 'low' | 'medium' | 'high';
        agentId: string;
        evidenceIds: string[];
    }): Promise<ImprovementProposal>;
    submitForApproval(proposalId: string): Promise<void>;
    listPending(): Promise<ImprovementProposal[]>;
    listActive(): Promise<ImprovementProposal[]>;
    private generateToolRoutingPatch;
    private generateSkillDocPatch;
    private generateWorkflowPatch;
    private generatePromptPatch;
}
