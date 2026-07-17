import test from "node:test";
import assert from "node:assert/strict";

import { isSearchFundShell, isActualCompany, isSfBackedCompany } from "../src/data/privateCompanyModel.js";

test("SF company with vehicleEst Cerca is a shell regardless of ticket size", () => {
  // Hargrave case: still searching, but its €100,519 ticket is over the legacy
  // €100k heuristic threshold — est classification must win over ticket size.
  const hargrave = { tipus: "SF", ticket: 100519, vehicleEst: "Search Fund - Cerca" };
  assert.equal(isSearchFundShell(hargrave), true);
  assert.equal(isActualCompany(hargrave), false);
});

test("SF company with vehicleEst Participada is NOT a shell even with a small ticket", () => {
  const acquired = { tipus: "SF", ticket: 50000, vehicleEst: "Search Fund - Participada" };
  assert.equal(isSearchFundShell(acquired), false);
  assert.equal(isSfBackedCompany(acquired), true);
});

test("without vehicleEst, the ticket heuristic still applies", () => {
  assert.equal(isSearchFundShell({ tipus: "SF", ticket: 47500 }), true);
  assert.equal(isSearchFundShell({ tipus: "SF", ticket: 400000 }), false);
});

test("non-SF tipus is never a shell", () => {
  assert.equal(isSearchFundShell({ tipus: "PC", ticket: 47500, vehicleEst: "Search Fund - Cerca" }), false);
});
