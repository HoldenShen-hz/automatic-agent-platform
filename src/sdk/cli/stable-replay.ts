import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
} from "../../platform/shared/stability/stable-event-replay-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_REPLAY",
  defaultDir: "data/stable-replay",
  reportFilename: "stable-event-replay-report.json",
  runner: runStableEventReplayRehearsal,
  writer: writeStableEventReplayRehearsalReport,
});
