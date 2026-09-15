import test from "node:test";
import assert from "node:assert/strict";

import {
  createSearcherCapitalCallMatcher,
  enrichSearchersWithCapitalCalls,
  isActiveSearcher,
  isActualCompanyCapitalCall,
  isInvestedUnacquiredSearcher,
  matchSearcherCapitalCall,
} from "../src/data/searcherModel.js";

test("enrichSearchersWithCapitalCalls derives earliest SF commitment by vehicle id", () => {
  const [row] = enrichSearchersWithCapitalCalls(
    [{ id: 7, nif: "veh-1", nom: "Aeqor Partners", ticket: null, dataCompr: null, statusScreening: "Invertit en fase de cerca" }],
    [
      { vehicle_id: "veh-1", fons: "Aeqor", est: "Search Fund - Cerca", cat: "Capital Call", data: "2026-03-10", eur: 200000 },
      { vehicle_id: "veh-1", fons: "Aeqor", est: "Search Fund - Cerca", cat: "Compromís", data: "2026-02-01", eur: 500000 },
    ],
    { calcMonths: () => 3 },
  );

  assert.equal(row.ticket, 500000);
  assert.equal(row.derivedDataCompr, "2026-02-01");
  assert.equal(row.investmentYear, 2026);
  assert.equal(row.stageLabel, "Cerca activa");
  assert.equal(row.mesosCercant, 3);
});

test("searcher capital-call matcher accepts id, exact normalized name and core token, but only SF rows", () => {
  const searcher = { id: 12, nif: "abc-123", nom: "Aeqor Partners" };
  const matcher = createSearcherCapitalCallMatcher([searcher]);

  assert.equal(matcher({ id: "abc-123", est: "Search Fund - Cerca", fons: "Other" }), true);
  assert.equal(matcher({ est: "Search Fund - Cerca", fons: "Aeqor Partners" }), true);
  assert.equal(matcher({ est: "Search Fund - Cerca", fons: "Aeqor SRL" }), true);
  assert.equal(matcher({ id: "abc-123", est: "Fons Primari", fons: "Aeqor Partners" }), false);
  assert.equal(matchSearcherCapitalCall({ est: "Search Fund - Cerca", fons: "Aeqor SRL" }, searcher), true);
});

test("searcher status and company exclusion helpers centralize index filters", () => {
  assert.equal(isActiveSearcher({ statusScreeningCode: 2 }), true);
  assert.equal(isActiveSearcher({ statusScreening: "Invested - Search Phase" }), true);
  assert.equal(isActiveSearcher({ statusScreening: "Descartat" }), false);

  const actualCompanyIds = new Set(["company-1"]);
  assert.equal(isInvestedUnacquiredSearcher({ ticket: 100, nif: "searcher-1" }, actualCompanyIds), true);
  assert.equal(isInvestedUnacquiredSearcher({ ticket: 100, nif: "company-1" }, actualCompanyIds), false);
  assert.equal(isInvestedUnacquiredSearcher({ ticket: 100, companiaAdquirida: "Target" }, actualCompanyIds), false);
  assert.equal(isActualCompanyCapitalCall({ vehicle_id: "company-1" }, actualCompanyIds), true);
});