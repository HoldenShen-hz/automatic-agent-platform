/**
 * Pack Test CLI Command
 *
 * Tests a pack manifest and validates its configuration per §22.3.
 *
 * Usage:
 *   npx tsx src/sdk/cli/pack-test.ts --manifest ./pack.json
 */

import { readFileSync } from "node:fs";
import { validateBusinessPackManifest, type BusinessPackManifest } from "../pack-sdk/pack-manifest.js";

interface PackTestOptions {
  manifest: string;
  verbose?: boolean;
}

function parseArgs(): PackTestOptions {
  const args = process.argv.slice(2);
  const opts: PackTestOptions = { manifest: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manifest" && i + 1 < args.length) opts.manifest = args[++i];
    else if (args[i] === "--verbose") opts.verbose = true;
  }
  return opts;
}

interface TestResult {
  passed: boolean;
  checks: string[];
  errors: string[];
}

function main(): void {
  const opts = parseArgs();
  if (!opts.manifest) {
    process.stderr.write("Error: --manifest is required\n");
    process.exit(1);
  }

  const result: TestResult = { passed: true, checks: [], errors: [] };

  try {
    const content = readFileSync(opts.manifest, "utf-8");
    const manifest: BusinessPackManifest = JSON.parse(content);

    // Validate manifest structure
    const validated = validateBusinessPackManifest(manifest);
    result.checks.push(`manifest_valid:true`);
    result.checks.push(`pack_id:${validated.packId}`);
    result.checks.push(`capabilities_count:${validated.capabilities.length}`);

    if (opts.verbose) {
      result.checks.push(`version:${validated.version}`);
      result.checks.push(`domain:${validated.domainId}`);
      result.checks.push(`owner:${validated.owner}`);
      result.checks.push(`sdk_semver:${validated.sdk_semver ?? "not_set"}`);
      result.checks.push(`platform_min_version:${validated.platform_min_version ?? "not_set"}`);
      result.checks.push(`platform_max_version:${validated.platform_max_version ?? "not_set"}`);
      result.checks.push(`contract_test_generator:${validated.contract_test_generator ?? "not_set"}`);
    }

    // Check required fields per §22.2
    if (!validated.sdk_semver) {
      result.passed = false;
      result.errors.push("missing_required_field:sdk_semver");
    }
    if (!validated.platform_min_version) {
      result.passed = false;
      result.errors.push("missing_required_field:platform_min_version");
    }
    if (!validated.platform_max_version) {
      result.passed = false;
      result.errors.push("missing_required_field:platform_max_version");
    }
  } catch (err) {
    result.passed = false;
    result.errors.push(`parse_error:${err instanceof Error ? err.message : String(err)}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.passed ? 0 : 1);
}

main();