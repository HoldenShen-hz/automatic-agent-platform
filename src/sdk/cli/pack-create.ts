/**
 * Pack Create CLI Command
 *
 * Creates a new business pack manifest with the required fields per §22.3.
 *
 * Usage:
 *   npm run pack-create -- --pack-id my-pack --domain my-domain --owner me
 */

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { validateBusinessPackManifest, type BusinessPackManifest } from "../pack-sdk/pack-manifest.js";
import { newId } from "../../platform/contracts/types/ids.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";

interface PackCreateOptions {
  packId: string;
  domain: string;
  owner: string;
  version?: string;
  capabilities?: string[];
  tools?: string[];
  output?: string;
}

const PACK_CREATE_TOKEN_PATTERN = /^[A-Za-z0-9._:-]+$/u;

function parseListValue(value: string, label: "capabilities" | "tools"): string[] {
  const entries = [...new Set(value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  if (entries.length === 0 || entries.some((entry) => !PACK_CREATE_TOKEN_PATTERN.test(entry))) {
    throw new Error(`Invalid --${label} value`);
  }
  return entries;
}

export function parsePackCreateArgs(argv = process.argv.slice(2)): PackCreateOptions {
  const args = argv;
  const opts: PackCreateOptions = {
    packId: "",
    domain: "",
    owner: "",
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--pack-id" && next !== undefined) {
      opts.packId = next;
      i++;
    } else if (arg === "--domain" && next !== undefined) {
      opts.domain = next;
      i++;
    } else if (arg === "--owner" && next !== undefined) {
      opts.owner = next;
      i++;
    } else if (arg === "--version" && next !== undefined) {
      opts.version = next;
      i++;
    } else if (arg === "--capabilities" && next !== undefined) {
      opts.capabilities = parseListValue(next, "capabilities");
      i++;
    } else if (arg === "--tools" && next !== undefined) {
      opts.tools = parseListValue(next, "tools");
      i++;
    } else if (arg === "--output" && next !== undefined) {
      opts.output = next;
      i++;
    }
  }
  return opts;
}

export function buildPackCreateManifest(opts: PackCreateOptions): BusinessPackManifest {
  const manifest: BusinessPackManifest = {
    packId: opts.packId,
    version: opts.version ?? "1.0.0",
    domainId: opts.domain,
    owner: opts.owner,
    capabilities: (opts.capabilities ?? ["core"]).map((cap) => ({
      capabilityKey: cap.trim(),
      maturity: "experimental",
      requiredContracts: [],
    })),
    tools: opts.tools ?? [],
  };
  return manifest;
}

function main(): number {
  const opts = parsePackCreateArgs();
  if (!opts.packId || !opts.domain || !opts.owner) {
    process.stderr.write("Error: --pack-id, --domain, and --owner are required\n");
    return CLI_EXIT_FAILURE;
  }

  const manifest = buildPackCreateManifest(opts);
  const validated = validateBusinessPackManifest(manifest);

  if (opts.output) {
    writeFileSync(opts.output, `${JSON.stringify(validated, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ packId: validated.packId, version: validated.version, domainId: validated.domainId, outputPath: opts.output ?? null }, null, 2)}\n`);
  return CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main);
}
