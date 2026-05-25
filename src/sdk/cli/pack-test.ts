/**
 * Pack Test CLI Command
 *
 * Tests a pack manifest and validates its configuration per §22.3.
 *
 * Usage:
 *   npm run pack-test -- --manifest ./pack.json
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  requirePackCompatibilityMetadata,
  validateBusinessPackManifest,
  type BusinessPackManifest,
} from "../pack-sdk/pack-manifest.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";

interface PackTestOptions {
  manifest: string;
  verbose?: boolean;
}

function parseArgs(): PackTestOptions {
  const args = process.argv.slice(2);
  const opts: PackTestOptions = { manifest: "" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--manifest" && next !== undefined) {
      opts.manifest = next;
      i++;
    } else if (arg === "--verbose") {
      opts.verbose = true;
    }
  }
  return opts;
}

interface TestResult {
  passed: boolean;
  checks: string[];
  errors: string[];
}

function main(): number {
  const opts = parseArgs();
  if (!opts.manifest) {
    process.stderr.write("Error: --manifest is required\n");
    return CLI_EXIT_FAILURE;
  }

  const result: TestResult = { passed: true, checks: [], errors: [] };

  try {
    const content = readFileSync(opts.manifest, "utf-8");
    const manifest: BusinessPackManifest = JSON.parse(content);

    // Validate manifest structure
    const validated = validateBusinessPackManifest(manifest);
    const compatibility = requirePackCompatibilityMetadata(validated);
    result.checks.push(`manifest_valid:true`);
    result.checks.push(`pack_id:${validated.packId}`);
    result.checks.push(`capabilities_count:${validated.capabilities.length}`);

    if (opts.verbose) {
      result.checks.push(`version:${validated.version}`);
      result.checks.push(`domain:${validated.domainId}`);
      result.checks.push(`owner:${validated.owner}`);
      result.checks.push(`sdk_semver:${compatibility.sdkSemver}`);
      result.checks.push(`platform_min_version:${compatibility.platformMinVersion}`);
      result.checks.push(`platform_max_version:${compatibility.platformMaxVersion}`);
      result.checks.push(`contract_test_generator:${validated.contract_test_generator ?? "not_set"}`);
    }
  } catch (err) {
    result.passed = false;
    result.errors.push(`parse_error:${err instanceof Error ? err.message : String(err)}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.passed ? CLI_EXIT_SUCCESS : CLI_EXIT_FAILURE;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main);
}
