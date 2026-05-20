/**
 * Pack Create CLI Command
 *
 * Creates a new business pack manifest with the required fields per §22.3.
 *
 * Usage:
 *   npm run pack-create -- --pack-id my-pack --domain my-domain --owner me
 */

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

function parseArgs(): PackCreateOptions {
  const args = process.argv.slice(2);
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
      opts.capabilities = next.split(",");
      i++;
    } else if (arg === "--tools" && next !== undefined) {
      opts.tools = next.split(",");
      i++;
    } else if (arg === "--output" && next !== undefined) {
      opts.output = next;
      i++;
    }
  }
  return opts;
}

function buildManifest(opts: PackCreateOptions): BusinessPackManifest {
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
  const opts = parseArgs();
  if (!opts.packId || !opts.domain || !opts.owner) {
    process.stderr.write("Error: --pack-id, --domain, and --owner are required\n");
    return CLI_EXIT_FAILURE;
  }

  const manifest = buildManifest(opts);
  const validated = validateBusinessPackManifest(manifest);

  const output = opts.output
    ? JSON.stringify(validated, null, 2)
    : JSON.stringify({ packId: validated.packId, version: validated.version, domainId: validated.domainId }, null, 2);

  process.stdout.write(`${output}\n`);
  return CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main);
}
