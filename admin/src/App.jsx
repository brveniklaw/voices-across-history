import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0D1117", bgCard: "#161B22", bgHover: "#1C2128",
  border: "#30363D", borderFaint: "#21262D",
  text: "#E6EDF3", textMuted: "#8B949E", textFaint: "#484F58",
  gold: "#B8892A", goldLt: "#D4A84B",
  blue: "#58A6FF", green: "#3FB950", red: "#F85149", orange: "#D29922",
  pill: (color) => ({ background: `${color}22`, color, border: `1px solid ${color}55`, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }),
};

// ── API HELPER ────────────────────────────────────────────────────────────────
function useApi() {
  const token = sessionStorage.getItem("vah_admin_token");
  return async (path, opts = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
    });
    if (res.status === 401) { sessionStorage.removeItem("vah_admin_token"); window.location.reload(); }
    return res.json();
  };
}

// ── CSV EXPORT ────────────────────────────────────────────────────────────────
function exportCSV(data, filename) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

// ── BADGE ─────────────────────────────────────────────────────────────────────
function AccessBadge({ type }) {
  const map = { subscribed: T.green, trial: T.blue, promo_trial: T.blue, permanent: T.gold, cancelled: T.red };
  return <span style={T.pill(map[type] || T.textMuted)}>{type || "—"}</span>;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(() => !!sessionStorage.getItem("vah_admin_token"));
  const [view, setView] = useState("subscribers");
  const [unreadCount, setUnreadCount] = useState(0);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      <Sidebar view={view} setView={setView} unreadCount={unreadCount} />
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {view === "subscribers"  && <SubscribersView />}
        {view === "promos"       && <PromosView />}
        {view === "messages"     && <MessagesView setUnreadCount={setUnreadCount} />}
        {view === "feedback"     && <FeedbackView />}
        {view === "health"       && <HealthView />}
      </main>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const data = await res.json();
      if (data.token) { sessionStorage.setItem("vah_admin_token", data.token); onLogin(); }
      else setError(data.error || "Invalid password.");
    } catch { setError("Unable to connect. Please try again."); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ width: 360, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "2.5rem", textAlign: "center" }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.3em", color: T.gold, marginBottom: "1rem", textTransform: "uppercase" }}>IntexiaU Admin</div>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: "1.4rem", fontWeight: 700, color: T.text, marginBottom: "0.3rem" }}>Voices Across History™</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: "2rem" }}>Admin Dashboard</p>
        <form onSubmit={submit}>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Admin password" autoFocus
            style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 15, padding: "0.7rem 1rem", outline: "none", marginBottom: "0.8rem", fontFamily: "'Inter',sans-serif" }} />
          {error && <p style={{ color: T.red, fontSize: 13, marginBottom: "0.7rem" }}>{error}</p>}
          <button type="submit" disabled={loading || !pw}
            style={{ width: "100%", background: `linear-gradient(135deg,${T.gold},#8B6820)`, color: "#fff", border: "none", borderRadius: 8, padding: "0.75rem", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, unreadCount }) {
  const [collapsed, setCollapsed] = useState(window.innerWidth < 900);
  const items = [
    { id: "subscribers", label: "Subscribers",    icon: "👥" },
    { id: "promos",      label: "Promo Codes",    icon: "🎫" },
    { id: "messages",    label: "Messages",       icon: "✉️", badge: unreadCount },
    { id: "feedback",    label: "Feedback",       icon: "⭐" },
    { id: "health",      label: "Platform Health",icon: "🩺" },
  ];
  return (
    <aside style={{ width: collapsed ? 56 : 220, background: "#0A0F16", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s" }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "1rem 0.6rem" : "1.2rem 1.2rem 0.8rem", borderBottom: `1px solid ${T.borderFaint}` }}>
        {!collapsed && <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.25em", color: T.gold, textTransform: "uppercase" }}>VAH Admin</div>}
        {collapsed && <div style={{ textAlign: "center", fontSize: "1rem" }}>🏛️</div>}
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.5rem 0" }}>
        {items.map(item => (
          <button key={item.id} onClick={() => setView(item.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.7rem", padding: collapsed ? "0.8rem 0" : "0.7rem 1.2rem", background: view === item.id ? T.bgHover : "transparent", border: "none", cursor: "pointer", color: view === item.id ? T.text : T.textMuted, fontSize: 14, fontFamily: "'Inter',sans-serif", justifyContent: collapsed ? "center" : "flex-start", position: "relative", transition: "background 0.15s, color 0.15s", borderLeft: view === item.id ? `2px solid ${T.gold}` : "2px solid transparent" }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {item.badge > 0 && (
              <span style={{ position: collapsed ? "absolute" : "static", top: 6, right: 8, background: T.red, color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 5px", marginLeft: "auto" }}>{item.badge}</span>
            )}
          </button>
        ))}
      </nav>
      {/* Footer */}
      <div style={{ padding: "0.8rem", borderTop: `1px solid ${T.borderFaint}` }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18, textAlign: "center" }}>
          {collapsed ? "→" : "←"}
        </button>
        <button onClick={() => { sessionStorage.removeItem("vah_admin_token"); window.location.reload(); }}
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: 11, fontFamily: "'Inter',sans-serif", marginTop: "0.3rem", padding: "0.3rem 0" }}>
          {!collapsed ? "Sign out" : ""}
        </button>
      </div>
    </aside>
  );
}

// ── VIEW HEADER ───────────────────────────────────────────────────────────────
function ViewHeader({ title, subtitle, action }) {
  return (
    <div style={{ padding: "1.5rem 2rem 1rem", borderBottom: `1px solid ${T.borderFaint}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: T.text, marginBottom: 2 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: T.textMuted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1.2rem 1.5rem" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || T.text, marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted }}>{sub}</div>}
    </div>
  );
}

// ── SUBSCRIBERS VIEW ──────────────────────────────────────────────────────────
function SubscribersView() {
  const apiFetch = useApi();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => { apiFetch("/api/users").then(d => { setUsers(d.users || []); setLoading(false); }); }, []);

  const filtered = filter === "all" ? users : users.filter(u => {
    if (filter === "active") return u.access_type === "subscribed";
    if (filter === "trial") return u.access_type === "trial";
    if (filter === "promo") return u.access_type === "promo_trial" || u.access_type === "permanent";
    if (filter === "cancelled") return u.subscription_end && new Date(u.subscription_end) < new Date();
    return true;
  });

  const activeCount = users.filter(u => u.access_type === "subscribed").length;
  const mrr = (activeCount * 9.99).toFixed(2);

  return (
    <div>
      <ViewHeader
        title="Subscribers"
        subtitle="All platform users and their access status"
        action={<button onClick={() => exportCSV(filtered, "vah-subscribers.csv")} style={btnStyle}>Export CSV</button>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem", padding: "1.5rem 2rem 1rem" }}>
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Active Subscribers" value={activeCount} color={T.green} />
        <StatCard label="Monthly Revenue" value={`$${mrr}`} color={T.goldLt} sub="MRR estimate" />
        <StatCard label="On Trial" value={users.filter(u => u.access_type === "trial" || u.access_type === "promo_trial").length} color={T.blue} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", padding: "0 2rem 1rem", flexWrap: "wrap" }}>
        {["all","active","trial","promo","cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...filterBtnStyle, background: filter === f ? T.gold : "transparent", color: filter === f ? "#000" : T.textMuted, borderColor: filter === f ? T.gold : T.border }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 2rem 2rem", overflow: "auto" }}>
        {loading ? <Loading /> : filtered.length === 0 ? <Empty msg="No users yet." /> : (
          <table style={tableStyle}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Email","Access","Subscribed","Trial Expires","Stripe ID"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={i} onClick={() => setSelected(u)} style={{ ...trStyle, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}><AccessBadge type={u.access_type} /></td>
                  <td style={tdStyle}><Dt val={u.subscribed_at} /></td>
                  <td style={tdStyle}><Dt val={u.trial_expires_at} /></td>
                  <td style={{ ...tdStyle, color: T.textFaint, fontSize: 11 }}>{u.stripe_customer_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)} title={selected.email}>
          <Row label="Access Type"><AccessBadge type={selected.access_type} /></Row>
          <Row label="Subscribed At"><Dt val={selected.subscribed_at} /></Row>
          <Row label="Subscription End"><Dt val={selected.subscription_end} /></Row>
          <Row label="Trial Expires"><Dt val={selected.trial_expires_at} /></Row>
          <Row label="Promo Code Used">{selected.promo_code_used || "—"}</Row>
          <Row label="Stripe Customer">{selected.stripe_customer_id || "—"}</Row>
          <Row label="Stripe Subscription">{selected.stripe_subscription_id || "—"}</Row>
          <Row label="Created"><Dt val={selected.created_at} /></Row>
          <Row label="Last Seen"><Dt val={selected.last_seen_at} /></Row>
        </Modal>
      )}
    </div>
  );
}

// ── PROMO CODES VIEW ──────────────────────────────────────────────────────────
function PromosView() {
  const apiFetch = useApi();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", type: "trial_7day", maxUses: "1", unlimited: false, expiresAt: "", never: true, note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = () => apiFetch("/api/promos").then(d => { setPromos(d.promos || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  async function createPromo(e) {
    e.preventDefault();
    if (!form.code.trim()) { setFormError("Code is required."); return; }
    setSaving(true); setFormError("");
    const body = {
      code: form.code.toUpperCase().trim(),
      type: form.type,
      max_uses: form.unlimited ? null : parseInt(form.maxUses) || 1,
      expires_at: form.never ? null : form.expiresAt || null,
      note: form.note.trim()
    };
    const data = await apiFetch("/api/promos", { method: "POST", body: JSON.stringify(body) });
    if (data.success) { setShowForm(false); setForm({ code: "", type: "trial_7day", maxUses: "1", unlimited: false, expiresAt: "", never: true, note: "" }); load(); }
    else setFormError(data.error || "Error creating code.");
    setSaving(false);
  }

  async function toggleActive(promo) {
    await apiFetch("/api/promos", { method: "PATCH", body: JSON.stringify({ id: promo.id, is_active: !promo.is_active }) });
    load();
  }

  async function deletePromo(promo) {
    if (!confirm(`Delete code ${promo.code}?`)) return;
    await apiFetch("/api/promos", { method: "DELETE", body: JSON.stringify({ id: promo.id }) });
    load();
  }

  return (
    <div>
      <ViewHeader
        title="Promo Codes"
        subtitle="Create and manage access codes for the platform"
        action={<button onClick={() => setShowForm(!showForm)} style={btnStyle}>{showForm ? "Cancel" : "+ New Code"}</button>}
      />

      {showForm && (
        <form onSubmit={createPromo} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, margin: "1rem 2rem", padding: "1.5rem" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: "1.2rem", color: T.text }}>Create New Promo Code</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>
            <Field label="Code *">
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="VAH-XXXX-XXXX" style={inputStyle} />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                <option value="trial_7day">7-Day Trial</option>
                <option value="permanent">Permanent Access</option>
              </select>
            </Field>
            <Field label="Max Uses">
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="number" min="1" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} disabled={form.unlimited} style={{ ...inputStyle, width: 80 }} />
                <label style={{ fontSize: 13, color: T.textMuted, display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.unlimited} onChange={e => setForm(p => ({ ...p, unlimited: e.target.checked }))} />
                  Unlimited
                </label>
              </div>
            </Field>
            <Field label="Expiry Date">
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} disabled={form.never} style={{ ...inputStyle, flex: 1 }} />
                <label style={{ fontSize: 13, color: T.textMuted, display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.never} onChange={e => setForm(p => ({ ...p, never: e.target.checked }))} />
                  Never
                </label>
              </div>
            </Field>
            <Field label="Note" style={{ gridColumn: "1 / -1" }}>
              <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Internal memo (optional)" style={inputStyle} />
            </Field>
          </div>
          {formError && <p style={{ color: T.red, fontSize: 13, marginTop: "0.8rem" }}>{formError}</p>}
          <div style={{ marginTop: "1.2rem", display: "flex", gap: "0.5rem" }}>
            <button type="submit" disabled={saving} style={btnStyle}>{saving ? "Creating…" : "Create Code"}</button>
            <button type="button" onClick={() => setShowForm(false)} style={ghostBtnStyle}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ padding: "0.5rem 2rem 2rem", overflow: "auto" }}>
        {loading ? <Loading /> : promos.length === 0 ? <Empty msg="No promo codes yet. Create your first one above." /> : (
          <table style={tableStyle}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Code","Type","Uses","Expires","Active","Note","Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {promos.map((p, i) => (
                <tr key={i} style={trStyle}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 600, color: T.goldLt }}>{p.code}</td>
                  <td style={tdStyle}><span style={T.pill(p.type === "permanent" ? T.gold : T.blue)}>{p.type === "permanent" ? "Permanent" : "7-Day Trial"}</span></td>
                  <td style={tdStyle}>{p.uses_count} / {p.max_uses ?? "∞"}</td>
                  <td style={tdStyle}><Dt val={p.expires_at} fallback="Never" /></td>
                  <td style={tdStyle}><span style={T.pill(p.is_active ? T.green : T.red)}>{p.is_active ? "Active" : "Inactive"}</span></td>
                  <td style={{ ...tdStyle, color: T.textMuted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note || "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button onClick={() => toggleActive(p)} style={{ ...ghostBtnStyle, fontSize: 11, padding: "3px 8px" }}>{p.is_active ? "Disable" : "Enable"}</button>
                      <button onClick={() => deletePromo(p)} style={{ ...ghostBtnStyle, fontSize: 11, padding: "3px 8px", color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── MESSAGES VIEW ─────────────────────────────────────────────────────────────
function MessagesView({ setUnreadCount }) {
  const apiFetch = useApi();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unread");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");

  const load = () => apiFetch("/api/messages").then(d => {
    const msgs = d.messages || [];
    setMessages(msgs);
    setUnreadCount(msgs.filter(m => m.status === "unread").length);
    setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? messages : messages.filter(m => m.status === filter);

  async function updateStatus(id, status, adminNote) {
    await apiFetch("/api/messages", { method: "PATCH", body: JSON.stringify({ id, status, admin_note: adminNote }) });
    load();
  }

  const statusColor = { unread: T.blue, read: T.textMuted, replied: T.green, archived: T.textFaint };

  return (
    <div>
      <ViewHeader title="Messages" subtitle="Contact messages from platform users" />
      <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 2rem 1rem", flexWrap: "wrap" }}>
        {["unread","read","replied","archived","all"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...filterBtnStyle, background: filter === f ? T.gold : "transparent", color: filter === f ? "#000" : T.textMuted, borderColor: filter === f ? T.gold : T.border }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "unread" && messages.filter(m => m.status === "unread").length > 0 && (
              <span style={{ marginLeft: 5, background: T.red, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 5px" }}>{messages.filter(m => m.status === "unread").length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 2rem 2rem", overflow: "auto" }}>
        {loading ? <Loading /> : filtered.length === 0 ? <Empty msg={`No ${filter} messages.`} /> : (
          <table style={tableStyle}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Name","Email","Subject","Preview","Status","Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={i} onClick={() => { setSelected(m); setNote(m.admin_note || ""); }}
                  style={{ ...trStyle, cursor: "pointer", fontWeight: m.status === "unread" ? 600 : 400 }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={tdStyle}>{m.name || "—"}</td>
                  <td style={tdStyle}>{m.email}</td>
                  <td style={tdStyle}>{m.subject || "—"}</td>
                  <td style={{ ...tdStyle, color: T.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message?.substring(0, 80)}…</td>
                  <td style={tdStyle}><span style={T.pill(statusColor[m.status] || T.textMuted)}>{m.status}</span></td>
                  <td style={{ ...tdStyle, color: T.textMuted }}><Dt val={m.created_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)} title={selected.subject || "Message"} wide>
          <Row label="From">{selected.name} &lt;{selected.email}&gt;</Row>
          <Row label="Date"><Dt val={selected.created_at} /></Row>
          <Row label="Status"><span style={T.pill(statusColor[selected.status] || T.textMuted)}>{selected.status}</span></Row>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "1rem", margin: "1rem 0", fontSize: 14, lineHeight: 1.7, color: T.text, whiteSpace: "pre-wrap" }}>{selected.message}</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: "0.4rem" }}>Admin Note (internal)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              style={{ ...inputStyle, width: "100%", resize: "vertical" }} placeholder="Internal note…" />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={() => { updateStatus(selected.id, "read", note); setSelected(null); }} style={ghostBtnStyle}>Mark Read</button>
            <button onClick={() => { updateStatus(selected.id, "replied", note); setSelected(null); }} style={{ ...ghostBtnStyle, color: T.green, borderColor: `${T.green}55` }}>Mark Replied</button>
            <button onClick={() => { updateStatus(selected.id, "archived", note); setSelected(null); }} style={{ ...ghostBtnStyle, color: T.textFaint, borderColor: `${T.textFaint}55` }}>Archive</button>
            <button onClick={() => { updateStatus(selected.id, selected.status, note); setSelected(null); }} style={btnStyle}>Save Note</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── FEEDBACK VIEW ─────────────────────────────────────────────────────────────
function FeedbackView() {
  const apiFetch = useApi();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appFilter, setAppFilter] = useState("all");

  useEffect(() => { apiFetch("/api/feedback").then(d => { setFeedback(d.feedback || []); setLoading(false); }); }, []);

  const filtered = appFilter === "all" ? feedback : feedback.filter(f => f.app === appFilter);

  // Aggregate ratings per agent
  const agentStats = {};
  filtered.forEach(f => {
    if (!agentStats[f.agent_id]) agentStats[f.agent_id] = { up: 0, down: 0, app: f.app };
    if (f.rating === 1) agentStats[f.agent_id].up++;
    else if (f.rating === -1) agentStats[f.agent_id].down++;
  });
  const chartData = Object.entries(agentStats).map(([agent, s]) => ({
    agent: agent.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    thumbsUp: s.up, thumbsDown: s.down,
    pct: s.up + s.down > 0 ? Math.round((s.up / (s.up + s.down)) * 100) : 0
  })).sort((a, b) => b.pct - a.pct);

  return (
    <div>
      <ViewHeader title="Feedback" subtitle="User ratings and comments across platform agents"
        action={<button onClick={() => exportCSV(filtered, "vah-feedback.csv")} style={btnStyle}>Export CSV</button>}
      />
      <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 2rem 1rem" }}>
        {["all","republic","philosophers","inventors"].map(f => (
          <button key={f} onClick={() => setAppFilter(f)} style={{ ...filterBtnStyle, background: appFilter === f ? T.gold : "transparent", color: appFilter === f ? "#000" : T.textMuted, borderColor: appFilter === f ? T.gold : T.border }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {!loading && chartData.length > 0 && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, margin: "0 2rem 1.5rem", padding: "1.5rem" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agent Approval Ratings</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <XAxis dataKey="agent" tick={{ fill: T.textMuted, fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v, n) => [`${v}%`, "Approval"]} contentStyle={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pct >= 70 ? T.green : entry.pct >= 40 ? T.orange : T.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ padding: "0 2rem 2rem", overflow: "auto" }}>
        {loading ? <Loading /> : filtered.length === 0 ? <Empty msg="No feedback yet." /> : (
          <table style={tableStyle}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["App","Agent","Rating","Comment","Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={i} style={trStyle}>
                  <td style={tdStyle}><span style={T.pill(T.blue)}>{f.app}</span></td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{f.agent_id}</td>
                  <td style={tdStyle}><span style={{ fontSize: 18 }}>{f.rating === 1 ? "👍" : "👎"}</span></td>
                  <td style={{ ...tdStyle, color: T.textMuted, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.comment || "—"}</td>
                  <td style={{ ...tdStyle, color: T.textMuted }}><Dt val={f.created_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── HEALTH VIEW ───────────────────────────────────────────────────────────────
function HealthView() {
  const apiFetch = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); apiFetch("/api/health").then(d => { setData(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const APP_URLS = [
    { label: "Platform Hub",           url: "https://voices-across-history.vercel.app" },
    { label: "Voices of the Republic", url: "https://voices-of-the-republic.vercel.app" },
    { label: "Voices of the Philosophers", url: "https://voices-of-the-philosophers.vercel.app" },
    { label: "Voices of the Inventors", url: "https://voices-of-the-inventors.vercel.app" },
    { label: "Admin Dashboard",        url: "https://voices-across-history-admin.vercel.app" },
  ];

  return (
    <div>
      <ViewHeader title="Platform Health" subtitle="Live status of all apps and services"
        action={<button onClick={load} style={ghostBtnStyle}>↻ Refresh</button>}
      />

      {loading ? <Loading /> : (
        <div style={{ padding: "1rem 2rem 2rem" }}>
          {/* User stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <StatCard label="Total Users" value={data?.totalUsers ?? "—"} />
            <StatCard label="New This Week" value={data?.newThisWeek ?? "—"} color={T.green} />
            <StatCard label="New This Month" value={data?.newThisMonth ?? "—"} color={T.blue} />
            <StatCard label="Inventors Waitlist" value={data?.waitlistCount ?? "—"} color={T.orange} />
          </div>

          {/* App status */}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>App URLs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
            {APP_URLS.map(app => {
              const status = data?.appStatus?.[app.url];
              return (
                <div key={app.url} style={{ display: "flex", alignItems: "center", gap: "1rem", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0.8rem 1.2rem" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: status === "ok" ? T.green : status === "error" ? T.red : T.textFaint, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{app.label}</div>
                    <div style={{ fontSize: 12, color: T.textFaint }}>{app.url}</div>
                  </div>
                  <span style={{ fontSize: 12, color: status === "ok" ? T.green : status === "error" ? T.red : T.textMuted }}>{status === "ok" ? "Online" : status === "error" ? "Offline" : "Unknown"}</span>
                </div>
              );
            })}
          </div>

          {/* Service status */}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>Services</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ServiceRow label="Supabase" status={data?.supabaseOk ? "ok" : "error"} detail={data?.supabaseOk ? "Connected" : "Connection failed"} />
            <ServiceRow label="Stripe Webhook" status={data?.lastWebhook ? "ok" : "unknown"} detail={data?.lastWebhook ? `Last received: ${new Date(data.lastWebhook).toLocaleString()}` : "No events recorded yet"} />
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceRow({ label, status, detail }) {
  const color = status === "ok" ? T.green : status === "error" ? T.red : T.orange;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0.8rem 1.2rem" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{label}</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>{detail}</div>
      </div>
    </div>
  );
}

// ── MODAL ──────────────────────────────────────────────────────────────────────
function Modal({ onClose, title, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, width: "100%", maxWidth: wide ? 700 : 500, maxHeight: "85vh", overflow: "auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 20, padding: "0 4px", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "0.5rem 0", borderBottom: `1px solid ${T.borderFaint}` }}>
      <span style={{ fontSize: 12, color: T.textMuted, minWidth: 140, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 14, color: T.text }}>{children}</span>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: "0.4rem" }}>{label}</label>
      {children}
    </div>
  );
}

function Dt({ val, fallback }) {
  if (!val) return <span style={{ color: T.textFaint }}>{fallback || "—"}</span>;
  return <span>{new Date(val).toLocaleDateString()}</span>;
}

function Loading() { return <div style={{ padding: "3rem", textAlign: "center", color: T.textMuted, fontSize: 14 }}>Loading…</div>; }
function Empty({ msg }) { return <div style={{ padding: "3rem", textAlign: "center", color: T.textMuted, fontSize: 14 }}>{msg}</div>; }

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const btnStyle = { background: `linear-gradient(135deg,${T.gold},#8B6820)`, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const ghostBtnStyle = { background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 16px", fontFamily: "'Inter',sans-serif", fontWeight: 500, fontSize: 13, cursor: "pointer" };
const filterBtnStyle = { border: "1px solid", borderRadius: 20, padding: "4px 14px", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" };
const inputStyle = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontFamily: "'Inter',sans-serif", fontSize: 14, padding: "8px 12px", outline: "none", width: "100%" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const thStyle = { textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" };
const tdStyle = { padding: "10px 12px", borderBottom: `1px solid ${T.borderFaint}`, color: T.text, verticalAlign: "middle" };
const trStyle = { transition: "background 0.1s" };
