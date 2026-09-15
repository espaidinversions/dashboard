import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardPaletteConfig, buildGeoColorMap, buildSectorColorMap } from "../src/data/dashboardPalettes.js";

const tc = {
  navy: "#111111",
  navyLight: "#222222",
  green: "#333333",
  greenDark: "#444444",
  purple: "#555555",
  textLight: "#666666",
  bgAlt: "#777777",
};

test("buildDashboardPaletteConfig returns theme-aware dashboard maps", () => {
  const light = buildDashboardPaletteConfig(tc, false);
  const dark = buildDashboardPaletteConfig(tc, true);

  assert.equal(light.estCfg["Fons Primari"].bg, "#E6EDF3");
  assert.equal(dark.estCfg["Fons Primari"].bg, "#112030");
  assert.equal(light.catCfg["Altres"].bg, tc.bgAlt);
  assert.equal(light.geoCfg["Nord America"].color, tc.navy);
});

test("color maps expose the same geo and sector colors used by dashboard charts", () => {
  assert.equal(buildGeoColorMap(tc)["Nord d'Europa"], tc.green);
  assert.equal(buildSectorColorMap(tc)["Tecnologia"], tc.navy);
});