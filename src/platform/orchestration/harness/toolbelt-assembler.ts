export interface ToolbeltAssemblyRequest {
  readonly allowedTools: readonly string[];
  readonly requestedTools: readonly string[];
  readonly requiredEvidence: readonly string[];
}

export interface HarnessToolbelt {
  readonly allowedTools: readonly string[];
  readonly grantedTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly requiredEvidence: readonly string[];
}

export class ToolbeltAssembler {
  public assemble(request: ToolbeltAssemblyRequest): HarnessToolbelt {
    const allowed = new Set(request.allowedTools);
    const grantedTools: string[] = [];
    const blockedTools: string[] = [];

    for (const tool of request.requestedTools) {
      if (allowed.has(tool)) {
        grantedTools.push(tool);
      } else {
        blockedTools.push(tool);
      }
    }

    return {
      allowedTools: [...request.allowedTools],
      grantedTools,
      blockedTools,
      requiredEvidence: [...request.requiredEvidence],
    };
  }
}
