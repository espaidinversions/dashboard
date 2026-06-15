import { makeFundRouteId } from "./fundDetailModel.js";
import { slugify } from "../utils.js";
import { estSection } from "./capitalCallStrategyModel.js";

export function makeVehicleDetailPath(row) {
  if (estSection(row?.est) === "PC") {
    return `/investments/companies/${encodeURIComponent(row?.id ?? slugify(row?.fons ?? ""))}`;
  }
  return `/investments/funds/${encodeURIComponent(makeFundRouteId(row))}`;
}
