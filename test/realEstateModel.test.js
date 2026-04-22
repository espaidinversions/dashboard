import test from "node:test";
import assert from "node:assert/strict";

import { RAW_CC } from "../src/data/capital-calls.js";
import { buildFundDetailSnapshot, makeFundRouteId } from "../src/data/fundDetailModel.js";
import { buildRealEstateFundsMap, splitRealEstateRows } from "../src/data/realEstateModel.js";

test("real-estate rows are split from the shared capital-calls source", () => {
  const { tx, compr } = splitRealEstateRows(RAW_CC);

  assert.equal(tx.length, 66);
  assert.equal(compr.length, 10);
  assert.ok(tx.every((row) => row.vcpe === "RE" && row.cat !== "Compromís"));
  assert.ok(compr.every((row) => row.vcpe === "RE" && row.cat === "Compromís"));
});

test("real-estate vehicle detail updates when transactions are added or removed", () => {
  const routeId = makeFundRouteId({ fons: "Meridia Real Estate Fund V FICC" });
  const before = buildFundDetailSnapshot(RAW_CC, [], routeId);
  assert.ok(before);
  assert.equal(before.calls, 809934);
  assert.equal(before.dist, 268000);
  assert.equal(before.net, -541934);

  const addedTx = {
    fons: "Meridia Real Estate Fund V FICC",
    tipus: "Aportació",
    cat: "Capital Call",
    data: "2026-04-21",
    mes: 4,
    any: 2026,
    fy: "FY 2026",
    vcpe: "RE",
    est: "SOCIMI",
    eur: 190066,
    divisa: "EUR",
  };
  const withAddedTx = [...RAW_CC, addedTx];
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
    ...RAW_CC,
    {
      fons: "Canalejas Income I",
      tipus: "Aportació",
      cat: "Capital Call",
      data: "2026-04-21",
      mes: 4,
      any: 2026,
      fy: "FY 2026",
      vcpe: "RE",
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
