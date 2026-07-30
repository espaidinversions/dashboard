import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const KEYTIP_TIMEOUT_MS = 5000;

function isEditableShortcutTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target.closest?.("[contenteditable='true']"))
  );
}

export function GlobalKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isAdmin, canAccessSection, canEditSection } = useAuth();
  const keyTipModeRef = useRef(false);
  const keyTipTimerRef = useRef(null);
  const [keyTipsVisible, setKeyTipsVisible] = useState(false);

  const shortcutEntries = useMemo(() => {
    const entries = [];
    const add = (key, label, path, allowed = true, action = null) => {
      if (allowed) entries.push({ key, label, path, action });
    };

    const params = new URLSearchParams(location.search);
    const currentTab = params.get("tab");
    const addTransactionScope = location.pathname === "/" ? (currentTab === "tx-alt" ? "alt" : currentTab === "tx-re" ? "re" : null) : null;

    add("H", "Inici", "/?nav=home", isAdmin || canAccessSection("inici"));
    add("A", "Alternatius", "/?nav=alt-resum", canAccessSection("fons"));
    add("F", "Fons", "/?nav=fons", canAccessSection("fons"));
    add("S", "Searchers", "/?nav=searchers", canAccessSection("alternatives"));
    add("C", "Participades", "/?nav=companies", canAccessSection("companies"));
    add("M", "Model Caixa", "/?nav=alt-cash-model", canAccessSection("cash-model"));
    add("R", "Real Estate", "/?nav=re-resum", canAccessSection("real-estate"));
    add("P", "Mercats Públics", "/?nav=mp-resum", canAccessSection("mercats-publics"));
    add("L", "Liquiditat", "/?nav=liquidity", isAdmin || canAccessSection("liquidity"));
    add("T", "Transaccions", "/?nav=tx-alt", canAccessSection("tx-alt"));
    add("N", "Nou moviment", null, Boolean(addTransactionScope) && canEditSection(addTransactionScope === "re" ? "tx-re" : "tx-alt"), { type: "add-transaction", scope: addTransactionScope });
    add("U", "Guia", "/guia", Boolean(session));
    add("D", "Admin", "/admin", isAdmin);

    return entries;
  }, [canAccessSection, canEditSection, isAdmin, location.search, session]);

  const shortcutTargets = useMemo(
    () => new Map(shortcutEntries.map((entry) => [entry.key.toLowerCase(), entry])),
    [shortcutEntries],
  );

  useEffect(() => {
    const clearKeyTipMode = () => {
      keyTipModeRef.current = false;
      setKeyTipsVisible(false);
      if (keyTipTimerRef.current) {
        window.clearTimeout(keyTipTimerRef.current);
        keyTipTimerRef.current = null;
      }
    };

    const activateKeyTipMode = () => {
      keyTipModeRef.current = true;
      setKeyTipsVisible(true);
      if (keyTipTimerRef.current) window.clearTimeout(keyTipTimerRef.current);
      keyTipTimerRef.current = window.setTimeout(clearKeyTipMode, KEYTIP_TIMEOUT_MS);
    };

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || isEditableShortcutTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey) return;

      const key = event.key.toLowerCase();

      if (key === "escape" && keyTipModeRef.current) {
        event.preventDefault();
        clearKeyTipMode();
        return;
      }

      if (key === "?") {
        event.preventDefault();
        if (keyTipModeRef.current && !event.repeat) clearKeyTipMode();
        else activateKeyTipMode();
        return;
      }

      if (!keyTipModeRef.current) return;

      const target = shortcutTargets.get(key);
      if (!target) {
        clearKeyTipMode();
        return;
      }

      event.preventDefault();
      clearKeyTipMode();
      if (target.action?.type === "add-transaction") {
        window.dispatchEvent(new CustomEvent("tc:add-transaction", { detail: { scope: target.action.scope } }));
        return;
      }

      const current = `${location.pathname}${location.search}`;
      if (target.path && current !== target.path) navigate(target.path);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearKeyTipMode();
    };
  }, [location.pathname, location.search, navigate, shortcutTargets]);

  if (!keyTipsVisible || shortcutEntries.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 64,
        bottom: 18,
        zIndex: 1000,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        maxWidth: "min(760px, calc(100vw - 96px))",
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(12, 24, 36, 0.94)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
        color: "rgba(255,255,255,0.84)",
        fontSize: 12,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      {shortcutEntries.map((entry) => (
        <span key={entry.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          <kbd style={{ minWidth: 18, padding: "1px 5px", borderRadius: 4, background: "#fff", color: "#18324C", fontSize: 11, fontWeight: 700, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{entry.key}</kbd>
          {entry.label}
        </span>
      ))}
    </div>
  );
}

