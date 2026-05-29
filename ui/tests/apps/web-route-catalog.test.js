import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createScenarioChecklist } from "@aa/e2e";
function renderRouteCatalog(route) {
    return render(_jsx(MemoryRouter, { initialEntries: [route], children: _jsxs(Routes, { children: [createScenarioChecklist().map((scenario) => (_jsx(Route, { element: _jsx("section", { children: _jsx("h2", { children: scenario.expectedTitle }) }), path: scenario.route }, scenario.scenario))), _jsx(Route, { element: _jsx("section", { children: _jsx("h2", { children: "Not Found" }) }), path: "*" })] }) }));
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
