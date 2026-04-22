import { makeFundRouteId } from "./fundDetailModel.js";
import { slugify } from "../utils.js";

export function makeVehicleDetailPath(row) {
  if (row?.vcpe === "PC") {
    return `/company/${encodeURIComponent(row?.id ?? slugify(row?.fons ?? ""))}`;
  }
  return `/fund/${encodeURIComponent(makeFundRouteId(row))}`;
}
