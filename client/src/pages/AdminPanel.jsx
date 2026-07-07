import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, MessageSquareText, Users, Flag, Settings,
  Search, Bell, Check, X, Trash2, Plus, ExternalLink, LogOut, Inbox, Mail, Globe, Image,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { Spinner, InlineError, Skeleton } from "../components/ui/Loaders";
import { C, initials, timeAgo } from "../theme";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "rooms", label: "Company Rooms", icon: Building2 },
  { key: "experiences", label: "Interview Experiences", icon: MessageSquareText },
  { key: "feedback", label: "Feedback & Suggestions", icon: Inbox },
  { key: "users", label: "Users", icon: Users },
  { key: "reports", label: "Reports", icon: Flag },
  { key: "settings", label: "Settings", icon: Settings },
];

const SECTION_META = {
  dashboard: { title: "Dashboard" },
  rooms: { title: "Company rooms" },
  experiences: { title: "Interview experiences" },
  feedback: { title: "Feedback & suggestions" },
  users: { title: "Users" },
  reports: { title: "Reports" },
  settings: { title: "Settings" },
};

/* ---------- small shared UI ---------- */

function Badge({ tone = "green", children }) {
  const palette = {
    green: { bg: C.green100, text: C.green700 },
    red: { bg: C.red100, text: C.red700 },
    grey: { bg: C.greyLine, text: C.greyText },
  }[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: palette.bg, color: palette.text, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function IconButton({ icon: Icon, tone = "grey", onClick, label, disabled, busy }) {
  const tones = {
    green: { text: C.green700, hoverBg: C.green100 },
    red: { text: C.red700, hoverBg: C.red100 },
    grey: { text: C.greyText, hoverBg: C.greyLine },
  }[tone];
  const [hover, setHover] = useState(false);
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled || busy}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 30, height: 30, borderRadius: 7, border: "none", background: hover && !disabled ? tones.hoverBg : "transparent", color: tones.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled || busy ? "default" : "pointer", opacity: disabled ? 0.4 : 1, transition: "background 0.15s ease" }}>
      {busy ? <Spinner size={14} color={tones.text} /> : <Icon size={15} />}
    </button>
  );
}

function Card({ children, style }) {
  return <div style={{ background: C.white, border: `1px solid ${C.greyLine}`, borderRadius: 12, ...style }}>{children}</div>;
}

function PageIntro({ description, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
      <p style={{ margin: 0, fontSize: 13.5, color: C.greyText, maxWidth: 560 }}>{description}</p>
      {action}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 22, margin: "0 0 4px", color: C.black }}>{title}</h2>
      {description && <p style={{ margin: 0, fontSize: 13.5, color: C.greyText }}>{description}</p>}
    </div>
  );
}

function PrimaryButton({ children, icon: Icon, onClick, busy }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} disabled={busy} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: C.white, background: hover ? C.green900 : C.green700, border: "none", padding: "9px 16px", borderRadius: 8, cursor: busy ? "default" : "pointer", transition: "background 0.15s ease", whiteSpace: "nowrap" }}>
      {busy ? <Spinner size={14} color={C.white} /> : Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function Tr({ children }) {
  const [hover, setHover] = useState(false);
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ background: hover ? C.green050 : "transparent", transition: "background 0.1s ease" }}>
      {children}
    </tr>
  );
}
function Th({ children, align = "left" }) {
  return <th style={{ textAlign: align, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: C.greyFaint, padding: "0 16px 12px", borderBottom: `1px solid ${C.greyLine}` }}>{children}</th>;
}
function Td({ children, align = "left", style }) {
  return <td style={{ textAlign: align, fontSize: 13.5, color: C.black, padding: "14px 16px", borderBottom: `1px solid ${C.greyLine}`, ...style }}>{children}</td>;
}

function TableWrap({ children }) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>{children}</table>
      </div>
    </Card>
  );
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "36px 16px", textAlign: "center", fontSize: 13.5, color: C.greyFaint }}>{children}</td>
    </tr>
  );
}

function LoadingRows({ cols, rows = 4 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.greyLine}` }}>
          <Skeleton width={c === 0 ? "70%" : "50%"} height={12} />
        </td>
      ))}
    </tr>
  ));
}

function verdictTone(v) {
  return v === "Selected" ? "green" : v === "Rejected" ? "red" : "grey";
}

/* ---------- Dashboard ---------- */

function StatCard({ label, value, delta, icon: Icon, loading }) {
  return (
    <Card style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: C.greyText }}>{label}</div>
        {Icon && (
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.green100, color: C.green700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={15} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 28, color: C.black, marginBottom: 6 }}>
        {loading ? <Skeleton width={48} height={26} /> : value}
      </div>
      <div style={{ fontSize: 11.5, color: C.green700, fontWeight: 600 }}>{delta}</div>
    </Card>
  );
}

function PendingTable({ rows, loading, error, onReload, onModerate, busyId }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Student</Th><Th>Company</Th><Th>City</Th><Th>Verdict</Th><Th>Submitted</Th><Th align="right">Action</Th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <LoadingRows cols={6} />
        ) : error ? (
          <EmptyRow colSpan={6}><InlineError onRetry={onReload}>Couldn't load the moderation queue.</InlineError></EmptyRow>
        ) : rows.length === 0 ? (
          <EmptyRow colSpan={6}>Nothing waiting for review — you're all caught up.</EmptyRow>
        ) : (
          rows.map((row) => (
            <Tr key={row._id}>
              <Td>{row.sender?.name || "—"}</Td>
              <Td>{row.room?.name || "—"}</Td>
              <Td>{row.city}</Td>
              <Td><Badge tone={verdictTone(row.verdict)}>{row.verdict}</Badge></Td>
              <Td style={{ color: C.greyText }}>{timeAgo(row.createdAt)}</Td>
              <Td align="right">
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <IconButton icon={Check} tone="green" label="Approve" busy={busyId === row._id} onClick={() => onModerate(row._id, "Approved")} />
                  <IconButton icon={X} tone="red" label="Reject" busy={busyId === row._id} onClick={() => onModerate(row._id, "Rejected")} />
                </div>
              </Td>
            </Tr>
          ))
        )}
      </tbody>
    </TableWrap>
  );
}

function usePending() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setState("loading");
    try {
      setRows(await api.pendingExperiences());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moderate = useCallback(async (id, status) => {
    setBusyId(id);
    try {
      await api.moderate(id, status);
      setRows((prev) => prev.filter((r) => r._id !== id));
      toast.success(status === "Approved" ? "Experience approved and published." : "Experience rejected.");
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }, [toast]);

  return { rows, state, busyId, load, moderate };
}

function DashboardView() {
  const pending = usePending();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [rooms, feedback, users, pend] = await Promise.all([
          api.listAllRooms().catch(() => []),
          api.listFeedback("New").catch(() => []),
          api.listUsers().catch(() => []),
          api.pendingExperiences().catch(() => []),
        ]);
        setStats({
          rooms: rooms.length,
          activeRooms: rooms.filter((r) => r.status === "Active").length,
          feedback: feedback.length,
          users: users.length,
          pending: pend.length,
        });
      } catch {
        setStats({});
      }
    })();
  }, []);

  const cards = [
    { label: "Total students", value: stats?.users ?? 0, delta: "Registered accounts", icon: Users },
    { label: "Active rooms", value: stats?.activeRooms ?? 0, delta: `${stats?.rooms ?? 0} total`, icon: Building2 },
    { label: "Pending approvals", value: stats?.pending ?? 0, delta: "Needs review", icon: MessageSquareText },
    { label: "New feedback", value: stats?.feedback ?? 0, delta: "In the inbox", icon: Inbox },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14, marginBottom: 32 }}>
        {cards.map((s) => <StatCard key={s.label} {...s} loading={!stats} />)}
      </div>
      <SectionHeader title="Pending interview experiences" description="New submissions waiting for moderation before they go live in rooms." />
      <div style={{ marginBottom: 32 }}>
        <PendingTable rows={pending.rows} loading={pending.state === "loading"} error={pending.state === "error"} onReload={pending.load} onModerate={pending.moderate} busyId={pending.busyId} />
      </div>
    </>
  );
}

/* ---------- Rooms ---------- */

const modalInputStyle = {
  fontSize: 14, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.greyLine}`,
  outline: "none", fontFamily: "Inter, sans-serif", width: "100%", boxSizing: "border-box",
};

function AddRoomModal({ onClose, onSubmit, busy }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [cities, setCities] = useState("");
  const [status, setStatus] = useState("Active");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !cities.trim()) return;
    onSubmit({ name: name.trim(), domain: domain.trim(), cities: cities.trim(), status });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,20,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.greyLine}`, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.greyLine}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.green100, color: C.green700, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={16} />
            </div>
            <h3 style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 17, margin: 0, color: C.black }}>Add a company room</h3>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: C.greyText, padding: 4 }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Company name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zoho" style={modalInputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Website domain (for the logo)</span>
            <div style={{ position: "relative" }}>
              <Globe size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.greyFaint }} />
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="zoho.com" style={{ ...modalInputStyle, paddingLeft: 32 }} />
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black }}>Cities</span>
            <input required value={cities} onChange={(e) => setCities(e.target.value)} placeholder="e.g. Chennai, Pune" style={modalInputStyle} />
            <span style={{ fontSize: 11.5, color: C.greyFaint }}>Separate multiple cities with commas.</span>
          </label>
          {/* Logo upload removed: uploads are stored privately and not shown in UI */}
          <div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.black, display: "block", marginBottom: 8 }}>Status</span>
            <div style={{ display: "flex", gap: 8 }}>
              {["Active", "Hidden"].map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "9px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${status === s ? C.green700 : C.greyLine}`, background: status === s ? C.green100 : C.white, color: status === s ? C.green700 : C.greyText, transition: "all 0.15s ease" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600, color: C.white, background: C.green700, border: "none", padding: "11px 18px", borderRadius: 8, cursor: busy ? "default" : "pointer", marginTop: 4, opacity: busy ? 0.8 : 1 }}>
            {busy && <Spinner size={15} color={C.white} />}
            Create room
          </button>
        </form>
      </div>
    </div>
  );
}

function RoomsView() {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [state, setState] = useState("loading");
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      try {
        setRooms(await api.listAllRooms());
      } catch (err) {
        // If we're not authenticated/authorized, fall back to the public rooms list
        if (err.status === 401 || err.status === 403) {
          const publicRooms = await api.listRooms().catch(() => []);
          setRooms(publicRooms);
        } else throw err;
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleAddRoom(payload) {
    setAdding(true);
    try {
      const room = await api.createRoom(payload);
      setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddModal(false);
      toast.success(`${room.name} room created.`);
    } catch (err) {
      toast.error(err.message || "Couldn't create room");
    } finally {
      setAdding(false);
    }
  }

  async function toggleStatus(room) {
    setBusyId(room._id);
    const next = room.status === "Active" ? "Hidden" : "Active";
    try {
      const updated = await api.updateRoom(room._id, { status: next });
      setRooms((prev) => prev.map((r) => (r._id === room._id ? updated : r)));
    } catch (err) {
      toast.error(err.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(room) {
    if (!window.confirm(`Delete the ${room.name} room? This can't be undone.`)) return;
    setBusyId(room._id);
    try {
      await api.deleteRoom(room._id);
      setRooms((prev) => prev.filter((r) => r._id !== room._id));
      toast.success(`${room.name} room deleted.`);
    } catch (err) {
      toast.error(err.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  function handleUploadClick(room) {
    const input = document.getElementById(`logo-input-${room._id}`);
    if (input) input.click();
  }

  async function handleLogoSelected(e, room) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    try {
      await api.uploadRoomLogo(room._id, fd);
      // Uploaded and attached privately on the server (logoVisible=false). Do not display until published.
      toast.success('Logo uploaded privately. Publish to make it public.');
    } catch (err) {
      toast.error(err.message || 'Logo upload failed');
    } finally {
      // clear file input
      e.target.value = '';
    }
  }

  async function publishLogo(room) {
    setBusyId(room._id);
    try {
      const updated = await api.publishRoomLogo(room._id, true);
      setRooms((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      toast.success('Logo published. It will appear on the landing page.');
    } catch (err) {
      toast.error(err.message || 'Publish failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageIntro description="Manage which company rooms students can join and post in."
        action={<PrimaryButton icon={Plus} onClick={() => setShowAddModal(true)}>Add room</PrimaryButton>} />
      <TableWrap>
        <thead>
          <tr><Th>Company</Th><Th>Cities</Th><Th>Members</Th><Th>Status</Th><Th align="right">Action</Th></tr>
        </thead>
        <tbody>
          {state === "loading" ? (
            <LoadingRows cols={5} />
          ) : state === "error" ? (
            <EmptyRow colSpan={5}><InlineError onRetry={load}>Couldn't load rooms.</InlineError></EmptyRow>
          ) : rooms.length === 0 ? (
            <EmptyRow colSpan={5}>No rooms yet. Add your first company room.</EmptyRow>
          ) : (
            rooms.map((r) => (
              <Tr key={r._id}>
                <Td><span style={{ fontWeight: 600 }}>{r.name}</span></Td>
                <Td style={{ color: C.greyText }}>{(r.cities || []).join(", ")}</Td>
                <Td>{(r.memberCount || 0).toLocaleString()}</Td>
                <Td>
                  <button onClick={() => toggleStatus(r)} disabled={busyId === r._id} title="Toggle visibility"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <Badge tone={r.status === "Active" ? "green" : "grey"}>{r.status}</Badge>
                  </button>
                </Td>
                <Td align="right">
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <IconButton icon={ExternalLink} label="Open room" onClick={() => window.open(`/room/${r.slug}`, "_blank")} />
                    <IconButton icon={Image} label="Upload logo" onClick={() => handleUploadClick(r)} />
                    {r.logoUrl && !r.logoVisible && (
                      <IconButton icon={Check} tone="green" label="Publish logo" onClick={() => publishLogo(r)} busy={busyId === r._id} />
                    )}
                    <input id={`logo-input-${r._id}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleLogoSelected(e, r)} />
                    <IconButton icon={Trash2} tone="red" label="Delete" busy={busyId === r._id} onClick={() => remove(r)} />
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </TableWrap>
      {showAddModal && <AddRoomModal onClose={() => setShowAddModal(false)} onSubmit={handleAddRoom} busy={adding} />}
    </>
  );
}

/* ---------- Experiences ---------- */

function ExperiencesView() {
  const pending = usePending();
  return (
    <>
      <PageIntro description="Review submissions before they appear publicly in their company room." />
      <PendingTable rows={pending.rows} loading={pending.state === "loading"} error={pending.state === "error"} onReload={pending.load} onModerate={pending.moderate} busyId={pending.busyId} />
    </>
  );
}

/* ---------- Users ---------- */

function UsersView() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [state, setState] = useState("loading");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setUsers(await api.listUsers());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleBan(u) {
    setBusyId(u._id);
    const next = u.status === "active" ? "banned" : "active";
    try {
      const updated = await api.updateUser(u._id, { status: next });
      setUsers((prev) => prev.map((x) => (x._id === u._id ? updated : x)));
      toast.success(next === "banned" ? `${u.name} banned.` : `${u.name} reinstated.`);
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageIntro description="Everyone with a PlacementDesk account." />
      <TableWrap>
        <thead>
          <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Joined</Th><Th>Status</Th><Th align="right">Action</Th></tr>
        </thead>
        <tbody>
          {state === "loading" ? (
            <LoadingRows cols={6} />
          ) : state === "error" ? (
            <EmptyRow colSpan={6}><InlineError onRetry={load}>Couldn't load users.</InlineError></EmptyRow>
          ) : users.length === 0 ? (
            <EmptyRow colSpan={6}>No users yet.</EmptyRow>
          ) : (
            users.map((u) => (
              <Tr key={u._id}>
                <Td style={{ fontWeight: 600 }}>{u.name}</Td>
                <Td style={{ color: C.greyText }}>{u.email}</Td>
                <Td><Badge tone={u.role === "admin" ? "green" : "grey"}>{u.role}</Badge></Td>
                <Td style={{ color: C.greyText }}>{timeAgo(u.createdAt)}</Td>
                <Td><Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge></Td>
                <Td align="right">
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <IconButton icon={u.status === "active" ? X : Check} tone={u.status === "active" ? "red" : "green"} label={u.status === "active" ? "Ban" : "Reinstate"} busy={busyId === u._id} onClick={() => toggleBan(u)} />
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </TableWrap>
    </>
  );
}

/* ---------- Feedback ---------- */

function FeedbackTypeBadge({ type }) {
  const tone = type === "Company suggestion" ? "green" : type === "Bug report" ? "red" : "grey";
  return <Badge tone={tone}>{type}</Badge>;
}

function FeedbackView() {
  const toast = useToast();
  const [filter, setFilter] = useState("New");
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [busyId, setBusyId] = useState(null);
  const filters = ["New", "In progress", "Resolved", "All"];

  const load = useCallback(async () => {
    setState("loading");
    try {
      setItems(await api.listFeedback(filter));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id, status) {
    setBusyId(id);
    try {
      await api.updateFeedback(id, status);
      // re-fetch so it drops out of a filtered view correctly
      setItems((prev) =>
        filter === "All" ? prev.map((i) => (i._id === id ? { ...i, status } : i)) : prev.filter((i) => i._id !== id)
      );
      toast.success("Updated.");
    } catch (err) {
      toast.error(err.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageIntro description="Company requests, bug reports, and general inquiries submitted from the landing page." />
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.green700 : C.greyLine}`, background: filter === f ? C.green100 : C.white, color: filter === f ? C.green700 : C.greyText, cursor: "pointer", transition: "all 0.15s ease" }}>
            {f}
          </button>
        ))}
      </div>

      {state === "loading" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} style={{ padding: 18 }}><Skeleton width="40%" height={13} /><Skeleton width="90%" height={11} style={{ marginTop: 12 }} /></Card>
          ))}
        </div>
      ) : state === "error" ? (
        <InlineError onRetry={load}>Couldn't load feedback.</InlineError>
      ) : items.length === 0 ? (
        <Card style={{ padding: "48px 20px", textAlign: "center", fontSize: 13.5, color: C.greyText, border: `1px dashed ${C.greyLine}` }}>
          Nothing here right now.
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <Card key={item._id} style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.black, color: C.white, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {initials(item.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                    {item.email && (
                      <div style={{ fontSize: 12, color: C.greyText, display: "flex", alignItems: "center", gap: 5 }}>
                        <Mail size={11} />{item.email}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <FeedbackTypeBadge type={item.type} />
                  <Badge tone={item.status === "Resolved" ? "green" : item.status === "In progress" ? "grey" : "red"}>{item.status}</Badge>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: C.black, lineHeight: 1.55, margin: "0 0 14px", paddingLeft: 42 }}>{item.message}</p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 42, gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.greyFaint }}>{timeAgo(item.createdAt)}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {item.status !== "Resolved" ? (
                    <>
                      {item.status !== "In progress" && (
                        <button onClick={() => setStatus(item._id, "In progress")} disabled={busyId === item._id}
                          style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.greyLine}`, background: C.white, color: C.greyText, cursor: "pointer" }}>
                          Mark in progress
                        </button>
                      )}
                      <button onClick={() => setStatus(item._id, "Resolved")} disabled={busyId === item._id}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "none", background: C.green700, color: C.white, cursor: "pointer" }}>
                        {busyId === item._id && <Spinner size={13} color={C.white} />}
                        {item.type === "Company suggestion" ? "Mark room added" : "Mark resolved"}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setStatus(item._id, "New")} disabled={busyId === item._id}
                      style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.greyLine}`, background: C.white, color: C.greyText, cursor: "pointer" }}>
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Reports (placeholder — no backend model yet) ---------- */

function ReportsView() {
  return (
    <>
      <PageIntro description="Content flagged by students for review." />
      <Card style={{ padding: "48px 20px", textAlign: "center", border: `1px dashed ${C.greyLine}` }}>
        <Flag size={22} style={{ color: C.greyFaint, marginBottom: 10 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 4 }}>No open reports</div>
        <p style={{ fontSize: 13, color: C.greyText, margin: 0 }}>Flagged content will appear here once reporting is enabled.</p>
      </Card>
    </>
  );
}

/* ---------- Settings ---------- */

function ToggleSwitch({ defaultOn = true }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(!on)} style={{ width: 40, height: 22, borderRadius: 20, border: "none", background: on ? C.green700 : C.greyLine, position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s ease" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: C.white, transition: "left 0.15s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function SettingsView() {
  return (
    <>
      <PageIntro description="Platform-wide preferences for PlacementDesk." />
      <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
        {[
          { label: "Require college email for signup", desc: "New accounts must verify with a .edu or campus domain email." },
          { label: "Auto-approve experiences from verified students", desc: "Skip manual review for accounts with 5+ approved posts." },
          { label: "Allow anonymous posting", desc: "Students can hide their name on interview experience posts." },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 12.5, color: C.greyText }}>{s.desc}</div>
            </div>
            <ToggleSwitch />
          </div>
        ))}
        <p style={{ fontSize: 11.5, color: C.greyFaint, margin: 0 }}>These toggles are illustrative and aren't persisted yet.</p>
      </Card>
    </>
  );
}

/* ---------- Shell ---------- */

export default function AdminPanel() {
  const [active, setActive] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const views = {
    dashboard: <DashboardView />,
    rooms: <RoomsView />,
    experiences: <ExperiencesView />,
    feedback: <FeedbackView />,
    users: <UsersView />,
    reports: <ReportsView />,
    settings: <SettingsView />,
  };

  const Sidebar = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 17, padding: "0 8px", marginBottom: 28 }}>
        <span style={{ width: 26, height: 26, borderRadius: 6, background: C.green700, color: C.white, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>P</span>
        PlacementDesk
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => { setActive(item.key); setMobileNav(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, padding: "9px 10px", borderRadius: 7, border: "none", background: isActive ? C.green100 : "transparent", color: isActive ? C.green700 : C.greyText, cursor: "pointer", textAlign: "left", transition: "background 0.15s ease, color 0.15s ease" }}>
              <Icon size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${C.greyLine}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 12px" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.black, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
            {initials(user?.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "Admin"}</div>
            <div style={{ fontSize: 11.5, color: C.greyText }}>Admin</div>
          </div>
        </div>
        <button onClick={() => { logout(); navigate("/"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.greyText, background: "none", border: "none", cursor: "pointer", padding: "8px 8px" }}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.green050, fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes pd-spin { to { transform: rotate(360deg); } }
        @keyframes pd-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        table tr:last-child td { border-bottom: none; }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="max-md:hidden" style={{ width: 240, flexShrink: 0, background: C.white, borderRight: `1px solid ${C.greyLine}`, display: "flex", flexDirection: "column", padding: "22px 14px", position: "sticky", top: 0, height: "100vh" }}>
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileNav && (
        <div onClick={() => setMobileNav(false)} style={{ position: "fixed", inset: 0, background: "rgba(17,20,18,0.45)", zIndex: 60 }} className="md:hidden">
          <aside onClick={(e) => e.stopPropagation()} style={{ width: 240, height: "100%", background: C.white, display: "flex", flexDirection: "column", padding: "22px 14px" }}>
            {Sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, background: C.green050 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: C.white, borderBottom: `1px solid ${C.greyLine}`, position: "sticky", top: 0, zIndex: 10, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button className="md:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu"
              style={{ background: "none", border: "none", cursor: "pointer", color: C.black, display: "flex", padding: 4 }}>
              <LayoutDashboard size={20} />
            </button>
            <div>
              <div style={{ fontSize: 11.5, color: C.greyFaint, marginBottom: 3, letterSpacing: "0.02em" }}>ADMIN</div>
              <div style={{ fontFamily: "Newsreader, serif", fontWeight: 600, fontSize: 19, color: C.black }}>{SECTION_META[active]?.title}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="max-sm:hidden" style={{ display: "flex", alignItems: "center", gap: 8, background: C.green050, border: `1px solid ${C.greyLine}`, borderRadius: 8, padding: "7px 12px", width: 220 }}>
              <Search size={14} color={C.greyFaint} />
              <input placeholder="Search…" style={{ border: "none", outline: "none", background: "none", fontSize: 13, flex: 1, color: C.black }} />
            </div>
            <IconButton icon={Bell} label="Notifications" />
          </div>
        </header>

        <div style={{ padding: 32, maxWidth: 1180 }} className="max-sm:p-5">{views[active]}</div>
      </main>
    </div>
  );
}
