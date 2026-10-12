// Voices Across History™ — shared app engine used by every collection.
// Each collection supplies its figures and look in ../figures.js; this file is copied into
// each app by scripts/sync-shared.sh, so edit it in /shared and re-run the script.
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jbmioozydrvkrizalhbx.supabase.co";
const SUPABASE_KEY = "sb_publishable_1685vxbdVi0zYx3kbIZM3w__kfJBF42";
const BASE = import.meta.env.BASE_URL || "/";
const API = `${BASE}api`;
const HUB = "https://voicesacrosshistory.intexiau.com";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "intexiau-voices-auth" },
});

// ── HELPERS ───────────────────────────────────────────────────────────────────
function useMobile(bp = 640) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return mobile;
}

function speakText(text, voiceProfile = {}, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const hints = voiceProfile.voiceHint || [];
  let chosen = null;
  if (hints.includes("female")) {
    chosen = voices.find((v) => /female|woman/i.test(v.name)) ||
      voices.find((v) => /Samantha|Victoria|Karen|Serena|Moira/.test(v.name));
  } else {
    chosen = voices.find((v) => /male/i.test(v.name) && !/female/i.test(v.name)) ||
      voices.find((v) => /Daniel|Arthur|George|Fred|Oliver/.test(v.name));
  }
  if (chosen) utter.voice = chosen;
  utter.pitch = voiceProfile.pitch || 1;
  utter.rate = voiceProfile.rate || 0.9;
  utter.onend = onEnd || null;
  window.speechSynthesis.speak(utter);
}
const stopSpeech = () => window.speechSynthesis && window.speechSynthesis.cancel();

const initials = (name) => name.replace(/[^A-Za-z &]/g, "").split(/\s+/).filter((w) => w && w !== "&").map((w) => w[0]).slice(0, 2).join("");

function daysLeft(iso) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000));
}

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function VoicesApp({ collection: C, figures }) {
  const T = C.theme;
  const S = makeStyles(T);
  const isMobile = useMobile();

  const [view, setView] = useState("landing"); // landing | auth | join | gallery | chat
  const [session, setSession] = useState(null);
  const [access, setAccess] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  // auth form
  const [mode, setMode] = useState("signup"); // signup | signin | reset | newpass
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [authOk, setAuthOk] = useState("");

  // membership
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState("");
  const [promo, setPromo] = useState("");
  const [showPromo, setShowPromo] = useState(false);

  // gallery / chat
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const recogRef = useRef(null);

  const token = session?.access_token;

  const refreshAccess = useCallback(async (tok) => {
    if (!tok) { setAccess(null); return null; }
    const { ok, data } = await api("access", { token: tok });
    const a = ok ? data.access : null;
    setAccess(a);
    return a;
  }, []);

  // Old addresses of each collection forward to the platform address so one sign-in covers everything.
  useEffect(() => {
    if ((C.legacyHosts || []).includes(window.location.hostname)) {
      window.location.replace(`${HUB}${BASE}${window.location.search}${window.location.hash}`);
    }
  }, [C.legacyHosts]);

  useEffect(() => {
    const recovering = window.location.hash.includes("type=recovery");
    sb.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (recovering) { setMode("newpass"); setView("auth"); }
      const params = new URLSearchParams(window.location.search);
      if (data.session) {
        let a = await refreshAccess(data.session.access_token);
        if (params.get("checkout") === "success") {
          for (let i = 0; i < 6 && !a?.active; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            a = await refreshAccess(data.session.access_token);
          }
          setNotice(a?.active ? "Welcome — your membership is active across every collection." : "Thank you! Your membership is being confirmed. If you can't enter yet, refresh in a minute.");
          if (a?.active) setView("gallery");
        }
      }
      if (params.has("checkout")) window.history.replaceState({}, "", BASE);
      setChecking(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") { setMode("newpass"); setView("auth"); }
      if (event === "SIGNED_OUT") { setAccess(null); setView("landing"); }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshAccess]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (window.speechSynthesis) window.speechSynthesis.getVoices(); }, []);

  // ── NAVIGATION ──────────────────────────────────────────────────────────────
  async function enter() {
    setNotice("");
    if (!session) { setMode("signup"); setView("auth"); return; }
    const a = access || (await refreshAccess(token));
    setView(a?.active ? "gallery" : "join");
  }

  async function signOut() {
    stopSpeech();
    await sb.auth.signOut();
  }

  // ── AUTH ────────────────────────────────────────────────────────────────────
  async function submitAuth(e) {
    e.preventDefault();
    setAuthErr(""); setAuthOk(""); setAuthBusy(true);
    const redirect = `${window.location.origin}${BASE}`;
    try {
      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Please enter your name.");
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) { setAuthOk("Check your email for a confirmation link, then come back and sign in."); return; }
        setSession(data.session);
        const a = await refreshAccess(data.session.access_token);
        setView(a?.active ? "gallery" : "join");
      } else if (mode === "signin") {
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setSession(data.session);
        const a = await refreshAccess(data.session.access_token);
        setView(a?.active ? "gallery" : "join");
      } else if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
        if (error) throw error;
        setAuthOk("If an account exists for that email, a reset link is on its way.");
      } else {
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        window.history.replaceState({}, "", BASE);
        const { data } = await sb.auth.getSession();
        const a = await refreshAccess(data.session?.access_token);
        setView(a?.active ? "gallery" : "join");
      }
    } catch (err) {
      const msg = err?.message || String(err);
      setAuthErr(/Invalid login/i.test(msg) ? "That email and password don't match. Try again or reset your password." : msg);
    } finally {
      setAuthBusy(false);
    }
  }

  // ── MEMBERSHIP ──────────────────────────────────────────────────────────────
  async function startMembership() {
    setJoinErr(""); setJoinBusy(true);
    const { data } = await api("create-checkout", { method: "POST", token, body: { returnPath: BASE, collection: C.id } });
    if (data.access) { setAccess(data.access); setJoinBusy(false); if (data.access.active) setView("gallery"); return; }
    if (data.url) { window.location.href = data.url; return; }
    setJoinErr(data.error || "Checkout is unavailable right now. Please try again.");
    setJoinBusy(false);
  }

  async function redeem(e) {
    e.preventDefault();
    if (!promo.trim()) return;
    setJoinErr(""); setJoinBusy(true);
    const { data } = await api("apply-promo", { method: "POST", token, body: { code: promo.trim() } });
    setJoinBusy(false);
    if (data.access) { setAccess(data.access); if (data.access.active) setView("gallery"); return; }
    setJoinErr(data.error || "That code isn't valid.");
  }

  // ── CHAT ────────────────────────────────────────────────────────────────────
  function openFigure(f) {
    setActive(f);
    setMessages([{ role: "assistant", text: C.greeting(f) }]);
    setView("chat");
  }

  const send = useCallback(async (text) => {
    if (!text.trim() || !active || loading) return;
    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const { ok, status, data } = await api("chat", {
      method: "POST",
      token,
      body: { figureId: active.id, messages: next.map((m) => ({ role: m.role, content: m.text })) },
    });
    setLoading(false);
    if (ok) {
      setMessages((prev) => [...prev, { role: "assistant", text: data.text }]);
      setSpeaking(true);
      speakText(data.text, active.voiceProfile, () => setSpeaking(false));
      return;
    }
    let reply = "Forgive me — I am presently unable to respond. Please try again.";
    if (status === 401) reply = "Your session has ended. Please sign in again to continue.";
    if (status === 402) { await refreshAccess(token); setView("join"); return; }
    if (status === 429) reply = `You've reached today's limit of ${data.limit || 100} messages. Conversations reopen at midnight (Eastern).`;
    setMessages((prev) => [...prev, { role: "assistant", text: reply, system: true }]);
  }, [messages, active, loading, token, refreshAccess]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input isn't supported in this browser. Try Chrome or Safari.");
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  }, []);
  const stopListening = useCallback(() => { recogRef.current?.stop(); setListening(false); }, []);

  // ── ACCOUNT BAR ─────────────────────────────────────────────────────────────
  const AccountBar = () =>
    session ? (
      <div style={S.accountBar}>
        <span style={{ opacity: 0.75 }}>{session.user.email}</span>
        <button onClick={signOut} style={S.linkBtn}>Sign out</button>
      </div>
    ) : null;

  // ── VIEW: LANDING ───────────────────────────────────────────────────────────
  if (view === "landing") {
    const trialDays = access?.active && (access.access_type === "trial" || access.access_type === "promo_trial") ? daysLeft(access.trial_expires_at) : null;
    return (
      <div style={S.landing}>
        <div style={S.noise} />
        <div style={{ ...S.landingInner, padding: isMobile ? "2rem 1.4rem" : "2rem" }}>
          <div style={S.eyebrow}>Voices Across History™</div>
          <h1 style={{ ...S.title, fontSize: isMobile ? "clamp(2.3rem,10vw,3.4rem)" : "clamp(3rem,7vw,5.2rem)" }}>
            {C.titleTop}<br /><span style={{ color: T.accentLt }}>{C.titleBottom}</span>
          </h1>
          <div style={S.rule} />
          <p style={{ ...S.desc, fontSize: isMobile ? "1.05rem" : "clamp(1.1rem,2vw,1.3rem)" }}>{C.description}</p>
          <div style={S.meta}>{C.meta.map((m, i) => <span key={m}>{i > 0 && <span style={{ margin: "0 0.6rem", opacity: 0.4 }}>·</span>}{m}</span>)}</div>
          {notice && <div style={S.noticeOk}>{notice}</div>}
          <button onClick={enter} disabled={checking} style={{ ...S.primaryBtn, minHeight: 48 }}>
            {checking ? "One moment…" : access?.active ? C.enterLabel : session ? "Continue" : "Start Free — 7 Days on Us"}
          </button>
          <div style={{ marginTop: "1.4rem" }}>
            <div style={S.price}>$9.99<span style={S.priceUnit}> / month — the whole platform</span></div>
            <div style={S.small}>One membership opens every collection: Republic, Philosophers and Inventors.</div>
            {trialDays !== null && <div style={S.trialTag}>FREE TRIAL — {trialDays} day{trialDays === 1 ? "" : "s"} remaining</div>}
            {access?.staff && <div style={S.trialTag}>INTEXIAU STAFF ACCESS</div>}
          </div>
          {!session && !checking && (
            <button onClick={() => { setMode("signin"); setView("auth"); }} style={{ ...S.linkBtn, marginTop: "1rem" }}>
              Already a member? Sign in
            </button>
          )}
          <AccountBar />
          <a href={`${HUB}/`} style={S.backLink}>← Voices Across History™ Platform</a>
        </div>
      </div>
    );
  }

  // ── VIEW: AUTH ──────────────────────────────────────────────────────────────
  if (view === "auth") {
    const titles = { signup: "Create your free account", signin: "Welcome back", reset: "Reset your password", newpass: "Choose a new password" };
    return (
      <div style={{ ...S.landing, justifyContent: "center" }}>
        <div style={S.noise} />
        <form onSubmit={submitAuth} style={S.formCard}>
          <div style={S.eyebrow}>{C.name}</div>
          <h2 style={S.formTitle}>{titles[mode]}</h2>
          <div style={S.rule} />
          {(mode === "signup" || mode === "signin") && (
            <div style={S.tabs}>
              <button type="button" onClick={() => { setMode("signup"); setAuthErr(""); setAuthOk(""); }} style={mode === "signup" ? S.tabOn : S.tab}>Create account</button>
              <button type="button" onClick={() => { setMode("signin"); setAuthErr(""); setAuthOk(""); }} style={mode === "signin" ? S.tabOn : S.tab}>Sign in</button>
            </div>
          )}
          <p style={S.formNote}>
            {mode === "signup" && "One IntexiaU account works across every Voices collection and the IntexiaU Academy."}
            {mode === "signin" && "Use the email and password from your IntexiaU account."}
            {mode === "reset" && "Enter your email and we'll send a reset link."}
            {mode === "newpass" && "Enter a new password for your account."}
          </p>
          {mode === "signup" && <input style={S.input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
          {mode !== "newpass" && <input style={S.input} type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}
          {mode !== "reset" && <input style={S.input} type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required />}
          {authErr && <div style={S.err}>{authErr}</div>}
          {authOk && <div style={S.noticeOk}>{authOk}</div>}
          <button disabled={authBusy} style={{ ...S.primaryBtn, width: "100%", minHeight: 50 }}>
            {authBusy ? "Please wait…" : { signup: "Create account", signin: "Sign in", reset: "Send reset link", newpass: "Save new password" }[mode]}
          </button>
          {mode !== "newpass" && (
            <button type="button" onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setAuthErr(""); setAuthOk(""); }} style={{ ...S.linkBtn, marginTop: "1rem" }}>
              {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
            </button>
          )}
          <p style={S.fine}>By creating an account you agree to the IntexiaU <a href="https://academy.intexiau.com/terms" style={S.fineLink}>Terms</a> and <a href="https://academy.intexiau.com/privacy" style={S.fineLink}>Privacy Policy</a>. You must be 16 or older.</p>
          <button type="button" onClick={() => setView("landing")} style={{ ...S.backLink, background: "none", border: "none", cursor: "pointer", display: "block", margin: "1.2rem auto 0" }}>← Back</button>
        </form>
      </div>
    );
  }

  // ── VIEW: JOIN (signed in, no active membership) ────────────────────────────
  if (view === "join") {
    const ended = access && !access.is_new && !access.active;
    return (
      <div style={{ ...S.landing, justifyContent: "center" }}>
        <div style={S.noise} />
        <div style={S.formCard}>
          <div style={S.eyebrow}>{C.name}</div>
          <h2 style={S.formTitle}>{ended ? "Your access has ended" : "Start your free 7-day trial"}</h2>
          <div style={S.rule} />
          <p style={S.formNote}>
            {ended
              ? "Continue your conversations for $9.99 a month. One membership opens every collection. Cancel anytime."
              : "Add a card to begin — $0 today, then $9.99/month for the whole Voices Across History platform. Cancel anytime."}
          </p>
          <div style={{ ...S.price, fontSize: "2.4rem", margin: "0.6rem 0 0.2rem" }}>$9.99<span style={S.priceUnit}>/mo</span></div>
          <div style={{ ...S.small, marginBottom: "1.2rem" }}>EVERY COLLECTION · CANCEL ANYTIME</div>
          {joinErr && <div style={S.err}>{joinErr}</div>}
          <button onClick={startMembership} disabled={joinBusy} style={{ ...S.primaryBtn, width: "100%", minHeight: 50 }}>
            {joinBusy ? "Opening secure checkout…" : ended ? "Subscribe — $9.99 / month" : "Begin 7-Day Free Trial"}
          </button>
          {!showPromo ? (
            <button onClick={() => setShowPromo(true)} style={{ ...S.linkBtn, marginTop: "1rem" }}>Have a promo code?</button>
          ) : (
            <form onSubmit={redeem} style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <input style={{ ...S.input, marginBottom: 0, flex: 1, textTransform: "uppercase", letterSpacing: "0.08em" }} placeholder="VAH-XXXX-XXXX" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
              <button disabled={joinBusy} style={{ ...S.secondaryBtn, minHeight: 46 }}>Apply</button>
            </form>
          )}
          <AccountBar />
          <button onClick={() => setView("landing")} style={{ ...S.backLink, background: "none", border: "none", cursor: "pointer", display: "block", margin: "1.2rem auto 0" }}>← Back</button>
        </div>
      </div>
    );
  }

  // ── VIEW: GALLERY ───────────────────────────────────────────────────────────
  if (view === "gallery") {
    const filters = C.filterBy ? ["All", ...Array.from(new Set(figures.map((f) => f[C.filterBy])))] : null;
    const shown = filters && filter !== "All" ? figures.filter((f) => f[C.filterBy] === filter) : figures;
    const sections = C.sections || [{ label: C.sectionLabel || "The Collection", match: () => true }];
    return (
      <div style={S.page}>
        <div style={S.header}>
          <button onClick={() => setView("landing")} style={S.ghostBtn}>← Hall</button>
          <div style={{ textAlign: "center" }}>
            <div style={S.headerEyebrow}>Voices Across History™</div>
            <h1 style={{ ...S.headerTitle, fontSize: isMobile ? "1.05rem" : "1.35rem" }}>{C.name}</h1>
          </div>
          <button onClick={signOut} style={S.ghostBtn}>Sign out</button>
        </div>
        {notice && <div style={{ ...S.noticeOk, margin: "1rem 1.5rem 0" }}>{notice}</div>}
        {filters && (
          <div style={S.filters}>
            {filters.map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={filter === f ? S.filterOn : S.filter}>{f}</button>
            ))}
          </div>
        )}
        {sections.map((sec) => {
          const list = shown.filter(sec.match);
          if (!list.length) return null;
          return (
            <div key={sec.label}>
              <div style={S.sectionLabel}>{sec.label}{sec.note && <span style={S.sectionNote}> — {sec.note}</span>}</div>
              <div style={{ ...S.grid, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(200px,1fr))" }}>
                {list.map((f) => <FigureCard key={f.id} f={f} onClick={() => openFigure(f)} S={S} isMobile={isMobile} badge={sec.badge} />)}
              </div>
            </div>
          );
        })}
        <div style={S.crossLinks}>
          {(C.otherCollections || []).map((o) => (
            <a key={o.href} href={o.href} style={S.crossLink}>{o.label} →</a>
          ))}
        </div>
      </div>
    );
  }

  // ── VIEW: CHAT ──────────────────────────────────────────────────────────────
  if (view === "chat" && active) {
    return (
      <div style={{ ...S.chatPage, maxWidth: isMobile ? "100%" : 820 }}>
        <div style={S.chatHeader}>
          <button onClick={() => { stopSpeech(); setView("gallery"); }} style={S.ghostBtn}>← Gallery</button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flex: 1, minWidth: 0 }}>
            <Portrait f={active} size={isMobile ? 40 : 52} round S={S} />
            <div style={{ minWidth: 0 }}>
              <div style={S.chatName}>{active.name}</div>
              <div style={S.chatTitle}>{active.title}</div>
              {!isMobile && <div style={S.chatYears}>{active.years}</div>}
            </div>
          </div>
          <div style={{ flexShrink: 0, color: T.accentLt }}>{speaking ? "🔊" : ""}</div>
        </div>
        <div style={S.sourcesBar}>
          <span style={S.sourcesLabel}>Sources:</span>
          {active.primarySources.map((s) => <span key={s} style={S.sourceTag}>{s}</span>)}
        </div>
        <div style={S.messages}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === "user" ? { ...S.userBubble, maxWidth: isMobile ? "88%" : "75%" } : { ...S.botBubble, maxWidth: isMobile ? "94%" : "85%", opacity: m.system ? 0.8 : 1 }}>
              {m.role === "assistant" && <div style={S.speaker}>{active.short || active.name.split(" ")[0]}</div>}
              <div style={{ ...S.bubbleText, whiteSpace: "pre-wrap" }}>{m.text}</div>
              {m.role === "assistant" && !m.system && (
                <button onClick={() => { setSpeaking(true); speakText(m.text, active.voiceProfile, () => setSpeaking(false)); }} style={S.replay} title="Read aloud" aria-label="Read aloud">🔊</button>
              )}
            </div>
          ))}
          {loading && (
            <div style={S.botBubble}>
              <div style={S.speaker}>{active.short || active.name.split(" ")[0]}</div>
              <div className="typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div style={{ ...S.inputRow, padding: isMobile ? "0.8rem 1rem" : "1rem 1.5rem" }}>
          <button
            onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening}
            style={{ ...S.mic, background: listening ? "#8B1A1A" : T.accentAlpha }}
            title={listening ? "Listening…" : "Hold to speak"} aria-label="Hold to speak"
          >{listening ? "🔴" : "🎙️"}</button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={`Ask ${active.short || active.name.split(" ")[0]}…`}
            style={S.textarea}
            rows={2}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{ ...S.primaryBtn, padding: "0.6rem 1.1rem", minHeight: 44, boxShadow: "none" }}>Send</button>
        </div>
        <div style={S.disclaimer}>
          An AI interpretation for learning, grounded in the documented writings of {active.name} ({active.years}). Not the person, and not a verbatim quotation unless cited.
          {active.limitedRecord && " Limited record — responses restricted to verified writings only."}
        </div>
      </div>
    );
  }
  return null;
}

// ── PORTRAITS & CARDS ─────────────────────────────────────────────────────────
function Portrait({ f, size, round, S, height }) {
  const [failed, setFailed] = useState(!f.portrait);
  const src = f.portrait && !/^https?:/.test(f.portrait) ? `${BASE}${f.portrait.replace(/^\//, "")}` : f.portrait;
  const box = round
    ? { width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: `2px solid ${S._t.border}` }
    : { width: "100%", height, overflow: "hidden" };
  if (failed) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 50% 40%, ${f.color}66, ${f.color}22 70%)` }}>
        <span style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: round ? size * 0.38 : 44, color: S._t.accentLt, letterSpacing: "0.04em" }}>
          {f.icon && !round ? <span style={{ display: "block", textAlign: "center", fontSize: 30, marginBottom: 4 }}>{f.icon}</span> : null}
          {initials(f.name)}
        </span>
      </div>
    );
  }
  return (
    <div style={box}>
      <img src={src} alt={f.name} onError={() => setFailed(true)} referrerPolicy="no-referrer" loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", filter: "sepia(18%) contrast(1.05)" }} />
    </div>
  );
}

function FigureCard({ f, onClick, S, isMobile, badge }) {
  return (
    <button onClick={onClick} style={{ ...S.card, borderColor: `${f.color}66` }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <Portrait f={f} S={S} height={isMobile ? 160 : 220} />
      <div style={{ padding: "0.8rem", textAlign: "left" }}>
        <div style={{ ...S.cardName, fontSize: isMobile ? "0.78rem" : "0.86rem" }}>{f.name}</div>
        <div style={S.cardSub}>{f.title}</div>
        <div style={S.cardYears}>{f.years}</div>
        {badge && <div style={S.badge}>{badge}</div>}
      </div>
    </button>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
function makeStyles(T) {
  const cinzel = "'Cinzel',serif";
  const garamond = "'EB Garamond',Georgia,serif";
  return {
    _t: T,
    landing: { minHeight: "100vh", background: T.bgGrad, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "'Crimson Text',Georgia,serif", position: "relative", overflow: "hidden", color: T.text },
    noise: { position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")` },
    landingInner: { position: "relative", zIndex: 2, maxWidth: 720 },
    eyebrow: { fontFamily: cinzel, fontSize: "0.65rem", letterSpacing: "0.35em", color: T.accent, marginBottom: "1rem", textTransform: "uppercase" },
    title: { fontFamily: cinzel, fontWeight: 900, color: T.text, lineHeight: 1.05, margin: "0 0 1rem", textShadow: `0 2px 40px ${T.accentAlpha}` },
    rule: { width: 80, height: 1, background: `linear-gradient(90deg,transparent,${T.accent},transparent)`, margin: "1.4rem auto" },
    desc: { fontFamily: garamond, fontStyle: "italic", color: T.muted, lineHeight: 1.7, margin: "0 auto 1.4rem", maxWidth: 600 },
    meta: { fontFamily: cinzel, fontSize: "0.65rem", letterSpacing: "0.15em", color: T.accent, marginBottom: "2rem", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.3rem 0" },
    primaryBtn: { fontFamily: cinzel, fontSize: "0.8rem", letterSpacing: "0.14em", padding: "0.9rem 2.4rem", background: T.btn, color: T.btnText || T.text, border: "none", borderRadius: 2, cursor: "pointer", boxShadow: `0 4px 20px ${T.accentAlpha}` },
    secondaryBtn: { fontFamily: cinzel, fontSize: "0.68rem", letterSpacing: "0.1em", padding: "0.6rem 1rem", background: T.accentAlpha, border: `1px solid ${T.border}`, color: T.accentLt, cursor: "pointer", borderRadius: 2 },
    ghostBtn: { fontFamily: cinzel, fontSize: "0.68rem", letterSpacing: "0.1em", background: "transparent", border: `1px solid ${T.border}`, color: T.accentLt, padding: "0.45rem 0.9rem", cursor: "pointer", borderRadius: 2, minHeight: 40 },
    linkBtn: { background: "none", border: "none", cursor: "pointer", fontFamily: garamond, fontStyle: "italic", fontSize: "0.95rem", color: T.accentLt, textDecoration: "underline", padding: 0, display: "inline-block" },
    backLink: { fontFamily: cinzel, fontSize: "0.65rem", letterSpacing: "0.1em", color: T.accent, opacity: 0.7, textDecoration: "none", display: "inline-block", marginTop: "1.6rem" },
    price: { fontFamily: cinzel, fontSize: "1.3rem", color: T.accentLt, letterSpacing: "0.05em" },
    priceUnit: { fontSize: "0.6em", color: T.accent, letterSpacing: "0.12em" },
    small: { fontFamily: garamond, fontStyle: "italic", fontSize: "0.9rem", color: T.faint, marginTop: "0.3rem" },
    trialTag: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.12em", color: T.accent, marginTop: "0.6rem" },
    accountBar: { marginTop: "1.2rem", display: "flex", gap: "0.8rem", justifyContent: "center", alignItems: "center", fontFamily: garamond, fontSize: "0.9rem", color: T.muted, flexWrap: "wrap" },
    formCard: { position: "relative", zIndex: 2, width: "100%", maxWidth: 440, padding: "2rem 1.5rem", textAlign: "center" },
    formTitle: { fontFamily: cinzel, fontSize: "1.6rem", fontWeight: 700, color: T.text, lineHeight: 1.2, margin: "0 0 0.4rem" },
    formNote: { fontFamily: garamond, fontStyle: "italic", fontSize: "1rem", color: T.muted, lineHeight: 1.6, margin: "0 0 1.2rem" },
    tabs: { display: "flex", gap: 4, background: T.accentAlpha, padding: 4, borderRadius: 4, marginBottom: "1rem" },
    tab: { flex: 1, padding: "0.6rem", background: "transparent", border: "none", color: T.muted, fontFamily: cinzel, fontSize: "0.68rem", letterSpacing: "0.08em", cursor: "pointer", borderRadius: 3 },
    tabOn: { flex: 1, padding: "0.6rem", background: T.panel, border: `1px solid ${T.border}`, color: T.text, fontFamily: cinzel, fontSize: "0.68rem", letterSpacing: "0.08em", cursor: "pointer", borderRadius: 3 },
    input: { width: "100%", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 2, color: T.text, fontFamily: "'Crimson Text',Georgia,serif", fontSize: "1.05rem", padding: "0.75rem 0.95rem", outline: "none", marginBottom: "0.75rem", minHeight: 46 },
    err: { background: "rgba(161,54,29,0.18)", border: "1px solid rgba(220,90,60,0.4)", color: "#F2B8A8", borderRadius: 2, padding: "0.6rem 0.8rem", fontSize: "0.92rem", marginBottom: "0.8rem", textAlign: "left" },
    noticeOk: { background: "rgba(29,122,85,0.18)", border: "1px solid rgba(80,180,130,0.4)", color: "#BFE8D2", borderRadius: 2, padding: "0.6rem 0.8rem", fontSize: "0.92rem", marginBottom: "1rem" },
    fine: { fontSize: "0.78rem", color: T.faint, marginTop: "1.2rem", lineHeight: 1.5 },
    fineLink: { color: T.accentLt, textDecoration: "underline" },
    page: { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Crimson Text',Georgia,serif", paddingBottom: "4rem" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", padding: "0.9rem 1.2rem", borderBottom: `1px solid ${T.border}`, background: T.headerBg, position: "sticky", top: 0, zIndex: 10 },
    headerEyebrow: { fontFamily: cinzel, fontSize: "0.58rem", letterSpacing: "0.3em", color: T.accent, marginBottom: "0.2rem" },
    headerTitle: { fontFamily: cinzel, fontWeight: 700, color: T.text, margin: 0 },
    filters: { display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "1.2rem 1.5rem", borderBottom: `1px solid ${T.borderFaint}` },
    filter: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.1em", padding: "0.45rem 0.9rem", border: `1px solid ${T.borderFaint}`, background: "transparent", color: T.muted, cursor: "pointer", borderRadius: 2, minHeight: 36 },
    filterOn: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.1em", padding: "0.45rem 0.9rem", border: `1px solid ${T.accent}`, background: T.accentAlpha, color: T.accentLt, cursor: "pointer", borderRadius: 2, minHeight: 36 },
    sectionLabel: { fontFamily: cinzel, fontSize: "0.7rem", letterSpacing: "0.25em", color: T.accent, padding: "2rem 1.5rem 1rem", textTransform: "uppercase", borderBottom: `1px solid ${T.borderFaint}` },
    sectionNote: { fontFamily: garamond, fontStyle: "italic", letterSpacing: 0, textTransform: "none", fontSize: "0.88rem", color: T.muted },
    grid: { display: "grid", gap: "1rem", padding: "1.5rem" },
    card: { background: T.panel, border: "1px solid", borderRadius: 2, cursor: "pointer", overflow: "hidden", transition: "transform 0.25s, box-shadow 0.25s", display: "flex", flexDirection: "column", padding: 0, color: T.text, font: "inherit" },
    cardName: { fontFamily: cinzel, fontWeight: 700, color: T.text, marginBottom: "0.3rem" },
    cardSub: { fontFamily: garamond, fontStyle: "italic", color: T.muted, lineHeight: 1.35, marginBottom: "0.4rem", fontSize: "0.86rem" },
    cardYears: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.1em", color: T.accent },
    badge: { display: "inline-block", fontFamily: cinzel, fontSize: "0.55rem", letterSpacing: "0.1em", border: `1px solid ${T.border}`, color: T.accent, padding: "0.2rem 0.5rem", marginTop: "0.5rem", borderRadius: 2 },
    crossLinks: { display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", padding: "2.5rem 1.5rem 0" },
    crossLink: { fontFamily: cinzel, fontSize: "0.68rem", letterSpacing: "0.12em", color: T.accentLt, textDecoration: "none", border: `1px solid ${T.border}`, padding: "0.6rem 1rem", borderRadius: 2 },
    chatPage: { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Crimson Text',Georgia,serif", display: "flex", flexDirection: "column", margin: "0 auto" },
    chatHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: `1px solid ${T.border}`, background: T.headerBg, gap: "0.8rem", position: "sticky", top: 0, zIndex: 10 },
    chatName: { fontFamily: cinzel, fontWeight: 700, color: T.text, lineHeight: 1.2, fontSize: "0.95rem" },
    chatTitle: { fontFamily: garamond, fontStyle: "italic", color: T.muted, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "0.85rem" },
    chatYears: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.1em", color: T.accent },
    sourcesBar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.3rem 0.4rem", padding: "0.5rem 1rem", background: T.accentAlpha2, borderBottom: `1px solid ${T.borderFaint}` },
    sourcesLabel: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.1em", color: T.accent, marginRight: "0.3rem" },
    sourceTag: { fontFamily: cinzel, fontSize: "0.57rem", letterSpacing: "0.05em", padding: "0.15rem 0.45rem", border: `1px solid ${T.border}`, color: T.accentLt, borderRadius: 2 },
    messages: { flex: 1, overflowY: "auto", padding: "1.2rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" },
    userBubble: { alignSelf: "flex-end", background: T.accentAlpha, border: `1px solid ${T.border}`, borderRadius: 2, padding: "0.7rem 1rem" },
    botBubble: { alignSelf: "flex-start", background: T.panel, border: `1px solid ${T.borderFaint}`, borderRadius: 2, padding: "0.9rem 1rem", position: "relative" },
    speaker: { fontFamily: cinzel, fontSize: "0.6rem", letterSpacing: "0.15em", color: T.accent, marginBottom: "0.4rem" },
    bubbleText: { fontFamily: garamond, lineHeight: 1.7, color: T.text, fontSize: "1.04rem" },
    replay: { background: "transparent", border: "none", cursor: "pointer", fontSize: "0.85rem", marginTop: "0.3rem", opacity: 0.55, float: "right", minWidth: 32, minHeight: 32 },
    inputRow: { display: "flex", gap: "0.5rem", borderTop: `1px solid ${T.border}`, background: T.headerBg, alignItems: "flex-end", position: "sticky", bottom: 0 },
    mic: { width: 44, height: 44, borderRadius: "50%", border: `1px solid ${T.border}`, cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.accentLt },
    textarea: { flex: 1, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 2, color: T.text, fontFamily: "'Crimson Text',Georgia,serif", fontSize: "1rem", padding: "0.6rem 0.8rem", resize: "none", outline: "none", lineHeight: 1.5 },
    disclaimer: { fontFamily: garamond, fontStyle: "italic", color: T.faint, textAlign: "center", padding: "0.5rem 1rem 1rem", lineHeight: 1.5, fontSize: "0.75rem" },
  };
}
