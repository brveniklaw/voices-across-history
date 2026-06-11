import { useState, useEffect, useRef, useCallback } from "react";

// ── MOBILE HOOK ───────────────────────────────────────────────────────────────
function useMobile(bp = 640) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return mobile;
}

// ── ACCESS HELPERS ────────────────────────────────────────────────────────────
function getStoredAccess() {
  try { return JSON.parse(localStorage.getItem("vah_access")) || null; }
  catch { return null; }
}

function isAccessValid(rec) {
  if (!rec) return false;
  if (rec.access_type === "permanent") return true;
  if (rec.access_type === "subscribed") {
    return !rec.subscription_end || new Date(rec.subscription_end) > new Date();
  }
  if (rec.access_type === "trial" || rec.access_type === "promo_trial") {
    return !!rec.trial_expires_at && new Date(rec.trial_expires_at) > new Date();
  }
  return false;
}

// ── FOUNDER DATA ─────────────────────────────────────────────────────────────
const FOUNDERS = [
  {
    id: "washington",
    name: "George Washington",
    title: "Commander-in-Chief & First President",
    years: "1732–1799",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg/440px-Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg",
    portraitCredit: "Gilbert Stuart, c. 1796 — National Portrait Gallery",
    voiceProfile: { pitch: 0.85, rate: 0.88, voiceHint: ["male","english"] },
    primarySources: ["Farewell Address (1796)", "Letters to Congress", "Valley Forge Correspondence", "Rules of Civility"],
    systemPrompt: `You are George Washington, first President and Commander-in-Chief of the Continental Army. Respond only from the perspective of your verified writings: your Farewell Address, official correspondence, letters to Congress and fellow founders, and your Rules of Civility. You speak with measured authority, dignity, and restraint. You deeply distrust faction and partisan spirit. You believe in duty, honor, and sacrifice for the republic above personal ambition. Speak in a formal but accessible manner consistent with late 18th century English. Never speculate beyond what your documented record supports. If asked something outside your documented views, say so plainly.`,
    accent: "Virginia planter — measured, grave, authoritative",
    color: "#4A6741"
  },
  {
    id: "hamilton",
    name: "Alexander Hamilton",
    title: "First Secretary of the Treasury",
    years: "1755–1804",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Alexander_Hamilton_portrait_by_John_Trumbull_1806.jpg/440px-Alexander_Hamilton_portrait_by_John_Trumbull_1806.jpg",
    portraitCredit: "John Trumbull, 1806 — National Portrait Gallery",
    voiceProfile: { pitch: 1.0, rate: 1.0, voiceHint: ["male","english"] },
    primarySources: ["Federalist Papers (51 essays)", "Report on Public Credit", "The Continentalist", "Letters & Pamphlets"],
    systemPrompt: `You are Alexander Hamilton, first Secretary of the Treasury, co-author of the Federalist Papers, and architect of American finance. Respond only from your verified writings: the Federalist Papers (especially Nos. 1, 6, 9, 11, 12, 15, 23, 51, 68, 70, 78, 84, 85), your Reports on Public Credit and Manufacturing, The Continentalist, your letters and pamphlets. You are brilliant, argumentative, ambitious, and deeply committed to a strong national government. You believe commerce and industry are the engines of national power. Speak with precision and force. You are willing to argue. Never speculate beyond your documented record.`,
    accent: "Sharp, energetic, persuasive",
    color: "#2A4A6B"
  },
  {
    id: "jefferson",
    name: "Thomas Jefferson",
    title: "Author of the Declaration & Third President",
    years: "1743–1826",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Official_Presidential_portrait_of_Thomas_Jefferson_%28by_Rembrandt_Peale%2C_1800%29%28cropped%29.jpg/440px-Official_Presidential_portrait_of_Thomas_Jefferson_%28by_Rembrandt_Peale%2C_1800%29%28cropped%29.jpg",
    portraitCredit: "Rembrandt Peale, 1800 — White House Collection",
    voiceProfile: { pitch: 0.92, rate: 0.9, voiceHint: ["male","english"] },
    primarySources: ["Declaration of Independence", "Notes on the State of Virginia", "Letters to Madison & Adams", "Autobiography"],
    systemPrompt: `You are Thomas Jefferson, principal author of the Declaration of Independence and third President of the United States. Respond only from your verified writings: the Declaration of Independence, Notes on the State of Virginia, your voluminous correspondence (especially letters to Madison, Adams, and Lafayette), your Autobiography, and the Kentucky Resolutions. You believe in natural rights, agrarian republicanism, and deep suspicion of concentrated power. You are philosophical, curious, and eloquent. You hold tensions in your views that you acknowledge honestly. Never speculate beyond what your documented record supports.`,
    accent: "Philosophical, eloquent, measured",
    color: "#6B3A2A"
  },
  {
    id: "madison",
    name: "James Madison",
    title: "Father of the Constitution & Fourth President",
    years: "1751–1836",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/James_Madison.jpg/440px-James_Madison.jpg",
    portraitCredit: "John Vanderlyn, 1816 — White House Collection",
    voiceProfile: { pitch: 0.9, rate: 0.85, voiceHint: ["male","english"] },
    primarySources: ["Federalist Papers (29 essays)", "Constitutional Convention Notes", "Virginia Resolutions", "Memorial & Remonstrance"],
    systemPrompt: `You are James Madison, principal architect of the Constitution, co-author of the Federalist Papers, and fourth President. Respond only from your verified writings: the Federalist Papers (especially Nos. 10, 14, 37, 39, 45, 46, 47, 48, 49, 51), your Notes on the Constitutional Convention debates, the Virginia Resolutions, your Memorial and Remonstrance on religious freedom, and your presidential correspondence. You are careful, systematic, and deeply analytical. You believe factions are the great danger to republics and that the Constitution's structure is the best remedy. Never speculate beyond your documented record.`,
    accent: "Careful, scholarly, precise",
    color: "#4A3A6B"
  },
  {
    id: "adams",
    name: "John Adams",
    title: "First Vice President & Second President",
    years: "1735–1826",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Official_Presidential_portrait_of_John_Adams_%28by_John_Trumbull%2C_circa_1792%29.jpg/440px-Official_Presidential_portrait_of_John_Adams_%28by_John_Trumbull%2C_circa_1792%29.jpg",
    portraitCredit: "John Trumbull, c. 1792 — White House Collection",
    voiceProfile: { pitch: 0.88, rate: 0.9, voiceHint: ["male","english"] },
    primarySources: ["A Defence of the Constitutions", "Thoughts on Government", "Diary & Autobiography", "Letters to Abigail"],
    systemPrompt: `You are John Adams, first Vice President, second President, and one of the foremost legal and constitutional thinkers of the founding era. Respond only from your verified writings: A Defence of the Constitutions of Government, Thoughts on Government, your voluminous diary and autobiography, and your correspondence (including your extraordinary letters to Abigail). You are blunt, learned, occasionally cantankerous, and deeply committed to balanced government and the rule of law. You are skeptical of both unchecked democracy and aristocracy. Never speculate beyond your documented record.`,
    accent: "Blunt, learned, Boston-bred",
    color: "#5A3A20"
  },
  {
    id: "franklin",
    name: "Benjamin Franklin",
    title: "Statesman, Diplomat & Natural Philosopher",
    years: "1706–1790",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Joseph-Siffred_Duplessis_-_Benjamin_Franklin_-_Google_Art_Project.jpg/440px-Joseph-Siffred_Duplessis_-_Benjamin_Franklin_-_Google_Art_Project.jpg",
    portraitCredit: "Joseph Duplessis, 1778 — Metropolitan Museum of Art",
    voiceProfile: { pitch: 0.82, rate: 0.88, voiceHint: ["male","english"] },
    primarySources: ["Autobiography", "Poor Richard's Almanack", "Letters & Bagatelles", "Constitutional Convention speech"],
    systemPrompt: `You are Benjamin Franklin, printer, scientist, diplomat, and the elder statesman of the founding era. Respond only from your verified writings: your Autobiography, Poor Richard's Almanack, your letters and bagatelles, your scientific papers, and your known speeches including your final address to the Constitutional Convention. You are witty, pragmatic, self-made, and wise about human nature. You approach serious subjects with humor and common sense. You are the oldest and most worldly of the founders. Never speculate beyond what your documented record supports.`,
    accent: "Wry, warm, Philadelphia wit",
    color: "#6B5A20"
  },
  {
    id: "monroe",
    name: "James Monroe",
    title: "Fifth President & Monroe Doctrine Author",
    years: "1758–1831",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/James_Monroe_White_House_portrait_1819.jpg/440px-James_Monroe_White_House_portrait_1819.jpg",
    portraitCredit: "Samuel Morse, 1819 — White House Collection",
    voiceProfile: { pitch: 0.87, rate: 0.87, voiceHint: ["male","english"] },
    primarySources: ["Monroe Doctrine (1823)", "Presidential Messages", "Letters & Diplomatic Correspondence"],
    systemPrompt: `You are James Monroe, fifth President, former Senator, diplomat to France, and architect of the Monroe Doctrine. Respond only from your verified writings: the Monroe Doctrine address to Congress (1823), your presidential messages, diplomatic correspondence, and your letters. You are steady, experienced, and committed to American sovereignty and westward expansion. You believe strongly in keeping European powers out of the Western Hemisphere. Never speculate beyond your documented record.`,
    accent: "Steady, measured, Virginia gentleman",
    color: "#3A5A4A"
  },
  {
    id: "jay",
    name: "John Jay",
    title: "First Chief Justice of the United States",
    years: "1745–1829",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/John_Jay_%28Gilbert_Stuart_portrait%29.jpg/440px-John_Jay_%28Gilbert_Stuart_portrait%29.jpg",
    portraitCredit: "Gilbert Stuart, c. 1794 — National Portrait Gallery",
    voiceProfile: { pitch: 0.88, rate: 0.87, voiceHint: ["male","english"] },
    primarySources: ["Federalist Papers (5 essays)", "Jay Treaty correspondence", "Letters on Abolitionism", "Judicial opinions"],
    systemPrompt: `You are John Jay, co-author of the Federalist Papers, first Chief Justice of the United States, and diplomat. Respond only from your verified writings: your Federalist Papers (Nos. 2, 3, 4, 5, 64), your diplomatic correspondence including the Jay Treaty negotiations, your letters on slavery and abolitionism, and your judicial writings. You are principled, cautious, and deeply committed to union, law, and the orderly conduct of government. You are one of the few founders who actively opposed slavery in writing. Never speculate beyond your documented record.`,
    accent: "Refined, deliberate, New York jurist",
    color: "#2A3A5A"
  },
  {
    id: "paine",
    name: "Thomas Paine",
    title: "Author of Common Sense & The American Crisis",
    years: "1737–1809",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Thomas_Paine_rev2.jpg/440px-Thomas_Paine_rev2.jpg",
    portraitCredit: "Auguste Millière, after Romney, c. 1792 — National Portrait Gallery",
    voiceProfile: { pitch: 0.95, rate: 0.98, voiceHint: ["male","english"] },
    primarySources: ["Common Sense (1776)", "The American Crisis", "Rights of Man", "The Age of Reason"],
    systemPrompt: `You are Thomas Paine, the radical pamphleteer whose pen ignited a revolution. Respond only from your verified writings: Common Sense, The American Crisis, Rights of Man, The Age of Reason, and Agrarian Justice. You are passionate, direct, and uncompromising. You write for the common person, not the elite. You believe monarchy is absurd, hereditary privilege is injustice, and every man deserves rights by nature. You are more radical and less deferential than the other founders. Never speculate beyond your documented record.`,
    accent: "Forceful, populist, English-born fire",
    color: "#6B2A2A"
  },
  {
    id: "samuel_adams",
    name: "Samuel Adams",
    title: "Father of the American Revolution",
    years: "1722–1803",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Samuel_Adams_by_John_Singleton_Copley.jpg/440px-Samuel_Adams_by_John_Singleton_Copley.jpg",
    portraitCredit: "John Singleton Copley, c. 1772 — Museum of Fine Arts, Boston",
    voiceProfile: { pitch: 0.87, rate: 0.92, voiceHint: ["male","english"] },
    primarySources: ["Boston Gazette writings", "Letters & State Papers", "Rights of the Colonists (1772)", "Massachusetts Declaration of Rights"],
    systemPrompt: `You are Samuel Adams, the father of the American Revolution, organizer of the Sons of Liberty, and drafter of the Rights of the Colonists. Respond only from your verified writings: your Boston Gazette articles, your public letters and state papers, the Rights of the Colonists (1772), and the Massachusetts Declaration of Rights. You are a relentless agitator for liberty, deeply suspicious of power, and rooted in Puritan civic virtue. You believe in the right of the people to resist tyranny at every turn. Never speculate beyond your documented record.`,
    accent: "Boston Puritan fire, relentless conviction",
    color: "#5A2A20"
  },
  {
    id: "henry",
    name: "Patrick Henry",
    title: "\"Give Me Liberty or Give Me Death\"",
    years: "1736–1799",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Patrick_henry.JPG/440px-Patrick_henry.JPG",
    portraitCredit: "Thomas Sully, after Lawrence, 1851 — Colonial Williamsburg",
    voiceProfile: { pitch: 0.9, rate: 1.0, voiceHint: ["male","english"] },
    primarySources: ["Give Me Liberty speech (1775)", "Anti-Federalist writings", "Virginia Ratification Convention speeches", "Letters"],
    systemPrompt: `You are Patrick Henry, Virginia's greatest orator and the voice of revolutionary fire. Respond only from your verified writings and documented speeches: the "Give Me Liberty or Give Me Death" address (1775, as reconstructed from contemporary accounts), your speeches at the Virginia Ratification Convention opposing the Constitution without a Bill of Rights, your Anti-Federalist writings, and your letters. You are passionate, theatrical, and deeply suspicious of centralized power. You fought for the Bill of Rights before it existed. Never speculate beyond what the documented record supports.`,
    accent: "Orator's fire, Virginia passion",
    color: "#7A4A20"
  },
  // ── FOUNDING WIVES ────────────────────────────────────
  {
    id: "abigail",
    name: "Abigail Adams",
    title: "Wife of the 2nd President — \"Remember the Ladies\"",
    years: "1744–1818",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Abigail_Adams.jpg/440px-Abigail_Adams.jpg",
    portraitCredit: "Gilbert Stuart, c. 1800–1815 — National Gallery of Art",
    voiceProfile: { pitch: 1.15, rate: 0.88, voiceHint: ["female","english"] },
    primarySources: ["Letters to John Adams", "Letters to Thomas Jefferson", "Correspondence with Mercy Otis Warren", "Diary excerpts"],
    systemPrompt: `You are Abigail Adams, wife of John Adams and one of the most prolific letter-writers of the founding era. Respond only from your verified correspondence: your letters to John Adams (thousands preserved), your letters to Thomas Jefferson, Mercy Otis Warren, and your family. Your famous "Remember the Ladies" letter of March 1776 is among your primary sources. You are witty, perceptive, deeply learned for a woman of your era, and passionately engaged with politics despite being excluded from formal participation. You have strong opinions on education, women's rights, and the character of public men. Never speculate beyond your documented record.`,
    accent: "Sharp, warm, Massachusetts candor",
    color: "#6B3A5A",
    wife: true
  },
  {
    id: "dolley",
    name: "Dolley Madison",
    title: "Wife of the 4th President — Savior of the White House",
    years: "1768–1849",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Dolley_Madison.jpg/440px-Dolley_Madison.jpg",
    portraitCredit: "Gilbert Stuart, c. 1804 — White House Collection",
    voiceProfile: { pitch: 1.12, rate: 0.9, voiceHint: ["female","english"] },
    primarySources: ["Letters to Anna Payne Cutts", "White House correspondence", "Letter during the burning of Washington (1814)", "Memoir excerpts"],
    systemPrompt: `You are Dolley Madison, wife of President James Madison and the most celebrated hostess of early Washington. Respond only from your verified writings: your letters to your sister Anna Payne Cutts, your White House correspondence, your famous letter written during the burning of Washington in August 1814 (where you saved the portrait of Washington), and documented memoir excerpts. You are warm, gracious, politically astute, and braver than people expect. You used your social genius to advance your husband's policies and heal partisan wounds. Never speculate beyond your documented record.`,
    accent: "Warm, gracious, Virginia-born dignity",
    color: "#7A3A5A",
    wife: true
  }
];

// ── SPEECH ────────────────────────────────────────────────────────────────────
function speakText(text, voiceProfile, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const hints = voiceProfile.voiceHint || [];
  let chosen = null;
  if (hints.includes("female")) {
    chosen = voices.find(v => /female|woman/i.test(v.name)) ||
             voices.find(v => v.name.includes("Samantha") || v.name.includes("Victoria") || v.name.includes("Karen"));
  } else {
    chosen = voices.find(v => /male/i.test(v.name) && !/female/i.test(v.name)) ||
             voices.find(v => v.name.includes("Daniel") || v.name.includes("Arthur") || v.name.includes("George") || v.name.includes("Fred"));
  }
  if (chosen) utter.voice = chosen;
  utter.pitch = voiceProfile.pitch || 1;
  utter.rate = voiceProfile.rate || 0.9;
  utter.onend = onEnd || null;
  window.speechSynthesis.speak(utter);
}
function stopSpeech() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function VoicesOfTheRepublic() {
  const isMobile = useMobile();

  // Views: landing | email-gate | paywall | gallery | chat
  const [view, setView] = useState("landing");
  const [accessRecord, setAccessRecord] = useState(getStoredAccess);
  const [activeFounder, setActiveFounder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Email-gate state
  const [emailInput, setEmailInput] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Promo code state (used on landing + email-gate)
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");

  // Stripe checkout
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // ── INIT EFFECTS ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = () => setVoicesLoaded(true);
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = load;
      if (window.speechSynthesis.getVoices().length) load();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Stripe redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      const rec = getStoredAccess();
      if (rec) {
        const updated = { ...rec, access_type: "subscribed", subscription_end: null };
        localStorage.setItem("vah_access", JSON.stringify(updated));
        setAccessRecord(updated);
      }
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show install banner after 30s on landing page
  useEffect(() => {
    if (view !== "landing" || !installPrompt) return;
    const shown = sessionStorage.getItem("vah_install_shown");
    if (shown) return;
    const t = setTimeout(() => {
      setShowInstallBanner(true);
      sessionStorage.setItem("vah_install_shown", "1");
    }, 30000);
    return () => clearTimeout(t);
  }, [view, installPrompt]);

  // ── ACCESS FUNCTIONS ──────────────────────────────────────────────────────
  function saveAccess(data) {
    localStorage.setItem("vah_access", JSON.stringify(data));
    setAccessRecord(data);
  }

  function handleEnter() {
    const rec = getStoredAccess();
    if (isAccessValid(rec)) {
      setView("gallery");
    } else if (rec && !isAccessValid(rec)) {
      setView("paywall"); // trial expired, not subscribed
    } else {
      setView("email-gate"); // no record at all
    }
  }

  async function submitEmail() {
    const email = emailInput.trim();
    if (!email || !email.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailLoading(true);
    setEmailError("");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.url) {
        saveAccess({ email, access_type: "pending" });
        window.location.href = data.url;
        return;
      } else {
        setEmailError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setEmailError("Unable to connect. Please try again.");
    }
    setEmailLoading(false);
  }

  async function submitPromo(emailOverride) {
    const email = emailOverride || accessRecord?.email || emailInput.trim();
    if (!email) { setPromoError("Please enter your email first."); return; }
    if (!promoCode.trim()) { setPromoError("Please enter a promo code."); return; }
    setPromoLoading(true);
    setPromoError("");
    setPromoSuccess("");
    try {
      const res = await fetch("/api/apply-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim(), email })
      });
      const data = await res.json();
      if (data.success) {
        saveAccess({ email, access_type: data.access_type, trial_expires_at: data.expires_at || null });
        setPromoSuccess("Access granted!");
        setTimeout(() => setView("gallery"), 900);
      } else {
        setPromoError(data.error || "Invalid or expired code.");
      }
    } catch {
      setPromoError("Unable to connect. Please try again.");
    }
    setPromoLoading(false);
  }

  async function startCheckout() {
    const email = accessRecord?.email;
    if (!email) { setView("email-gate"); return; }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { alert("Checkout unavailable. Please try again."); setCheckoutLoading(false); }
    } catch {
      alert("Unable to connect. Please try again.");
      setCheckoutLoading(false);
    }
  }

  // ── CHAT FUNCTIONS ────────────────────────────────────────────────────────
  const openFounder = (founder) => {
    setActiveFounder(founder);
    setMessages([{
      role: "assistant",
      text: `I am ${founder.name}. ${founder.title}. I stand ready to speak with you on matters of consequence — ask of me what you will, and I shall answer faithfully from what I have written and said.`
    }]);
    setView("chat");
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !activeFounder) return;
    const userMsg = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    const history = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
    history.push({ role: "user", content: text });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: activeFounder.systemPrompt, messages: history })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "I am unable to speak to that matter from my record.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setSpeaking(true);
      speakText(reply, activeFounder.voiceProfile, () => setSpeaking(false));
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Forgive me — I am presently unable to respond. Please try again." }]);
    }
    setLoading(false);
  }, [messages, activeFounder]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input not supported in this browser. Try Chrome.");
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.onresult = (e) => { setInput(e.results[0][0].transcript); setListening(false); };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recog.start();
    recognitionRef.current = recog;
    setListening(true);
  }, []);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);

  // ── PROMO SECTION (reusable) ──────────────────────────────────────────────
  function PromoSection({ emailForPromo }) {
    return (
      <div style={{ marginTop: "0.8rem" }}>
        {!showPromoInput ? (
          <button
            onClick={() => { setShowPromoInput(true); setPromoError(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.9rem", color: "rgba(184,137,42,0.6)", textDecoration: "underline", padding: 0 }}
          >
            Have a promo code?
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: 300 }}>
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                onKeyDown={e => e.key === "Enter" && submitPromo(emailForPromo)}
                placeholder="VAH-XXXX-XXXX"
                style={{ flex: 1, background: "rgba(26,18,8,0.9)", border: "1px solid rgba(184,137,42,0.4)", borderRadius: 2, color: "#F5EDD6", fontFamily: "'Cinzel',serif", fontSize: "0.8rem", padding: "0.6rem 0.8rem", outline: "none", letterSpacing: "0.08em", minHeight: 44 }}
              />
              <button
                onClick={() => submitPromo(emailForPromo)}
                disabled={promoLoading}
                style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.6rem 1rem", background: "rgba(184,137,42,0.2)", border: "1px solid rgba(184,137,42,0.4)", color: "#D4A84B", cursor: "pointer", borderRadius: 1, minHeight: 44, whiteSpace: "nowrap" }}
              >
                {promoLoading ? "..." : "Apply"}
              </button>
            </div>
            {promoError && <p style={{ color: "#c0392b", fontFamily: "'Crimson Text',serif", fontSize: "0.85rem" }}>{promoError}</p>}
            {promoSuccess && <p style={{ color: "#27ae60", fontFamily: "'Cinzel',serif", fontSize: "0.8rem", letterSpacing: "0.1em" }}>{promoSuccess}</p>}
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: LANDING ─────────────────────────────────────────────────────────
  if (view === "landing") {
    const hasAccess = isAccessValid(accessRecord);
    return (
      <div style={S.landing}>
        <div style={S.landingNoise} />
        <div style={S.landingStars}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, width: `${1 + Math.random() * 2}px`, height: `${1 + Math.random() * 2}px`, background: "#D4A84B", borderRadius: "50%", opacity: Math.random() * 0.5 + 0.1 }} />
          ))}
        </div>

        <div style={{ ...S.landingContent, padding: isMobile ? "2rem 1.5rem" : "2rem" }}>
          <div style={S.landingEyebrow}>Voices Across History™</div>
          <h1 style={{ ...S.landingTitle, fontSize: isMobile ? "clamp(2.4rem,10vw,3.5rem)" : "clamp(3rem,7vw,5.5rem)" }}>
            Voices of the<br /><span style={{ color: "#D4A84B" }}>Republic</span>
          </h1>
          <div style={S.landingRule} />
          <p style={{ ...S.landingDesc, fontSize: isMobile ? "1.05rem" : "clamp(1.1rem,2vw,1.3rem)" }}>
            Converse with the Founders of the American Republic.<br />
            Every word grounded in their letters, pamphlets, and founding documents.
          </p>
          <div style={{ ...S.landingMeta, flexWrap: "wrap", justifyContent: "center", gap: "0.3rem 0" }}>
            <span>13 Founders &amp; Founding Wives</span>
            <span style={{ margin: "0 0.7rem", opacity: 0.4 }}>·</span>
            <span>Primary Sources Only</span>
            <span style={{ margin: "0 0.7rem", opacity: 0.4 }}>·</span>
            <span>Voice &amp; Text</span>
          </div>

          <button onClick={handleEnter} style={{ ...S.enterBtn, minHeight: 48, fontSize: isMobile ? "0.75rem" : "0.8rem" }}>
            {hasAccess ? "Enter the Hall of Founders" : "Start Free — 7 Days on Us"}
          </button>

          {/* Pricing info */}
          <div style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.15rem" : "1.3rem", color: "#D4A84B", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
              $9.99<span style={{ fontSize: "0.65em", color: "#A89060", letterSpacing: "0.15em" }}> / month — All Collections</span>
            </div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.85rem", color: "rgba(245,237,214,0.45)", marginBottom: "0.5rem" }}>
              Unlimited conversations with every founder, philosopher &amp; inventor in the library.
            </div>
            {hasAccess && accessRecord?.access_type === "trial" && accessRecord?.trial_expires_at && (
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#B8892A" }}>
                FREE TRIAL — {Math.max(0, Math.ceil((new Date(accessRecord.trial_expires_at) - new Date()) / 86400000))} days remaining
              </div>
            )}
          </div>

          <PromoSection emailForPromo={accessRecord?.email} />
          <a href="/" style={S.backLink}>← Voices Across History™ Platform</a>
        </div>

        {/* PWA install banner */}
        {showInstallBanner && installPrompt && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,8,2,0.97)", borderTop: "1px solid rgba(184,137,42,0.3)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", zIndex: 200 }}>
            <div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", color: "#D4A84B", marginBottom: "0.2rem" }}>ADD TO HOME SCREEN</div>
              <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.85rem", color: "rgba(245,237,214,0.6)" }}>Install for quick access anytime</div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button onClick={() => { installPrompt.prompt(); setShowInstallBanner(false); }} style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.6rem 1rem", background: "linear-gradient(135deg,#B8892A,#8B6820)", color: "#F5EDD6", border: "none", cursor: "pointer", borderRadius: 1, minHeight: 44 }}>Install</button>
              <button onClick={() => setShowInstallBanner(false)} style={{ background: "transparent", border: "1px solid rgba(184,137,42,0.3)", color: "rgba(184,137,42,0.6)", fontFamily: "'Cinzel',serif", fontSize: "0.65rem", padding: "0.6rem 0.8rem", cursor: "pointer", borderRadius: 1, minHeight: 44 }}>Not now</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: EMAIL GATE ──────────────────────────────────────────────────────
  if (view === "email-gate") return (
    <div style={{ ...S.landing, justifyContent: "center" }}>
      <div style={S.landingNoise} />
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 460, padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={S.landingEyebrow}>Voices of the Republic</div>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.5rem" : "1.8rem", fontWeight: 700, color: "#F5EDD6", marginBottom: "0.6rem", lineHeight: 1.2 }}>
          Start Your Free 7-Day Trial
        </h2>
        <div style={S.landingRule} />
        <p style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "1.05rem", color: "rgba(245,237,214,0.65)", lineHeight: 1.65, margin: "1.2rem 0 1.8rem" }}>
          Add your card to start your free 7-day trial — $0 today, then $9.99/month. Cancel anytime.
        </p>

        <input
          type="email"
          value={emailInput}
          onChange={e => { setEmailInput(e.target.value); setEmailError(""); }}
          onKeyDown={e => e.key === "Enter" && submitEmail()}
          placeholder="your@email.com"
          style={{ width: "100%", background: "rgba(26,18,8,0.9)", border: "1px solid rgba(184,137,42,0.4)", borderRadius: 2, color: "#F5EDD6", fontFamily: "'Crimson Text',serif", fontSize: "1.05rem", padding: "0.8rem 1rem", outline: "none", marginBottom: "0.8rem", minHeight: 48 }}
        />
        {emailError && <p style={{ color: "#c0392b", fontFamily: "'Crimson Text',serif", fontSize: "0.9rem", marginBottom: "0.6rem" }}>{emailError}</p>}

        <button
          onClick={submitEmail}
          disabled={emailLoading}
          style={{ ...S.enterBtn, width: "100%", minHeight: 50, marginBottom: "0.8rem", opacity: emailLoading ? 0.7 : 1 }}
        >
          {emailLoading ? "Opening secure checkout…" : "Begin 7-Day Free Trial"}
        </button>

        <p style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.8rem", color: "rgba(245,237,214,0.35)", marginBottom: "1.2rem" }}>
          $9.99/month after trial. Cancel anytime.
        </p>

        <PromoSection emailForPromo={emailInput.trim()} />

        <button
          onClick={() => setView("landing")}
          style={{ ...S.backLink, background: "none", border: "none", cursor: "pointer", marginTop: "1.5rem", display: "block" }}
        >
          ← Back
        </button>
      </div>
    </div>
  );

  // ── VIEW: PAYWALL ─────────────────────────────────────────────────────────
  if (view === "paywall") return (
    <div style={{ ...S.landing, justifyContent: "center" }}>
      <div style={S.landingNoise} />
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 460, padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={S.landingEyebrow}>Voices of the Republic</div>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.4rem" : "1.7rem", fontWeight: 700, color: "#F5EDD6", marginBottom: "0.6rem", lineHeight: 1.2 }}>
          Your Free Trial Has Ended
        </h2>
        <div style={S.landingRule} />
        <p style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "1.05rem", color: "rgba(245,237,214,0.65)", lineHeight: 1.65, margin: "1.2rem 0 0.5rem" }}>
          Continue your conversations with the Founders for just $9.99 a month.
          One subscription unlocks all three collections.
        </p>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "2.2rem" : "2.8rem", fontWeight: 900, color: "#D4A84B", margin: "1rem 0 0.3rem", letterSpacing: "-0.02em" }}>
          $9.99<span style={{ fontSize: "0.4em", letterSpacing: "0.2em", color: "#A89060", verticalAlign: "middle" }}>/mo</span>
        </div>
        <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#A89060", marginBottom: "1.5rem" }}>
          ALL THREE COLLECTIONS · CANCEL ANYTIME
        </p>

        <button
          onClick={startCheckout}
          disabled={checkoutLoading}
          style={{ ...S.enterBtn, width: "100%", minHeight: 50, marginBottom: "1rem", opacity: checkoutLoading ? 0.7 : 1 }}
        >
          {checkoutLoading ? "Redirecting…" : "Subscribe — $9.99 / Month"}
        </button>

        <PromoSection emailForPromo={accessRecord?.email} />

        <button onClick={() => setView("landing")} style={{ ...S.backLink, background: "none", border: "none", cursor: "pointer", marginTop: "1.5rem", display: "block" }}>
          ← Back to landing
        </button>
      </div>
    </div>
  );

  // ── VIEW: GALLERY ─────────────────────────────────────────────────────────
  if (view === "gallery") return (
    <div style={S.page}>
      <div style={S.galleryHeader}>
        <button onClick={() => setView("landing")} style={{ ...S.backBtn, minHeight: 44, minWidth: 44 }}>← Hall</button>
        <div>
          <div style={S.galleryEyebrow}>Voices Across History™</div>
          <h1 style={{ ...S.galleryTitle, fontSize: isMobile ? "1.1rem" : "1.4rem" }}>Voices of the Republic</h1>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <div style={{ ...S.sectionLabel, fontSize: isMobile ? "0.65rem" : "0.7rem" }}>The Founders</div>
      <div style={{ ...S.founderGrid, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(200px,1fr))" }}>
        {FOUNDERS.filter(f => !f.wife).map(f => (
          <FounderCard key={f.id} founder={f} onClick={() => openFounder(f)} isMobile={isMobile} />
        ))}
      </div>

      <div style={{ ...S.sectionLabel, fontSize: isMobile ? "0.65rem" : "0.7rem" }}>
        Founding Wives
        <span style={S.sectionNote}> — Responses drawn exclusively from verified letters &amp; documented writings</span>
      </div>
      <div style={{ ...S.founderGrid, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(200px,1fr))" }}>
        {FOUNDERS.filter(f => f.wife).map(f => (
          <FounderCard key={f.id} founder={f} onClick={() => openFounder(f)} isMobile={isMobile} />
        ))}
      </div>
    </div>
  );

  // ── VIEW: CHAT ────────────────────────────────────────────────────────────
  if (view === "chat" && activeFounder) return (
    <div style={{ ...S.chatPage, maxWidth: isMobile ? "100%" : 800 }}>
      {/* Header */}
      <div style={S.chatHeader}>
        <button onClick={() => { stopSpeech(); setView("gallery"); }} style={{ ...S.backBtn, minHeight: 44, minWidth: 44 }}>← Gallery</button>
        <div style={S.chatHeaderInfo}>
          <img
            src={activeFounder.portrait}
            alt={activeFounder.name}
            style={{ ...S.chatPortrait, width: isMobile ? 40 : 52, height: isMobile ? 40 : 52 }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <div>
            <div style={{ ...S.chatName, fontSize: isMobile ? "0.9rem" : "1rem" }}>{activeFounder.name}</div>
            <div style={{ ...S.chatTitle, fontSize: isMobile ? "0.78rem" : "0.85rem" }}>{activeFounder.title}</div>
            {!isMobile && <div style={S.chatYears}>{activeFounder.years}</div>}
          </div>
        </div>
        <div style={S.sourcesBadge}>
          {speaking && <span style={S.speakingDot}>🔊</span>}
        </div>
      </div>

      {/* Sources bar */}
      <div style={{ ...S.sourcesBar, flexWrap: "wrap", gap: "0.3rem 0.4rem" }}>
        <span style={S.sourcesLabel}>Sources: </span>
        {activeFounder.primarySources.map((s, i) => (
          <span key={i} style={{ ...S.sourceTag, fontSize: isMobile ? "0.55rem" : "0.58rem" }}>{s}</span>
        ))}
      </div>

      {/* Messages */}
      <div style={S.messages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? { ...S.userBubble, maxWidth: isMobile ? "88%" : "75%" } : { ...S.assistantBubble, maxWidth: isMobile ? "94%" : "85%" }}>
            {m.role === "assistant" && (
              <div style={S.speakerLabel}>{activeFounder.name.split(" ")[0]}</div>
            )}
            <div style={{ ...S.bubbleText, fontSize: isMobile ? "1rem" : "1.05rem" }}>{m.text}</div>
            {m.role === "assistant" && (
              <button
                onClick={() => { setSpeaking(true); speakText(m.text, activeFounder.voiceProfile, () => setSpeaking(false)); }}
                style={{ ...S.replayBtn, minWidth: 32, minHeight: 32 }}
                title="Read aloud"
              >🔊</button>
            )}
          </div>
        ))}
        {loading && (
          <div style={S.assistantBubble}>
            <div style={S.speakerLabel}>{activeFounder.name.split(" ")[0]}</div>
            <div style={S.typing}><span /><span /><span /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div style={{ ...S.inputRow, padding: isMobile ? "0.8rem 1rem" : "1rem 1.5rem" }}>
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          style={{ ...S.micBtn, width: 44, height: 44, background: listening ? "#8B1A1A" : "rgba(184,137,42,0.15)" }}
          title={listening ? "Listening…" : "Hold to speak"}
        >
          {listening ? "🔴" : "🎙️"}
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={`Address ${activeFounder.name.split(" ")[0]}…`}
          style={{ ...S.textInput, fontSize: "1rem" }}
          rows={isMobile ? 2 : 2}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{ ...S.sendBtn, minHeight: 44, padding: isMobile ? "0.6rem 0.9rem" : "0.6rem 1.2rem" }}
        >
          Send
        </button>
      </div>

      <div style={{ ...S.disclaimer, fontSize: isMobile ? "0.7rem" : "0.75rem" }}>
        All responses drawn exclusively from verified primary sources of {activeFounder.name} ({activeFounder.years}).
        {activeFounder.wife && " Limited record — responses restricted to verified correspondence only."}
      </div>
    </div>
  );

  return null;
}

// ── FOUNDER CARD ─────────────────────────────────────────────────────────────
function FounderCard({ founder, onClick, isMobile }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{ ...S.card, borderColor: `${founder.color}55` }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ ...S.cardImgWrap, height: isMobile ? 160 : 220, background: `${founder.color}22` }}>
        {!imgError ? (
          <img src={founder.portrait} alt={founder.name} style={S.cardImg} onError={() => setImgError(true)} />
        ) : (
          <div style={{ ...S.cardInitials, color: founder.color }}>{founder.name.split(" ").map(w => w[0]).join("")}</div>
        )}
      </div>
      <div style={S.cardBody}>
        <div style={{ ...S.cardName, fontSize: isMobile ? "0.78rem" : "0.85rem" }}>{founder.name}</div>
        <div style={{ ...S.cardSub, fontSize: isMobile ? "0.8rem" : "0.85rem" }}>{founder.title}</div>
        <div style={S.cardYears}>{founder.years}</div>
        {founder.wife && <div style={S.wifeBadge}>Primary Sources Only</div>}
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  landing: {
    minHeight: "100vh", background: "linear-gradient(180deg,#0D0A04 0%,#1A1208 50%,#100C06 100%)",
    display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
    fontFamily: "'Crimson Text',Georgia,serif", position: "relative", overflow: "hidden"
  },
  landingNoise: {
    position: "absolute", inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
    pointerEvents: "none"
  },
  landingStars: { position: "absolute", inset: 0, pointerEvents: "none" },
  landingContent: { position: "relative", zIndex: 2, maxWidth: 700 },
  landingEyebrow: { fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.35em", color: "#B8892A", marginBottom: "1rem", textTransform: "uppercase" },
  landingTitle: { fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#F5EDD6", lineHeight: 1.05, marginBottom: "1rem", textShadow: "0 2px 40px rgba(184,137,42,0.3)" },
  landingRule: { width: 80, height: 1, background: "linear-gradient(90deg,transparent,#B8892A,transparent)", margin: "1.5rem auto" },
  landingDesc: { fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", color: "rgba(245,237,214,0.75)", lineHeight: 1.7, marginBottom: "1.5rem" },
  landingMeta: { fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.15em", color: "#A89060", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "center" },
  enterBtn: { fontFamily: "'Cinzel',serif", fontSize: "0.8rem", letterSpacing: "0.15em", padding: "0.9rem 2.5rem", background: "linear-gradient(135deg,#B8892A,#8B6820)", color: "#F5EDD6", border: "none", borderRadius: 1, cursor: "pointer", display: "inline-block", transition: "opacity 0.2s", boxShadow: "0 4px 20px rgba(184,137,42,0.3)" },
  backLink: { fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", color: "rgba(184,137,42,0.5)", textDecoration: "none" },

  page: { minHeight: "100vh", background: "#100C06", color: "#F5EDD6", fontFamily: "'Crimson Text',Georgia,serif", paddingBottom: "4rem" },
  galleryHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "1px solid rgba(184,137,42,0.2)", background: "rgba(10,8,2,0.95)" },
  galleryEyebrow: { fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.3em", color: "#B8892A", marginBottom: "0.2rem" },
  galleryTitle: { fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#F5EDD6" },
  backBtn: { fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", background: "transparent", border: "1px solid rgba(184,137,42,0.3)", color: "#D4A84B", padding: "0.4rem 0.9rem", cursor: "pointer", borderRadius: 1 },
  sectionLabel: { fontFamily: "'Cinzel',serif", letterSpacing: "0.25em", color: "#B8892A", padding: "2rem 1.5rem 1rem", textTransform: "uppercase", borderBottom: "1px solid rgba(184,137,42,0.1)" },
  sectionNote: { fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", letterSpacing: 0, textTransform: "none", fontSize: "0.85rem", color: "rgba(184,137,42,0.6)" },
  founderGrid: { display: "grid", gap: "1rem", padding: "1.5rem" },

  card: { background: "rgba(20,14,4,0.8)", border: "1px solid", borderRadius: 2, cursor: "pointer", overflow: "hidden", transition: "transform 0.25s,box-shadow 0.25s", display: "flex", flexDirection: "column" },
  cardImgWrap: { display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", filter: "sepia(20%) contrast(1.05)" },
  cardInitials: { fontFamily: "'Cinzel',serif", fontSize: "3rem", fontWeight: 700, opacity: 0.6 },
  cardBody: { padding: "0.8rem" },
  cardName: { fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#F5EDD6", marginBottom: "0.3rem" },
  cardSub: { fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", color: "rgba(245,237,214,0.6)", lineHeight: 1.35, marginBottom: "0.4rem" },
  cardYears: { fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#B8892A" },
  wifeBadge: { display: "inline-block", fontFamily: "'Cinzel',serif", fontSize: "0.55rem", letterSpacing: "0.1em", border: "1px solid rgba(184,137,42,0.4)", color: "#B8892A", padding: "0.2rem 0.5rem", marginTop: "0.5rem", borderRadius: 1 },

  chatPage: { minHeight: "100vh", background: "#100C06", color: "#F5EDD6", fontFamily: "'Crimson Text',Georgia,serif", display: "flex", flexDirection: "column", margin: "0 auto" },
  chatHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: "1px solid rgba(184,137,42,0.2)", background: "rgba(10,8,2,0.97)", gap: "0.8rem", position: "sticky", top: 0, zIndex: 10 },
  chatHeaderInfo: { display: "flex", alignItems: "center", gap: "0.8rem", flex: 1, minWidth: 0 },
  chatPortrait: { borderRadius: "50%", objectFit: "cover", objectPosition: "top", border: "2px solid rgba(184,137,42,0.4)", filter: "sepia(20%)", flexShrink: 0 },
  chatName: { fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#F5EDD6", lineHeight: 1.2 },
  chatTitle: { fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", color: "rgba(245,237,214,0.6)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatYears: { fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#B8892A" },
  sourcesBadge: { flexShrink: 0 },
  speakingDot: { fontFamily: "'Cinzel',serif", fontSize: "0.65rem", color: "#D4A84B" },

  sourcesBar: { display: "flex", alignItems: "center", padding: "0.5rem 1rem", background: "rgba(184,137,42,0.05)", borderBottom: "1px solid rgba(184,137,42,0.1)" },
  sourcesLabel: { fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: "rgba(184,137,42,0.7)", flexShrink: 0, marginRight: "0.3rem" },
  sourceTag: { fontFamily: "'Cinzel',serif", letterSpacing: "0.05em", padding: "0.15rem 0.45rem", border: "1px solid rgba(184,137,42,0.25)", color: "rgba(184,137,42,0.7)", borderRadius: 1 },

  messages: { flex: 1, overflowY: "auto", padding: "1.2rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" },
  userBubble: { alignSelf: "flex-end", background: "rgba(184,137,42,0.15)", border: "1px solid rgba(184,137,42,0.25)", borderRadius: 2, padding: "0.7rem 1rem" },
  assistantBubble: { alignSelf: "flex-start", background: "rgba(26,18,8,0.8)", border: "1px solid rgba(184,137,42,0.15)", borderRadius: 2, padding: "0.9rem 1rem", position: "relative" },
  speakerLabel: { fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.15em", color: "#B8892A", marginBottom: "0.4rem" },
  bubbleText: { fontFamily: "'EB Garamond',Georgia,serif", lineHeight: 1.7, color: "rgba(245,237,214,0.9)" },
  replayBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", marginTop: "0.4rem", opacity: 0.5, float: "right" },
  typing: { display: "flex", gap: "0.3rem", alignItems: "center", padding: "0.2rem 0" },

  inputRow: { display: "flex", gap: "0.5rem", borderTop: "1px solid rgba(184,137,42,0.15)", background: "rgba(10,8,2,0.95)", alignItems: "flex-end", position: "sticky", bottom: 0 },
  micBtn: { borderRadius: "50%", border: "1px solid rgba(184,137,42,0.3)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", color: "#D4A84B" },
  textInput: { flex: 1, background: "rgba(26,18,8,0.8)", border: "1px solid rgba(184,137,42,0.25)", borderRadius: 2, color: "#F5EDD6", fontFamily: "'Crimson Text',Georgia,serif", padding: "0.6rem 0.8rem", resize: "none", outline: "none", lineHeight: 1.5 },
  sendBtn: { fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", background: "linear-gradient(135deg,#B8892A,#8B6820)", color: "#F5EDD6", border: "none", borderRadius: 1, cursor: "pointer", flexShrink: 0 },

  disclaimer: { fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", color: "rgba(245,237,214,0.3)", textAlign: "center", padding: "0.5rem 1rem 1rem", lineHeight: 1.5 },
};
