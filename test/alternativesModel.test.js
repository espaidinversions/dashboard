import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPrivateSyntheticRows,
  mergePrivateRows,
  normalizePrivateWorkbookRows,
} from "../src/data/alternativesModel.js";

test("buildPrivateSyntheticRows creates paired commitment and call rows", () => {
  const rows = [
    { nom: "Fairmile Partners", ticket: 28117, dataCompr: "2025-05-29", formEntrada: "Search Capital" },
  ];

  const synthetic = buildPrivateSyntheticRows(rows, {
    vcpe: "SF",
    include: () => true,
    fons: (row) => row.nom,
    tipus: (row) => row.formEntrada,
    est: () => null,
  });

  assert.equal(synthetic.tx.length, 1);
  assert.equal(synthetic.compr.length, 1);
  assert.equal(synthetic.tx[0].cat, "Capital Call");
  assert.equal(synthetic.compr[0].cat, "Compromís");
  assert.equal(synthetic.tx[0].eur, 28117);
});

test("mergePrivateRows keeps real rows and skips duplicate synthetic rows", () => {
  const actual = [
    { fons: "Fairmile Partners", data: "2025-05-29", cat: "Capital Call", eur: 28117, vcpe: "SF" },
  ];
  const synthetic = [
    { fons: "Fairmile Partners", data: "2025-05-29", cat: "Capital Call", eur: 28117, vcpe: "SF", _synthetic: true },
    { fons: "Palette Capital", data: "2026-01-13", cat: "Capital Call", eur: 32625, vcpe: "SF", _synthetic: true },
  ];

  const merged = mergePrivateRows(actual, synthetic);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], actual[0]);
  assert.equal(merged[1].fons, "Palette Capital");
});

test("normalizePrivateWorkbookRows maps workbook aliases onto canonical company names", () => {
  const workbookRows = [{ fons: "Omega Project", eur: 1000 }];
  const companies = [{ nom: "Greenfarm" }];

  const normalized = normalizePrivateWorkbookRows(workbookRows, [], companies);

  assert.equal(normalized[0].fons, "Greenfarm");
  assert.equal(normalized[0].vcpe, "PC");
  assert.equal(normalized[0].est, null);
});
