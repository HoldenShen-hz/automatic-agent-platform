// Seeded evasion sample: the import string is split across a
// string-concatenation so a text-level scanner may miss it. The
// audit:architecture-boundary script MUST still catch this because
// the assembled specifier text contains a forbidden plane.
//
// We use a static import that contains a long comment + the
// forbidden plane path, so the line is at least a valid TS source.
const _id = "ad-hoc";
import { plannerService as p } from "../../../src/platform/five-plane-orchestration/planner/index.js";
void p;
void _id;
