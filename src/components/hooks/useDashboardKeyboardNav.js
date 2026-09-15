import { useEffect, useMemo } from "react";

function isKeyboardEditableTarget(target) {
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

/**
 * Registers global keyboard shortcuts: "/" focuses global search, "[" / "]"
 * cycle through the accessible nav items. Extracted from Dashboard.jsx; the
 * effect dependency array is intentionally unchanged (globalSearchRef is a
 * stable ref and deliberately omitted).
 *
 * @param {{
 *   canAccessInici: boolean,
 *   canAccessSection: (section: string) => boolean,
 *   isAdmin: boolean,
 *   activeNavItem: string,
 *   handleNavigate: (id: string) => void,
 *   globalSearchRef: { current: HTMLInputElement | null },
 * }} params
 */
export function useDashboardKeyboardNav({
  canAccessInici,
  canAccessSection,
  isAdmin,
  activeNavItem,
  handleNavigate,
  globalSearchRef,
}) {
  const keyboardNavItems = useMemo(() => {
    const candidates = [
      canAccessInici ? { id: "home", label: "Inici" } : null,
      canAccessSection("fons") ? { id: "alt-resum", label: "Alternatius" } : null,
      canAccessSection("fons") ? { id: "fons", label: "Fons" } : null,
      canAccessSection("alternatives") ? { id: "searchers", label: "Searchers" } : null,
      canAccessSection("companies") ? { id: "companies", label: "Participades" } : null,
      canAccessSection("cash-model") ? { id: "alt-cash-model", label: "Model Caixa" } : null,
      canAccessSection("real-estate") ? { id: "re-resum", label: "Real Estate" } : null,
      canAccessSection("re-altres") ? { id: "re-altres", label: "Vehicles RE" } : null,
      canAccessSection("mercats-publics") ? { id: "mp-resum", label: "Mercats Publics" } : null,
      canAccessSection("mp-rv") ? { id: "mp-rv", label: "Renda Variable" } : null,
      canAccessSection("mp-rf") ? { id: "mp-rf", label: "Renda Fixa" } : null,
      canAccessSection("mp-posicions") ? { id: "mp-posicions", label: "Posicions MP" } : null,
      canAccessSection("mp-transaccions") ? { id: "mp-transaccions", label: "Transaccions MP" } : null,
      canAccessSection("tx-alt") ? { id: "tx-alt", label: "Tx Alternatius" } : null,
      canAccessSection("tx-re") ? { id: "tx-re", label: "Tx RE" } : null,
      canAccessSection("tx-mp") ? { id: "tx-mp", label: "Tx MP" } : null,
      (isAdmin || canAccessSection("liquidity")) ? { id: "liquidity", label: "Liquiditat" } : null,
    ].filter(Boolean);
    const seen = new Set();
    return candidates.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [canAccessInici, canAccessSection, isAdmin]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;

      const key = event.key.toLowerCase();
      const isShortcutModifier = event.ctrlKey || event.metaKey;

      if (key === "escape" && document.activeElement === globalSearchRef.current) {
        globalSearchRef.current?.blur();
        event.preventDefault();
        return;
      }

      if (isKeyboardEditableTarget(event.target)) return;

      if (key === "/" && !isShortcutModifier && !event.altKey) {
        event.preventDefault();
        globalSearchRef.current?.focus();
        globalSearchRef.current?.select();
        return;
      }

      if (event.altKey || isShortcutModifier) return;

      if (key === "[" || key === "]") {
        if (!keyboardNavItems.length) return;
        event.preventDefault();
        const currentIndex = keyboardNavItems.findIndex((item) => item.id === activeNavItem);
        const direction = key === "]" ? 1 : -1;
        const nextIndex = currentIndex >= 0
          ? (currentIndex + direction + keyboardNavItems.length) % keyboardNavItems.length
          : (direction === 1 ? 0 : keyboardNavItems.length - 1);
        handleNavigate(keyboardNavItems[nextIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNavItem, handleNavigate, keyboardNavItems]);
}
