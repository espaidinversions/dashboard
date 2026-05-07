// src/chartColors.js
// Single source of truth for all reusable chart color constants.

import { TC_LIGHT } from "./theme.js";

/** 9-color brand-derived categorical palette.
 *  Order chosen for maximum perceptual separation when cycling. */
export const CHART_PALETTE = [
  TC_LIGHT.navy,       // #2B5070
  TC_LIGHT.green,      // #3DC83E
  TC_LIGHT.navyLight,  // #4A789A
  TC_LIGHT.greenDark,  // #28A029
  TC_LIGHT.navyDark,   // #1C3A52
  TC_LIGHT.greenLight, // #62D963
  TC_LIGHT.purple,     // #6A4C8A
  TC_LIGHT.red,        // #C62828
  TC_LIGHT.yellow,     // #B8860B
];

/** Canonical manager/custodian identity colors.
 *  Keys match the lowercase manager slugs used throughout the PM data layer. */
export const MGR_COLORS = {
  caixa:              TC_LIGHT.navy,       // #2B5070
  ubs:                TC_LIGHT.navyLight,  // #4A789A
  creditSuisse:       "#C46B5A",           // institution-specific warm tone
  bankinter:          TC_LIGHT.green,      // #3DC83E
  interactiveBrokers: TC_LIGHT.greenLight, // #62D963
  andbank:            TC_LIGHT.purple,     // #6A4C8A
  jpmorgan:           TC_LIGHT.yellow,     // #B8860B
  abel:               TC_LIGHT.green,      // #3DC83E
  altres:             "#9AA4B2",           // neutral grey — no brand equivalent
};

/** Node colors for the Searcher Sankey diagram.
 *  Shared between SearchersTab and SearchersBadges. */
export const SANKEY_NODE_COLORS = {
  Searchers:      TC_LIGHT.navy,      // #2B5070
  "Equity Gap":   TC_LIGHT.purple,    // #6A4C8A
  Cercant:        TC_LIGHT.greenDark, // #28A029
  "Acabat Cerca": TC_LIGHT.navyDark,  // #1C3A52
  Portafoli:      TC_LIGHT.navyLight, // #4A789A
  Operant:        TC_LIGHT.navy,      // #2B5070
};
