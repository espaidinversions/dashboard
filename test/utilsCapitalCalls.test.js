import test from "node:test";
import assert from "node:assert/strict";

import { mapCapitalCallsRows } from "../src/utils.js";

test("mapCapitalCallsRows normalizes Excel serial dates to ISO", () => {
  const [row] = mapCapitalCallsRows([
    {
      Fons: "Test Fund",
      Tipus: "Aportació",
      Categoria: "Capital Call",
      Data: 45399,
      "Import (€)": 1000,
      VCPE: "PE",
      Estructura: "Fons Primari",
      Divisa: "EUR",
    },
  ]);

  assert.match(row.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(row.any, Number(row.data.slice(0, 4)));
  assert.equal(row.mes, Number(row.data.slice(5, 7)));
  assert.equal(row.fy, `FY ${row.any}`);
});

test("mapCapitalCallsRows normalizes dd/mm/yyyy dates to ISO", () => {
  const [row] = mapCapitalCallsRows([
    {
      Fons: "Recent Fund",
      Tipus: "Aportació",
      Categoria: "Capital Call",
      Data: "22/04/2026",
      "Import (€)": 250000,
      VCPE: "VC",
      Estructura: "Fons Primari",
      Divisa: "EUR",
    },
  ]);

  assert.equal(row.data, "2026-04-22");
  assert.equal(row.any, 2026);
  assert.equal(row.mes, 4);
  assert.equal(row.fy, "FY 2026");
});
