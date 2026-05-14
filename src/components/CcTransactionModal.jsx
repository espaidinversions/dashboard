import React from "react";
import { AddRowModal } from "./SharedComponents.jsx";
import { fmtM } from "../utils.js";
import { inferCapitalCallCategoryFromTipus } from "../data/capitalCallTipusModel.js";
import { CAPITAL_CALL_STRATEGY_OPTIONS } from "../data/capitalCallStrategyModel.js";
import { CAPITAL_CALL_TIPUS_OPTIONS } from "../config.js";

/**
 * Single modal for adding or editing a capital call / transaction row.
 * Add mode: pass fons + defaults, leave editRow null.
 * Edit mode: pass editRow with the row being edited.
 */
export function CcTransactionModal({
  editRow = null,
  addFons = "",
  addDefaults = {},
  ccNameOptions,
  ccTipusOptions,
  amountInputStyle,
  defaultVehicleCurrency,
  recallablePoolByFund,
  uncalledByFund,
  onInsert,
  onUpdate,
  onClose,
}) {
  const isEdit = editRow != null;
  const fons = isEdit ? editRow.fons : addFons;
  const rawPool = recallablePoolByFund[fons] ?? 0;
  // For edit, add back the row's current draw so the label shows "available if you change this"
  const poolForLabel = isEdit
    ? Math.round((rawPool + Number(editRow.from_recallable ?? 0)) * 100) / 100
    : rawPool;

  const recallableOnChange = (value, nextValues, { setValue }) => {
    if (value !== "" && value != null && nextValues.eur !== "" && nextValues.eur != null) {
      const rec = Number(value), eur = Number(nextValues.eur);
      if (!isNaN(rec) && !isNaN(eur)) setValue("non_recallable", String(Math.round((eur - rec) * 100) / 100));
    }
    return nextValues;
  };

  const recallableHint = (values) => {
    const rec    = values.recallable    !== "" && values.recallable    != null ? Number(values.recallable)    : null;
    const nonRec = values.non_recallable !== "" && values.non_recallable != null ? Number(values.non_recallable) : null;
    if (rec == null && nonRec == null) return null;
    const r = rec ?? 0, nr = nonRec ?? 0, total = r + nr;
    const eur = Number(values.eur) || 0;
    return { text: `${fmtM(r)} rec + ${fmtM(nr)} no rec = ${fmtM(total)}`, valid: Math.abs(total - eur) <= 0.01 };
  };

  const fields = [
    isEdit
      ? { key: "fons", label: "Vehicle", type: "text", defaultValue: fons, disabled: true }
      : {
          key: "fons", label: "Vehicle", type: "combo", options: ccNameOptions, defaultValue: addFons,
          onChange: (value, nextValues, { setValue }) => { setValue("divisa", defaultVehicleCurrency(value)); return nextValues; },
        },
    {
      key: "tipus", label: "Tipus Moviment", type: "combo", options: ccTipusOptions,
      defaultValue: isEdit ? editRow.tipus : (addDefaults?.tipus ?? ""),
      hint: (values) => values.tipus
        ? `Categoria interna: ${inferCapitalCallCategoryFromTipus(values.tipus, values.eur)}`
        : "La categoria interna es derivarà del tipus.",
    },
    { key: "data", label: "Data", type: "date", defaultValue: isEdit ? editRow.data : new Date().toISOString().slice(0, 10) },
    {
      key: "eur", label: "Import", type: "number",
      defaultValue: isEdit ? (editRow.amountNative ?? editRow.eur) : undefined,
      inputStyle: amountInputStyle,
      hint: (values) => {
        if (!isEdit) {
          return values.divisa === "USD"
            ? "Introdueix USD. Es convertirà automàticament a EUR amb el tipus BCE de la data."
            : "Introdueix EUR.";
        }
        if (values.divisa !== "USD") return "Introdueix EUR.";
        if (editRow.fxRate) {
          return `Import en USD. Tipus BCE guardat: ${Number(editRow.fxRate).toFixed(6)} · EUR guardats: ${fmtM(editRow.eur)}`;
        }
        return "Import en USD. Si aquest moviment és legacy, el canvi a EUR es recalcularà quan modifiquis l'import o la data.";
      },
    },
    {
      key: "divisa", label: "Divisa", type: "select", options: ["EUR", "USD"],
      defaultValue: isEdit ? editRow.divisa : (addDefaults?.divisa ?? defaultVehicleCurrency(addFons)),
    },
    { key: "comentaris", label: "Comentaris", type: "textarea", defaultValue: isEdit ? (editRow.comentaris ?? "") : (addDefaults?.comentaris ?? ""), placeholder: "Observacions del moviment" },
    { key: "vcpe", label: "VCPE", type: "select", options: ["PE", "VC", "RE", "SF", "PC"], defaultValue: isEdit ? editRow.vcpe : (addDefaults?.vcpe ?? "PE") },
    { key: "est", label: "Estratègia", type: "select", options: CAPITAL_CALL_STRATEGY_OPTIONS, defaultValue: isEdit ? editRow.est : (addDefaults?.est ?? "") },
    {
      key: "recallable", label: "Recallable (€)", type: "number",
      defaultValue: isEdit ? (editRow.recallable ?? "") : undefined,
      visible: v => inferCapitalCallCategoryFromTipus(v.tipus, v.eur) === "Distribució",
      onChange: recallableOnChange,
    },
    {
      key: "non_recallable", label: "No Recallable (€)", type: "number",
      defaultValue: isEdit ? (editRow.non_recallable ?? "") : undefined,
      visible: v => inferCapitalCallCategoryFromTipus(v.tipus, v.eur) === "Distribució",
      hint: recallableHint,
    },
    {
      key: "from_recallable",
      label: `Des de pool recallable (€) — pool: ${fmtM(poolForLabel)} · pendent: ${fmtM(uncalledByFund[fons] ?? 0)}`,
      type: "number",
      defaultValue: isEdit ? (editRow.from_recallable ?? "") : undefined,
      visible: v => inferCapitalCallCategoryFromTipus(v.tipus, v.eur) === "Capital Call",
    },
    {
      key: "nif",
      label: "NIF (nou vehicle)",
      type: "text",
      defaultValue: "",
      placeholder: "p. ex. A12345678",
      visible: (v) => {
        const name = String(v.fons ?? "").trim();
        return name !== "" && !(ccNameOptions ?? []).includes(name);
      },
    },
    {
      key: "fiscal_name",
      label: "Nom fiscal (nou vehicle)",
      type: "text",
      defaultValue: "",
      placeholder: "Raó social completa",
      visible: (v) => {
        const name = String(v.fons ?? "").trim();
        return name !== "" && !(ccNameOptions ?? []).includes(name);
      },
    },
  ];

  const handleSave = async (values, setError) => {
    if (!values.tipus) { setError("El tipus de moviment és obligatori."); return; }
    const cat = inferCapitalCallCategoryFromTipus(values.tipus, values.eur);

    // Validate from_recallable
    if (cat === "Capital Call" && values.from_recallable !== "" && values.from_recallable != null) {
      if (Number(values.from_recallable) < 0) { setError("El valor 'des de pool recallable' no pot ser negatiu."); return; }
      if (Number(values.from_recallable) > poolForLabel + 0.01) {
        setError(`Advertiment: pool recallable disponible és ${fmtM(poolForLabel)}. El moviment s'ha guardat igualment.`);
        // soft warning — fall through
      }
    }

    // Validate recallable split
    if (cat === "Distribució" && values.recallable !== "" && values.recallable != null) {
      const rec = Number(values.recallable);
      if (rec < 0) { setError("El recallable no pot ser negatiu."); return; }
      const eur = Number(values.eur) || 0;
      if (rec > eur + 0.01) { setError(`El recallable (${fmtM(rec)}) no pot superar l'import total (${fmtM(eur)}).`); return; }
      const nonRec = values.non_recallable !== "" && values.non_recallable != null ? Number(values.non_recallable) : eur - rec;
      if (Math.abs(rec + nonRec - eur) > 0.01) {
        setError(`Recallable (${fmtM(rec)}) + No recallable (${fmtM(nonRec)}) = ${fmtM(rec + nonRec)}, però l'import total és ${fmtM(eur)}`);
        return;
      }
      if (isEdit) {
        let errMsg = null;
        await onUpdate(editRow._rowId, { ...values, cat, non_recallable: nonRec }, (m) => { errMsg = m; setError(m); }, editRow);
        if (!errMsg) onClose();
      } else {
        onInsert({ ...values, cat, non_recallable: nonRec }, setError);
      }
      return;
    }

    if (isEdit) {
      let errMsg = null;
      await onUpdate(editRow._rowId, { ...values, cat }, (m) => { errMsg = m; setError(m); }, editRow);
      if (!errMsg) onClose();
    } else {
      onInsert({ ...values, cat }, setError);
    }
  };

  return (
    <AddRowModal
      title={isEdit ? "Edita moviment" : "Afegeix moviment"}
      submitLabel={isEdit ? "Desa" : undefined}
      fields={fields}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
