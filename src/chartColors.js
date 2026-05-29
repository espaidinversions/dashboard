// src/chartColors.js
// Single source of truth for all chart color constants.

import { TC_LIGHT } from "./theme.js";

/** 9-color brand-derived categorical palette.
 *  Order chosen for maximum perceptual separation when cycling. */
export const CHART_PALETTE = [
  TC_LIGHT.navy,       // #2B4F70  — brand primary
  TC_LIGHT.green,      // #3DC83E  — brand secondary
  TC_LIGHT.navyLight,  // #3D6A94
  TC_LIGHT.greenDark,  // #28A029
  TC_LIGHT.navyDark,   // #1C3650
  TC_LIGHT.greenLight, // #62D963
  TC_LIGHT.purple,     // #6A4C8A
  TC_LIGHT.orange,     // #C96A10
  TC_LIGHT.red,        // #B52020
];

/** Muted grey for unlabelled / "altres" series. */
export const NEUTRAL = "#8A9BAC";

/** Total-mode flow chart colors — inflow, outflow, cumulative line. */
export const FLOW_COLORS = {
  inflow:     TC_LIGHT.green,   // #3DC83E
  outflow:    TC_LIGHT.red,     // #B52020
  cumulative: TC_LIGHT.navy,    // #2B4F70
};

/** Asset-type series colors. */
export const ASSET_COLORS = {
  RV: TC_LIGHT.navy,   // #2B4F70  Renda Variable
  RF: TC_LIGHT.orange, // #C96A10  Renda Fixa
};

/** Portfolio value overlay line (dashed). */
export const PORTFOLIO_VALUE_COLOR = TC_LIGHT.greenDark; // #28A029

/** Canonical manager/custodian identity colors.
 *  Keys match the lowercase manager slugs used throughout the PM data layer. */
export const MGR_COLORS = {
  caixa:              TC_LIGHT.navy,
  ubs:                TC_LIGHT.navyLight,
  creditSuisse:       "#C46B5A",
  bankinter:          TC_LIGHT.green,
  interactiveBrokers: TC_LIGHT.greenLight,
  andbank:            TC_LIGHT.purple,
  jpmorgan:           TC_LIGHT.yellow,
  abel:               TC_LIGHT.green,
  altres:             NEUTRAL,
};

/** Node colors for the Searcher Sankey diagram. */
export const SANKEY_NODE_COLORS = {
  Searchers:      TC_LIGHT.navy,
  "Equity Gap":   TC_LIGHT.purple,
  Cercant:        TC_LIGHT.greenDark,
  "Acabat Cerca": TC_LIGHT.navyDark,
  Portafoli:      TC_LIGHT.navyLight,
  Operant:        TC_LIGHT.navy,
};
