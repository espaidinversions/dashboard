import { GEO_NAME } from "../../config.js";
import { SEARCHER_FORM_ENTRADA_OPTIONS, SEARCHER_MODALITAT_OPTIONS, SEARCHER_STATUS_OPTIONS } from "../../config.js";

export const SEARCHER_ADD_MODAL_FIELDS = [
  { key: "nom", label: "Nom", type: "text", placeholder: "Nom del searcher" },
  { key: "nif", label: "NIF", type: "text", placeholder: "B12345678" },
  { key: "tipus", label: "Tipus", type: "select", options: ["", "Tradicional", "Self-funded"] },
  { key: "modalitat", label: "Modalitat", type: "select", options: ["", ...SEARCHER_MODALITAT_OPTIONS] },
  { key: "geo", label: "Geografia", type: "select", options: ["", ...Object.keys(GEO_NAME).sort()] },
  { key: "statusScreening", label: "Status", type: "select", options: ["", ...SEARCHER_STATUS_OPTIONS] },
  { key: "formEntrada", label: "Entrada", type: "select", options: ["", ...SEARCHER_FORM_ENTRADA_OPTIONS] },
  { key: "dataInici", label: "Data inici", type: "date" },
  { key: "ticket", label: "Ticket (€)", type: "number" },
  { key: "equityStake", label: "Equity stake (%)", type: "number" },
];
