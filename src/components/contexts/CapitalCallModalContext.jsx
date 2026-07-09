import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const CapitalCallModalContext = createContext(null);

export function CapitalCallModalProvider({ children, defaultVehicleCurrency }) {
  const [ccAddModalFons, setCcAddModalFons] = useState(null);
  const [ccAddModalDefaults, setCcAddModalDefaults] = useState(null);
  const [ccEditModalRow, setCcEditModalRow] = useState(null);

  const openAddModal = useCallback((defaults = {}) => {
    const fons = defaults.fons ?? "";
    setCcAddModalDefaults({
      ...defaults,
      est: defaults.est ?? "Fons Primari",
      divisa: defaults.divisa ?? defaultVehicleCurrency(fons),
    });
    setCcAddModalFons(fons);
  }, [defaultVehicleCurrency]);

  const openEditModal = useCallback((row) => {
    setCcEditModalRow(row);
  }, []);

  const closeAddModal = useCallback(() => setCcAddModalFons(null), []);
  const closeEditModal = useCallback(() => setCcEditModalRow(null), []);

  const value = useMemo(() => ({
    ccAddModalFons,
    ccAddModalDefaults,
    ccEditModalRow,
    openAddModal,
    openEditModal,
    closeAddModal,
    closeEditModal,
  }), [ccAddModalDefaults, ccAddModalFons, ccEditModalRow, closeAddModal, closeEditModal, openAddModal, openEditModal]);

  return (
    <CapitalCallModalContext.Provider value={value}>
      {children}
    </CapitalCallModalContext.Provider>
  );
}

export function useCapitalCallModal() {
  const ctx = useContext(CapitalCallModalContext);
  if (!ctx) throw new Error("useCapitalCallModal must be used within CapitalCallModalProvider");
  return ctx;
}

