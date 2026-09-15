import { lazy, Suspense } from "react";
import { useCapitalCallModal } from "./contexts/CapitalCallModalContext.jsx";

const CcTransactionModal = lazy(() =>
  import("./CcTransactionModal.jsx").then(m => ({ default: m.CcTransactionModal }))
);

/**
 * Renders the capital-call add/edit modals driven by CapitalCallModalContext.
 * Extracted from Dashboard.jsx; the heavy CcTransactionModal stays lazily
 * loaded behind Suspense.
 */
export function CapitalCallModals({
  ccNameOptions,
  ccTipusOptions,
  amountInputStyle,
  defaultVehicleCurrency,
  recallablePoolByFund,
  uncalledByFund,
  onInsert,
  onUpdate,
}) {
  const {
    ccAddModalFons,
    ccAddModalDefaults,
    ccEditModalRow,
    closeAddModal,
    closeEditModal,
  } = useCapitalCallModal();

  return (
    <Suspense fallback={null}>
      {ccAddModalFons !== null && (
        <CcTransactionModal
          addFons={ccAddModalFons}
          addDefaults={ccAddModalDefaults}
          ccNameOptions={ccNameOptions}
          ccTipusOptions={ccTipusOptions}
          amountInputStyle={amountInputStyle}
          defaultVehicleCurrency={defaultVehicleCurrency}
          recallablePoolByFund={recallablePoolByFund}
          uncalledByFund={uncalledByFund}
          onInsert={onInsert}
          onUpdate={onUpdate}
          onClose={closeAddModal}
        />
      )}

      {ccEditModalRow && (
        <CcTransactionModal
          editRow={ccEditModalRow}
          ccNameOptions={ccNameOptions}
          ccTipusOptions={ccTipusOptions}
          amountInputStyle={amountInputStyle}
          defaultVehicleCurrency={defaultVehicleCurrency}
          recallablePoolByFund={recallablePoolByFund}
          uncalledByFund={uncalledByFund}
          onInsert={onInsert}
          onUpdate={onUpdate}
          onClose={closeEditModal}
        />
      )}
    </Suspense>
  );
}
