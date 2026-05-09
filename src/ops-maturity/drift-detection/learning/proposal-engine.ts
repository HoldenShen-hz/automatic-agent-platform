/**
 * Proposal Engine
 *
 * Converts reflections into actionable improvement proposals.
 * Each proposal is categorized by type and risk level.
 */

import type { ReflectionRecord } from './reflection-engine.js';

export type ProposalKind =
  | 'prompt_patch'
  | 'tool_routing_rule'
  | 'workflow_template'
  | 'skill_doc'
  | 'threshold_tuning';

export type ProposalStatus =
  | 'draft'
  | 'reviewed'
  | 'staged'
  | 'stable'
  | 'retired'
  | 'rejected'

export interface ImprovementProposal {
  id: string;
  title: string;
  description: string;
  kind: ProposalKind;
  target: string;
  patch: string;
  rationale: string;
  risk: 'low' | 'medium' | 'high';
  reviewRequirement: 'auto' | 'manual_review';
  evidenceIds: string[];
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  draftedAt: string;
  reviewedAt?: string;
  stagedAt?: string;
  stabilizedAt?: string;
  retiredAt?: string;
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

export class SimpleProposalEngine implements ProposalEngine {
  private proposalIdCounter = 0;
  private proposals = new Map<string, ImprovementProposal>();

  // Low-risk proposal kinds that can auto-promote
  private readonly AUTO_PROMOTE_KINDS: readonly ProposalKind[] = [
    'tool_routing_rule',
    'skill_doc',
  ];

  // High-risk kinds requiring manual approval
  private readonly MANUAL_ONLY_KINDS: readonly ProposalKind[] = [
    'prompt_patch',
    'workflow_template',
    'threshold_tuning',
  ];

  async propose(reflections: ReflectionRecord[]): Promise<ImprovementProposal[]> {
    const proposals: ImprovementProposal[] = [];

    for (const reflection of reflections) {
      const generated = await this.proposeFromReflection(reflection);
      proposals.push(...generated);
    }

    return proposals;
  }

  async proposeFromReflection(reflection: ReflectionRecord): Promise<ImprovementProposal[]> {
    const proposals: ImprovementProposal[] = [];
    const now = new Date().toISOString();

    // Determine proposal kinds based on root cause
    const rootCause = reflection.rootCause.toLowerCase();

    // R13-11: Determine appropriate risk level based on content and type
    const determineRisk = (baseKind: ProposalKind, target: string): 'low' | 'medium' | 'high' => {
      // High-risk categories always high
      if (baseKind === 'prompt_patch' || baseKind === 'threshold_tuning') {
        return 'high';
      }
      // Security-related targets always at least medium
      const securityKeywords = ['security', 'auth', 'permission', 'access_control'];
      if (securityKeywords.some(kw => target.toLowerCase().includes(kw) || rootCause.includes(kw))) {
        return 'high';
      }
      // Workflow template changes are medium risk
      if (baseKind === 'workflow_template') {
        return 'medium';
      }
      // Default to low for tool_routing_rule and skill_doc
      return 'low';
    };
    const determineReviewRequirement = (risk: 'low' | 'medium' | 'high'): ImprovementProposal['reviewRequirement'] =>
      risk === 'high' || risk === 'medium' ? 'manual_review' : 'auto';

    if (rootCause.includes('type') || rootCause.includes('schema')) {
      const kind: ProposalKind = 'tool_routing_rule';
      const risk = determineRisk(kind, 'type_validation');
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Tool Routing Optimization',
        description: 'Optimize tool selection for type-safe operations',
        kind,
        target: 'type_validation',
        patch: this.generateToolRoutingPatch(reflection),
        rationale: `Tool routing optimization based on ${reflection.evidenceIds.length} failures`,
        risk,
        reviewRequirement: determineReviewRequirement(risk),
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        draftedAt: now,
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { stability: 0.15, cost: 0.05 },
      });
    }

    if (rootCause.includes('test')) {
      const kind: ProposalKind = 'skill_doc';
      const risk = determineRisk(kind, 'testing_guidelines');
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Improve Testing Guidelines',
        description: 'Improve testing practices guideline',
        kind,
        target: 'testing_guidelines',
        patch: this.generateSkillDocPatch(reflection),
        rationale: `Improve testing guidelines based on ${reflection.evidenceIds.length} test failures`,
        risk,
        reviewRequirement: determineReviewRequirement(risk),
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        draftedAt: now,
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { quality: 0.10 },
      });
    }

    if (rootCause.includes('complex') || rootCause.includes('planning')) {
      const kind: ProposalKind = 'workflow_template';
      const risk = determineRisk(kind, 'complex_task_template');
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Workflow Template Improvement',
        description: 'Improved complex task workflow',
        kind,
        target: 'complex_task_template',
        patch: this.generateWorkflowPatch(reflection),
        rationale: `Improve workflow template for complex tasks`,
        risk,
        reviewRequirement: determineReviewRequirement(risk),
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        draftedAt: now,
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { stability: 0.20, latency: -0.10 },
      });
    }

    if (rootCause.includes('security')) {
      const kind: ProposalKind = 'prompt_patch';
      const risk: ImprovementProposal['risk'] = 'high';
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Security Guidelines Enhancement',
        description: 'Strengthen security prompt sections',
        kind,
        target: 'security_guidelines',
        patch: this.generatePromptPatch(reflection),
        rationale: `Strengthen security guidelines`,
        risk,
        reviewRequirement: determineReviewRequirement(risk),
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        draftedAt: now,
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { stability: 0.30 },
      });
    }

    return proposals;
  }

  canAutoPromote(kind: ProposalKind): boolean {
    return this.AUTO_PROMOTE_KINDS.includes(kind);
  }

  requiresManualApproval(kind: ProposalKind): boolean {
    return this.MANUAL_ONLY_KINDS.includes(kind);
  }

  async create(input: {
    title: string;
    description: string;
    kind: ProposalKind;
    target: string;
    risk: 'low' | 'medium' | 'high';
    agentId: string;
    evidenceIds: string[];
  }): Promise<ImprovementProposal> {
    const id = `prop_${++this.proposalIdCounter}`;
    const now = new Date().toISOString();

    const proposal: ImprovementProposal = {
      id,
      title: input.title,
      description: input.description,
      kind: input.kind,
      target: input.target,
      patch: input.description,
      rationale: input.description,
      risk: input.risk,
      reviewRequirement: input.risk === 'low' ? 'auto' : 'manual_review',
      evidenceIds: input.evidenceIds,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      draftedAt: now,
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  async submitForApproval(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      const updatedAt = new Date().toISOString();
      proposal.status = 'reviewed';
      proposal.reviewedAt = updatedAt;
      proposal.updatedAt = updatedAt;
    }
  }

  async listPending(): Promise<ImprovementProposal[]> {
    return Array.from(this.proposals.values()).filter((p) => p.status === 'draft');
  }

  async listActive(): Promise<ImprovementProposal[]> {
    return Array.from(this.proposals.values()).filter(
      (p) => p.status === 'reviewed' || p.status === 'staged' || p.status === 'stable'
    );
  }

  private generateToolRoutingPatch(_reflection: ReflectionRecord): string {
    return JSON.stringify({
      description: 'Optimize tool selection for type-safe operations',
      rules: [
        { condition: 'task_type contains "validation"', preferTools: ['diagnostics', 'typecheck'] },
        { condition: 'task_type contains "refactor"', avoidTools: ['apply_patch'] },
      ],
    }, null, 2);
  }

  private generateSkillDocPatch(_reflection: ReflectionRecord): string {
    return JSON.stringify({
      description: 'Improve testing practices guideline',
      content: 'When writing tests, prefer simple assertions and cover edge cases explicitly.',
    }, null, 2);
  }

  private generateWorkflowPatch(_reflection: ReflectionRecord): string {
    return JSON.stringify({
      description: 'Improved complex task workflow',
      steps: [
        'Analyze requirements carefully before starting',
        'Break down complex tasks into smaller steps',
        'Validate intermediate results before proceeding',
      ],
    }, null, 2);
  }

  private generatePromptPatch(_reflection: ReflectionRecord): string {
    return JSON.stringify({
      description: 'Strengthen security prompt sections',
      sections: {
        safety_policy: 'Always validate tool inputs against allowed paths before execution',
      },
    }, null, 2);
  }
}
