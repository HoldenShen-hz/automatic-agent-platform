/**
 * Pack Validate CLI Command
 *
 * Validates a pack manifest against the platform contract requirements per §22.3.
 *
 * Usage:
 *   npx tsx src/sdk/cli/pack-validate.ts --manifest ./pack.json --contract-version 1.0.0
 */

import { readFileSync } from "node:fs";
import { validateBusinessPackManifest, type BusinessPackManifest } from "../pack-sdk/pack-manifest.js";

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

function main(): void {
  const opts = parseArgs();
  if (!opts.manifest) {
    process.stderr.write("Error: --manifest is required\n");
    process.exit(1);
  }

  const result: ValidationResult = { valid: true, errors: [], warnings: [], metadata: {} };

  try {
    const content = readFileSync(opts.manifest, "utf-8");
    const manifest: BusinessPackManifest = JSON.parse(content);

    // Structural validation
    const validated = validateBusinessPackManifest(manifest);
    result.metadata["pack_id"] = validated.packId;
    result.metadata["version"] = validated.version;
    result.metadata["capabilities"] = String(validated.capabilities.length);

    // Contract version validation if provided
    if (opts.contractVersion) {
      const minVersion = validated.sdk_release?.platform_min_version ?? "0.0.0";
      const maxVersion = validated.sdk_release?.platform_max_version ?? "999.999.999";
      const contractMajor = minVersion.split(".").map(Number)[0] ?? 0;
      const minMajor = minVersion.split(".").map(Number)[0] ?? 0;
      const maxMajor = maxVersion.split(".").map(Number)[0] ?? 999;

      if (contractMajor < minMajor || contractMajor > maxMajor) {
        result.valid = false;
        result.errors.push(`contract_version_mismatch:requested=${opts.contractVersion},supported=${minVersion}-${maxVersion}`);
      } else {
        result.warnings.push(`contract_version_ok:${opts.contractVersion}`);
      }
    }

    // SDK semver check
    if (!validated.sdk_release?.sdk_semver) {
      if (opts.strict) {
        result.valid = false;
        result.errors.push("missing_field:sdk_semver");
      } else {
        result.warnings.push("missing_optional_field:sdk_semver");
      }
    }

    // Contract test generator check
    if (!validated.sdk_release?.contract_test_generator) {
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
  process.exit(result.valid ? 0 : 1);
}

main();
