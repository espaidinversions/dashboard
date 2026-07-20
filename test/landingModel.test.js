import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSectionSummary, buildLandingModel, SECTION_NAV_TARGET } from "../src/data/landingModel.js";

const call = (id, eur) => ({ id, fons: id, cat: "Capital Call", est: "Fons Primari", eur });
const dist = (id, eur) => ({ id, fons: id, cat: "Distribució", est: "Fons Primari", eur });
const compr = (id, eur) => ({ id, fons: id, cat: "Compromís", est: "Fons Primari", eur });

test("buildSectionSummary aggregates invertit, retornat and pending commitment", () => {
  // Arrange
  const tx = [call("A", 100), call("A", 50), dist("A", -30), call("B", 200)];
  const cm = [compr("A", 400)];

  // Act
  const s = buildSectionSummary({ tx, compr: cm, sectionId: "alternatives", label: "Alternatius" });

  // Assert
  assert.equal(s.invertit, 350);
  assert.equal(s.retornat, 30);          // Math.abs of distribution
  assert.equal(s.compromesPendent, 50);  // max(0, 400 - 350)
  assert.equal(s.nPosicions, 2);         // distinct ids A, B
  assert.equal(s.kind, "cashflow");
});

test("compromesPendent floors at zero when calls exceed commitment", () => {
  const s = buildSectionSummary({ tx: [call("A", 500)], compr: [compr("A", 400)], sectionId: "alternatives", label: "Alternatius" });
  assert.equal(s.compromesPendent, 0);
});

test("buildLandingModel excludes sections the user cannot access", () => {
  // Arrange
  const canAccess = (id) => id === "alternatives";
  // Act
  const model = buildLandingModel({
    altTx: [call("A", 100)], altCompr: [compr("A", 100)],
    reTx: [call("R", 999)], reCompr: [],
    pmSummary: { valorActual: 12345, nGestors: 3 },
    canAccess,
  });
  // Assert
  assert.equal(model.cards.length, 1);
  assert.equal(model.cards[0].sectionId, "alternatives");
  assert.equal(model.headline.invertit, 100);   // RE and PM excluded
});

test("headline rolls up only included cash-flow cards", () => {
  const canAccess = () => true;
  const model = buildLandingModel({
    altTx: [call("A", 100)], altCompr: [],
    reTx: [call("R", 400)], reCompr: [],
    pmSummary: { valorActual: 5000, nGestors: 2 },
    canAccess,
  });
  assert.equal(model.headline.invertit, 500);    // 100 + 400, PM not summed
  assert.equal(model.headline.kind, "cashflow");
  assert.equal(model.cards.length, 3);           // alt, re, pm(value)
  assert.equal(model.cards[2].kind, "value");
  assert.equal(model.cards[2].valorActual, 5000);
});

test("PM-only access falls back to a value headline", () => {
  const canAccess = (id) => id === "mercats-publics";
  const model = buildLandingModel({
    altTx: [], altCompr: [], reTx: [], reCompr: [],
    pmSummary: { valorActual: 8000, nGestors: 4 },
    canAccess,
  });
  assert.equal(model.headline.kind, "value");
  assert.equal(model.headline.valorActual, 8000);
  assert.equal(model.cards.length, 1);
});

test("empty input yields zeroed cash-flow summary without throwing", () => {
  const s = buildSectionSummary({ tx: [], compr: [], sectionId: "alternatives", label: "Alternatius" });
  assert.deepEqual(
    { i: s.invertit, r: s.retornat, c: s.compromesPendent, n: s.nPosicions },
    { i: 0, r: 0, c: 0, n: 0 },
  );
});

test("SECTION_NAV_TARGET maps each section to its default nav item", () => {
  assert.equal(SECTION_NAV_TARGET.alternatives, "alt-resum");
  assert.equal(SECTION_NAV_TARGET["real-estate"], "re-directe");
  assert.equal(SECTION_NAV_TARGET["mercats-publics"], "mp-resum");
});
