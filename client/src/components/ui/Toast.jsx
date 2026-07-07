import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { C } from "../../theme";

const ToastContext = createContext(null);

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "success", ttl = 3600) => {
      const id = ++idSeq;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (ttl) setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error", 5000),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 1000,
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        <style>{`
          @keyframes pd-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        `}</style>
        {toasts.map((t) => {
          const palette = {
            success: { bg: C.green700, Icon: CheckCircle2 },
            error: { bg: C.red700, Icon: AlertCircle },
            info: { bg: C.black, Icon: Info },
          }[t.tone];
          const { bg, Icon } = palette;
          return (
            <div
              key={t.id}
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: bg,
                color: C.white,
                borderRadius: 10,
                padding: "11px 14px",
                fontSize: 13.5,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 12px 30px -12px rgba(0,0,0,0.4)",
                animation: "pd-toast-in 0.18s ease",
                maxWidth: 360,
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                style={{ background: "none", border: "none", color: C.white, cursor: "pointer", padding: 2, opacity: 0.8 }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
