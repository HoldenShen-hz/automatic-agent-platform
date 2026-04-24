import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryWSClient } from "@aa/shared-api-client";
import { createScenarioChecklist } from "@aa/e2e";
import { App } from "../../apps/web/src/App";

function renderScenario(route: string) {
  return render(<App initialEntries={[route]} router="memory" wsClient={new InMemoryWSClient()} />);
}

describe("web route catalog smoke", () => {
  afterEach(() => {
    cleanup();
  });

  for (const scenario of createScenarioChecklist()) {
    it(`renders ${scenario.scenario} at ${scenario.route}`, async () => {
      renderScenario(scenario.route);
      expect(await screen.findByText(scenario.expectedTitle)).toBeInTheDocument();
    });
  }
});
