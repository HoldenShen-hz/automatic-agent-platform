import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createScenarioChecklist } from "@aa/e2e";

function renderRouteCatalog(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        {createScenarioChecklist().map((scenario) => (
          <Route
            key={scenario.scenario}
            element={<section><h2>{scenario.expectedTitle}</h2></section>}
            path={scenario.route}
          />
        ))}
        <Route element={<section><h2>Not Found</h2></section>} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("web route catalog smoke", () => {
  afterEach(() => {
    cleanup();
  });

  for (const scenario of createScenarioChecklist()) {
    it(`matches ${scenario.scenario} at ${scenario.route}`, async () => {
      renderRouteCatalog(scenario.route);
      expect(await screen.findByText(scenario.expectedTitle)).toBeInTheDocument();
    });
  }
});
