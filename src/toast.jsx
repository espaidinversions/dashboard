import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ message, type = "success" }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        fontFamily: "'Outfit',system-ui,sans-serif",
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            minWidth: 260, maxWidth: 360,
            padding: "10px 14px", borderRadius: 8, fontSize: 13,
            boxShadow: "0 4px 16px rgba(0,0,0,.15)",
            background: t.type === "error" ? "#FDECEA" : "#E8F5E9",
            color: t.type === "error" ? "#C62828" : "#1B5E20",
            fontWeight: 500,
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
