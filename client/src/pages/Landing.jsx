import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LogOut, X, MessageSquarePlus, CheckCircle2, LayoutDashboard } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { Spinner, Skeleton, InlineError } from "../components/ui/Loaders";
import CitySelector from "../components/CitySelector";
import { C } from "../theme";

function LogoTile({ room }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: failed ? C.black : C.white,
        border: `1px solid ${C.greyLine}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
      className="flex items-center justify-center"
    >
      {failed ? (
        <span style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 15, color: C.white }}>
          {room.initial}
        </span>
      ) : (
        <img
          src={room.logoUrl || `/logos/${room.slug}.png`}
          alt={`${room.name} logo`}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6, background: C.white }}
        />
      )}
    </div>
  );
}

function SuggestCompanyModal({ initialCompany, onClose }) {
  const toast = useToast();
  const [company, setCompany] = useState(initialCompany || "");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!company.trim() || busy) return;
    setBusy(true);
    try {
      await api.submitFeedback({
        type: "Company suggestion",
        name: company.trim(),
        email: email.trim(),
        message: message.trim() || `Requesting a room for ${company.trim()}.`,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || "Couldn't submit — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(17,20,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-company-title"
        style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.greyLine}`, width: "100%", maxWidth: 440, padding: 28, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.35)" }}
      >
        {submitted ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.green100, color: C.green700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={24} />
            </div>
            <h3 style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 19, margin: "0 0 8px", color: C.black }}>
              Thanks — we've got it
            </h3>
            <p style={{ fontSize: 13.5, color: C.greyText, lineHeight: 1.55, margin: "0 0 22px" }}>
              We'll review the request for <b style={{ color: C.black }}>{company}</b> and open a room once
              there's enough interest. We'll email you if you left an address.
            </p>
            <button onClick={onClose} style={{ fontSize: 14, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: C.green100, color: C.green700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MessageSquarePlus size={17} />
              </div>
              <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: C.greyText, padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <h3 id="suggest-company-title" style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 19, margin: "12px 0 4px", color: C.black }}>
              Suggest a company
            </h3>
            <p style={{ fontSize: 13.5, color: C.greyText, lineHeight: 1.5, margin: "0 0 20px" }}>
              Don't see a company hiring on your campus? Tell us and we'll open a room for it.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Company name</span>
                <input required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Zoho, Flipkart" style={modalInput} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Your email (optional)</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" style={modalInput} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Anything else? (optional)</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="City, role, or why it'd help — anything useful" rows={3} style={{ ...modalInput, resize: "vertical" }} />
              </label>

              <button type="submit" disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "11px 18px", borderRadius: 8, cursor: busy ? "default" : "pointer", marginTop: 4, opacity: busy ? 0.8 : 1 }}>
                {busy && <Spinner size={15} color={C.white} />}
                Submit suggestion
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const modalInput = {
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${C.greyLine}`,
  outline: "none",
  fontFamily: "Inter, sans-serif",
  width: "100%",
  boxSizing: "border-box",
};

function RoomCardSkeleton() {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.greyLine}`, borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton width={38} height={38} radius={8} />
        <div style={{ flex: 1 }}>
          <Skeleton width="55%" height={13} />
          <Skeleton width="80%" height={11} style={{ marginTop: 8 }} />
        </div>
      </div>
      <div style={{ paddingTop: 14, borderTop: `1px solid ${C.greyLine}` }}>
        <Skeleton width="40%" height={11} />
      </div>
    </div>
  );
}

export default function PlacementDeskLanding() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const toast = useToast();

  const [rooms, setRooms] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [query, setQuery] = useState("");
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null); // For city selector

  const loadRooms = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await api.listRooms();
      const mapped = data.map((r) => ({
        ...r,  // Spread all original data (including cities array)
        name: r.name,
        slug: r.slug,
        city: (r.cities || []).join(", "),
        members: r.memberCount || 0,
        initial: (r.name?.[0] || "?").toUpperCase(),
      }));
      setRooms(mapped);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q));
  }, [query, rooms]);

  const totalMembers = useMemo(() => rooms.reduce((n, r) => n + (r.members || 0), 0), [rooms]);

  return (
    <div style={{ background: C.white, color: C.black, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes pd-pulse {
          0% { box-shadow: 0 0 0 0 rgba(46,158,99,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(46,158,99,0); }
          100% { box-shadow: 0 0 0 0 rgba(46,158,99,0); }
        }
        .pd-live-dot { animation: pd-pulse 2.2s infinite; }
        @media (prefers-reduced-motion: reduce) { .pd-live-dot { animation: none; } }
        .pd-room:hover { border-color: ${C.green700} !important; background: ${C.green050} !important; transform: translateY(-2px); }
        .pd-nav-link:hover { color: ${C.black} !important; }
        .pd-btn-ghost:hover { color: ${C.black} !important; }
        .pd-btn-primary:hover { background: ${C.green900} !important; }
        .pd-search-go:hover { background: ${C.green900} !important; }
        .pd-search-shell:focus-within { box-shadow: 0 0 0 3px ${C.green100}; }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", paddingLeft: 40, paddingRight: 40 }} className="max-sm:px-5">
        {/* Nav */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 22, borderBottom: `1px solid ${C.greyLine}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 18, letterSpacing: "-0.01em", color: C.black }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: C.green700, color: C.white, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
              P
            </span>
            PlacementDesk
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="pd-btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: C.greyText, background: "none", border: "none", cursor: "pointer", padding: "9px 14px", transition: "color 0.15s ease" }}
              >
                <LayoutDashboard size={15} />
                <span className="max-sm:hidden">Admin</span>
              </button>
            )}
            {isAuthenticated ? (
              <button
                onClick={() => { logout(); toast.info("Signed out"); }}
                className="pd-btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: C.greyText, background: "none", border: "none", cursor: "pointer", padding: "9px 14px", transition: "color 0.15s ease" }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            ) : (
              <>
                <button onClick={() => navigate("/login")} className="pd-btn-ghost" style={{ fontSize: 14, color: C.greyText, background: "none", border: "none", cursor: "pointer", padding: "9px 14px", transition: "color 0.15s ease" }}>
                  Log in
                </button>
                <button onClick={() => navigate("/register")} className="pd-btn-primary" style={{ fontSize: 14, fontWeight: 600, color: C.white, background: C.green700, padding: "9px 18px", borderRadius: 7, border: "none", cursor: "pointer", transition: "background 0.15s ease" }}>
                  Register
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section style={{ paddingTop: 64, paddingBottom: 20 }} className="max-sm:pt-10">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: C.green700, background: C.green100, padding: "6px 12px", borderRadius: 20, margin: "0 0 22px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green500 }} />
            Live interview experiences from real candidates
          </div>

          <h1 style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: "clamp(34px,4.6vw,54px)", lineHeight: 1.08, letterSpacing: "-0.015em", margin: "0 0 18px", maxWidth: 760, color: C.black }}>
            Prepare for the interview with people who just sat it.
          </h1>

          <p style={{ fontSize: 16.5, color: C.greyText, maxWidth: 560, lineHeight: 1.6, margin: "0 0 36px" }}>
            PlacementDesk connects students across campuses and cities in company-specific
            rooms, so you walk in knowing what was actually asked — not what a forum says
            was asked in 2019.
          </p>

          <div className="pd-search-shell" style={{ background: C.white, border: `1.5px solid ${C.black}`, borderRadius: 12, padding: 8, maxWidth: 640, display: "flex", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", paddingLeft: 10, color: C.greyText }}>
              <Search size={17} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by company or city"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.black, fontFamily: "Inter, sans-serif", fontSize: 15, padding: "12px 14px" }}
            />
            <span
              className="pd-search-go max-sm:hidden"
              onClick={() => { const el = document.getElementById("resources"); el?.scrollIntoView({ behavior: "smooth" }); }}
              style={{ background: C.green700, color: C.white, fontSize: 14, fontWeight: 600, padding: "0 20px", borderRadius: 8, display: "flex", alignItems: "center", cursor: "pointer", transition: "background 0.15s ease" }}
            >
              Search
            </span>
          </div>

          <div style={{ display: "flex", gap: 40, marginTop: 32, flexWrap: "wrap" }}>
            {[
              [status === "ready" ? String(rooms.length) : "—", "Companies covered"],
              [status === "ready" ? String(new Set(rooms.flatMap((r) => r.city.split(", "))).size) : "—", "Cities represented"],
              [status === "ready" ? totalMembers.toLocaleString() : "—", "Members across rooms"],
            ].map(([n, label]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", fontSize: 13, color: C.greyText }}>
                <b style={{ color: C.black, fontSize: 20, fontWeight: 600, fontFamily: "Newsreader, serif", marginBottom: 2 }}>{n}</b>
                {label}
              </div>
            ))}
          </div>
        </section>

        {/* Rooms */}
        <section id="resources" style={{ paddingTop: 56, paddingBottom: 90 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, borderBottom: `1px solid ${C.greyLine}`, paddingBottom: 18, gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 22, margin: "0 0 4px", color: C.black }}>
                Company rooms
              </h2>
              <p style={{ margin: 0, fontSize: 13.5, color: C.greyText }}>
                Join a room to read recent interview experiences and ask current candidates questions in real time.
              </p>
            </div>
            <div style={{ fontSize: 13, color: C.greyText, whiteSpace: "nowrap" }}>
              {status === "ready" ? `${filteredRooms.length} rooms shown` : ""}
            </div>
          </div>

          {status === "error" ? (
            <InlineError onRetry={loadRooms}>
              Couldn't load rooms. Make sure the backend is running on the API URL.
            </InlineError>
          ) : status === "loading" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <RoomCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 20px", fontSize: 13.5, color: C.greyText, border: `1px dashed ${C.greyLine}`, borderRadius: 10 }}>
              <p style={{ margin: "0 0 16px" }}>
                {rooms.length === 0
                  ? "No rooms yet. Suggest a company to get the first one opened."
                  : `No room matches "${query}" yet — be the first to ask for it.`}
              </p>
              <button
                onClick={() => setShowSuggestModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}
              >
                <MessageSquarePlus size={15} />
                Suggest {query ? `"${query}"` : "a company"}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
              {filteredRooms.map((r) => (
                <div
                  key={r.slug}
                  role="button"
                  tabIndex={0}
                  className="pd-room"
                  onClick={() => {
                    // If room has cities, show selector; otherwise navigate directly
                    if (r.cities && r.cities.length > 0) {
                      setSelectedRoom(r);
                    } else {
                      navigate(`/room/${r.slug}`);
                    }
                  }}
                  onKeyDown={(e) => { 
                    if (e.key === "Enter") {
                      if (r.cities && r.cities.length > 0) {
                        setSelectedRoom(r);
                      } else {
                        navigate(`/room/${r.slug}`);
                      }
                    }
                  }}
                  style={{ background: C.white, border: `1px solid ${C.greyLine}`, borderRadius: 10, padding: 20, cursor: "pointer", display: "flex", flexDirection: "column", gap: 16, transition: "border-color 0.15s ease, transform 0.15s ease, background 0.15s ease" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                      <LogoTile room={r} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.black, lineHeight: 1.25 }}>{r.name}</div>
                        <div style={{ fontSize: 12.5, color: C.greyText, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.city || "—"}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: C.greyText, paddingTop: 14, borderTop: `1px solid ${C.greyLine}` }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="pd-live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: C.green500 }} />
                      {r.members.toLocaleString()} members
                    </span>
                    <span style={{ color: C.green700, fontWeight: 600 }}>View room →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="max-sm:flex-col max-sm:gap-2" style={{ borderTop: `1px solid ${C.greyLine}`, paddingTop: 24, paddingBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: C.greyText }}>
          <span>© 2026 PlacementDesk</span>
          <button onClick={() => setShowSuggestModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.greyText, fontSize: 12.5, padding: 0 }} className="pd-nav-link">
            <MessageSquarePlus size={13} />
            Suggest a company or share feedback
          </button>
          <span>Built by students, for students</span>
        </footer>
      </div>

      {showSuggestModal && (
        <SuggestCompanyModal initialCompany={filteredRooms.length === 0 ? query : ""} onClose={() => setShowSuggestModal(false)} />
      )}

      {selectedRoom && (
        <CitySelector
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onCitySelect={(city) => {
            setSelectedRoom(null);
            navigate(`/room/${selectedRoom.slug}?city=${encodeURIComponent(city)}`);
          }}
        />
      )}
    </div>
  );
}
