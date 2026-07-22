import { PM_MODEL } from "../../data/publicMarketsModel.js";
import { WAM_POSITIONS } from "../../data/wamPositions.js";
import { summarizeLatestPmValuesWithWam } from "../../data/pmValueUtils.js";

/**
 * Real Public Markets figures for the Inici landing summary.
 *
 * Pulls in the (large) generated PM dataset, so this module must only ever be
 * imported lazily — never from an eagerly-loaded bundle entry point.
 *
 * @returns {{ valorActual: number, nGestors: number }}
 */
export function getPmLandingSummary() {
  const summary = summarizeLatestPmValuesWithWam(
    PM_MODEL.series.values,
    PM_MODEL.holdings.active,
    WAM_POSITIONS,
  );
  const nGestors = Object.values(summary.byManager).filter((v) => Math.abs(v) > 0).length;
  return { valorActual: summary.total, nGestors };
}
