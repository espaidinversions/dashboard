import test from "node:test";
import assert from "node:assert/strict";

import {
  FUND_META_SELECT_COLUMNS,
  PIPELINE_SELECT_COLUMNS,
  PORTFOLIO_COMPANY_SELECT_COLUMNS,
  SEARCHER_SELECT_COLUMNS,
  rowToFundMeta,
  rowToDeal,
  rowToCompany,
  rowToSearcher,
} from "../src/data/mappers.js";

// Contract: the dashboard bundle's fund_meta SELECT must fetch every column that
// rowToFundMeta() consumes. A missing column is not an error — PostgREST just
// omits it, the mapper reads `undefined`, and the field silently becomes null.
// That is exactly how the "Tipus fons" (strategy) allocation bar went blank and
// how the committed_override allocation basis was being ignored. If you add a
// field to rowToFundMeta, add its DB column here AND to FUND_META_SELECT_COLUMNS.
const REQUIRED_FUND_META_COLUMNS = [
  "vehicle_id",
  "fons",
  "tvpi",
  "irr",
  "fi_end",
  "geography",
  "sector",
  "strategy",
  "committed_override",
];

test("fund_meta bundle SELECT fetches every column rowToFundMeta reads", () => {
  for (const col of REQUIRED_FUND_META_COLUMNS) {
    assert.ok(
      FUND_META_SELECT_COLUMNS.includes(col),
      `fund_meta SELECT is missing "${col}" — its mapped field will silently be null`,
    );
  }
});

test("rowToFundMeta surfaces the classification maps + committed_override", () => {
  const raw = {
    vehicle_id: "V-TEST",
    fons: "Test Fund",
    tvpi: 1.2,
    irr: 0.1,
    fi_end: null,
    geography: { "Nord America": 1 },
    sector: { "Tecnologia": 1 },
    strategy: { "Mid Buyout": 0.6, "Growth": 0.4 },
    committed_override: 5_000_000,
  };

  const mapped = rowToFundMeta(raw, new Map());

  assert.deepEqual(mapped.geography, { "Nord America": 1 });
  assert.deepEqual(mapped.sector, { "Tecnologia": 1 });
  assert.deepEqual(mapped.strategy, { "Mid Buyout": 0.6, "Growth": 0.4 });
  assert.equal(mapped.committedOverride, 5_000_000);
});

// ── pipeline → rowToDeal ────────────────────────────────────────────────
const REQUIRED_PIPELINE_COLUMNS = [
  "id", "name", "amount", "currency", "geography", "strategy", "sector",
  "status", "canal", "active", "estimated_closing", "manager",
];

test("pipeline bundle SELECT fetches every column rowToDeal reads", () => {
  for (const col of REQUIRED_PIPELINE_COLUMNS) {
    assert.ok(
      PIPELINE_SELECT_COLUMNS.includes(col),
      `pipeline SELECT is missing "${col}" — its mapped field will silently be null`,
    );
  }
});

test("rowToDeal surfaces snake_case columns as camelCase", () => {
  const mapped = rowToDeal({
    id: 7, name: "Deal", amount: 1000, currency: "EUR",
    geography: "Nord America", strategy: "Growth", sector: "Tecnologia",
    status: "Actiu", canal: "Directe", active: true,
    estimated_closing: "2026-09-30", manager: "TC",
  });
  assert.equal(mapped.estimatedClosing, "2026-09-30");
  assert.equal(mapped.geography, "Nord America");
  assert.equal(mapped.manager, "TC");
});

// ── portfolio_companies → rowToCompany ──────────────────────────────────
// r.id is a defensive fallback for entity_id and intentionally not fetched.
const REQUIRED_PORTFOLIO_COMPANY_COLUMNS = [
  "entity_id", "nom", "tipus", "segment", "entrepreneurs", "origen", "geo",
  "ticket", "tvpi", "rvpi_eur", "dpi_eur", "rev", "ebitda", "dfn",
  "gross_ev", "mult_entry", "data_compr", "mesos_operant", "is_mock", "quarters",
];

test("portfolio_companies bundle SELECT fetches every column rowToCompany reads", () => {
  for (const col of REQUIRED_PORTFOLIO_COMPANY_COLUMNS) {
    assert.ok(
      PORTFOLIO_COMPANY_SELECT_COLUMNS.includes(col),
      `portfolio_companies SELECT is missing "${col}" — its mapped field will silently be null`,
    );
  }
});

test("rowToCompany surfaces snake_case columns as camelCase", () => {
  const mapped = rowToCompany({
    entity_id: "E-1", nom: "Co", tipus: "PC", segment: "SaaS",
    entrepreneurs: "A,B", origen: "Directe", geo: "Sud d'Europa",
    ticket: 500, tvpi: 1.5, rvpi_eur: 100, dpi_eur: 50,
    rev: 10, ebitda: 2, dfn: 1, gross_ev: 20, mult_entry: 8,
    data_compr: "2024-01-01", mesos_operant: 30, is_mock: false, quarters: [],
  }, new Map());
  assert.equal(mapped.rvpiEur, 100);
  assert.equal(mapped.dpiEur, 50);
  assert.equal(mapped.grossEV, 20);
  assert.equal(mapped.multEntry, 8);
  assert.equal(mapped.mesosOperant, 30);
});

// ── searchers → rowToSearcher ───────────────────────────────────────────
const REQUIRED_SEARCHER_COLUMNS = [
  "id", "nom", "tipus", "modalitat", "geo",
  "status_screening_code", "status_screening", "form_entrada",
  "status_cerca_code", "status_cerca", "status_adquisicio_code", "status_adquisicio",
  "intro_per", "searcher1", "searcher2", "companyia_adquirida", "escola1", "escola2",
  "web", "comentaris", "ticket", "tvpi", "data_inici", "database_intro_date",
  "data_compr", "mesos_cercant", "equity_stake", "is_mock", "is_legacy",
  "nif", "label", "irr", "dpi",
];

test("searchers bundle SELECT fetches every column rowToSearcher reads", () => {
  for (const col of REQUIRED_SEARCHER_COLUMNS) {
    assert.ok(
      SEARCHER_SELECT_COLUMNS.includes(col),
      `searchers SELECT is missing "${col}" — its mapped field will silently be null`,
    );
  }
});

test("rowToSearcher surfaces snake_case columns as camelCase", () => {
  const mapped = rowToSearcher({
    id: 3, nom: "Searcher", tipus: "SF", modalitat: "Solo", geo: "Iberia",
    status_screening_code: 2, status_screening: "Screening",
    form_entrada: "Intro", status_cerca_code: 1, status_cerca: "Cerca",
    status_adquisicio_code: null, status_adquisicio: null,
    intro_per: "X", searcher1: "S1", searcher2: "", companyia_adquirida: null,
    escola1: "IESE", escola2: "", web: null, comentaris: null,
    ticket: 100000, tvpi: 1.2, data_inici: "2023-01-01",
    database_intro_date: "2023-02-01", data_compr: null, mesos_cercant: 12,
    equity_stake: 0.3, is_mock: false, is_legacy: false,
    nif: "B123", label: "L", irr: 0.15, dpi: 0.1,
  });
  assert.equal(mapped.statusScreeningCode, 2);
  assert.equal(mapped.databaseIntroDate, "2023-02-01");
  assert.equal(mapped.equityStake, 0.3);
  assert.equal(mapped.isLegacy, false);
});
