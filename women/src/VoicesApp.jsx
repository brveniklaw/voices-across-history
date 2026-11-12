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

function speakText(text, voiceProfile = {}, onEnd, { queue = false } = {}) {
  if (!window.speechSynthesis) { onEnd && onEnd(); return; }
  if (!queue) window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(forSpeech(text));
  const chosen = pickVoice(voiceProfile);
  if (chosen) { utter.voice = chosen; utter.lang = chosen.lang; } else { utter.lang = voiceProfile.lang === "en-GB-scotland" ? "en-GB" : (voiceProfile.lang || "en-US"); }
  utter.pitch = voiceProfile.pitch || 1;
  utter.rate = voiceProfile.rate || 0.9;
  utter.onend = onEnd || null;
  window.speechSynthesis.speak(utter);
}
const stopSpeech = () => window.speechSynthesis && window.speechSynthesis.cancel(); // onend clears the lit portrait

// Replies are written as plain spoken prose, but a stray bit of formatting can still slip through.
// tidyReply cleans what's shown on screen; forSpeech also turns symbols the device voice would
// otherwise read aloud ("asterisk", "dash", "slash") into natural pauses or words.
function tidyReply(text = "") {
  return String(text)
    .replace(/\r/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")                 // headings
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")     // bold
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1$2")     // italics with *
    .replace(/(^|\s)_([^_\n]+)_(?=\s|[.,;:!?]|$)/g, "$1$2") // italics with _
    .replace(/^\s*[-*•]\s+/gm, "")                       // bullet markers
    .replace(/^\s*\d+[.)]\s+(?=\S)/gm, "")                // numbered list markers
    .replace(/^\s*>\s?/gm, "")                           // block quotes
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")             // links
    .replace(/\*{1,3}|_{2,}/g, "")                        // leftover emphasis marks
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function forSpeech(text = "") {
  return tidyReply(text)
    .replace(/\(([^)]*)\)/g, ", $1,")                     // asides in brackets become spoken asides
    .replace(/\s*[—–]\s*/g, ", ")                         // em and en dashes become pauses
    .replace(/\s+-{1,2}\s+/g, ", ")                       // spaced hyphens used as dashes
    .replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2")           // 1787–1788 → 1787 to 1788
    .replace(/&/g, " and ")
    .replace(/\s\/\s|(?<=[A-Za-z])\/(?=[A-Za-z])/g, " or ")   // and/or, Socrates / Plato
    .replace(/…|\.{3,}/g, ".")
    .replace(/["“”«»]/g, "")
    .replace(/[;:]\s*/g, ", ")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/,\s*([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const initials = (name) => { const w = name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((x) => /^[A-Z]/.test(x)); return w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "?")[0]; };
const speakerName = (f) => f.short || f.name.split(" / ")[0].split(" ").slice(-1)[0];
const groupWord = (g) => (g?.kind === "coop" ? "co-op" : "class");
const newRoundId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const listNames = (names) => (names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

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

  const [view, setView] = useState("landing"); // landing | auth | join | gallery | chat | roundtable | class
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
  const [saying, setSaying] = useState(null); // key of the answer being read aloud
  const say = (key, text, profile, opts) => {
    setSpeaking(true); setSaying(key);
    speakText(text, profile, () => { setSpeaking(false); setSaying(null); opts?.done && opts.done(); }, opts);
  };
  const [listening, setListening] = useState(false);
  const [today, setToday] = useState(false); // "Today's issues" mode
  const endRef = useRef(null);
  const recogRef = useRef(null);

  // roundtable
  const [picking, setPicking] = useState(false);
  const [panel, setPanel] = useState([]); // figure ids, 2–3
  const [table, setTable] = useState([]); // [{ speaker: "visitor" | figureId, text, system? }]
  const [turnOf, setTurnOf] = useState(null); // figure currently answering
  const speechChain = useRef(Promise.resolve());

  // class & co-op leader page
  const [groupData, setGroupData] = useState(null);
  const [groupErr, setGroupErr] = useState("");
  const [openStudent, setOpenStudent] = useState(null);

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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, table, turnOf]);
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
    if (data.access) {
      setAccess(data.access);
      if (data.joined) setNotice(`You've joined ${data.joined.name}. Your ${data.joined.kind === "coop" ? "co-op" : "class"} leader can read the conversations you have here.`);
      if (data.access.active) setView("gallery");
      return;
    }
    setJoinErr(data.error || "That code isn't valid.");
  }

  // ── CHAT ────────────────────────────────────────────────────────────────────
  function openFigure(f) {
    setToday(false);
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
      body: { figureId: active.id, mode: today ? "today" : "record", messages: next.map((m) => ({ role: m.role, content: m.text })) },
    });
    setLoading(false);
    if (ok) {
      setMessages((prev) => [...prev, { role: "assistant", text: data.text, sources: data.sources || [], today: data.mode === "today" }]);
      say(`c${next.length}`, data.text, active.voiceProfile);
      return;
    }
    let reply = "Forgive me — I am presently unable to respond. Please try again.";
    if (status === 401) reply = "Your session has ended. Please sign in again to continue.";
    if (status === 402) { await refreshAccess(token); setView("join"); return; }
    if (status === 429) reply = `You've reached today's limit of ${data.limit || 100} messages. Conversations reopen at midnight (Eastern).`;
    setMessages((prev) => [...prev, { role: "assistant", text: reply, system: true }]);
  }, [messages, active, loading, token, refreshAccess, today]);

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

  // ── ROUNDTABLE ──────────────────────────────────────────────────────────────
  const byId = (id) => figures.find((f) => f.id === id);

  function togglePick(f) {
    setPanel((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : p.length >= 3 ? p : [...p, f.id]));
  }

  function openRoundtable(ids, question) {
    stopSpeech();
    setToday(false);
    speechChain.current = Promise.resolve();
    const names = ids.map((id) => byId(id)?.name).filter(Boolean);
    setPanel(ids);
    setPicking(false);
    setTable([{ speaker: "host", text: `${listNames(names)} have taken their seats. Put a question to the table, and each will answer in turn, responding to the others where their writings agree or differ.` }]);
    setInput(question || "");
    setView("roundtable");
  }

  function queueSpeech(key, text, profile) {
    speechChain.current = speechChain.current.then(() => new Promise((done) => {
      say(key, text, profile, { queue: true, done });
    }));
  }

  const askTable = useCallback(async (text) => {
    if (!text.trim() || turnOf || panel.length < 2) return;
    const roundId = newRoundId();
    let lines = [...table, { speaker: "visitor", text: text.trim() }];
    setTable(lines);
    setInput("");
    for (const id of panel) {
      const f = byId(id);
      setTurnOf(f);
      const { ok, status, data } = await api("roundtable", {
        method: "POST",
        token,
        body: { figureId: id, panel, roundId, mode: today ? "today" : "record", transcript: lines.filter((l) => !l.system && l.speaker !== "host").map((l) => ({ speaker: l.speaker, text: l.text })) },
      });
      if (!ok) {
        setTurnOf(null);
        if (status === 402) { await refreshAccess(token); setView("join"); return; }
        let msg = "The table has fallen quiet. Please try again.";
        if (status === 401) msg = "Your session has ended. Please sign in again to continue.";
        if (status === 429) msg = `You've reached today's limit of ${data.limit || 100} messages. Each voice's answer counts as one. Conversations reopen at midnight (Eastern).`;
        setTable((prev) => [...prev, { speaker: "host", text: msg, system: true }]);
        return;
      }
      lines = [...lines, { speaker: id, text: data.text, sources: data.sources || [], today: data.mode === "today" }];
      setTable(lines);
      queueSpeech(`r${lines.length - 1}`, data.text, f.voiceProfile);
    }
    setTurnOf(null);
  }, [table, panel, turnOf, token, refreshAccess, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CLASS / CO-OP LEADER PAGE ───────────────────────────────────────────────
  async function openClass() {
    setGroupErr(""); setGroupData(null); setOpenStudent(null);
    setView("class");
    const { ok, data } = await api("group", { token });
    if (ok) setGroupData(data); else setGroupErr(data.error || "This page couldn't load. Please try again.");
  }

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
      <Shell vars={vars} era={C.id} className="vx-landing">
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
              <p className="vx-price"><strong>$9.99 a month</strong> for every collection: Republic, Philosophers, Inventors, Explorers and Great Women.</p>
            </div>
            {trialDays !== null && <p className="vx-status">Free trial: {trialDays} day{trialDays === 1 ? "" : "s"} left</p>}
            {access?.staff && <p className="vx-status">IntexiaU staff access</p>}
            {access?.access_type === "group" && access.group && <p className="vx-status">Access through {access.group.name}</p>}
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
      <Shell vars={vars} era={C.id} className="vx-center">
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
      <Shell vars={vars} era={C.id} className="vx-center">
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
            <button className="vx-link vx-center-text" onClick={() => setShowPromo(true)}>Have a promo or class code?</button>
          ) : (
            <form className="vx-inline" onSubmit={redeem}>
              <input aria-label="Promo or class code" placeholder="Promo or class code" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
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
      <Shell vars={vars} era={C.id}>
        <TopBar left={<button className="vx-link" onClick={() => setView("landing")}>{C.titleBottom}</button>} right={account()} />
        <main className="vx-gallery">
          <div className="vx-gallery-head">
            <h1 className="vx-h1">{picking ? "Seat your roundtable" : "Choose a voice"}</h1>
            <p className="vx-muted">
              {picking
                ? "Choose two or three voices. Each will answer your question in turn and respond to the others."
                : "Every answer is grounded in the figure's own writings. Tap a portrait to begin, or seat a roundtable to hear several voices take up one question."}
            </p>
            {notice && <div className="vx-note vx-note-ok">{notice}</div>}
            <div className="vx-actions">
              {!picking ? (
                <button className="vx-btn vx-btn-quiet" onClick={() => { setPanel([]); setPicking(true); }}>Start a roundtable</button>
              ) : (
                <button className="vx-btn vx-btn-quiet" onClick={() => { setPicking(false); setPanel([]); }}>Cancel roundtable</button>
              )}
              {access?.group?.role === "leader" && <button className="vx-btn vx-btn-quiet" onClick={openClass}>Your {groupWord(access.group)}</button>}
            </div>
            {!picking && (C.roundtables || []).length > 0 && (
              <div className="vx-suggest" aria-label="Suggested roundtables">
                {C.roundtables.filter((r) => r.ids.every(byId)).map((r) => (
                  <button key={r.title} className="vx-suggest-card" onClick={() => openRoundtable(r.ids, r.question)}>
                    <span className="vx-suggest-title">{r.title}</span>
                    <span className="vx-suggest-who">{listNames(r.ids.map((id) => speakerName(byId(id))))}</span>
                  </button>
                ))}
              </div>
            )}
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
                    <button
                      key={f.id}
                      className={`vx-card ${picking && panel.includes(f.id) ? "is-picked" : ""}`}
                      onClick={() => (picking ? togglePick(f) : openFigure(f))}
                      aria-pressed={picking ? panel.includes(f.id) : undefined}
                      disabled={picking && !panel.includes(f.id) && panel.length >= 3}
                      style={{ "--tint": f.color }}
                    >
                      {picking && panel.includes(f.id) && <span className="vx-pick-badge" aria-hidden="true">{panel.indexOf(f.id) + 1}</span>}
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
        {picking && (
          <div className="vx-pickbar" role="status">
            <span>{panel.length ? listNames(panel.map((id) => speakerName(byId(id)))) : "No voices chosen yet"}</span>
            <button className="vx-btn" disabled={panel.length < 2} onClick={() => openRoundtable(panel)}>
              {panel.length < 2 ? `Choose ${2 - panel.length} more` : "Begin the roundtable"}
            </button>
          </div>
        )}
        <footer className="vx-foot">
          {(C.otherCollections || []).map((o) => <a key={o.href} href={o.href} className="vx-link">{o.label}</a>)}
        </footer>
      </Shell>
    );
  }

  // ── VIEW: ROUNDTABLE ────────────────────────────────────────────────────────
  if (view === "roundtable" && panel.length >= 2) {
    const seated = panel.map(byId).filter(Boolean);
    const live = !!turnOf || speaking;
    const nameFor = (sp) => (sp === "visitor" ? "You" : speakerName(byId(sp) || { name: "" }));
    const voiceSpeaker = saying && saying[0] === "r" ? table[Number(saying.slice(1))]?.speaker : null;
    return (
      <Shell vars={vars} era={C.id} className="vx-chat">
        <TopBar left={<button className="vx-link" onClick={() => { stopSpeech(); setTurnOf(null); setView("gallery"); }}>All voices</button>} right={account()} />
        <div className="vx-rt-wrap">
          <header className="vx-rt-head">
            <p className="vx-kicker">Roundtable</p>
            <div className={`vx-table n${seated.length}`} role="group" aria-label="Seated at the table">
              <div className="vx-table-top" aria-hidden="true"><span /></div>
              {seated.map((f, i) => {
                const thinking = turnOf?.id === f.id;
                const voicing = voiceSpeaker === f.id;
                return (
                  <div key={f.id} className={`vx-seat s${i} ${thinking ? "is-turn" : ""} ${voicing ? "is-voice" : ""}`} style={{ "--tint": f.color }}>
                    <span className="vx-seat-face"><Plate f={f} /></span>
                    <span className="vx-rt-name">{f.short || f.name}</span>
                    <span className="vx-rt-years">{thinking ? "Thinking" : voicing ? "Speaking" : f.years}</span>
                  </div>
                );
              })}
            </div>
          </header>
          <section className="vx-convo" aria-label="Roundtable conversation">
            <div className={`vx-voiceprint ${live ? "is-live" : ""}`} aria-hidden="true">
              {Array.from({ length: 64 }).map((_, i) => <span key={i} style={{ animationDelay: `${(i * 53) % 900}ms` }} />)}
            </div>
            <p className="vx-live-label" aria-live="polite">{turnOf ? `${speakerName(turnOf)} is considering the question…` : speaking ? "The table is speaking" : " "}</p>
            <div className="vx-transcript">
              {table.map((m, i) =>
                m.speaker === "visitor" ? (
                  <div key={i} className="vx-q"><p>{m.text}</p></div>
                ) : m.speaker === "host" ? (
                  <p key={i} className={`vx-rt-host ${m.system ? "is-system" : ""}`}>{m.text}</p>
                ) : (
                  <div key={i} className={`vx-a is-page ${saying === `r${i}` ? "is-saying" : ""}`} style={{ "--tint": byId(m.speaker)?.color || undefined }}>
                    <div className="vx-a-head">
                      {byId(m.speaker) && <span className="vx-a-face"><Plate f={byId(m.speaker)} /></span>}
                      <span className="vx-a-who">{nameFor(m.speaker)}</span>
                      <button className="vx-icon" onClick={() => say(`r${i}`, m.text, byId(m.speaker)?.voiceProfile)} aria-label="Read aloud" title="Read aloud">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    {m.today && <p className="vx-today-tag">Today's issue: an interpretation from {byId(m.speaker)?.name}'s writings, not a view they held</p>}
                    <p className="vx-a-text">{tidyReply(m.text)}</p>
                    <Cites list={m.sources} f={byId(m.speaker)} />
                  </div>
                )
              )}
              {turnOf && <div className="vx-a"><div className="vx-a-head"><span className="vx-a-who">{speakerName(turnOf)}</span></div><div className="vx-dots"><span /><span /><span /></div></div>}
              <div ref={endRef} />
            </div>
            <div className="vx-dock">
            <ModeSwitch today={today} setToday={setToday} onPick={(q) => setInput(q)} />
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
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askTable(input); } }}
                placeholder={today ? "Put an issue of our time to the table" : "Put a question to the table"}
                rows={2}
                aria-label="Put a question to the table"
              />
              <button className="vx-btn vx-send" onClick={() => askTable(input)} disabled={!!turnOf || !input.trim()}>Ask</button>
            </div>
            </div>
            <p className="vx-fine vx-center-text">
              AI interpretations for learning, each grounded in that figure's documented writings. Each voice's answer counts as one message.
              {access?.group?.role === "member" && ` Your ${groupWord(access.group)} leader can read this conversation.`}
            </p>
          </section>
        </div>
      </Shell>
    );
  }

  // ── VIEW: CLASS / CO-OP (leader) ────────────────────────────────────────────
  if (view === "class") {
    const g = groupData?.group;
    const word = g?.kind === "coop" ? "co-op" : "class";
    const turns = groupData?.turns || [];
    const members = groupData?.members || [];
    const countFor = (email) => turns.filter((t) => t.email === email).length;
    const shown = openStudent ? turns.filter((t) => t.email === openStudent) : [];
    const figureLabel = (t) => (t.app === C.id ? byId(t.figure_id)?.name : null) || t.figure_id.replace(/_/g, " ");
    return (
      <Shell vars={vars} era={C.id}>
        <TopBar left={<button className="vx-link" onClick={() => setView("gallery")}>All voices</button>} right={account()} />
        <main className="vx-gallery">
          {!groupData && !groupErr && <p className="vx-muted">Loading…</p>}
          {groupErr && <div className="vx-note vx-note-err">{groupErr}</div>}
          {g && (
            <>
              <div className="vx-gallery-head">
                <p className="vx-kicker">Your {word}</p>
                <h1 className="vx-h1">{g.name}</h1>
                <p className="vx-muted">
                  Share the code <strong className="vx-code">{g.code}</strong> with your {word === "co-op" ? "families" : "students"}. They enter it under "Have a promo or class code?" after creating their account.
                  {" "}{members.length} of {g.seats} seats taken{g.expires_at ? `, open until ${new Date(g.expires_at).toLocaleDateString()}` : ""}.
                </p>
              </div>
              {members.length === 0 ? (
                <p className="vx-muted">No one has joined yet.</p>
              ) : (
                <div className="vx-class">
                  <ul className="vx-roster" aria-label="Members">
                    {members.map((m) => (
                      <li key={m.email}>
                        <button aria-pressed={openStudent === m.email} onClick={() => setOpenStudent(openStudent === m.email ? null : m.email)}>
                          <span>{m.email}</span>
                          <span className="vx-faint">{countFor(m.email)} answers</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <section className="vx-class-log" aria-label="Conversations">
                    {!openStudent && <p className="vx-muted">Choose a member to read their recent conversations across every collection.</p>}
                    {openStudent && shown.length === 0 && <p className="vx-muted">No conversations yet.</p>}
                    {shown.map((t) => (
                      <article key={t.id} className="vx-log-item">
                        <p className="vx-log-meta">{new Date(t.created_at).toLocaleString()} · {t.app} · {figureLabel(t)}{t.round_id ? " · roundtable" : ""}</p>
                        <p className="vx-log-q">{t.question}</p>
                        <p className="vx-log-a">{tidyReply(t.answer)}</p>
                      </article>
                    ))}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </Shell>
    );
  }

  // ── VIEW: CHAT ──────────────────────────────────────────────────────────────
  if (view === "chat" && active) {
    const who = speakerName(active);
    const live = loading || speaking;
    return (
      <Shell vars={vars} era={C.id} className="vx-chat">
        <TopBar left={<button className="vx-link" onClick={() => { stopSpeech(); setView("gallery"); }}>All voices</button>} right={account()} />
        <div className="vx-chat-wrap">
          <aside className={`vx-dossier ${live ? "is-live" : ""}`}>
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
                  <div key={i} className={`vx-a ${m.system ? "is-system" : "is-page"} ${saying === `c${i}` ? "is-saying" : ""}`} style={{ "--tint": active.color }}>
                    <div className="vx-a-head">
                      {!m.system && <span className="vx-a-face"><Plate f={active} /></span>}
                      <span className="vx-a-who">{who}</span>
                      {!m.system && (
                        <button className="vx-icon" onClick={() => say(`c${i}`, m.text, active.voiceProfile)} aria-label="Read aloud" title="Read aloud">
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                    {m.today && <p className="vx-today-tag">Today's issue: an interpretation from {active.name}'s writings, not a view they held</p>}
                    <p className="vx-a-text">{m.system ? m.text : tidyReply(m.text)}</p>
                    <Cites list={m.sources} f={active} />
                  </div>
                )
              )}
              {loading && <div className="vx-a"><div className="vx-a-head"><span className="vx-a-who">{who}</span></div><div className="vx-dots"><span /><span /><span /></div></div>}
              <div ref={endRef} />
            </div>
            <div className="vx-dock">
            <ModeSwitch today={today} setToday={setToday} onPick={(q) => setInput(q)} />
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
                placeholder={today ? `Ask how ${who} might see an issue of our time` : `Ask ${who} a question`}
                rows={2}
                aria-label={`Ask ${who} a question`}
              />
              <button className="vx-btn vx-send" onClick={() => send(input)} disabled={loading || !input.trim()}>Ask</button>
            </div>
            </div>
            <p className="vx-fine vx-center-text">
              An AI interpretation for learning, grounded in the documented writings of {active.name}. Not the person, and not a direct quotation unless cited.
              {active.limitedRecord && " Limited record: answers stay within verified writings."}
              {access?.group?.role === "member" && ` Your ${groupWord(access.group)} leader can read this conversation.`}
            </p>
          </section>
        </div>
      </Shell>
    );
  }
  return null;
}

// ── LAYOUT PIECES (module level so inputs keep focus between renders) ────────
function Shell({ vars, era, className = "", children }) {
  return (
    <div className={`vx vx-era-${era} ${className}`} style={vars}>
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

// ── CITATIONS & MODE SWITCH ───────────────────────────────────────────────────
function parseCite(c) {
  const m = String(c).match(/^(.*?)\s*\(([^()]*\d{3,4}[^()]*)\)\s*\.?$/);
  return m ? { title: m[1].trim(), year: m[2].trim() } : { title: String(c).trim(), year: "" };
}
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function onList(f, title) {
  const t = norm(title);
  return !!(f && t.length > 3 && f.primarySources.some((s) => { const n = norm(s); return n.includes(t) || t.includes(n); }));
}

function Cites({ list, f }) {
  const [open, setOpen] = useState(-1);
  if (!list || !list.length) return null;
  const items = list.map(parseCite);
  const it = items[open];
  return (
    <div className="vx-cites">
      <span className="vx-cites-h">Sources</span>
      <div className="vx-tabs">
        {items.map((c, k) => (
          <button key={k} type="button" className="vx-tab" aria-expanded={open === k} onClick={() => setOpen(open === k ? -1 : k)}>
            <span className="vx-tab-t">{c.title}</span>{c.year && <span className="vx-tab-y">{c.year}</span>}
          </button>
        ))}
      </div>
      {it && (
        <div className="vx-slip" role="note">
          <p className="vx-slip-t">{it.title}</p>
          {it.year && <p className="vx-slip-y">{it.year}</p>}
          <p className="vx-slip-n">{onList(f, it.title) ? "On this voice's list of primary sources." : "Named by the AI from the wider record. Check the original before quoting it."}</p>
        </div>
      )}
    </div>
  );
}

const TODAY_STARTERS = [
  "Artificial intelligence and work",
  "Social media and free speech",
  "The national debt",
  "Climate and energy",
  "What makes a good citizen today?",
];

function ModeSwitch({ today, setToday, onPick }) {
  return (
    <div className="vx-mode">
      <div className="vx-seg vx-seg-sm" role="radiogroup" aria-label="Kind of question">
        <button type="button" role="radio" aria-checked={!today} onClick={() => setToday(false)}>From their writings</button>
        <button type="button" role="radio" aria-checked={today} onClick={() => setToday(true)}>Today's issues</button>
      </div>
      {today && (
        <>
          <p className="vx-fine vx-mode-note">For questions from our own time. Answers reason from the figure's documented principles, cite them, and lay out the tradeoffs on contested issues rather than taking a side. They're interpretations, not views the figure held.</p>
          <div className="vx-chips" aria-label="Example issues">
            {TODAY_STARTERS.map((q) => <button key={q} type="button" onClick={() => onPick(q)}>{q}</button>)}
          </div>
        </>
      )}
    </div>
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
  min-height: 100vh; min-height: 100dvh; background: radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); color: var(--paper);
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
@media (max-width: 560px) {
  .vx-gallery { padding: 26px 14px 10px; } .vx-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .vx-card .vx-plate { aspect-ratio: 3 / 4; } .vx-card .vx-plate-mono { font-size: 38px; }
  .vx-card-body { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 26px 10px 10px; background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--ink) 88%, transparent) 45%); }
  .vx-card-name { font-size: 16px; } .vx-card-title { display: none; } .vx-card-meta { margin-top: 2px; }
}

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
.vx-dock { position: sticky; bottom: 0; z-index: 12; padding-bottom: env(safe-area-inset-bottom, 0); background: linear-gradient(180deg, transparent, var(--ink) 22px); }
.vx-composer { display: flex; gap: 10px; align-items: flex-end; padding: 10px 0 14px; }
.vx-composer textarea { resize: none; line-height: 1.5; min-height: 48px; }
.vx-mic { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--line); background: var(--deep); color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.vx-mic.is-on { background: #8B2A1E; color: #fff; border-color: transparent; }
.vx-send { min-height: 48px; }
@media (max-width: 860px) {
  .vx-chat-wrap { grid-template-columns: 1fr; }
  .vx-dossier { position: sticky; top: 47px; z-index: 11; max-height: none; border-right: none; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: 52px 1fr; align-items: center; gap: 12px; padding: 10px 16px; background: color-mix(in srgb, var(--ink) 90%, transparent); backdrop-filter: blur(10px); }
  .vx-dossier .vx-plate { aspect-ratio: 1; margin: 0; border-radius: 50%; } .vx-dossier .vx-plate-mono { font-size: 18px; }
  .vx-dossier-name { font-size: 18px; margin: 0; } .vx-dossier-title { display: none; } .vx-dossier-years { margin-bottom: 0; }
  .vx-voiceprint { height: 28px; margin-top: 10px; }
  .vx-composer textarea { font-size: 16px; min-height: 44px; } .vx-mic, .vx-send { min-height: 44px; } .vx-mic { width: 44px; height: 44px; }
  .vx-a.is-page { padding: 12px 14px 14px; } .vx-a.is-page .vx-a-text { font-size: 17px; }
  .vx-mode-note { font-size: 12px; } .vx-mode .vx-chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .vx-mode .vx-chips button { white-space: nowrap; }
  .vx-dossier-h, .vx-sources, .vx-credit { display: none; }
  .vx-convo { padding: 0 16px; min-height: auto; }
  .vx-a-text { font-size: 17px; } .vx-q { max-width: 88%; }
}
/* Citations as source tabs */
.vx-cites { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.vx-cites-h { display: block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--faint); margin-bottom: 6px; }
.vx-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.vx-tab { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; padding: 4px 10px 5px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 6px 6px 2px 2px; background: color-mix(in srgb, var(--paper) 6%, transparent); cursor: pointer; font-size: 13px; color: var(--muted); }
.vx-tab-t { font-family: var(--serif); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 26ch; }
.vx-tab-y { font-size: 12px; color: var(--faint); font-variant-numeric: tabular-nums; }
.vx-tab:hover, .vx-tab[aria-expanded="true"] { border-color: var(--accent); color: var(--paper); }
.vx-tab[aria-expanded="true"] { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.vx-slip { margin-top: 8px; padding: 10px 14px; border-radius: 4px; border: 1px solid var(--line); border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--paper) 7%, var(--deep)); }
.vx-slip-t { margin: 0; font-family: var(--serif); font-size: 16px; color: var(--paper); }
.vx-slip-y { margin: 2px 0 0; font-size: 13px; color: var(--accent); }
.vx-slip-n { margin: 6px 0 0; font-size: 12px; color: var(--faint); }
.vx-today-tag { margin: 0 0 6px; font-size: 12px; color: var(--signal); }
.vx-mode { padding-top: 10px; }
.vx-seg-sm { display: inline-flex; margin-bottom: 8px; }
.vx-seg-sm button { flex: none; padding: 6px 12px; font-size: 13px; }
.vx-seg-sm button[aria-checked="true"] { background: var(--raise); color: var(--paper); }
.vx-mode-note { margin: 0 0 8px; max-width: 70ch; }

/* Answers as pages, with the speaker's portrait */
.vx-a.is-page { --page: color-mix(in srgb, var(--paper) 5%, var(--deep)); position: relative; max-width: 72ch; padding: 14px 20px 16px; border: 1px solid var(--line); border-left: 3px solid var(--tint, var(--accent)); border-radius: 3px 10px 10px 3px; background: var(--page); box-shadow: 0 10px 30px -18px rgba(0,0,0,.7); }
.vx-a.is-page::after { content: ""; position: absolute; top: -1px; right: -1px; width: 18px; height: 18px; border-radius: 0 10px 0 0; background: linear-gradient(225deg, var(--ink) 50%, color-mix(in srgb, var(--paper) 14%, var(--deep)) 50%); }
.vx-a.is-page .vx-a-text { font-size: 19px; }
.vx-a-face { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 1px var(--line); transition: box-shadow .3s; }
.vx-a-face .vx-plate { border-radius: 50%; } .vx-a-face .vx-plate-mono { font-size: 11px; }
.vx-a.is-saying { border-color: color-mix(in srgb, var(--signal) 45%, var(--line)); }
.vx-a.is-saying .vx-a-face { box-shadow: 0 0 0 2px var(--signal), 0 0 14px color-mix(in srgb, var(--signal) 60%, transparent); }
.vx-dossier .vx-plate { transition: box-shadow .4s; }
.vx-dossier.is-live .vx-plate { box-shadow: 0 0 0 2px var(--signal), 0 0 34px color-mix(in srgb, var(--signal) 40%, transparent); animation: vx-glow 1.8s ease-in-out infinite alternate; }
@keyframes vx-glow { from { filter: brightness(.95); } to { filter: brightness(1.12); } }
@media (prefers-reduced-motion: reduce) { .vx-dossier.is-live .vx-plate, .vx-seat.is-turn .vx-seat-face { animation: none; } }

/* Era styling: each collection's own ground and page */
.vx.vx-era-republic { background:
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .86 0 0 0 0 .72 0 0 0 0 .46 0 0 0 .08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
  radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); background-attachment: fixed; }
.vx-era-republic .vx-a.is-page { --page: color-mix(in srgb, #E8D9B5 8%, var(--deep));
  background-image: repeating-linear-gradient(180deg, transparent 0 30px, color-mix(in srgb, var(--accent) 9%, transparent) 30px 31px); }
.vx-era-republic .vx-section-title::after { content: ""; display: block; width: 64px; margin-top: 8px; border-top: 3px double var(--accent); }

.vx.vx-era-philosophers { background:
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='turbulence' baseFrequency='.004 .018' numOctaves='4' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -2.2 .62'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)' opacity='.06'/%3E%3C/svg%3E"),
  radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); background-attachment: fixed; }
.vx-era-philosophers .vx-a.is-page { --page: color-mix(in srgb, #D9D6CF 6%, var(--deep)); border-radius: 2px; }
.vx-era-philosophers .vx-section-title, .vx-era-philosophers .vx-dossier-name { font-variant: small-caps; letter-spacing: .03em; }

.vx.vx-era-inventors { background:
  linear-gradient(color-mix(in srgb, var(--signal) 7%, transparent) 1px, transparent 1px) 0 0 / 140px 140px,
  linear-gradient(90deg, color-mix(in srgb, var(--signal) 7%, transparent) 1px, transparent 1px) 0 0 / 140px 140px,
  linear-gradient(color-mix(in srgb, var(--signal) 3%, transparent) 1px, transparent 1px) 0 0 / 28px 28px,
  linear-gradient(90deg, color-mix(in srgb, var(--signal) 3%, transparent) 1px, transparent 1px) 0 0 / 28px 28px,
  radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); background-attachment: fixed; }
.vx-era-inventors .vx-a.is-page { background-image:
  linear-gradient(color-mix(in srgb, var(--signal) 6%, transparent) 1px, transparent 1px),
  linear-gradient(90deg, color-mix(in srgb, var(--signal) 6%, transparent) 1px, transparent 1px); background-size: 22px 22px; }
.vx-era-inventors .vx-card-meta, .vx-era-inventors .vx-tab-y, .vx-era-inventors .vx-dossier-years { font-family: ui-monospace, Menlo, monospace; }

.vx.vx-era-explorers { background:
  repeating-radial-gradient(circle at 18% 30%, transparent 0 38px, color-mix(in srgb, var(--accent) 7%, transparent) 38px 39px),
  repeating-radial-gradient(circle at 82% 78%, transparent 0 46px, color-mix(in srgb, var(--accent) 6%, transparent) 46px 47px),
  linear-gradient(color-mix(in srgb, var(--paper) 3%, transparent) 1px, transparent 1px) 0 0 / 120px 120px,
  linear-gradient(90deg, color-mix(in srgb, var(--paper) 3%, transparent) 1px, transparent 1px) 0 0 / 120px 120px,
  radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); background-attachment: fixed; }
.vx-era-explorers .vx-a.is-page { --page: color-mix(in srgb, #D8C9A3 7%, var(--deep)); }
.vx-era-explorers .vx-section-title::before { content: "\\2726"; color: var(--signal); margin-right: 8px; font-size: 16px; vertical-align: 2px; }

.vx.vx-era-women { background:
  radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 8%, transparent) 0 2px, transparent 3px) 0 0 / 46px 46px,
  radial-gradient(circle at 50% 50%, transparent 0 14px, color-mix(in srgb, var(--accent) 5%, transparent) 14px 15px, transparent 16px) 23px 23px / 46px 46px,
  radial-gradient(120% 80% at 85% -10%, var(--raise) 0%, var(--ink) 60%); background-attachment: fixed; }
.vx-era-women .vx-a.is-page { --page: color-mix(in srgb, #EAD3D9 7%, var(--deep)); border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); }
.vx-era-women .vx-section-title { font-style: italic; }
.vx-era-women .vx-section-title::after { content: ""; display: block; width: 48px; margin-top: 8px; border-top: 1px solid var(--signal); box-shadow: 0 3px 0 -2px var(--signal); }

/* Roundtable */
.vx-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 4px 0 18px; }
.vx-suggest { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-bottom: 6px; }
.vx-suggest-card { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--deep) 70%, transparent); cursor: pointer; }
.vx-suggest-card:hover { border-color: var(--accent); }
.vx-suggest-title { font-family: var(--serif); font-size: 17px; color: var(--paper); }
.vx-suggest-who { font-size: 13px; color: var(--muted); }
.vx-card { position: relative; }
.vx-card:disabled { opacity: .45; cursor: not-allowed; }
.vx-card.is-picked { border-color: var(--signal); box-shadow: 0 0 0 1px var(--signal) inset; }
.vx-pick-badge { position: absolute; top: 8px; right: 8px; z-index: 3; width: 26px; height: 26px; border-radius: 50%; background: var(--signal); color: var(--ink); font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; }
.vx-pickbar { position: sticky; bottom: 0; z-index: 15; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 24px; border-top: 1px solid var(--line); background: color-mix(in srgb, var(--ink) 92%, transparent); backdrop-filter: blur(10px); }
.vx-pickbar span { color: var(--muted); font-size: 14px; }
.vx-rt-wrap { flex: 1; max-width: 900px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; }
.vx-rt-head { padding: 22px 28px 0; }
.vx-table { position: relative; height: 236px; margin: 4px auto 0; max-width: 720px; }
.vx-table-top { position: absolute; left: 50%; top: 58%; width: 52%; height: 112px; transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(60% 70% at 50% 40%, color-mix(in srgb, var(--accent) 34%, var(--raise)) 0%, color-mix(in srgb, var(--accent) 16%, var(--deep)) 70%, var(--deep) 100%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent), 0 0 0 7px color-mix(in srgb, var(--accent) 10%, transparent), 0 22px 40px -18px rgba(0,0,0,.8); }
.vx-table-top span { position: absolute; inset: 16px 22%; border-radius: 50%; border: 1px dashed color-mix(in srgb, var(--paper) 14%, transparent); }
.vx-table.n2 .vx-table-top { top: 50%; width: 44%; }
.vx-seat { position: absolute; width: 132px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; transition: transform .3s; }
.vx-table.n2 .s0 { left: 4%; top: 50%; transform: translateY(-50%); }
.vx-table.n2 .s1 { right: 4%; top: 50%; transform: translateY(-50%); }
.vx-table.n3 .s0 { left: 2%; top: 46%; }
.vx-table.n3 .s1 { left: 50%; top: 0; transform: translateX(-50%); }
.vx-table.n3 .s2 { right: 2%; top: 46%; }
.vx-seat-face { width: 76px; height: 76px; border-radius: 50%; overflow: hidden; margin-bottom: 6px; box-shadow: 0 0 0 2px var(--line), 0 8px 20px -8px rgba(0,0,0,.8); transition: box-shadow .3s, transform .3s; }
.vx-seat-face .vx-plate { border-radius: 50%; } .vx-seat-face .vx-plate-mono { font-size: 22px; }
.vx-seat.is-turn .vx-seat-face { box-shadow: 0 0 0 2px var(--signal); animation: vx-think 1.2s ease-in-out infinite alternate; }
.vx-seat.is-voice .vx-seat-face { transform: scale(1.08); box-shadow: 0 0 0 3px var(--signal), 0 0 30px color-mix(in srgb, var(--signal) 55%, transparent); }
.vx-seat.is-turn .vx-rt-years, .vx-seat.is-voice .vx-rt-years { color: var(--signal); }
@keyframes vx-think { from { box-shadow: 0 0 0 2px color-mix(in srgb, var(--signal) 40%, transparent); } to { box-shadow: 0 0 0 4px var(--signal); } }
.vx-rt-name { font-family: var(--serif); font-size: 15px; line-height: 1.2; }
.vx-rt-years { font-size: 12px; color: var(--faint); }
.vx-rt-host { margin: 0; font-size: 14px; color: var(--muted); font-style: italic; max-width: 70ch; }
.vx-rt-host.is-system { color: #F6CABF; font-style: normal; }
@media (max-width: 700px) {
  .vx-rt-head { padding: 14px 16px 0; } .vx-pickbar { padding: 10px 16px; }
  .vx-table { height: 176px; } .vx-table-top { height: 74px; width: 46%; } .vx-table.n2 .vx-table-top { width: 40%; }
  .vx-seat { width: 96px; } .vx-seat-face { width: 54px; height: 54px; margin-bottom: 4px; } .vx-seat-face .vx-plate-mono { font-size: 16px; }
  .vx-rt-name { font-size: 13px; } .vx-rt-years { font-size: 11px; }
  .vx-table.n3 .s0, .vx-table.n3 .s2 { top: 50%; }
}

/* Class & co-op leader page */
.vx-code { font-family: ui-monospace, Menlo, monospace; letter-spacing: .06em; color: var(--signal); }
.vx-faint { color: var(--faint); font-size: 12px; }
.vx-class { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 22px; align-items: start; }
.vx-roster { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.vx-roster li + li { border-top: 1px solid var(--line); }
.vx-roster button { width: 100%; display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 10px 14px; background: transparent; border: none; cursor: pointer; overflow-wrap: anywhere; }
.vx-roster button[aria-pressed="true"] { background: var(--raise); }
.vx-log-item { border-top: 1px solid var(--line); padding: 14px 0; }
.vx-log-meta { margin: 0 0 6px; font-size: 12px; color: var(--faint); text-transform: capitalize; }
.vx-log-q { margin: 0 0 6px; font-weight: 600; white-space: pre-wrap; }
.vx-log-a { margin: 0; font-family: var(--serif); font-size: 16px; line-height: 1.55; color: var(--muted); white-space: pre-wrap; }
@media (max-width: 760px) { .vx-class { grid-template-columns: 1fr; } }

@media (prefers-reduced-motion: reduce) {
  .vx-mosaic-cell { animation: none; opacity: 1; }
  .vx-voiceprint.is-live span { animation: none; height: 14px; }
  .vx-dots span { animation: none; opacity: .7; }
}
`;
