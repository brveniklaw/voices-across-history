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

// Picks the best available device voice for a figure: their regional English first
// (American, British, Scottish), then the right gender, preferring higher-quality voices.
const FEMALE = /female|woman|samantha|victoria|karen|serena|moira|tessa|fiona|kate|susan|martha|allison|ava|zira|hazel|libby|sonia|jenny|aria|emma|amy|joanna|salli|kimberly|nicole|catherine|zoe|google us english$/i;
const MALE = /\bmale\b|daniel|arthur|oliver|george|fred|alex|tom|aaron|david|mark|ryan|guy|eric|brian|matthew|justin|joey|thomas|james|rishi|google uk english male/i;
const QUALITY = /natural|neural|enhanced|premium|online|google/i;

function pickVoice(profile = {}) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const want = (profile.lang || "en-US").toLowerCase();
  const female = (profile.voiceHint || []).includes("female");
  const norm = (v) => String(v.lang || "").replace("_", "-").toLowerCase();
  const genderOk = (v) => (female ? FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, "")) : MALE.test(v.name) && !/female/i.test(v.name));
  const score = (v) => (QUALITY.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const best = (list) => list.sort((a, b) => score(b) - score(a))[0];
  const tiers = [];
  if (want === "en-gb-scotland") {
    tiers.push(voices.filter((v) => /fiona|scot/i.test(v.name) || norm(v).includes("scotland")));
    tiers.push(voices.filter((v) => norm(v) === "en-gb"));
  } else {
    // Scottish voices (e.g. Apple's Fiona) are reserved for Scottish figures.
    const notScot = voices.filter((v) => !/fiona|scot/i.test(v.name) && !norm(v).includes("scotland"));
    tiers.push(notScot.filter((v) => norm(v) === want));
    tiers.push(notScot.filter((v) => norm(v).startsWith("en")));
  }
  tiers.push(voices.filter((v) => norm(v).startsWith("en")));
  for (const t of tiers) {
    const g = t.filter(genderOk);
    if (g.length) return best(g);
  }
  for (const t of tiers) if (t.length) return best(t);
  return null;
}

function speakText(text, voiceProfile = {}, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const chosen = pickVoice(voiceProfile);
  if (chosen) { utter.voice = chosen; utter.lang = chosen.lang; } else { utter.lang = voiceProfile.lang === "en-GB-scotland" ? "en-GB" : (voiceProfile.lang || "en-US"); }
  utter.pitch = voiceProfile.pitch || 1;
  utter.rate = voiceProfile.rate || 0.9;
  utter.onend = onEnd || null;
  window.speechSynthesis.speak(utter);
}
const stopSpeech = () => window.speechSynthesis && window.speechSynthesis.cancel();

const initials = (name) => { const w = name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((x) => /^[A-Z]/.test(x)); return w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "?")[0]; };
const speakerName = (f) => f.short || f.name.split(" / ")[0].split(" ").slice(-1)[0];

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

  // ── SHARED PIECES ───────────────────────────────────────────────────────────
  const vars = {
    "--ink": T.ink, "--deep": T.deep, "--raise": T.raise, "--paper": T.paper, "--muted": T.muted,
    "--faint": T.faint, "--accent": T.accent, "--accent-soft": T.accentSoft, "--signal": T.signal, "--line": T.line,
  };
  const account = () =>
    session ? (
      <div className="vx-account">
        <span className="vx-account-email">{session.user.email}</span>
        <button className="vx-link" onClick={signOut}>Sign out</button>
      </div>
    ) : null;

  // ── VIEW: LANDING ───────────────────────────────────────────────────────────
  if (view === "landing") {
    const trialDays = access?.active && (access.access_type === "trial" || access.access_type === "promo_trial") ? daysLeft(access.trial_expires_at) : null;
    const plates = figures.slice(0, isMobile ? 6 : 9);
    return (
      <Shell vars={vars} className="vx-landing">
        <TopBar right={session ? account() : !checking && <button className="vx-link" onClick={() => { setMode("signin"); setView("auth"); }}>Sign in</button>} />
        <main className="vx-hero">
          <section className="vx-hero-copy">
            <p className="vx-kicker">{C.kicker || "A Voices Across History collection"}</p>
            <h1 className="vx-title">{C.titleBottom}</h1>
            <p className="vx-lede">{C.description}</p>
            <dl className="vx-facts">
              <div><dt>{figures.length}</dt><dd>{C.countLabel || "voices"}</dd></div>
              <div><dt>{figures.reduce((n, f) => n + f.primarySources.length, 0)}</dt><dd>primary sources</dd></div>
              <div><dt>Voice</dt><dd>speak or type</dd></div>
            </dl>
            {notice && <div className="vx-note vx-note-ok">{notice}</div>}
            <div className="vx-cta-row">
              <button className="vx-btn" onClick={enter} disabled={checking}>
                {checking ? "One moment…" : access?.active ? C.enterLabel : session ? "Continue" : "Start your free 7-day trial"}
              </button>
              <p className="vx-price"><strong>$9.99 a month</strong> for every collection: Republic, Philosophers and Inventors.</p>
            </div>
            {trialDays !== null && <p className="vx-status">Free trial: {trialDays} day{trialDays === 1 ? "" : "s"} left</p>}
            {access?.staff && <p className="vx-status">IntexiaU staff access</p>}
          </section>
          <section className="vx-mosaic" aria-label={`Figures in ${C.name}`}>
            {plates.map((f, i) => (
              <div key={f.id} className="vx-mosaic-cell" style={{ animationDelay: `${i * 70}ms` }}>
                <Plate f={f} />
                <span className="vx-mosaic-name">{f.short || f.name}</span>
              </div>
            ))}
          </section>
        </main>
        <footer className="vx-foot">
          {(C.otherCollections || []).map((o) => <a key={o.href} href={o.href} className="vx-link">{o.label}</a>)}
        </footer>
      </Shell>
    );
  }

  // ── VIEW: AUTH ──────────────────────────────────────────────────────────────
  if (view === "auth") {
    const titles = { signup: "Create your free account", signin: "Sign in", reset: "Reset your password", newpass: "Choose a new password" };
    const notes = {
      signup: "One IntexiaU account works in every Voices collection and in the IntexiaU Academy.",
      signin: "Use the email and password from your IntexiaU account.",
      reset: "Enter your email and we'll send a reset link.",
      newpass: "Enter a new password for your account.",
    };
    return (
      <Shell vars={vars} className="vx-center">
        <TopBar left={<button className="vx-link" onClick={() => setView("landing")}>Back</button>} />
        <form className="vx-panel" onSubmit={submitAuth}>
          <p className="vx-kicker">{C.name}</p>
          <h2 className="vx-h2">{titles[mode]}</h2>
          {(mode === "signup" || mode === "signin") && (
            <div className="vx-seg" role="tablist">
              <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setAuthErr(""); setAuthOk(""); }}>Create account</button>
              <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setAuthErr(""); setAuthOk(""); }}>Sign in</button>
            </div>
          )}
          <p className="vx-muted">{notes[mode]}</p>
          {mode === "signup" && <label className="vx-field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
          {mode !== "newpass" && <label className="vx-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>}
          {mode !== "reset" && <label className="vx-field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" /></label>}
          {authErr && <div className="vx-note vx-note-err">{authErr}</div>}
          {authOk && <div className="vx-note vx-note-ok">{authOk}</div>}
          <button className="vx-btn vx-btn-wide" disabled={authBusy}>
            {authBusy ? "Please wait…" : { signup: "Create account", signin: "Sign in", reset: "Send reset link", newpass: "Save new password" }[mode]}
          </button>
          {mode !== "newpass" && (
            <button type="button" className="vx-link vx-center-text" onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setAuthErr(""); setAuthOk(""); }}>
              {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
            </button>
          )}
          <p className="vx-fine">By creating an account you agree to the IntexiaU <a href="https://academy.intexiau.com/terms">Terms</a> and <a href="https://academy.intexiau.com/privacy">Privacy Policy</a>. You must be 16 or older.</p>
        </form>
      </Shell>
    );
  }

  // ── VIEW: JOIN ──────────────────────────────────────────────────────────────
  if (view === "join") {
    const ended = access && !access.is_new && !access.active;
    return (
      <Shell vars={vars} className="vx-center">
        <TopBar left={<button className="vx-link" onClick={() => setView("landing")}>Back</button>} right={account()} />
        <div className="vx-panel">
          <p className="vx-kicker">{C.name}</p>
          <h2 className="vx-h2">{ended ? "Your access has ended" : "Start your free 7-day trial"}</h2>
          <p className="vx-muted">
            {ended
              ? "Continue your conversations for $9.99 a month. One membership opens every collection, and you can cancel anytime."
              : "Add a card to begin. You pay nothing today, then $9.99 a month for the whole platform. Cancel anytime."}
          </p>
          <div className="vx-pricecard">
            <span className="vx-pricecard-amt">$9.99</span>
            <span className="vx-pricecard-per">per month, every collection</span>
          </div>
          {joinErr && <div className="vx-note vx-note-err">{joinErr}</div>}
          <button className="vx-btn vx-btn-wide" onClick={startMembership} disabled={joinBusy}>
            {joinBusy ? "Opening secure checkout…" : ended ? "Subscribe for $9.99 a month" : "Start free trial"}
          </button>
          {!showPromo ? (
            <button className="vx-link vx-center-text" onClick={() => setShowPromo(true)}>Have a promo code?</button>
          ) : (
            <form className="vx-inline" onSubmit={redeem}>
              <input aria-label="Promo code" placeholder="Promo code" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
              <button className="vx-btn vx-btn-quiet" disabled={joinBusy}>Apply</button>
            </form>
          )}
        </div>
      </Shell>
    );
  }

  // ── VIEW: GALLERY ───────────────────────────────────────────────────────────
  if (view === "gallery") {
    const filters = C.filterBy ? ["All", ...Array.from(new Set(figures.map((f) => f[C.filterBy])))] : null;
    const shown = filters && filter !== "All" ? figures.filter((f) => f[C.filterBy] === filter) : figures;
    const sections = C.sections || [{ label: C.sectionLabel || "The collection", match: () => true }];
    return (
      <Shell vars={vars}>
        <TopBar left={<button className="vx-link" onClick={() => setView("landing")}>{C.titleBottom}</button>} right={account()} />
        <main className="vx-gallery">
          <div className="vx-gallery-head">
            <h1 className="vx-h1">Choose a voice</h1>
            <p className="vx-muted">Every answer is grounded in the figure's own writings. Tap a portrait to begin.</p>
            {notice && <div className="vx-note vx-note-ok">{notice}</div>}
            {filters && (
              <div className="vx-chips" role="group" aria-label="Filter by era">
                {filters.map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
              </div>
            )}
          </div>
          {sections.map((sec) => {
            const list = shown.filter(sec.match);
            if (!list.length) return null;
            return (
              <section key={sec.label} className="vx-section">
                {sections.length > 1 && <h2 className="vx-section-title">{sec.label}{sec.note && <span> {sec.note}</span>}</h2>}
                <div className="vx-grid">
                  {list.map((f) => (
                    <button key={f.id} className="vx-card" onClick={() => openFigure(f)} style={{ "--tint": f.color }}>
                      <Plate f={f} />
                      <span className="vx-card-body">
                        <span className="vx-card-name">{f.name}</span>
                        <span className="vx-card-title">{f.title}</span>
                        <span className="vx-card-meta"><span>{f.years}</span><span>{f.primarySources.length} sources</span></span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </main>
        <footer className="vx-foot">
          {(C.otherCollections || []).map((o) => <a key={o.href} href={o.href} className="vx-link">{o.label}</a>)}
        </footer>
      </Shell>
    );
  }

  // ── VIEW: CHAT ──────────────────────────────────────────────────────────────
  if (view === "chat" && active) {
    const who = speakerName(active);
    const live = loading || speaking;
    return (
      <Shell vars={vars} className="vx-chat">
        <TopBar left={<button className="vx-link" onClick={() => { stopSpeech(); setView("gallery"); }}>All voices</button>} right={account()} />
        <div className="vx-chat-wrap">
          <aside className="vx-dossier">
            <Plate f={active} />
            <div className="vx-dossier-body">
              <h1 className="vx-dossier-name">{active.name}</h1>
              <p className="vx-dossier-title">{active.title}</p>
              <p className="vx-dossier-years">{active.years}</p>
              <h2 className="vx-dossier-h">Draws on</h2>
              <ul className="vx-sources">{active.primarySources.map((s) => <li key={s}>{s}</li>)}</ul>
              {active.portraitCredit && <p className="vx-credit">Portrait: {active.portraitCredit}</p>}
            </div>
          </aside>
          <section className="vx-convo" aria-label={`Conversation with ${active.name}`}>
            <div className={`vx-voiceprint ${live ? "is-live" : ""}`} aria-hidden="true">
              {Array.from({ length: 64 }).map((_, i) => <span key={i} style={{ animationDelay: `${(i * 53) % 900}ms` }} />)}
            </div>
            <p className="vx-live-label" aria-live="polite">{loading ? `${who} is considering your question…` : speaking ? `${who} is speaking` : " "}</p>
            <div className="vx-transcript">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="vx-q"><p>{m.text}</p></div>
                ) : (
                  <div key={i} className={`vx-a ${m.system ? "is-system" : ""}`}>
                    <div className="vx-a-head">
                      <span className="vx-a-who">{who}</span>
                      {!m.system && (
                        <button className="vx-icon" onClick={() => { setSpeaking(true); speakText(m.text, active.voiceProfile, () => setSpeaking(false)); }} aria-label="Read aloud" title="Read aloud">
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                    <p className="vx-a-text">{m.text}</p>
                  </div>
                )
              )}
              {loading && <div className="vx-a"><div className="vx-a-head"><span className="vx-a-who">{who}</span></div><div className="vx-dots"><span /><span /><span /></div></div>}
              <div ref={endRef} />
            </div>
            <div className="vx-composer">
              <button
                className={`vx-mic ${listening ? "is-on" : ""}`}
                onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening}
                aria-label={listening ? "Listening" : "Hold to speak"} title={listening ? "Listening…" : "Hold to speak"}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={`Ask ${who} a question`}
                rows={2}
                aria-label={`Ask ${who} a question`}
              />
              <button className="vx-btn vx-send" onClick={() => send(input)} disabled={loading || !input.trim()}>Ask</button>
            </div>
            <p className="vx-fine vx-center-text">
              An AI interpretation for learning, grounded in the documented writings of {active.name}. Not the person, and not a direct quotation unless cited.
              {active.limitedRecord && " Limited record: answers stay within verified writings."}
            </p>
          </section>
        </div>
      </Shell>
    );
  }
  return null;
}

// ── LAYOUT PIECES (module level so inputs keep focus between renders) ────────
function Shell({ vars, className = "", children }) {
  return (
    <div className={`vx ${className}`} style={vars}>
      <style>{CSS}</style>
      {children}
    </div>
  );
}

function TopBar({ left, right }) {
  return (
    <header className="vx-top">
      <div className="vx-top-l">{left}</div>
      <a className="vx-brand" href={`${HUB}/`}>Voices Across History<sup>™</sup></a>
      <div className="vx-top-r">{right}</div>
    </header>
  );
}

// ── PORTRAIT PLATE ────────────────────────────────────────────────────────────
// Archival portraits rendered as tinted, engraved plates; a monogram plate if no image loads.
function Plate({ f }) {
  const [failed, setFailed] = useState(!f.portrait);
  const src = f.portrait && !/^https?:/.test(f.portrait) ? `${BASE}${f.portrait.replace(/^\//, "")}` : f.portrait;
  return (
    <span className={`vx-plate ${failed ? "" : "has-img"}`} style={{ "--tint": f.color }}>
      {failed ? (
        <span className="vx-plate-mono">{f.monogram || initials(f.name)}</span>
      ) : (
        <img src={src} alt={f.name} onError={() => setFailed(true)} referrerPolicy="no-referrer" loading="lazy" />
      )}
      <span className="vx-plate-engrave" aria-hidden="true" />
    </span>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const CSS = `
.vx { --serif: "Newsreader", Georgia, serif; --sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  min-height: 100vh; background: radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); color: var(--paper);
  font-family: var(--sans); font-size: 15px; line-height: 1.55; -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; }
.vx *, .vx *::before, .vx *::after { box-sizing: border-box; }
.vx button { font: inherit; color: inherit; }
.vx :focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; border-radius: 4px; }
.vx a { color: inherit; }

.vx-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--ink) 82%, transparent); backdrop-filter: blur(10px); }
.vx-top-l { justify-self: start; } .vx-top-r { justify-self: end; }
.vx-brand { font-family: var(--serif); font-size: 17px; letter-spacing: 0.01em; text-decoration: none; color: var(--paper); white-space: nowrap; }
.vx-brand sup { font-size: 9px; color: var(--muted); }
.vx-link { background: none; border: none; padding: 4px 0; cursor: pointer; color: var(--muted); text-decoration: none; font-size: 14px; }
.vx-link:hover { color: var(--paper); }
.vx-account { display: flex; gap: 14px; align-items: center; font-size: 13px; color: var(--faint); }
.vx-account-email { max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 700px) { .vx-account-email { display: none; } .vx-top { padding: 12px 16px; } .vx-brand { font-size: 15px; } }

.vx-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 22px; border-radius: 10px; border: 1px solid transparent;
  background: var(--accent); color: var(--ink); font-weight: 600; font-size: 15px; cursor: pointer; transition: background .15s, transform .15s; }
.vx-btn:hover:not(:disabled) { background: var(--accent-soft); }
.vx-btn:active:not(:disabled) { transform: translateY(1px); }
.vx-btn:disabled { opacity: .55; cursor: not-allowed; }
.vx-btn-wide { width: 100%; }
.vx-btn-quiet { background: transparent; border-color: var(--line); color: var(--paper); }
.vx-btn-quiet:hover:not(:disabled) { background: var(--deep); }
.vx-center-text { display: block; margin: 14px auto 0; text-align: center; }

.vx-kicker { margin: 0 0 10px; font-size: 13px; color: var(--accent); letter-spacing: .02em; }
.vx-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(30px, 4vw, 44px); line-height: 1.08; margin: 0 0 8px; letter-spacing: -0.01em; }
.vx-h2 { font-family: var(--serif); font-weight: 500; font-size: 30px; line-height: 1.15; margin: 0 0 14px; }
.vx-muted { color: var(--muted); margin: 0 0 18px; max-width: 62ch; }
.vx-fine { font-size: 12px; color: var(--faint); line-height: 1.5; margin: 16px 0 0; }
.vx-fine a { color: var(--muted); }
.vx-note { border-radius: 10px; padding: 10px 14px; font-size: 14px; margin: 0 0 14px; }
.vx-note-ok { background: rgba(70,170,120,.14); border: 1px solid rgba(90,190,140,.35); color: #CDEFDD; }
.vx-note-err { background: rgba(200,80,60,.14); border: 1px solid rgba(220,100,80,.4); color: #F6CABF; }
.vx-status { margin: 14px 0 0; font-size: 13px; color: var(--signal); }

/* Landing */
.vx-hero { flex: 1; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 56px; align-items: center; max-width: 1180px; width: 100%; margin: 0 auto; padding: 56px 24px; }
.vx-title { font-family: var(--serif); font-weight: 400; font-size: clamp(56px, 8.5vw, 112px); line-height: .92; letter-spacing: -0.035em; margin: 0 0 22px; }
.vx-lede { font-family: var(--serif); font-size: 21px; line-height: 1.5; color: var(--muted); margin: 0 0 30px; max-width: 34ch; }
.vx-facts { display: flex; gap: 34px; margin: 0 0 30px; padding: 18px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.vx-facts div { margin: 0; } .vx-facts dt { font-family: var(--serif); font-size: 30px; line-height: 1; color: var(--paper); }
.vx-facts dd { margin: 6px 0 0; font-size: 13px; color: var(--faint); }
.vx-cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px; }
.vx-price { margin: 0; font-size: 14px; color: var(--muted); max-width: 30ch; }
.vx-price strong { color: var(--paper); font-weight: 600; }
.vx-mosaic { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.vx-mosaic-cell { position: relative; aspect-ratio: 3 / 4; opacity: 0; animation: vx-develop .9s ease forwards; }
.vx-mosaic-cell .vx-plate { height: 100%; }
.vx-mosaic-name { position: absolute; left: 10px; bottom: 8px; font-size: 12px; color: var(--paper); text-shadow: 0 1px 8px rgba(0,0,0,.8); }
@keyframes vx-develop { from { opacity: 0; filter: brightness(2.2) blur(6px); } to { opacity: 1; filter: none; } }
.vx-foot { display: flex; gap: 22px; justify-content: center; flex-wrap: wrap; padding: 22px 16px 30px; border-top: 1px solid var(--line); }
@media (max-width: 900px) { .vx-hero { grid-template-columns: 1fr; gap: 36px; padding: 36px 16px; } .vx-lede { font-size: 19px; } .vx-facts { gap: 22px; } }

/* Plates */
.vx-plate { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; border-radius: 6px; background: color-mix(in srgb, var(--tint, var(--accent)) 35%, var(--deep)); isolation: isolate; }
.vx-plate.has-img { background: color-mix(in srgb, var(--accent) 34%, var(--ink)); }
.vx-plate img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; filter: grayscale(1) contrast(1.12) brightness(.92); mix-blend-mode: luminosity; }
.vx-plate::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, color-mix(in srgb, var(--ink) 75%, transparent)); pointer-events: none; }
.vx-plate-engrave { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: .22;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.55) 0 1px, transparent 1px 3px); mix-blend-mode: multiply; }
.vx-plate-mono { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 44px; color: var(--paper); opacity: .85; letter-spacing: .04em; }

/* Gallery */
.vx-gallery { max-width: 1180px; width: 100%; margin: 0 auto; padding: 40px 24px 20px; flex: 1; }
.vx-gallery-head { margin-bottom: 26px; }
.vx-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.vx-chips button { border: 1px solid var(--line); background: transparent; border-radius: 999px; padding: 6px 14px; font-size: 13px; color: var(--muted); cursor: pointer; }
.vx-chips button[aria-pressed="true"] { background: var(--paper); color: var(--ink); border-color: var(--paper); }
.vx-section { margin-top: 30px; }
.vx-section-title { font-family: var(--serif); font-weight: 500; font-size: 22px; margin: 0 0 14px; }
.vx-section-title span { font-family: var(--sans); font-size: 13px; color: var(--faint); font-weight: 400; margin-left: 6px; }
.vx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
.vx-card { display: flex; flex-direction: column; text-align: left; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--deep); cursor: pointer; overflow: hidden; transition: border-color .2s; }
.vx-card .vx-plate { aspect-ratio: 4 / 5; height: auto; border-radius: 0; }
.vx-card:hover { border-color: var(--accent); }
.vx-card:hover .vx-plate img { filter: grayscale(.15) contrast(1.05); mix-blend-mode: normal; }
.vx-card-body { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px 14px; }
.vx-card-name { font-family: var(--serif); font-size: 18px; line-height: 1.2; color: var(--paper); }
.vx-card-title { font-size: 13px; color: var(--muted); line-height: 1.4; }
.vx-card-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--faint); font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .vx-grid { grid-template-columns: 1fr 1fr; gap: 10px; } .vx-card-name { font-size: 15px; } .vx-card-title { display: none; } .vx-gallery { padding: 26px 14px 10px; } }

/* Auth / join */
.vx-center main, .vx-center .vx-panel { margin: 0 auto; }
.vx-panel { width: 100%; max-width: 440px; margin: 48px auto; padding: 30px 28px; border: 1px solid var(--line); border-radius: 16px; background: color-mix(in srgb, var(--deep) 88%, transparent); }
@media (max-width: 520px) { .vx-panel { margin: 22px 14px; padding: 24px 18px; width: auto; } }
.vx-seg { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; margin-bottom: 14px; }
.vx-seg button { flex: 1; padding: 8px; border: none; border-radius: 7px; background: transparent; color: var(--muted); cursor: pointer; font-size: 14px; }
.vx-seg button[aria-selected="true"] { background: var(--raise); color: var(--paper); }
.vx-field { display: block; margin-bottom: 12px; }
.vx-field span { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.vx-field input, .vx-inline input, .vx-composer textarea { width: 100%; background: var(--ink); border: 1px solid var(--line); border-radius: 10px; color: var(--paper); padding: 11px 13px; font: inherit; font-size: 15px; }
.vx-field input:focus, .vx-inline input:focus, .vx-composer textarea:focus { outline: none; border-color: var(--signal); }
.vx-inline { display: flex; gap: 8px; margin-top: 14px; }
.vx-inline input { text-transform: uppercase; letter-spacing: .06em; }
.vx-pricecard { display: flex; align-items: baseline; gap: 10px; padding: 16px 0; margin: 0 0 18px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.vx-pricecard-amt { font-family: var(--serif); font-size: 40px; line-height: 1; }
.vx-pricecard-per { color: var(--muted); font-size: 14px; }

/* Chat */
.vx-chat-wrap { flex: 1; display: grid; grid-template-columns: 300px minmax(0, 1fr); max-width: 1180px; width: 100%; margin: 0 auto; }
.vx-dossier { border-right: 1px solid var(--line); padding: 24px 22px; position: sticky; top: 57px; align-self: start; max-height: calc(100vh - 57px); overflow-y: auto; }
.vx-dossier .vx-plate { aspect-ratio: 4 / 5; height: auto; margin-bottom: 16px; }
.vx-dossier-name { font-family: var(--serif); font-weight: 500; font-size: 26px; line-height: 1.1; margin: 0 0 6px; }
.vx-dossier-title { color: var(--muted); font-size: 14px; margin: 0 0 4px; }
.vx-dossier-years { color: var(--faint); font-size: 13px; margin: 0 0 18px; font-variant-numeric: tabular-nums; }
.vx-dossier-h { font-size: 13px; font-weight: 600; color: var(--accent); margin: 0 0 8px; }
.vx-sources { list-style: none; margin: 0; padding: 0; }
.vx-sources li { font-family: var(--serif); font-size: 15px; padding: 7px 0; border-top: 1px solid var(--line); color: var(--paper); }
.vx-credit { font-size: 11px; color: var(--faint); margin: 14px 0 0; }
.vx-convo { display: flex; flex-direction: column; min-height: calc(100vh - 57px); padding: 0 28px; }
.vx-voiceprint { display: flex; align-items: center; justify-content: space-between; height: 44px; margin-top: 18px; padding: 0 2px; }
.vx-voiceprint span { width: 3px; height: 2px; border-radius: 2px; background: color-mix(in srgb, var(--signal) 45%, transparent); transition: height .3s; }
.vx-voiceprint.is-live span { background: var(--signal); animation: vx-wave 900ms ease-in-out infinite alternate; }
@keyframes vx-wave { 0% { height: 3px; } 35% { height: 26px; } 60% { height: 9px; } 100% { height: 38px; } }
.vx-live-label { min-height: 20px; margin: 6px 0 0; font-size: 13px; color: var(--signal); }
.vx-transcript { flex: 1; padding: 18px 0 24px; display: flex; flex-direction: column; gap: 22px; }
.vx-q { align-self: flex-end; max-width: 78%; background: var(--raise); border: 1px solid var(--line); border-radius: 14px 14px 4px 14px; padding: 10px 14px; }
.vx-q p { margin: 0; white-space: pre-wrap; }
.vx-a { max-width: 70ch; border-left: 2px solid var(--accent); padding-left: 16px; }
.vx-a.is-system { border-left-color: var(--faint); opacity: .85; }
.vx-a-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.vx-a-who { font-size: 13px; font-weight: 600; color: var(--accent); }
.vx-a-text { margin: 0; font-family: var(--serif); font-size: 19px; line-height: 1.62; white-space: pre-wrap; color: var(--paper); }
.vx-icon { display: inline-flex; padding: 4px; border: none; background: none; color: var(--faint); cursor: pointer; border-radius: 6px; }
.vx-icon:hover { color: var(--signal); }
.vx-dots { display: flex; gap: 5px; padding: 8px 0; }
.vx-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--signal); animation: vx-dot 1.2s infinite; }
.vx-dots span:nth-child(2) { animation-delay: .2s; } .vx-dots span:nth-child(3) { animation-delay: .4s; }
@keyframes vx-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }
.vx-composer { position: sticky; bottom: 0; display: flex; gap: 10px; align-items: flex-end; padding: 14px 0; background: linear-gradient(180deg, transparent, var(--ink) 30%); }
.vx-composer textarea { resize: none; line-height: 1.5; min-height: 48px; }
.vx-mic { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--line); background: var(--deep); color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.vx-mic.is-on { background: #8B2A1E; color: #fff; border-color: transparent; }
.vx-send { min-height: 48px; }
@media (max-width: 860px) {
  .vx-chat-wrap { grid-template-columns: 1fr; }
  .vx-dossier { position: static; max-height: none; border-right: none; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: 76px 1fr; gap: 14px; padding: 16px; }
  .vx-dossier .vx-plate { aspect-ratio: 1; margin: 0; border-radius: 50%; }
  .vx-dossier-name { font-size: 20px; } .vx-dossier-years { margin-bottom: 0; }
  .vx-dossier-h, .vx-sources, .vx-credit { display: none; }
  .vx-convo { padding: 0 16px; min-height: auto; }
  .vx-a-text { font-size: 17px; } .vx-q { max-width: 88%; }
}
@media (prefers-reduced-motion: reduce) {
  .vx-mosaic-cell { animation: none; opacity: 1; }
  .vx-voiceprint.is-live span { animation: none; height: 14px; }
  .vx-dots span { animation: none; opacity: .7; }
}
`;
