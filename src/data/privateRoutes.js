import { makeFundRouteId } from "./fundDetailModel.js";
import { slugify } from "../utils.js";
import { estSection } from "./capitalCallStrategyModel.js";

export function makeVehicleDetailPath(row) {
  if (estSection(row?.est) === "PC") {
    return `/company/${encodeURIComponent(row?.id ?? slugify(row?.fons ?? ""))}`;
  }
  return `/fund/${encodeURIComponent(makeFundRouteId(row))}`;
}
