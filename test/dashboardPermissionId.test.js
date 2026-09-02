import test from "node:test";
import assert from "node:assert/strict";
import { resolveSection, resolvePermissionId } from "../src/data/dashboardPermissionId.js";

test("resolveSection maps public markets, real estate and tx tabs", () => {
  assert.equal(resolveSection("mercats-publics"), "mercats-publics");
  assert.equal(resolveSection("real-estate"), "real-estate");
  assert.equal(resolveSection("re-cash-model"), "real-estate");
  assert.equal(resolveSection("tx-re"), "real-estate");
  assert.equal(resolveSection("tx-alt"), "txlog");
});

test("resolveSection defaults unknown tabs to alternatives", () => {
  assert.equal(resolveSection("home"), "alternatives");
  assert.equal(resolveSection("inversions"), "alternatives");
  assert.equal(resolveSection("whatever"), "alternatives");
});

test("resolvePermissionId returns liquidity for the liquidity tab", () => {
  assert.equal(resolvePermissionId({ tab: "liquidity" }), "liquidity");
});

test("resolvePermissionId maps real-estate sub-tabs", () => {
  assert.equal(resolvePermissionId({ tab: "real-estate", realEstateTab: "resum" }), "real-estate");
  assert.equal(resolvePermissionId({ tab: "real-estate", realEstateTab: "altres-vehicles" }), "re-altres");
  assert.equal(resolvePermissionId({ tab: "real-estate", realEstateTab: "inversions" }), "re-directe");
});

test("resolvePermissionId maps mercats-publics sub-tabs", () => {
  assert.equal(
    resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "transaccions", activeNavItem: "tx-mp" }),
    "tx-mp",
  );
  assert.equal(resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "rv" }), "mp-rv");
  assert.equal(resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "rf" }), "mp-rf");
  assert.equal(resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "posicions" }), "mp-posicions");
  assert.equal(
    resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "transaccions", activeNavItem: "mp-transaccions" }),
    "mp-transaccions",
  );
  assert.equal(resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "traçabilitat" }), "mp-traçabilitat");
  assert.equal(resolvePermissionId({ tab: "mercats-publics", mercatsPublicsTab: "resum" }), "mp-resum");
});

test("resolvePermissionId maps remaining tabs and defaults to fons", () => {
  assert.equal(resolvePermissionId({ tab: "tx-re" }), "tx-re");
  assert.equal(resolvePermissionId({ tab: "tx-alt" }), "tx-alt");
  assert.equal(resolvePermissionId({ tab: "searchers" }), "alternatives");
  assert.equal(resolvePermissionId({ tab: "cash-model" }), "cash-model");
  assert.equal(resolvePermissionId({ tab: "alt-cash-model" }), "cash-model");
  assert.equal(resolvePermissionId({ tab: "re-cash-model" }), "cash-model");
  assert.equal(resolvePermissionId({ tab: "companies" }), "companies");
  assert.equal(resolvePermissionId({ tab: "inversions" }), "inversions");
  assert.equal(resolvePermissionId({ tab: "fons" }), "fons");
  assert.equal(resolvePermissionId({ tab: "unknown-tab" }), "fons");
});
