import test from "node:test";
import assert from "node:assert/strict";

import {
  makeFundRouteId,
  findFundRowsByRouteId,
  buildFundDetailSnapshot,
} from "../src/data/fundDetailModel.js";

test("makeFundRouteId returns the entity id (id-only routes)", () => {
  assert.equal(makeFundRouteId({ id: "ITA1770581100", est: "Search Fund - Cerca", fons: "Aeqor SRL" }), "ITA1770581100");
  const slugRoute = makeFundRouteId({ est: "Fons Primari", fons: "Global Fund" });
  assert.ok(slugRoute && !slugRoute.includes(":")); // id-only, no legacy TIPUS: prefix
});

test("findFundRowsByRouteId resolves legacy TIPUS:id bookmarks by id", () => {
  const rows = [
    { id: "ITA1770581100", est: "Search Fund - Cerca", fons: "Aeqor SRL", cat: "Capital Call", eur: 25000, data: "2024-07-31" },
  ];

  // Both the legacy prefixed form and the modern id-only form resolve the entity.
  assert.equal(findFundRowsByRouteId(rows, "SF:ITA1770581100").length, 1);
  assert.equal(findFundRowsByRouteId(rows, "ITA1770581100").length, 1);
  assert.equal(findFundRowsByRouteId(rows, "SF:ITA1770581100")[0].fons, "Aeqor SRL");
});

test("bare id/slug routes prefer non-company (non-PC) rows when names collide", () => {
  const rows = [
    { id: "shared", est: "Participada (Altres)", fons: "Shared Name", cat: "Capital Call", eur: 50000, data: "2024-07-31" },
    { id: "shared", est: "Fons Primari", fons: "Shared Name", cat: "Capital Call", eur: 25000, data: "2024-07-31" },
  ];

  const matches = findFundRowsByRouteId(rows, "shared");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].est, "Fons Primari");
});

test("buildFundDetailSnapshot builds a fund snapshot for an id route", () => {
  const rawCC = [
    { id: "F1", est: "Fons Primari", fons: "Global Fund", tipus: "Aportació capital", cat: "Capital Call", eur: 25000, data: "2024-07-31" },
    { id: "F1", est: "Fons Primari", fons: "Global Fund", tipus: "Aportació capital", cat: "Compromís", eur: 100000, data: "2024-01-31" },
  ];

  const detail = buildFundDetailSnapshot(rawCC, [], "F1");

  assert.equal(detail.fundName, "Global Fund");
  assert.equal(detail.calls, 25000);
  assert.equal(detail.compromis, 100000);
  assert.equal(detail.section, "ALT");
});

test("buildFundDetailSnapshot normalizes transaction concepts for fund pages", () => {
  const rawCC = [
    { id: "F1", vehicleTipus: "PE", fons: "Test Fund", tipus: "Ampliació Capital", cat: "Capital Call", eur: 1000, data: "2026-01-10", est: "Fons Primari" },
    { id: "F1", vehicleTipus: "PE", fons: "Test Fund", tipus: "Devol. Capital", cat: "Retorn Capital", eur: 250, data: "2026-02-10", est: "Fons Primari" },
  ];

  const detail = buildFundDetailSnapshot(rawCC, [], "PE:F1");

  assert.deepEqual(detail.txLog.map((row) => row.tipus), ["Retorn Capital", "Aportació"]);
  assert.equal(detail.txLog[0].eur, -250);
  assert.equal(detail.txLog[1].eur, 1000);
});
test("buildFundDetailSnapshot preserves ALT underlying deal-type allocation", () => {
  const rawCC = [
    { id: "ALT1", est: "Fons de Fons", estRaw: "Fons de Coinversió", fons: "FoF With CoInvest", tipus: "Aportació", cat: "Capital Call", eur: 40, data: "2025-01-31" },
    { id: "ALT1", est: "Fons de Fons", estRaw: "Fons de Fons", fons: "FoF With CoInvest", tipus: "Aportació", cat: "Capital Call", eur: 60, data: "2025-02-28" },
    { id: "ALT1", est: "Fons de Fons", fons: "FoF With CoInvest", tipus: "Compromís", cat: "Compromís", eur: 100, data: "2025-01-01" },
  ];

  const detail = buildFundDetailSnapshot(rawCC, [], "ALT1");

  assert.deepEqual(detail.underlyingMix, {
    "Fons de Coinversió": 40,
    "Fons de Fons": 60,
  });
});

test("buildFundDetailSnapshot uses fund_meta strategy for Real Estate allocation", () => {
  const rawCC = [
    { id: "RE1", est: "Fons Real Estate", estRaw: "Fons Real Estate", fons: "Meridia RE", tipus: "Aportació", cat: "Capital Call", eur: 25000, data: "2025-07-31" },
    { id: "RE1", est: "Fons Real Estate", estRaw: "Fons Real Estate", fons: "Meridia RE", tipus: "Compromís", cat: "Compromís", eur: 100000, data: "2025-01-31" },
  ];
  const fundMeta = [{
    id: "RE1",
    fons: "Meridia RE",
    geography: { "Sud d'Europa": 1 },
    sector: { "Real Estate & Infraestructure": 1 },
    strategy: { "Real Estate & Infraestructure": 1 },
  }];

  const detail = buildFundDetailSnapshot(rawCC, fundMeta, "RE1");

  assert.equal(detail.section, "RE");
  assert.deepEqual(detail.geography, { "Sud d'Europa": 1 });
  assert.deepEqual(detail.sector, { "Real Estate & Infraestructure": 1 });
  assert.deepEqual(detail.strategy, { "Real Estate & Infraestructure": 1 });
  assert.deepEqual(detail.underlyingMix, { "Real Estate & Infraestructure": 1 });
});
