import test from "node:test";
import assert from "node:assert/strict";

import {
  makeFundRouteId,
  findFundRowsByRouteId,
  buildFundDetailSnapshot,
} from "../src/data/fundDetailModel.js";

test("makeFundRouteId namespaces routes by vcpe", () => {
  assert.equal(makeFundRouteId({ id: "ITA1770581100", vcpe: "SF", fons: "Aeqor SRL" }), "SF:ITA1770581100");
  assert.equal(makeFundRouteId({ id: "ITA1770581100", vcpe: "PC", fons: "Aeqor Partners" }), "PC:ITA1770581100");
});

test("findFundRowsByRouteId keeps SF rows isolated from PC rows sharing the same id", () => {
  const rows = [
    { id: "ITA1770581100", vcpe: "SF", fons: "Aeqor SRL", cat: "Capital Call", eur: 25000, data: "2024-07-31" },
    { id: "ITA1770581100", vcpe: "PC", fons: "Aeqor Partners", cat: "Capital Call", eur: 50000, data: "2024-07-31" },
  ];

  const matches = findFundRowsByRouteId(rows, "SF:ITA1770581100");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].vcpe, "SF");
  assert.equal(matches[0].fons, "Aeqor SRL");
});

test("legacy bare id routes prefer non-PC rows when ids collide", () => {
  const rows = [
    { id: "ITA1770581100", vcpe: "PC", fons: "Aeqor Partners", cat: "Capital Call", eur: 50000, data: "2024-07-31" },
    { id: "ITA1770581100", vcpe: "SF", fons: "Aeqor SRL", cat: "Capital Call", eur: 25000, data: "2024-07-31" },
  ];

  const matches = findFundRowsByRouteId(rows, "ITA1770581100");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].vcpe, "SF");
});

test("buildFundDetailSnapshot ignores shared-id PC rows on fund routes", () => {
  const rawCC = [
    { id: "ITA1770581100", vcpe: "SF", fons: "Aeqor SRL", tipus: "Aportació capital", cat: "Capital Call", eur: 25000, data: "2024-07-31", est: "SF" },
    { id: "ITA1770581100", vcpe: "PC", fons: "Aeqor Partners", tipus: "SF", cat: "Compromís", eur: 50000, data: "2024-07-31", est: "PC" },
    { id: "ITA1770581100", vcpe: "PC", fons: "Aeqor Partners", tipus: "SF", cat: "Capital Call", eur: 50000, data: "2024-07-31", est: "PC" },
  ];

  const detail = buildFundDetailSnapshot(rawCC, [], "SF:ITA1770581100");

  assert.equal(detail.fundName, "Aeqor SRL");
  assert.equal(detail.calls, 25000);
  assert.equal(detail.compromis, 0);
  assert.equal(detail.txLog.length, 1);
});
