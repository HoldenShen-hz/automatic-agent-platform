import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildP0PilotEvidencePackage,
  runAllP0PilotEvidence,
  writeP0PilotEvidenceArtifacts,
  type P0PilotDivisionId,
} from "../../src/platform/shared/stability/p0-pilot-evidence-runner.js";

export interface RunP0PilotEvidenceCliOptions {
  readonly platformRoot?: string;
  readonly inputRoot?: string;
  readonly outputRoot?: string;
  readonly divisionId?: P0PilotDivisionId;
  readonly now?: Date;
}

function resolveDefaultPlatformRoot(): string {
  return dirname(dirname(dirname(fileURLToPath(import.meta.url))));
}

function parseDivisionId(value: string | undefined): P0PilotDivisionId | undefined {
  if (value == null || value.trim().length === 0 || value === "all") {
    return undefined;
  }
  if (value === "coding" || value === "knowledge-base" || value === "customer-service") {
    return value;
  }
  throw new Error(`pilot_evidence.division_unknown:${value}`);
}

function readArg(flag: string): string | undefined {
  const matched = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  return matched == null ? undefined : matched.slice(flag.length + 1);
}

export function runP0PilotEvidenceCli(options: RunP0PilotEvidenceCliOptions = {}): {
  readonly mode: "all" | P0PilotDivisionId;
  readonly outputRoot: string;
  readonly artifactPath: string;
} {
  const platformRoot = options.platformRoot
    ?? process.env.AA_PLATFORM_ROOT
    ?? resolveDefaultPlatformRoot();
  const inputRoot = options.inputRoot
    ?? process.env.AA_PILOT_EVIDENCE_INPUT_ROOT
    ?? join(platformRoot, "data", "pilot-evidence-inputs");
  const outputRoot = options.outputRoot
    ?? process.env.AA_PILOT_EVIDENCE_OUTPUT_ROOT
    ?? join(platformRoot, "artifacts", "validation", "p0-pilot-evidence");
  const divisionId = options.divisionId
    ?? parseDivisionId(process.env.AA_PILOT_EVIDENCE_DIVISION ?? readArg("--division"));
  const now = options.now ?? new Date();

  if (divisionId == null) {
    runAllP0PilotEvidence({
      platformRoot,
      inputRoot,
      outputRoot,
      now,
    });
    return {
      mode: "all",
      outputRoot,
      artifactPath: join(outputRoot, "p0-pilot-evidence-report.json"),
    };
  }

  writeP0PilotEvidenceArtifacts(
    buildP0PilotEvidencePackage(divisionId, {
      platformRoot,
      inputRoot,
      outputRoot,
      now,
    }),
    {
      platformRoot,
      inputRoot,
      outputRoot,
      now,
    },
  );
  return {
    mode: divisionId,
    outputRoot,
    artifactPath: join(outputRoot, divisionId, "evidence-package.json"),
  };
}

if (process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = runP0PilotEvidenceCli();
    console.log(`p0 pilot evidence exported: ${result.artifactPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
