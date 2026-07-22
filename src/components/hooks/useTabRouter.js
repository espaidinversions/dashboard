import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePersistedState } from "../../utils.js";

export function normalizeNavState({ tab, inversionsSubTab, realEstateTab, mercatsPublicsTab, activeNavItem }) {
  if (tab === "home") return "home";
  if (tab === "real-estate") {
    if (realEstateTab === "resum") return "re-resum";
    if (realEstateTab === "altres-vehicles") return "re-altres";
    return "re-directe";
  }
  if (tab === "mercats-publics") {
    if (mercatsPublicsTab === "transaccions" && activeNavItem === "tx-mp") return "tx-mp";
    if (mercatsPublicsTab === "rv") return "mp-rv";
    if (mercatsPublicsTab === "rf") return "mp-rf";
    if (mercatsPublicsTab === "posicions") return "mp-posicions";
    if (mercatsPublicsTab === "transaccions") return "mp-transaccions";
    if (mercatsPublicsTab === "traçabilitat") return "mp-traçabilitat";
    return "mp-resum";
  }
  if (tab === "tx-alt") return "tx-alt";
  if (tab === "tx-re") return "tx-re";
  if (tab === "tx-mp") return "tx-mp";
  if (tab === "inversions") {
    if (inversionsSubTab === "resum") return "alt-resum";
    if (inversionsSubTab === "pipeline") return "pipeline";
    if (inversionsSubTab === "tx") return "tx-alt";
    return "fons";
  }
  return null;
}

export function useTabRouter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "home";
  const setTab = useCallback((newTab) => {
    setSearchParams(params => {
      const next = new URLSearchParams(params);
      next.set("tab", newTab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [inversionsSubTab, setInversionsSubTab] = useState("fons");
  const [realEstateTab, setRealEstateTab] = useState("resum");
  const [mercatsPublicsTab, setMercatsPublicsTab] = useState("resum");
  const [searchersSubTab, setSearchersSubTab] = useState("tots");
  const [companiesSubTab, setCompaniesSubTab] = useState("portfoli");
  const [companiesPortfoliSubTab, setCompaniesPortfoliSubTab] = useState("totes");
  const [activeNavItem, setActiveNavItem] = usePersistedState("ui_navItem", "fons");

  const handleNavigate = useCallback((itemId) => {
    setActiveNavItem(itemId);
    switch (itemId) {
      case "home":           setTab("home"); break;
      case "alt-resum":      setTab("inversions"); setInversionsSubTab("resum"); break;
      case "fons":           setTab("inversions"); setInversionsSubTab("fons"); break;
      case "searchers":      setTab("searchers"); break;
      case "companies":      setTab("companies"); break;
      case "cash-model":     setTab("cash-model"); break;
      case "alt-cash-model": setTab("alt-cash-model"); break;
      case "re-cash-model":  setTab("re-cash-model");  break;
      case "posicions":      setTab("inversions"); break;
      case "re-resum":       setTab("real-estate");     setRealEstateTab("resum"); break;
      case "re-directe":     setTab("real-estate");     setRealEstateTab("directe"); break;
      case "re-altres":      setTab("real-estate");     setRealEstateTab("altres-vehicles"); break;
      case "re-inversions":  setTab("real-estate");     setRealEstateTab("inversions"); break;
      case "mp-resum":       setTab("mercats-publics"); setMercatsPublicsTab("resum"); break;
      case "mp-rv":          setTab("mercats-publics"); setMercatsPublicsTab("rv"); break;
      case "mp-rf":          setTab("mercats-publics"); setMercatsPublicsTab("rf"); break;
      case "mp-posicions":   setTab("mercats-publics"); setMercatsPublicsTab("posicions"); break;
      case "mp-transaccions":setTab("mercats-publics"); setMercatsPublicsTab("transaccions"); break;
      case "mp-traçabilitat":setTab("mercats-publics"); setMercatsPublicsTab("traçabilitat"); break;
      case "tx-alt":         setTab("tx-alt"); break;
      case "tx-re":          setTab("tx-re"); break;
      case "tx-mp":          setTab("tx-mp"); break;
      default: break;
    }
  }, [setActiveNavItem, setCompaniesSubTab, setInversionsSubTab, setMercatsPublicsTab, setRealEstateTab, setTab]);

  const derivedNavItem = useMemo(() => {
    const next = normalizeNavState({ tab, inversionsSubTab, realEstateTab, mercatsPublicsTab, activeNavItem });
    return next ?? activeNavItem;
  }, [activeNavItem, inversionsSubTab, mercatsPublicsTab, realEstateTab, tab]);

  return {
    tab, setTab,
    inversionsSubTab, setInversionsSubTab,
    realEstateTab, setRealEstateTab,
    mercatsPublicsTab, setMercatsPublicsTab,
    searchersSubTab, setSearchersSubTab,
    companiesSubTab, setCompaniesSubTab,
    companiesPortfoliSubTab, setCompaniesPortfoliSubTab,
    activeNavItem: derivedNavItem, setActiveNavItem,
    handleNavigate,
  };
}
