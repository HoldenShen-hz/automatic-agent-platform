import {
  runStableGrayReleaseRehearsal,
  writeStableGrayReleaseRehearsalReport,
} from "../../platform/shared/stability/stable-gray-release-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_GRAY",
  defaultDir: "data/stable-gray",
  reportFilename: "stable-gray-release-report.json",
  runner: runStableGrayReleaseRehearsal,
  writer: writeStableGrayReleaseRehearsalReport,
});
