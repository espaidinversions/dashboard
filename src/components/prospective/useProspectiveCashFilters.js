import { useMemo, useState } from "react";
import { usePersistedState } from "../../utils.js";

export function useProspectiveCashFilters({ forceScope } = {}) {
  const [_entityScope, setEntityScope] = usePersistedState("ui_cash_model_scope", "funds");
  // Real Estate lives in its own dedicated section (forceScope="re"); the main
  // model caixa only offers Tots/Vehicles/Companyies, so coerce any stale "re".
  const entityScope = forceScope ?? (_entityScope === "re" ? "funds" : _entityScope);
  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("net");
  const [tableType, setTableType] = useState("net");
  const [fund, setFund] = useState("all");
  const [periods, setPeriods] = useState({ closed: true, current: true, fwd: true });
  const [yearFilters, setYearFilters] = useState(new Set());
  const [vintageFilter, setVintageFilter] = useState(null);
  const [sort, setSort] = useState({ key: "devAbs", dir: "desc" });
  const [devMetric, setDevMetric] = useState("eur");
  const [editorType, setEditorType] = useState("calls");
  const [editorSearch, setEditorSearch] = useState("");
  const [editorInputMode, setEditorInputMode] = useState("eur");

  const entityText = useMemo(() => {
    if (entityScope === "all") {
      return {
        singular: "vehicle",
        plural: "vehicles",
        selectLabel: "Vehicles",
        allLabel: "Tots els vehicles",
        searchPlaceholder: "Cercar vehicle...",
      };
    }
    if (entityScope === "companies") {
      return {
        singular: "companyia",
        plural: "companyies",
        selectLabel: "Companyies",
        allLabel: "Totes les companyies",
        searchPlaceholder: "Cercar companyia...",
      };
    }
    if (entityScope === "re") {
      return {
        singular: "fons RE",
        plural: "fons RE",
        selectLabel: "Real Estate",
        allLabel: "Tots els fons RE",
        searchPlaceholder: "Cercar fons RE...",
      };
    }
    if (entityScope === "funds") {
      return {
        singular: "vehicle",
        plural: "vehicles",
        selectLabel: "Vehicles",
        allLabel: "Tots els vehicles",
        searchPlaceholder: "Cercar vehicle...",
      };
    }
    return {
      singular: "fons",
      plural: "fons",
      selectLabel: "Fons",
      allLabel: "Tots els fons",
      searchPlaceholder: "Cercar fons...",
    };
  }, [entityScope]);

  return {
    entityScope,
    setEntityScope,
    view,
    setView,
    mode,
    setMode,
    tableType,
    setTableType,
    fund,
    setFund,
    periods,
    setPeriods,
    yearFilters,
    setYearFilters,
    vintageFilter,
    setVintageFilter,
    sort,
    setSort,
    devMetric,
    setDevMetric,
    editorType,
    setEditorType,
    editorSearch,
    setEditorSearch,
    editorInputMode,
    setEditorInputMode,
    entityText,
  };
}
