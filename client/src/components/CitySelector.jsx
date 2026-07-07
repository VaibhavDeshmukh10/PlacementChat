import { X } from "lucide-react";
import { C } from "../theme";

export default function CitySelector({ room, onClose, onCitySelect }) {
  if (!room || !room.cities || room.cities.length === 0) {
    return null;
  }

  const cityButtonClass = "city-selector-btn";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,20,18,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <style>{`
        .${cityButtonClass} {
          font-size: 14px;
          font-weight: 600;
          padding: 14px 16px;
          border-radius: 9px;
          border: 1.5px solid ${C.green700};
          background: ${C.green50};
          color: ${C.green700};
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
          font-family: inherit;
        }
        .${cityButtonClass}:hover {
          background: ${C.green100};
          transform: translateY(-2px);
        }
        .${cityButtonClass}:active {
          transform: translateY(0);
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-selector-title"
        style={{
          background: C.white,
          borderRadius: 14,
          border: `1px solid ${C.greyLine}`,
          width: "100%",
          maxWidth: 440,
          padding: 28,
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3
              id="city-selector-title"
              style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 22, margin: "0 0 6px", color: C.black }}
            >
              Select a city
            </h3>
            <p style={{ fontSize: 13.5, color: C.greyText, margin: 0 }}>
              Where are you interviewing at <b style={{ color: C.black }}>{room.name}</b>?
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.greyText, padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cities Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {room.cities.map((city) => (
            <button
              key={city}
              className={cityButtonClass}
              onClick={() => onCitySelect(city)}
              type="button"
            >
              {city}
            </button>
          ))}
        </div>

        {/* Footer Text */}
        <div style={{ fontSize: 12, color: C.greyFaint, marginTop: 18, textAlign: "center" }}>
          You can switch cities anytime by clicking the room name in the header.
        </div>
      </div>
    </div>
  );
}
