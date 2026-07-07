import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  ArrowLeft, Send, Pin, CheckCircle2, XCircle, Clock,
  Plus, X, Trash2, FileText, LogIn,
} from "lucide-react";
import { api, API_BASE, getToken } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import CitySelector from "../components/CitySelector";
import { Spinner, InlineError, keyframes } from "../components/ui/Loaders";
import { C, initials, clockTime } from "../theme";

function Avatar({ name, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.black, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 600, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function RoomLogo({ name, logoUrl, slug, size = 38 }) {
  const [failed, setFailed] = useState(false);
  const displayInitial = !logoUrl || failed;

  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: displayInitial ? C.black : C.white, overflow: "hidden", flexShrink: 0, border: `1px solid ${C.greyLine}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {displayInitial ? (
        <span style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 18, color: C.white }}>
          {initials(name || slug)}
        </span>
      ) : (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: C.white }}
        />
      )}
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const map = {
    Selected: { bg: C.green100, text: C.green700, Icon: CheckCircle2 },
    Rejected: { bg: C.red100, text: C.red700, Icon: XCircle },
    "In progress": { bg: C.greyLine, text: C.greyText, Icon: Clock },
  };
  const { bg, text, Icon } = map[verdict] || map["In progress"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, background: bg, color: text, padding: "3px 9px", borderRadius: 20 }}>
      <Icon size={12} />
      {verdict}
    </span>
  );
}

function TextMessage({ msg, isCurrentUser }) {
  if (isCurrentUser) {
    // Your message - RIGHT aligned
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "70%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: C.greyFaint }}>{clockTime(msg.createdAt)}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.black }}>{msg.sender?.name || "You"}</span>
          </div>
          <div style={{ 
            fontSize: 14, 
            color: C.white, 
            lineHeight: 1.55, 
            wordBreak: "break-word",
            background: C.green700,
            padding: "10px 14px",
            borderRadius: "18px 18px 4px 18px",
            width: "fit-content"
          }}>
            {msg.text}
          </div>
        </div>
        <Avatar name={msg.sender?.name} />
      </div>
    );
  } else {
    // Others' message - LEFT aligned
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", width: "100%", gap: 12, marginBottom: 8 }}>
        <Avatar name={msg.sender?.name} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "70%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.black }}>{msg.sender?.name || "Someone"}</span>
            <span style={{ fontSize: 11.5, color: C.greyFaint }}>{clockTime(msg.createdAt)}</span>
          </div>
          <div style={{ 
            fontSize: 14, 
            color: C.black, 
            lineHeight: 1.55, 
            wordBreak: "break-word",
            background: C.grey050,
            padding: "10px 14px",
            borderRadius: "18px 18px 18px 4px",
            border: `1px solid ${C.greyLine}`,
            width: "fit-content"
          }}>
            {msg.text}
          </div>
        </div>
      </div>
    );
  }
}

function ExperienceMessage({ msg, expanded, onToggle, isCurrentUser }) {
  const hasRounds = Array.isArray(msg.rounds) && msg.rounds.length > 0;
  
  if (isCurrentUser) {
    // Your experience - RIGHT aligned
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "70%", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: C.greyFaint }}>{clockTime(msg.createdAt)}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.black }}>{msg.sender?.name || "You"}</span>
          </div>
          <div style={{ 
            border: `1px solid ${C.green700}`, 
            borderRadius: "18px 18px 4px 18px", 
            padding: 16, 
            background: C.green050,
            width: "fit-content"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.greyText }}>
                {msg.role} · {msg.city}
              </span>
              <VerdictBadge verdict={msg.verdict} />
            </div>
            <p style={{ fontSize: 13.5, color: C.black, lineHeight: 1.55, margin: `0 0 ${hasRounds ? 12 : 0}px` }}>{msg.summary}</p>

            {hasRounds && expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 12px", paddingLeft: 4 }}>
                {msg.rounds.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.green100, color: C.green700, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>{r.title}</div>
                      {r.note && <div style={{ fontSize: 12.5, color: C.greyText, marginTop: 1 }}>{r.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasRounds && (
              <button onClick={onToggle} style={{ fontSize: 12.5, fontWeight: 600, color: C.green700, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                {expanded ? "Hide rounds ↑" : `Read full experience (${msg.rounds.length} rounds) →`}
              </button>
            )}
          </div>
        </div>
        <Avatar name={msg.sender?.name} />
      </div>
    );
  } else {
    // Others' experience - LEFT aligned
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", width: "100%", gap: 12, marginBottom: 8 }}>
        <Avatar name={msg.sender?.name} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "70%", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.black }}>{msg.sender?.name || "Someone"}</span>
            <span style={{ fontSize: 11.5, color: C.greyFaint }}>{clockTime(msg.createdAt)}</span>
          </div>
          <div style={{ 
            border: `1px solid ${C.greyLine}`, 
            borderRadius: "18px 18px 18px 4px", 
            padding: 16, 
            background: C.white,
            width: "fit-content"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.greyText }}>
                {msg.role} · {msg.city}
              </span>
              <VerdictBadge verdict={msg.verdict} />
            </div>
            <p style={{ fontSize: 13.5, color: C.black, lineHeight: 1.55, margin: `0 0 ${hasRounds ? 12 : 0}px` }}>{msg.summary}</p>

            {hasRounds && expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 12px", paddingLeft: 4 }}>
                {msg.rounds.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.green100, color: C.green700, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>{r.title}</div>
                      {r.note && <div style={{ fontSize: 12.5, color: C.greyText, marginTop: 1 }}>{r.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasRounds && (
              <button onClick={onToggle} style={{ fontSize: 12.5, fontWeight: 600, color: C.green700, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                {expanded ? "Hide rounds ↑" : `Read full experience (${msg.rounds.length} rounds) →`}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

const inputStyle = {
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${C.greyLine}`,
  outline: "none",
  fontFamily: "Inter, sans-serif",
  width: "100%",
  boxSizing: "border-box",
};

function userIdsMatch(user, sender) {
  if (!user || !sender) return false;
  const userId = String(user._id || user.id || "");
  const senderId = String(sender._id || sender.id || "");
  return userId !== "" && senderId !== "" && userId === senderId;
}

function PostExperienceModal({ roomName, onClose, onSubmit, busy }) {
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [verdict, setVerdict] = useState("Selected");
  const [summary, setSummary] = useState("");
  const [rounds, setRounds] = useState([{ title: "", note: "" }]);

  const updateRound = (i, field, value) => setRounds((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRound = () => setRounds((prev) => [...prev, { title: "", note: "" }]);
  const removeRound = (i) => setRounds((prev) => prev.filter((_, idx) => idx !== i));

  function handleSubmit(e) {
    e.preventDefault();
    if (!role.trim() || !city.trim() || !summary.trim()) return;
    onSubmit({
      role: role.trim(),
      city: city.trim(),
      verdict,
      summary: summary.trim(),
      rounds: rounds.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim(), note: r.note.trim() })),
    });
  }

  const verdictOptions = ["Selected", "Rejected", "In progress"];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,20,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="post-experience-title"
        style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.greyLine}`, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.greyLine}`, position: "sticky", top: 0, background: C.white, zIndex: 1 }}>
          <h3 id="post-experience-title" style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 18, margin: 0, color: C.black }}>
            Share your interview experience
          </h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: C.greyText, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }} className="max-sm:flex-col">
            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Role</span>
              <input required value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. SDE-1" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>City</span>
              <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Hyderabad" style={inputStyle} />
            </label>
          </div>

          <div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black, display: "block", marginBottom: 8 }}>Verdict</span>
            <div style={{ display: "flex", gap: 8 }}>
              {verdictOptions.map((v) => (
                <button key={v} type="button" onClick={() => setVerdict(v)}
                  style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "9px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${verdict === v ? C.green700 : C.greyLine}`, background: verdict === v ? C.green100 : C.white, color: verdict === v ? C.green700 : C.greyText, transition: "all 0.15s ease" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Summary</span>
            <textarea required value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was the overall process like? Anything that surprised you?" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Round-by-round (optional)</span>
              <button type="button" onClick={addRound} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: C.green700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <Plus size={13} />
                Add round
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rounds.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input value={r.title} onChange={(e) => updateRound(i, "title", e.target.value)} placeholder={`Round ${i + 1} title`} style={{ ...inputStyle, flex: "0 0 40%" }} />
                  <input value={r.note} onChange={(e) => updateRound(i, "note", e.target.value)} placeholder="What happened in this round" style={{ ...inputStyle, flex: 1 }} />
                  {rounds.length > 1 && (
                    <button type="button" onClick={() => removeRound(i)} aria-label="Remove round" style={{ background: "none", border: "none", cursor: "pointer", color: C.greyFaint, padding: 8, flexShrink: 0 }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, color: C.greyFaint, background: C.green050, borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
            Experiences are reviewed by a moderator before appearing in the room.
          </div>

          <button type="submit" disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "11px 18px", borderRadius: 8, cursor: busy ? "default" : "pointer", marginTop: 4, opacity: busy ? 0.8 : 1 }}>
            {busy && <Spinner size={15} color={C.white} />}
            Submit to {roomName} room
          </button>
        </form>
      </div>
    </div>
  );
}

export default function RoomChat() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCity = searchParams.get("city") || null;
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);  // NEW: Track city selector state
  const [postingExp, setPostingExp] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [highlightedExpId, setHighlightedExpId] = useState(null);  // Track highlighted experience

  const scrollRef = useRef(null);
  const messageRefs = useRef({});
  const socketRef = useRef(null);

  // dedupe helper — messages arrive both from POST responses and socket events
  const upsert = useCallback((incoming) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === incoming._id)) return prev;
      return [...prev, incoming];
    });
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await api.getRoom(slug);
      setRoom(r);
      const msgs = await api.listMessages(slug, selectedCity);  // Pass selected city
      setMessages(msgs);
      setStatus("ready");
    } catch (err) {
      setStatus(err.status === 404 ? "notfound" : "error");
    }
  }, [slug, selectedCity]);

  useEffect(() => {
    load();
  }, [load]);

  // Check if room requires city selection
  const requiresCity = room && room.cities && room.cities.length > 0;
  const hasCity = selectedCity !== null;

  // If room requires city but no city selected, redirect back
  useEffect(() => {
    if (status === "ready" && requiresCity && !hasCity) {
      toast.warn("Please select a city first");
      navigate(`/room/${slug}`);  // Go back to city selector
    }
  }, [status, requiresCity, hasCity, slug, navigate, toast]);

  // Socket.io real-time wiring
  useEffect(() => {
    if (status !== "ready") return;
    
    // Don't connect if city is required but not selected
    if (requiresCity && !hasCity) return;
    
    const socket = io(API_BASE, { 
      auth: { token: getToken() || undefined },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ['websocket'],  // Match server config - WebSocket only
      secure: window.location.protocol === 'https:',  // Use secure connection if on HTTPS
      rejectUnauthorized: false  // Allow self-signed certs in dev
    });
    socketRef.current = socket;
    
    // Join room with city information (slugify city to remove spaces and special chars)
    const slugifyCity = (city) => city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const roomIdentifier = selectedCity ? `${slug}-${slugifyCity(selectedCity)}` : slug;
    
    socket.on("connect", () => {
      socket.emit("join-room", roomIdentifier);
      console.log("✅ Socket connected successfully");
    });
    
    socket.on("message-received", (msg) => {
      // only messages for this room (server scopes emits, but guard anyway)
      upsert(msg);
    });
    
    socket.on("member-count-update", (data) => {
      setActiveMemberCount(data.memberCount);
    });
    
    // Suppress error toasts - just log to console for debugging
    socket.on("error", (error) => {
      console.error("🔴 Socket error:", error);
      // Don't show toast - let Socket.io handle reconnection silently
    });
    
    socket.on("connect_error", (error) => {
      console.warn("⚠️  Socket connection error:", error.message);
      // Don't show toast - let Socket.io retry automatically
    });
    
    socket.on("disconnect", (reason) => {
      console.log("⚠️  Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        console.log("Server disconnected us, will attempt to reconnect...");
      }
    });
    
    socket.on("reconnect", () => {
      console.log("✅ Socket reconnected");
      socket.emit("join-room", roomIdentifier);
    });
    
    socket.on("reconnect_attempt", () => {
      console.log("🔄 Attempting to reconnect...");
    });
    
    return () => {
      socket.emit("leave-room", roomIdentifier);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, slug, selectedCity, upsert]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function scrollToMessage(id) {
    messageRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    if (!isAuthenticated) {
      toast.info("Log in to join the conversation.");
      navigate("/login", { state: { from: `/room/${slug}` } });
      return;
    }
    setSending(true);
    setDraft("");
    try {
      const saved = await api.sendMessage(slug, text, selectedCity);  // Pass selected city
      upsert(saved); // socket will also deliver it; upsert dedupes
    } catch (err) {
      toast.error(err.message || "Message failed to send");
      setDraft(text); // restore so the user doesn't lose it
    } finally {
      setSending(false);
    }
  }

  async function handlePostExperience(data) {
    setPostingExp(true);
    try {
      await api.postExperience(slug, data);
      setShowExperienceModal(false);
      toast.success("Submitted — a moderator will review it shortly.");
    } catch (err) {
      toast.error(err.message || "Couldn't submit your experience");
    } finally {
      setPostingExp(false);
    }
  }

  if (status === "loading") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "Inter, sans-serif", color: C.greyText }}>
        <style>{keyframes}</style>
        <Spinner size={26} />
        <span style={{ fontSize: 14 }}>Loading room…</span>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "Inter, sans-serif", padding: 24, textAlign: "center" }}>
        <div style={{ fontFamily: "Newsreader, serif", fontSize: 22, fontWeight: 600, color: C.black }}>Room not found</div>
        <p style={{ fontSize: 14, color: C.greyText, margin: 0 }}>The "{slug}" room doesn't exist yet.</p>
        <button onClick={() => navigate("/")} style={{ fontSize: 14, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
          Browse rooms
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <InlineError onRetry={load}>Couldn't load this room. Is the backend running?</InlineError>
        </div>
      </div>
    );
  }

  const cities = (room.cities || []).join(", ");
  const experiences = messages.filter((m) => m.type === "experience");

  return (
    <div style={{ height: "100vh", display: "flex", background: C.white, fontFamily: "Inter, sans-serif" }}>
      <style>{keyframes}</style>

      {/* Main chat column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.greyLine}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: C.greyText, display: "flex", padding: 4 }} aria-label="Back to rooms">
              <ArrowLeft size={18} />
            </button>
            <RoomLogo name={room.name} logoUrl={room.logoUrl} slug={room.slug} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.black, lineHeight: 1.2 }}>
                {room.name}
                {selectedCity && (
                  <span style={{ fontSize: 12.5, color: C.greyText, marginLeft: 6 }}>
                    • {selectedCity}
                  </span>
                )}
              </div>
              {selectedCity && room.cities && room.cities.length > 1 && (
                <button
                  onClick={() => setShowCitySelector(true)}
                  style={{
                    fontSize: 11.5,
                    color: C.green700,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    marginTop: 2,
                    textDecoration: "underline",
                  }}
                >
                  Switch city
                </button>
              )}
              <div style={{ fontSize: 12, color: C.greyText, display: "flex", alignItems: "center", gap: 5, marginTop: selectedCity && room.cities && room.cities.length > 1 ? 2 : 0 }}>
                <span className="pd-live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: C.green500, display: "inline-block" }} />
                {activeMemberCount > 0 ? `${activeMemberCount} active now` : `${(room.memberCount || 0).toLocaleString()} members`}
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {messages.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: C.greyFaint, fontSize: 13.5, maxWidth: 320 }}>
              No messages yet. Be the first to ask a question or share how your interview went.
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = userIdsMatch(user, msg.sender);
              const isHighlighted = highlightedExpId === msg._id;
              return (
                <div 
                  key={msg._id} 
                  ref={(el) => (messageRefs.current[msg._id] = el)}
                  style={{
                    transition: "all 0.3s ease",
                    borderRadius: 12,
                    padding: isHighlighted ? "12px 14px" : 0,
                    background: isHighlighted ? C.green050 : "transparent",
                    border: isHighlighted ? `2px solid ${C.green500}` : "none"
                  }}
                >
                  {msg.type === "experience" ? (
                    <ExperienceMessage 
                      msg={msg} 
                      expanded={!!expanded[msg._id]} 
                      onToggle={() => setExpanded((p) => ({ ...p, [msg._id]: !p[msg._id] }))} 
                      isCurrentUser={isCurrentUser}
                    />
                  ) : (
                    <TextMessage msg={msg} isCurrentUser={isCurrentUser} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        {isAuthenticated ? (
          <form onSubmit={handleSend} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 24px", borderTop: `1px solid ${C.greyLine}`, flexShrink: 0 }}>
            <button type="button" onClick={() => setShowExperienceModal(true)} aria-label="Share your interview experience" title="Share your interview experience"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, color: C.green700, background: C.green100, border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
              <Plus size={16} />
            </button>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message the ${room.name} room…`}
              style={{ flex: 1, fontSize: 14.5, padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.greyLine}`, outline: "none", fontFamily: "Inter, sans-serif", background: C.green050 }} />
            <button type="submit" disabled={!draft.trim() || sending}
              style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: draft.trim() && !sending ? C.green700 : C.greyLine, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: draft.trim() && !sending ? "pointer" : "default", flexShrink: 0, transition: "background 0.15s ease" }} aria-label="Send message">
              {sending ? <Spinner size={15} color={C.white} /> : <Send size={16} />}
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 24px", borderTop: `1px solid ${C.greyLine}`, flexShrink: 0, background: C.green050 }}>
            <span style={{ fontSize: 13.5, color: C.greyText }}>Log in to post messages and share your experience.</span>
            <button onClick={() => navigate("/login", { state: { from: `/room/${slug}` } })}
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "9px 16px", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
              <LogIn size={15} /> Log in
            </button>
          </div>
        )}
      </div>

      {/* City Selector Modal */}
      {showCitySelector && room && (
        <CitySelector
          room={room}
          onClose={() => setShowCitySelector(false)}
          onCitySelect={(city) => {
            setShowCitySelector(false);
            navigate(`/room/${slug}?city=${encodeURIComponent(city)}`);
          }}
        />
      )}

      {/* Experience Modal */}
      {showExperienceModal && (
        <PostExperienceModal
          roomName={room?.name || "this"}
          onClose={() => setShowExperienceModal(false)}
          onSubmit={handlePostExperience}
          busy={postingExp}
        />
      )}

      {/* Sidebar */}
      <aside style={{ width: 260, flexShrink: 0, borderLeft: `1px solid ${C.greyLine}`, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }} className="max-lg:hidden">
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: C.greyFaint, marginBottom: 10 }}>About this room</div>
          <p style={{ fontSize: 13, color: C.greyText, lineHeight: 1.55, margin: 0 }}>
            For students interviewing at {room.name}{cities ? ` across ${cities}` : ""}. Share what you were asked, help others prep, and keep it kind.
          </p>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: C.greyFaint, marginBottom: 10 }}>
            <Pin size={12} />
            Experiences ({experiences.length})
          </div>

          {experiences.length === 0 ? (
            <p style={{ fontSize: 12.5, color: C.greyFaint, margin: 0 }}>No experiences shared yet.</p>
          ) : (
            experiences.map((exp) => {
              const isHighlighted = highlightedExpId === exp._id;
              const isCurrentUser = user && exp.sender && exp.sender._id === user._id;
              
              return (
                <button 
                  key={exp._id} 
                  onClick={() => {
                    setHighlightedExpId(exp._id);
                    scrollToMessage(exp._id);
                  }}
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: 6, 
                    width: "100%", 
                    textAlign: "left", 
                    fontSize: 12.5, 
                    background: isHighlighted ? C.green050 : C.white, 
                    border: `2px solid ${isHighlighted ? C.green500 : C.greyLine}`, 
                    borderRadius: 8, 
                    padding: 10, 
                    marginBottom: 8, 
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isHighlighted ? `0 0 0 3px ${C.green100}` : "none"
                  }}
                  onMouseEnter={(e) => {
                    if (!isHighlighted) {
                      e.currentTarget.style.background = C.green050;
                      e.currentTarget.style.borderColor = C.green300;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isHighlighted) {
                      e.currentTarget.style.background = C.white;
                      e.currentTarget.style.borderColor = C.greyLine;
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 600, color: C.black, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {exp.role}
                    </span>
                    <VerdictBadge verdict={exp.verdict} />
                  </div>
                  <span style={{ color: C.greyText, fontSize: 11 }}>
                    📍 {exp.city}
                  </span>
                  <span style={{ color: C.greyFaint, fontSize: 11, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {exp.summary}
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: C.greyFaint }}>
                    <span>
                      {Array.isArray(exp.rounds) && exp.rounds.length > 0 && `${exp.rounds.length} rounds`}
                    </span>
                    <span>
                      {isCurrentUser ? "You" : exp.sender?.name}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: C.greyFaint, marginBottom: 12 }}>
            <FileText size={12} />
            Tips
          </div>
          <p style={{ fontSize: 12.5, color: C.greyText, lineHeight: 1.55, margin: 0 }}>
            Be specific about rounds and topics — the more concrete, the more it helps the next candidate.
          </p>
        </div>
      </aside>

      {showExperienceModal && (
        <PostExperienceModal roomName={room.name} onClose={() => setShowExperienceModal(false)} onSubmit={handlePostExperience} busy={postingExp} />
      )}
    </div>
  );
}
