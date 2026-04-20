/**
 * Profile Home CLI Tool
 *
 * This module provides a command-line interface for resolving and creating
 * the agent profile home directory structure. It resolves the configured
 * profile home layout and optionally creates the necessary directories.
 *
 * Usage:
 *   npm run profile-home                    # Resolve layout only
 *   AA_PROFILE_HOME_CREATE=1 npm run profile-home  # Create directories
 *
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Profile home terminology
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */

import { ensureAgentProfileHome, resolveAgentProfileHome } from "../../platform/control-plane/config-center/profile-home.js";
import { loadProfileHomeCliEnv } from "../../platform/control-plane/config-center/ops-cli-env.js";

// Determine whether to create the profile home directories or just resolve the layout
const create = loadProfileHomeCliEnv().create;
const layout = resolveAgentProfileHome();

// Create directories if requested, otherwise just return the layout
const result = create ? ensureAgentProfileHome(layout) : layout;

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
