export interface NlRequest {
  readonly message: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: string;
}

export interface ParsedIntent {
  readonly intent: string;
  readonly confidence: number;
  readonly workflowId?: string;
  readonly fallbackWorkflowId?: string;
}

export interface DisambiguationOption {
  readonly optionId: string;
  readonly label: string;
  readonly intentHint: string;
}
