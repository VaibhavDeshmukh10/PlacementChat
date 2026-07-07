import { C } from "../../theme";

export function Spinner({ size = 18, color = C.green700, stroke = 2.5 }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `${stroke}px solid ${C.greyLine}`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "pd-spin 0.7s linear infinite",
      }}
    />
  );
}

export function FullScreenLoader({ label = "Loading…" }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: C.white,
        fontFamily: "Inter, sans-serif",
        color: C.greyText,
      }}
    >
      <style>{keyframes}</style>
      <Spinner size={26} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", radius = 6, style }) {
  return (
    <span
      style={{
        display: "block",
        height,
        width,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${C.greyLine} 25%, #EEF1ED 37%, ${C.greyLine} 63%)`,
        backgroundSize: "400% 100%",
        animation: "pd-shimmer 1.4s ease infinite",
        ...style,
      }}
    />
  );
}

export const keyframes = `
  @keyframes pd-spin { to { transform: rotate(360deg); } }
  @keyframes pd-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
`;

export function InlineError({ children, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        border: `1px solid ${C.red100}`,
        background: C.red100,
        color: C.red700,
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 13.5,
      }}
    >
      <span>{children}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.white,
            background: C.red700,
            border: "none",
            padding: "6px 12px",
            borderRadius: 7,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
