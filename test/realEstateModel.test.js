import test from "node:test";
import assert from "node:assert/strict";

import { buildFundDetailSnapshot, makeFundRouteId } from "../src/data/fundDetailModel.js";
import { buildRealEstateFundsMap, splitRealEstateRows } from "../src/data/realEstateModel.js";

test("real-estate rows are split from the shared capital-calls source", () => {
  const rows = [
    { fons: "RE Fund A", vehicleTipus: "RE", cat: "Capital Call", eur: 100000, data: "2024-01-15" },
    { fons: "RE Fund A", vehicleTipus: "RE", cat: "Compromís", eur: 500000, data: "2023-06-01" },
    { fons: "PE Fund B", vehicleTipus: "PE", cat: "Capital Call", eur: 200000, data: "2024-02-10" },
    { fons: "RE Fund C", vehicleTipus: "RE", cat: "Distribució", eur: -50000, data: "2024-03-20" },
  ];
  const { tx, compr } = splitRealEstateRows(rows);

  assert.equal(tx.length, 2);
  assert.equal(compr.length, 1);
  assert.ok(tx.every((row) => row.vehicleTipus === "RE" && row.cat !== "Compromís"));
  assert.ok(compr.every((row) => row.vehicleTipus === "RE" && row.cat === "Compromís"));
});

test("real-estate vehicle detail updates when transactions are added or removed", () => {
  const baseRows = [
    { fons: "Meridia V", vehicleTipus: "RE", cat: "Compromís", eur: 1000000, data: "2022-01-01", tipus: "Aportació", any: 2022, mes: 1, fy: "FY 2022", divisa: "EUR" },
    { fons: "Meridia V", vehicleTipus: "RE", cat: "Capital Call", eur: 809934, data: "2023-06-15", tipus: "Aportació", any: 2023, mes: 6, fy: "FY 2023", divisa: "EUR" },
    { fons: "Meridia V", vehicleTipus: "RE", cat: "Distribució", eur: -268000, data: "2024-03-10", tipus: "Distribució", any: 2024, mes: 3, fy: "FY 2024", divisa: "EUR" },
  ];
  const routeId = makeFundRouteId({ fons: "Meridia V" });
  const before = buildFundDetailSnapshot(baseRows, [], routeId);
  assert.ok(before);
  assert.equal(before.calls, 809934);
  assert.equal(before.dist, 268000);
  assert.equal(before.net, -541934);

  const addedTx = {
    fons: "Meridia V",
    tipus: "Aportació",
    cat: "Capital Call",
    data: "2026-04-21",
    mes: 4,
    any: 2026,
    fy: "FY 2026",
    vehicleTipus: "RE",
    est: "SOCIMI",
    eur: 190066,
    divisa: "EUR",
  };
  const withAddedTx = [...baseRows, addedTx];
  const afterAdd = buildFundDetailSnapshot(withAddedTx, [], routeId);

  assert.ok(afterAdd);
  assert.equal(afterAdd.txs.length, before.txs.length + 1);
  assert.equal(afterAdd.calls, 1000000);
  assert.equal(afterAdd.net, -732000);

  const afterRemove = buildFundDetailSnapshot(withAddedTx.filter((row) => row !== addedTx), [], routeId);
  assert.deepEqual(
    { count: afterRemove.txs.length, calls: afterRemove.calls, dist: afterRemove.dist, net: afterRemove.net },
    { count: before.txs.length, calls: before.calls, dist: before.dist, net: before.net },
  );
});

test("a new real-estate transaction creates a vehicle entry and a detail snapshot", () => {
  const newRows = [
    {
      fons: "Canalejas Income I",
      tipus: "Aportació",
      cat: "Capital Call",
      data: "2026-04-21",
      mes: 4,
      any: 2026,
      fy: "FY 2026",
      vehicleTipus: "RE",
      est: "SOCIMI",
      eur: 250000,
      divisa: "EUR",
    },
  ];

  const { tx, compr } = splitRealEstateRows(newRows);
  const funds = buildRealEstateFundsMap(compr, tx);
  const routeId = makeFundRouteId({ fons: "Canalejas Income I" });
  const createdFund = funds.find((fund) => makeFundRouteId(fund) === routeId);
  const detail = buildFundDetailSnapshot(newRows, [], routeId);

  assert.ok(createdFund);
  assert.equal(createdFund.compr, 0);
  assert.equal(createdFund.calls, 250000);
  assert.ok(detail);
  assert.equal(detail.fundName, "Canalejas Income I");
  assert.equal(detail.calls, 250000);
  assert.equal(detail.txs.length, 1);
});
