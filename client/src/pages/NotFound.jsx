import { useNavigate } from "react-router-dom";
import { C } from "../theme";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: C.green050,
        fontFamily: "Inter, sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@600&family=Inter:wght@400;600&display=swap');`}</style>
      <div style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 56, color: C.green700 }}>404</div>
      <p style={{ fontSize: 15, color: C.greyText, margin: 0 }}>
        We couldn't find that page.
      </p>
      <button
        onClick={() => navigate("/")}
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: C.white,
          background: C.green700,
          border: "none",
          padding: "10px 20px",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Back to PlacementDesk
      </button>
    </div>
  );
}
