import test from "node:test";
import assert from "node:assert/strict";

import {
  makeClosedPositionRouteId,
  findClosedPositionByRouteId,
  resolvePmTransactionRouteId,
} from "../src/data/pmPositionRouting.js";

test("closed PM route ids preserve isin, custodian, and year", () => {
  const closed = { isin: "LU0113258742", custodian: "Credit Suisse", any: 2024 };
  const routeId = makeClosedPositionRouteId(closed);

  assert.equal(routeId, "closed:LU0113258742:credit-suisse:2024");
  assert.deepEqual(findClosedPositionByRouteId(routeId, [closed]), closed);
});

test("PM transaction routing resolves exact active positions before falling back to bare isin", () => {
  const tx = { isin: "IE00BYVQ9F29", custodian: "Interactive Brokers" };
  const positions = [
    { id: "ie00byvq9f29-ubs", isin: "IE00BYVQ9F29", custodian: "UBS" },
    { id: "ie00byvq9f29-interactive-brokers", isin: "IE00BYVQ9F29", custodian: "Interactive Brokers" },
  ];

  assert.equal(
    resolvePmTransactionRouteId(tx, positions, []),
    "ie00byvq9f29-interactive-brokers"
  );
});

test("PM transaction routing falls back to an exact closed route when no active position matches", () => {
  const tx = { isin: "LU0113258742", custodian: "Credit Suisse" };
  const closed = [{ isin: "LU0113258742", custodian: "Credit Suisse", any: 2024 }];

  assert.equal(
    resolvePmTransactionRouteId(tx, [], closed),
    "closed:LU0113258742:credit-suisse:2024"
  );
});
