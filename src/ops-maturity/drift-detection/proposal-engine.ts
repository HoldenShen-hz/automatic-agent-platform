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
  | 'review'
  | 'staging'
  | 'canary'
  | 'active'
  | 'paused'
  | 'deprecated'
  | 'archived'
  | 'retired';

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

    if (rootCause.includes('type') || rootCause.includes('schema')) {
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Tool Routing Optimization',
        description: 'Optimize tool selection for type-safe operations',
        kind: 'tool_routing_rule',
        target: 'type_validation',
        patch: this.generateToolRoutingPatch(reflection),
        rationale: `Tool routing optimization based on ${reflection.evidenceIds.length} failures`,
        risk: 'low',
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { stability: 0.15, cost: 0.05 },
      });
    }

    if (rootCause.includes('test')) {
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Improve Testing Guidelines',
        description: 'Improve testing practices guideline',
        kind: 'skill_doc',
        target: 'testing_guidelines',
        patch: this.generateSkillDocPatch(reflection),
        rationale: `Improve testing guidelines based on ${reflection.evidenceIds.length} test failures`,
        risk: 'low',
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { quality: 0.10 },
      });
    }

    if (rootCause.includes('complex') || rootCause.includes('planning')) {
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Workflow Template Improvement',
        description: 'Improved complex task workflow',
        kind: 'workflow_template',
        target: 'complex_task_template',
        patch: this.generateWorkflowPatch(reflection),
        rationale: `Improve workflow template for complex tasks`,
        risk: 'high',  // workflow_template is in MANUAL_ONLY_KINDS = requires manual approval
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        expectedBenefit: { stability: 0.20, latency: -0.10 },
      });
    }

    if (rootCause.includes('security')) {
      proposals.push({
        id: `prop_${++this.proposalIdCounter}`,
        title: 'Security Guidelines Enhancement',
        description: 'Strengthen security prompt sections',
        kind: 'prompt_patch',
        target: 'security_guidelines',
        patch: this.generatePromptPatch(reflection),
        rationale: `Strengthen security guidelines`,
        risk: 'high',
        evidenceIds: reflection.evidenceIds,
        status: 'draft',
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
      evidenceIds: input.evidenceIds,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  async submitForApproval(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      proposal.status = 'staging';
      proposal.updatedAt = new Date().toISOString();
    }
  }

  async listPending(): Promise<ImprovementProposal[]> {
    return Array.from(this.proposals.values()).filter((p) => p.status === 'draft');
  }

  async listActive(): Promise<ImprovementProposal[]> {
    return Array.from(this.proposals.values()).filter(
      (p) => p.status === 'staging' || p.status === 'canary' || p.status === 'active'
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
