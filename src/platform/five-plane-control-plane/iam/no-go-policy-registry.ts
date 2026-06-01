import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isPlainObject,
  parseLimitedYaml,
  toObjectArray,
  toStringArray,
} from "../../../domains/governance/division-loader-support.js";

export type NoGoEnforcementSurface = "ToolRisk" | "ReleaseGate" | "ClaimScanner" | (string & {});

export interface NoGoPolicyAction {
  readonly familyId: string | null;
  readonly id: string;
  readonly description: string;
  readonly riskClass: string;
  readonly scopes: readonly string[];
  readonly enforcementSurfaces: readonly NoGoEnforcementSurface[];
  readonly blockModes: readonly string[];
}

export interface NoGoPolicyRegistryOptions {
  readonly platformRoot?: string;
  readonly policyRoot?: string;
  readonly yamlReader?: (path: string) => string;
}

export interface NoGoPolicyMatchRequest {
  readonly familyId?: string | null;
  readonly enforcementSurface?: NoGoEnforcementSurface | null;
  readonly blockMode?: string | null;
}

function resolvePlatformRoot(platformRoot?: string): string {
  return platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

export class NoGoPolicyRegistry {
  private readonly policyRoot: string;
  private readonly yamlReader: (path: string) => string;

  public constructor(options: NoGoPolicyRegistryOptions = {}) {
    const platformRoot = resolvePlatformRoot(options.platformRoot);
    this.policyRoot = options.policyRoot ?? join(platformRoot, "config", "policy");
    this.yamlReader = options.yamlReader ?? ((path) => readFileSync(path, "utf8"));
  }

  public listActions(): NoGoPolicyAction[] {
    const config = this.readYamlObject(join(this.policyRoot, "no-go-actions.yaml"));
    const globalActions = toObjectArray(config.globalActions).map((action) => this.mapAction(action, null));
    const familyActions = toObjectArray(config.familyActions).flatMap((entry) => {
      const familyId = typeof entry.familyId === "string" ? entry.familyId : null;
      return toObjectArray(entry.actions).map((action) => this.mapAction(action, familyId));
    });
    return [...globalActions, ...familyActions];
  }

  public findMatchingActions(input: NoGoPolicyMatchRequest): NoGoPolicyAction[] {
    const familyId = input.familyId?.trim() ?? null;
    return this.listActions().filter((action) => {
      if (action.familyId != null && action.familyId !== familyId) {
        return false;
      }
      if (input.enforcementSurface != null && !action.enforcementSurfaces.includes(input.enforcementSurface)) {
        return false;
      }
      if (input.blockMode != null && !action.blockModes.includes(input.blockMode)) {
        return false;
      }
      return true;
    });
  }

  private mapAction(action: Record<string, unknown>, familyId: string | null): NoGoPolicyAction {
    return {
      familyId,
      id: typeof action.id === "string" ? action.id : "unnamed-no-go-action",
      description: typeof action.description === "string" ? action.description : "",
      riskClass: typeof action.riskClass === "string" ? action.riskClass : "",
      scopes: toStringArray(action.scopes),
      enforcementSurfaces: toStringArray(action.enforcementSurfaces) as NoGoEnforcementSurface[],
      blockModes: toStringArray(action.blockModes),
    };
  }

  private readYamlObject(path: string): Record<string, unknown> {
    const parsed = parseLimitedYaml(this.yamlReader(path), path);
    return isPlainObject(parsed) ? parsed : {};
  }
}
