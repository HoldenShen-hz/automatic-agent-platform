/**
 * Pack Validate CLI Command
 *
 * Validates a pack manifest against the platform contract requirements per §22.3.
 *
 * Usage:
 *   npm run pack-validate -- --manifest ./pack.json --contract-version 1.0.0
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  requirePackCompatibilityMetadata,
  validateBusinessPackManifest,
  type BusinessPackManifest,
} from "../pack-sdk/pack-manifest.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";

interface PackValidateOptions {
  manifest: string;
  contractVersion?: string;
  strict?: boolean;
}

function parseArgs(): PackValidateOptions {
  const args = process.argv.slice(2);
  const opts: PackValidateOptions = { manifest: "", strict: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--manifest" && next !== undefined) {
      opts.manifest = next;
      i++;
    } else if (arg === "--contract-version" && next !== undefined) {
      opts.contractVersion = next;
      i++;
    } else if (arg === "--strict") {
      opts.strict = true;
    }
  }
  return opts;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, string>;
}

function parseMajorVersion(version: string): number {
  const [majorSegment] = version.trim().split(".");
  const major = Number(majorSegment);
  return Number.isFinite(major) ? major : 0;
}

function main(): number {
  const opts = parseArgs();
  if (!opts.manifest) {
    process.stderr.write("Error: --manifest is required\n");
    return CLI_EXIT_FAILURE;
  }

  const result: ValidationResult = { valid: true, errors: [], warnings: [], metadata: {} };

  try {
    const content = readFileSync(opts.manifest, "utf-8");
    const manifest: BusinessPackManifest = JSON.parse(content);

    // Structural validation
    const validated = validateBusinessPackManifest(manifest);
    const compatibility = requirePackCompatibilityMetadata(validated);
    result.metadata["pack_id"] = validated.packId;
    result.metadata["version"] = validated.version;
    result.metadata["capabilities"] = String(validated.capabilities.length);

    // Contract version validation if provided
    if (opts.contractVersion) {
      const minVersion = compatibility.platformMinVersion;
      const maxVersion = compatibility.platformMaxVersion;
      const contractMajor = parseMajorVersion(opts.contractVersion);
      const minMajor = parseMajorVersion(minVersion);
      const maxMajor = parseMajorVersion(maxVersion);

      if (contractMajor < minMajor || contractMajor > maxMajor) {
        result.valid = false;
        result.errors.push(`contract_version_mismatch:requested=${opts.contractVersion},supported=${minVersion}-${maxVersion}`);
      } else {
        result.warnings.push(`contract_version_ok:${opts.contractVersion}`);
      }
    }

    result.metadata["sdk_semver"] = compatibility.sdkSemver;
    result.metadata["platform_min_version"] = compatibility.platformMinVersion;
    result.metadata["platform_max_version"] = compatibility.platformMaxVersion;

    // Contract test generator check
    if (!validated.contract_test_generator) {
      result.warnings.push("missing_optional_field:contract_test_generator");
    }

    // Capability validation
    if (validated.capabilities.length === 0) {
      result.valid = false;
      result.errors.push("empty_capabilities:not_allowed");
    }

    for (const cap of validated.capabilities) {
      if (!cap.capabilityKey?.trim()) {
        result.valid = false;
        result.errors.push("invalid_capability:capabilityKey_empty");
      }
      if (!cap.requiredContracts || cap.requiredContracts.length === 0) {
        result.warnings.push(`capability_requires_no_contracts:${cap.capabilityKey}`);
      }
    }

  } catch (err) {
    result.valid = false;
    result.errors.push(`validation_failed:${err instanceof Error ? err.message : String(err)}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.valid ? CLI_EXIT_SUCCESS : CLI_EXIT_FAILURE;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main);
}
