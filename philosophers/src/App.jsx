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

// ── PHILOSOPHER DATA ──────────────────────────────────────────────────────────
const PHILOSOPHERS = [
  {
    id: "socrates",
    name: "Socrates / Plato",
    title: "Father of Western Philosophy",
    years: "c. 470–399 BC",
    era: "Ancient Greece",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Socrate_du_Louvre.jpg/440px-Socrate_du_Louvre.jpg",
    portraitCredit: "Roman copy of Greek original, Louvre Museum",
    voiceProfile: { pitch: 0.88, rate: 0.85 },
    primarySources: ["Apology", "Republic", "Symposium", "Phaedo", "Meno", "Crito", "Phaedrus"],
    tradition: "Socratic / Platonic",
    color: "#4A6B5A",
    systemPrompt: `You are Socrates, speaking as recorded by Plato in the dialogues. Respond only from the verified Platonic dialogues: the Apology, Republic, Symposium, Phaedo, Meno, Crito, Phaedrus, Theaetetus, and related works. You employ the Socratic method — you answer questions with questions, expose assumptions, and guide toward truth through dialogue rather than pronouncement. You claim to know nothing with certainty except the importance of questioning. You speak of the Good, Justice, the Soul, and the examined life. You are calm, ironic, and relentlessly curious. Never speculate beyond what Plato recorded.`
  },
  {
    id: "aristotle",
    name: "Aristotle",
    title: "The Philosopher — Logic, Ethics, Politics, Nature",
    years: "384–322 BC",
    era: "Ancient Greece",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Aristotle_Altemps_Inv8575.jpg/440px-Aristotle_Altemps_Inv8575.jpg",
    portraitCredit: "Roman copy of Greek original, Palazzo Altemps, Rome",
    voiceProfile: { pitch: 0.87, rate: 0.87 },
    primarySources: ["Nicomachean Ethics", "Politics", "Metaphysics", "Poetics", "Organon", "Physics"],
    tradition: "Peripatetic",
    color: "#4A5A6B",
    systemPrompt: `You are Aristotle, student of Plato and tutor of Alexander. Respond only from your verified works: Nicomachean Ethics, Politics, Metaphysics, Poetics, the Organon (especially Categories and Prior Analytics), Physics, De Anima, and related texts. You believe in eudaimonia (flourishing) as the highest good, virtue as the mean between extremes, and that humans are by nature political animals. You are systematic, empirical, and comprehensive. You categorize, define, and reason from first principles. You differ from Plato in believing forms exist in things, not apart from them. Never speculate beyond your documented works.`
  },
  {
    id: "marcus",
    name: "Marcus Aurelius",
    title: "Emperor & Stoic Philosopher",
    years: "121–180 AD",
    era: "Roman Empire",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/MSR-ra-61-b-1.jpg/440px-MSR-ra-61-b-1.jpg",
    portraitCredit: "Roman bust, c. 170 AD — Musée Saint-Raymond",
    voiceProfile: { pitch: 0.86, rate: 0.84 },
    primarySources: ["Meditations (12 books)"],
    tradition: "Stoic",
    color: "#5A4A2A",
    systemPrompt: `You are Marcus Aurelius, Roman Emperor and Stoic philosopher. Respond only from your Meditations — twelve books of private journal entries never meant for publication. You write to yourself as a reminder of Stoic discipline: focus only on what is within your control, accept what is not, fulfill your duty without complaint, treat others with reason and justice, and remember your mortality. You are weary but resolute. You quote Epictetus and Heraclitus. You believe the universe is rational (logos) and that we are all parts of a whole. These are private thoughts — speak intimately, not from a throne. Never speculate beyond the Meditations.`
  },
  {
    id: "epictetus",
    name: "Epictetus",
    title: "From Slave to Stoic Master",
    years: "c. 50–135 AD",
    era: "Roman Greece",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Epicteti_Enchiridion_Latinis_versibus_adumbratum_%28Oxford_1715%29_frontispiece.jpg/440px-Epicteti_Enchiridion_Latinis_versibus_adumbratum_%28Oxford_1715%29_frontispiece.jpg",
    portraitCredit: "Oxford edition frontispiece, 1715",
    voiceProfile: { pitch: 0.9, rate: 0.9 },
    primarySources: ["Enchiridion (Handbook)", "Discourses (4 books)", "Fragments"],
    tradition: "Stoic",
    color: "#6B4A2A",
    systemPrompt: `You are Epictetus, former slave and Stoic teacher. Respond only from your verified works as recorded by Arrian: the Enchiridion and the four books of Discourses. The core of your teaching: some things are up to us (our judgments, desires, impulses), some things are not (our bodies, reputation, property, positions). Freedom comes from mastering only what is yours. You were born a slave and became the freest man in Rome — this shapes everything. You are direct, sometimes harsh, deeply compassionate. You speak to students seeking to improve, not to please them. Never speculate beyond your documented works.`
  },
  {
    id: "locke",
    name: "John Locke",
    title: "Father of Liberalism",
    years: "1632–1704",
    era: "Enlightenment England",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/JohnLocke.png/440px-JohnLocke.png",
    portraitCredit: "Godfrey Kneller, 1697 — Hermitage Museum",
    voiceProfile: { pitch: 0.9, rate: 0.88 },
    primarySources: ["Two Treatises of Government", "Essay Concerning Human Understanding", "A Letter Concerning Toleration", "Some Thoughts Concerning Education"],
    tradition: "Empiricism / Classical Liberalism",
    color: "#3A5A3A",
    systemPrompt: `You are John Locke, the English philosopher whose ideas undergird the American founding. Respond only from your verified works: Two Treatises of Government, An Essay Concerning Human Understanding, A Letter Concerning Toleration, Some Thoughts Concerning Education, and related essays. You believe in natural rights (life, liberty, property), government by consent of the governed, the right of revolution against tyranny, and that the mind begins as a tabula rasa shaped by experience. You are measured, careful, and empirical. Your influence on Jefferson and the American founders was direct and immense. Never speculate beyond your documented works.`
  },
  {
    id: "rousseau",
    name: "Jean-Jacques Rousseau",
    title: "The Social Contract & Natural Man",
    years: "1712–1778",
    era: "French Enlightenment",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Allan_Ramsay_-_Jean-Jacques_Rousseau_-_Google_Art_Project.jpg/440px-Allan_Ramsay_-_Jean-Jacques_Rousseau_-_Google_Art_Project.jpg",
    portraitCredit: "Allan Ramsay, 1766 — National Gallery of Scotland",
    voiceProfile: { pitch: 0.92, rate: 0.9 },
    primarySources: ["The Social Contract", "Discourse on Inequality", "Émile", "Confessions"],
    tradition: "Romanticism / Democratic Theory",
    color: "#5A3A6B",
    systemPrompt: `You are Jean-Jacques Rousseau, the philosopher of the general will and natural goodness. Respond only from your verified works: The Social Contract, Discourse on the Origin of Inequality, Émile, The Confessions, and related essays. You believe man is naturally good and corrupted by society and private property. You believe in popular sovereignty and the general will — what the people collectively will for the common good. You are passionate, often at odds with Enlightenment rationalism, and deeply personal. You differ sharply from Hobbes and are in tension with Locke. Never speculate beyond your documented works.`
  },
  {
    id: "kant",
    name: "Immanuel Kant",
    title: "The Categorical Imperative",
    years: "1724–1804",
    era: "German Enlightenment",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Immanuel_Kant_%28painted_portrait%29.jpg/440px-Immanuel_Kant_%28painted_portrait%29.jpg",
    portraitCredit: "Anonymous portrait, c. 1790 — Kant-Museum, Königsberg",
    voiceProfile: { pitch: 0.87, rate: 0.83 },
    primarySources: ["Critique of Pure Reason", "Groundwork of the Metaphysics of Morals", "Critique of Practical Reason", "Perpetual Peace"],
    tradition: "German Idealism / Deontological Ethics",
    color: "#2A3A5A",
    systemPrompt: `You are Immanuel Kant, the philosopher who attempted to reconcile rationalism and empiricism and established the categorical imperative as the foundation of ethics. Respond only from your verified works: Critique of Pure Reason, Groundwork of the Metaphysics of Morals, Critique of Practical Reason, Critique of Judgment, Prolegomena to Any Future Metaphysics, and Perpetual Peace. You speak with precision and systematic rigor. Your core ethical principle: act only according to maxims you could will to become universal law. You respect persons as ends in themselves, never merely as means. You are methodical, dense, and thorough. Never speculate beyond your documented works.`
  },
  {
    id: "nietzsche",
    name: "Friedrich Nietzsche",
    title: "Beyond Good and Evil",
    years: "1844–1900",
    era: "19th Century Germany",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Nietzsche187a.jpg/440px-Nietzsche187a.jpg",
    portraitCredit: "Friedrich Hartmann, 1875 — Nietzsche Archive",
    voiceProfile: { pitch: 0.95, rate: 0.95 },
    primarySources: ["Thus Spoke Zarathustra", "Beyond Good and Evil", "On the Genealogy of Morality", "The Gay Science", "Twilight of the Idols"],
    tradition: "Existentialism / Perspectivism",
    color: "#6B2A2A",
    systemPrompt: `You are Friedrich Nietzsche, the philosopher who declared God is dead and demanded a revaluation of all values. Respond only from your verified works: Thus Spoke Zarathustra, Beyond Good and Evil, On the Genealogy of Morality, The Gay Science, Twilight of the Idols, Ecce Homo, and The Birth of Tragedy. You write in aphorisms, metaphors, and provocations. You attack slave morality, ressentiment, nihilism, and herd mentality. You champion the will to power, life-affirmation, and the Übermensch as an ideal of self-overcoming. You are not a systematic philosopher — you are a hammer. Speak with fire and precision. Never speculate beyond your documented works.`
  },
  {
    id: "emerson",
    name: "Ralph Waldo Emerson",
    title: "Self-Reliance & The Oversoul",
    years: "1803–1882",
    era: "American Transcendentalism",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Ralph_Waldo_Emerson_ca1857_retouched.jpg/440px-Ralph_Waldo_Emerson_ca1857_retouched.jpg",
    portraitCredit: "Photograph, c. 1857 — Library of Congress",
    voiceProfile: { pitch: 0.9, rate: 0.88 },
    primarySources: ["Self-Reliance", "Nature", "The American Scholar", "The Over-Soul", "Circles", "Experience"],
    tradition: "Transcendentalism",
    color: "#3A5A4A",
    systemPrompt: `You are Ralph Waldo Emerson, the central voice of American Transcendentalism. Respond only from your verified essays and lectures: Self-Reliance, Nature, The American Scholar, The Over-Soul, Circles, Experience, Compensation, The Divinity School Address, and your Journals. You believe in the primacy of individual intuition over social conformity, the presence of divinity in nature and in each person, and the necessity of original thought. "A foolish consistency is the hobgoblin of little minds." You write in luminous, aphoristic prose. Never speculate beyond your documented works.`
  },
  {
    id: "thoreau",
    name: "Henry David Thoreau",
    title: "Civil Disobedience & Walden",
    years: "1817–1862",
    era: "American Transcendentalism",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Benjamin_D._Maxham_-_Henry_David_Thoreau_-_Restored_-_greyscale_-_straightened.jpg/440px-Benjamin_D._Maxham_-_Henry_David_Thoreau_-_Restored_-_greyscale_-_straightened.jpg",
    portraitCredit: "Benjamin Maxham daguerreotype, 1856 — Morgan Library",
    voiceProfile: { pitch: 0.9, rate: 0.87 },
    primarySources: ["Walden", "Civil Disobedience", "Walking", "A Week on the Concord", "Journal"],
    tradition: "Transcendentalism / Anarchism",
    color: "#3A4A2A",
    systemPrompt: `You are Henry David Thoreau, writer, naturalist, and the philosopher of deliberate living. Respond only from your verified works: Walden, Civil Disobedience (Resistance to Civil Government), Walking, A Week on the Concord and Merrimack Rivers, and your published Journal. You went to the woods to live deliberately, to front only the essential facts of life. You believe most men live in quiet desperation, that government governs best which governs least, and that conscience is the highest law. You are precise about nature and fierce about justice — you were a passionate abolitionist. Never speculate beyond your documented works.`
  },
  {
    id: "mill",
    name: "John Stuart Mill",
    title: "On Liberty & Utilitarianism",
    years: "1806–1873",
    era: "Victorian England",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/John_Stuart_Mill_by_London_Stereoscopic_Co%2C_c1870.jpg/440px-John_Stuart_Mill_by_London_Stereoscopic_Co%2C_c1870.jpg",
    portraitCredit: "London Stereoscopic Co., c. 1870 — National Portrait Gallery",
    voiceProfile: { pitch: 0.9, rate: 0.9 },
    primarySources: ["On Liberty", "Utilitarianism", "The Subjection of Women", "Principles of Political Economy", "Autobiography"],
    tradition: "Utilitarianism / Classical Liberalism",
    color: "#3A4A6B",
    systemPrompt: `You are John Stuart Mill, the most important British philosopher of the 19th century and champion of individual liberty. Respond only from your verified works: On Liberty, Utilitarianism, The Subjection of Women, Principles of Political Economy, A System of Logic, and your Autobiography. The harm principle is central: the only legitimate reason to restrict individual liberty is to prevent harm to others. You believe in the greatest happiness for the greatest number, but you distinguish between higher and lower pleasures. You were a radical advocate for women's equality decades before it was respectable. Never speculate beyond your documented works.`
  },
  {
    id: "hume",
    name: "David Hume",
    title: "Skepticism, Causation & Human Nature",
    years: "1711–1776",
    era: "Scottish Enlightenment",
    portrait: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Portraitof_david_hume.jpg/440px-Portraitof_david_hume.jpg",
    portraitCredit: "Allan Ramsay, 1754 — Scottish National Portrait Gallery",
    voiceProfile: { pitch: 0.88, rate: 0.87 },
    primarySources: ["A Treatise of Human Nature", "An Enquiry Concerning Human Understanding", "An Enquiry Concerning the Principles of Morals", "Dialogues Concerning Natural Religion", "Essays"],
    tradition: "Empiricism / Skepticism",
    color: "#4A3A5A",
    systemPrompt: `You are David Hume, the Scottish philosopher who pushed empiricism to its logical — and skeptical — conclusions. Respond only from your verified works: A Treatise of Human Nature, An Enquiry Concerning Human Understanding, An Enquiry Concerning the Principles of Morals, Dialogues Concerning Natural Religion, The History of England, and your Essays. You believe all knowledge comes from experience and impressions; you are skeptical of causation as anything more than constant conjunction; you argue reason is the slave of the passions; and you are deeply skeptical of religion and miracles. You are genial, precise, and cool-headed. Kant said you woke him from his dogmatic slumber. Never speculate beyond your documented works.`
  }
];

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#080B10",
  bgDeep: "#050810",
  text: "#D4C8A8",
  textMuted: "rgba(212,200,168,0.6)",
  blue: "#6A9CBC",
  blueLt: "#8BB4D4",
  blueBtn: "linear-gradient(135deg,#4A7A9B,#2A5A7B)",
  blueAlpha: "rgba(106,156,188,0.15)",
  blueAlpha2: "rgba(106,156,188,0.08)",
  border: "rgba(106,156,188,0.2)",
  borderFaint: "rgba(106,156,188,0.1)",
};

// ── SPEECH ────────────────────────────────────────────────────────────────────
function speakText(text, voiceProfile, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const chosen = voices.find(v => /male/i.test(v.name) && !/female/i.test(v.name)) ||
                 voices.find(v => v.name.includes("Daniel") || v.name.includes("Arthur") || v.name.includes("George"));
  if (chosen) utter.voice = chosen;
  utter.pitch = voiceProfile.pitch || 0.9;
  utter.rate = voiceProfile.rate || 0.87;
  utter.onend = onEnd || null;
  window.speechSynthesis.speak(utter);
}
function stopSpeech() { window.speechSynthesis?.cancel(); }

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function VoicesOfThePhilosophers() {
  const isMobile = useMobile();

  // Views: landing | email-gate | paywall | gallery | chat
  const [view, setView] = useState("landing");
  const [accessRecord, setAccessRecord] = useState(getStoredAccess);
  const [activePhil, setActivePhil] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [filter, setFilter] = useState("All");

  // Email-gate state
  const [emailInput, setEmailInput] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Promo state
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");

  // Checkout
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // PWA install
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const eras = ["All", ...new Set(PHILOSOPHERS.map(p => p.era))];
  const filtered = filter === "All" ? PHILOSOPHERS : PHILOSOPHERS.filter(p => p.era === filter);

  // ── INIT ────────────────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (window.speechSynthesis) window.speechSynthesis.getVoices(); }, []);

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

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (view !== "landing" || !installPrompt) return;
    const shown = sessionStorage.getItem("vah_phil_install_shown");
    if (shown) return;
    const t = setTimeout(() => { setShowInstallBanner(true); sessionStorage.setItem("vah_phil_install_shown", "1"); }, 30000);
    return () => clearTimeout(t);
  }, [view, installPrompt]);

  // ── ACCESS ───────────────────────────────────────────────────────────────────
  function saveAccess(data) {
    localStorage.setItem("vah_access", JSON.stringify(data));
    setAccessRecord(data);
  }

  function handleEnter() {
    const rec = getStoredAccess();
    if (isAccessValid(rec)) setView("gallery");
    else if (rec && !isAccessValid(rec)) setView("paywall");
    else setView("email-gate");
  }

  async function submitEmail() {
    const email = emailInput.trim();
    if (!email || !email.includes("@")) { setEmailError("Please enter a valid email address."); return; }
    setEmailLoading(true); setEmailError("");
    try {
      const res = await fetch("/api/create-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (data.url) {
        saveAccess({ email, access_type: "pending" });
        window.location.href = data.url;
        return;
      } else setEmailError(data.error || "Something went wrong. Please try again.");
    } catch { setEmailError("Unable to connect. Please try again."); }
    setEmailLoading(false);
  }

  async function submitPromo(emailOverride) {
    const email = emailOverride || accessRecord?.email || emailInput.trim();
    if (!email) { setPromoError("Please enter your email first."); return; }
    if (!promoCode.trim()) { setPromoError("Please enter a promo code."); return; }
    setPromoLoading(true); setPromoError(""); setPromoSuccess("");
    try {
      const res = await fetch("/api/apply-promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode.trim(), email }) });
      const data = await res.json();
      if (data.success) { saveAccess({ email, access_type: data.access_type, trial_expires_at: data.expires_at || null }); setPromoSuccess("Access granted!"); setTimeout(() => setView("gallery"), 900); }
      else setPromoError(data.error || "Invalid or expired code.");
    } catch { setPromoError("Unable to connect. Please try again."); }
    setPromoLoading(false);
  }

  async function startCheckout() {
    const email = accessRecord?.email;
    if (!email) { setView("email-gate"); return; }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/create-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { alert("Checkout unavailable. Please try again."); setCheckoutLoading(false); }
    } catch { alert("Unable to connect. Please try again."); setCheckoutLoading(false); }
  }

  // ── CHAT ─────────────────────────────────────────────────────────────────────
  const openPhil = (phil) => {
    setActivePhil(phil);
    setMessages([{ role: "assistant", text: `I am ${phil.name}. You wish to speak with me on matters of philosophy? Very well. I am prepared to engage — but be warned, I shall not let easy answers stand unchallenged. What troubles your thinking?` }]);
    setView("chat");
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !activePhil) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput(""); setLoading(true);
    const history = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
    history.push({ role: "user", content: text });
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: activePhil.systemPrompt, messages: history }) });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "I find myself unable to speak to that from my record.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setSpeaking(true);
      speakText(reply, activePhil.voiceProfile, () => setSpeaking(false));
    } catch { setMessages(prev => [...prev, { role: "assistant", text: "I am momentarily unable to respond. Try again." }]); }
    setLoading(false);
  }, [messages, activePhil]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.lang = "en-US"; r.interimResults = false;
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start(); recognitionRef.current = r; setListening(true);
  }, []);

  // ── PROMO SECTION ─────────────────────────────────────────────────────────
  function PromoSection({ emailForPromo }) {
    return (
      <div style={{ marginTop: "0.8rem" }}>
        {!showPromoInput ? (
          <button onClick={() => { setShowPromoInput(true); setPromoError(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.9rem", color: `rgba(106,156,188,0.6)`, textDecoration: "underline", padding: 0 }}>
            Have a promo code?
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: 300 }}>
              <input value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                onKeyDown={e => e.key === "Enter" && submitPromo(emailForPromo)}
                placeholder="VAH-XXXX-XXXX"
                style={{ flex: 1, background: "rgba(14,21,32,0.9)", border: `1px solid ${C.border}`, borderRadius: 2, color: C.text, fontFamily: "'Cinzel',serif", fontSize: "0.8rem", padding: "0.6rem 0.8rem", outline: "none", letterSpacing: "0.08em", minHeight: 44 }} />
              <button onClick={() => submitPromo(emailForPromo)} disabled={promoLoading}
                style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.6rem 1rem", background: C.blueAlpha, border: `1px solid ${C.border}`, color: C.blueLt, cursor: "pointer", borderRadius: 1, minHeight: 44, whiteSpace: "nowrap" }}>
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

  // ── VIEW: LANDING ────────────────────────────────────────────────────────
  if (view === "landing") {
    const hasAccess = isAccessValid(accessRecord);
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg,${C.bgDeep} 0%,${C.bg} 50%,${C.bgDeep} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "'Crimson Text',Georgia,serif", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 2, padding: isMobile ? "2rem 1.5rem" : "2rem", maxWidth: 700, width: "100%" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.35em", color: C.blue, marginBottom: "1rem", textTransform: "uppercase" }}>
            Voices Across History™
          </div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "clamp(2.4rem,10vw,3.5rem)" : "clamp(3rem,7vw,5.5rem)", fontWeight: 900, color: C.text, lineHeight: 1.05, marginBottom: "1rem" }}>
            Voices of the<br /><span style={{ color: C.blueLt }}>Philosophers</span>
          </h1>
          <div style={{ width: 80, height: 1, background: `linear-gradient(90deg,transparent,${C.blue},transparent)`, margin: "1.5rem auto" }} />
          <p style={{ fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", fontSize: isMobile ? "1.05rem" : "clamp(1.1rem,2vw,1.3rem)", color: "rgba(212,200,168,0.75)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            Engage the minds that shaped Western thought.<br />Every response grounded in their authentic primary works.
          </p>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.15em", color: "#8A9080", marginBottom: "2rem", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.3rem 0" }}>
            <span>12 Philosophers</span><span style={{ margin: "0 0.7rem", opacity: 0.4 }}>·</span>
            <span>Primary Texts Only</span><span style={{ margin: "0 0.7rem", opacity: 0.4 }}>·</span>
            <span>Voice &amp; Text</span>
          </div>

          <button onClick={handleEnter} style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "0.75rem" : "0.8rem", letterSpacing: "0.15em", padding: "0.9rem 2.5rem", background: C.blueBtn, color: C.text, border: "none", borderRadius: 1, cursor: "pointer", display: "inline-block", minHeight: 48, boxShadow: "0 4px 20px rgba(74,122,155,0.35)", marginBottom: "1.5rem" }}>
            {hasAccess ? "Enter the Academy" : "Start Free — 7 Days on Us"}
          </button>

          {/* Pricing info */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.15rem" : "1.3rem", color: C.blueLt, letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
              $9.99<span style={{ fontSize: "0.65em", color: "#8A9080", letterSpacing: "0.15em" }}> / month — All Collections</span>
            </div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.85rem", color: "rgba(212,200,168,0.4)", marginBottom: "0.5rem" }}>
              Unlimited conversations with every founder, philosopher &amp; inventor in the library.
            </div>
            {hasAccess && accessRecord?.access_type === "trial" && accessRecord?.trial_expires_at && (
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: C.blue }}>
                FREE TRIAL — {Math.max(0, Math.ceil((new Date(accessRecord.trial_expires_at) - new Date()) / 86400000))} days remaining
              </div>
            )}
          </div>

          <PromoSection emailForPromo={accessRecord?.email} />
          <a href="/" style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", color: `rgba(106,156,188,0.5)`, textDecoration: "none", display: "block", marginTop: "1.2rem" }}>
            ← Voices Across History™ Platform
          </a>
        </div>

        {/* PWA install banner */}
        {showInstallBanner && installPrompt && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: `rgba(5,8,14,0.97)`, borderTop: `1px solid ${C.border}`, padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", zIndex: 200 }}>
            <div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", color: C.blueLt, marginBottom: "0.2rem" }}>ADD TO HOME SCREEN</div>
              <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.85rem", color: "rgba(212,200,168,0.6)" }}>Install for quick access anytime</div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button onClick={() => { installPrompt.prompt(); setShowInstallBanner(false); }} style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.6rem 1rem", background: C.blueBtn, color: C.text, border: "none", cursor: "pointer", borderRadius: 1, minHeight: 44 }}>Install</button>
              <button onClick={() => setShowInstallBanner(false)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.blue, fontFamily: "'Cinzel',serif", fontSize: "0.65rem", padding: "0.6rem 0.8rem", cursor: "pointer", borderRadius: 1, minHeight: 44 }}>Not now</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: EMAIL GATE ─────────────────────────────────────────────────────
  if (view === "email-gate") return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg,${C.bgDeep} 0%,${C.bg} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Crimson Text',Georgia,serif" }}>
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 460, padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.35em", color: C.blue, marginBottom: "1rem", textTransform: "uppercase" }}>Voices of the Philosophers</div>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.5rem" : "1.8rem", fontWeight: 700, color: C.text, marginBottom: "0.6rem", lineHeight: 1.2 }}>Start Your Free 7-Day Trial</h2>
        <div style={{ width: 80, height: 1, background: `linear-gradient(90deg,transparent,${C.blue},transparent)`, margin: "1rem auto 1.5rem" }} />
        <p style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "1.05rem", color: C.textMuted, lineHeight: 1.65, marginBottom: "1.8rem" }}>
          Add your card to start your free 7-day trial — $0 today, then $9.99/month. Cancel anytime.
        </p>
        <input type="email" value={emailInput} onChange={e => { setEmailInput(e.target.value); setEmailError(""); }} onKeyDown={e => e.key === "Enter" && submitEmail()}
          placeholder="your@email.com"
          style={{ width: "100%", background: "rgba(14,21,32,0.9)", border: `1px solid ${C.border}`, borderRadius: 2, color: C.text, fontFamily: "'Crimson Text',serif", fontSize: "1.05rem", padding: "0.8rem 1rem", outline: "none", marginBottom: "0.8rem", minHeight: 48 }} />
        {emailError && <p style={{ color: "#c0392b", fontFamily: "'Crimson Text',serif", fontSize: "0.9rem", marginBottom: "0.6rem" }}>{emailError}</p>}
        <button onClick={submitEmail} disabled={emailLoading}
          style={{ fontFamily: "'Cinzel',serif", fontSize: "0.8rem", letterSpacing: "0.15em", padding: "0.9rem 2rem", background: C.blueBtn, color: C.text, border: "none", borderRadius: 1, cursor: "pointer", width: "100%", minHeight: 50, marginBottom: "0.8rem", opacity: emailLoading ? 0.7 : 1 }}>
          {emailLoading ? "Opening secure checkout…" : "Begin 7-Day Free Trial"}
        </button>
        <p style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.8rem", color: "rgba(212,200,168,0.35)", marginBottom: "1.2rem" }}>$9.99/month after trial. Cancel anytime.</p>
        <PromoSection emailForPromo={emailInput.trim()} />
        <button onClick={() => setView("landing")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", color: `rgba(106,156,188,0.5)`, marginTop: "1.5rem", display: "block", width: "100%" }}>← Back</button>
      </div>
    </div>
  );

  // ── VIEW: PAYWALL ────────────────────────────────────────────────────────
  if (view === "paywall") return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg,${C.bgDeep} 0%,${C.bg} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Crimson Text',Georgia,serif" }}>
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 460, padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.35em", color: C.blue, marginBottom: "1rem", textTransform: "uppercase" }}>Voices of the Philosophers</div>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.4rem" : "1.7rem", fontWeight: 700, color: C.text, marginBottom: "0.6rem", lineHeight: 1.2 }}>Your Free Trial Has Ended</h2>
        <div style={{ width: 80, height: 1, background: `linear-gradient(90deg,transparent,${C.blue},transparent)`, margin: "1rem auto 1.2rem" }} />
        <p style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "1.05rem", color: C.textMuted, lineHeight: 1.65, margin: "0 0 0.5rem" }}>
          Continue your philosophical dialogues for just $9.99 a month. One subscription unlocks all three collections.
        </p>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "2.2rem" : "2.8rem", fontWeight: 900, color: C.blueLt, margin: "1rem 0 0.3rem", letterSpacing: "-0.02em" }}>
          $9.99<span style={{ fontSize: "0.4em", letterSpacing: "0.2em", color: "#8A9080", verticalAlign: "middle" }}>/mo</span>
        </div>
        <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#8A9080", marginBottom: "1.5rem" }}>ALL THREE COLLECTIONS · CANCEL ANYTIME</p>
        <button onClick={startCheckout} disabled={checkoutLoading}
          style={{ fontFamily: "'Cinzel',serif", fontSize: "0.8rem", letterSpacing: "0.15em", padding: "0.9rem 2rem", background: C.blueBtn, color: C.text, border: "none", borderRadius: 1, cursor: "pointer", width: "100%", minHeight: 50, marginBottom: "1rem", opacity: checkoutLoading ? 0.7 : 1 }}>
          {checkoutLoading ? "Redirecting…" : "Subscribe — $9.99 / Month"}
        </button>
        <PromoSection emailForPromo={accessRecord?.email} />
        <button onClick={() => setView("landing")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", color: `rgba(106,156,188,0.5)`, marginTop: "1.5rem", display: "block", width: "100%" }}>← Back to landing</button>
      </div>
    </div>
  );

  // ── VIEW: GALLERY ─────────────────────────────────────────────────────────
  if (view === "gallery") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Crimson Text',Georgia,serif", paddingBottom: "4rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: `1px solid ${C.border}`, background: `rgba(5,8,14,0.95)` }}>
        <button onClick={() => setView("landing")} style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", background: "transparent", border: `1px solid ${C.border}`, color: C.blueLt, padding: "0.4rem 0.9rem", cursor: "pointer", borderRadius: 1, minHeight: 44, minWidth: 44 }}>← Hall</button>
        <div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.3em", color: C.blue, marginBottom: "0.2rem" }}>Voices Across History™</div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "1.1rem" : "1.4rem", fontWeight: 700, color: C.text }}>Voices of the Philosophers</h1>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Era filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: isMobile ? "1rem" : "1.5rem 2rem", borderBottom: `1px solid ${C.borderFaint}` }}>
        {eras.map(e => (
          <button key={e} onClick={() => setFilter(e)}
            style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", padding: "0.4rem 0.9rem", border: `1px solid ${filter === e ? C.blue : C.borderFaint}`, background: filter === e ? C.blueAlpha : "transparent", color: filter === e ? C.blueLt : C.textMuted, cursor: "pointer", borderRadius: 1, transition: "all 0.2s", minHeight: 36 }}>
            {e}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(200px,1fr))", gap: "1rem", padding: "1.5rem" }}>
        {filtered.map(p => <PhilCard key={p.id} phil={p} onClick={() => openPhil(p)} isMobile={isMobile} />)}
      </div>
    </div>
  );

  // ── VIEW: CHAT ────────────────────────────────────────────────────────────
  if (view === "chat" && activePhil) return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Crimson Text',Georgia,serif", display: "flex", flexDirection: "column", maxWidth: isMobile ? "100%" : 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: `1px solid ${C.border}`, background: `rgba(5,8,14,0.97)`, gap: "0.8rem", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => { stopSpeech(); setView("gallery"); }} style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", background: "transparent", border: `1px solid ${C.border}`, color: C.blueLt, padding: "0.4rem 0.9rem", cursor: "pointer", borderRadius: 1, minHeight: 44, minWidth: 44 }}>← Gallery</button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flex: 1, minWidth: 0 }}>
          <img src={activePhil.portrait} alt={activePhil.name} style={{ width: isMobile ? 40 : 52, height: isMobile ? 40 : 52, borderRadius: "50%", objectFit: "cover", objectPosition: "top", border: `2px solid ${C.border}`, filter: "sepia(30%)", flexShrink: 0 }} onError={e => e.target.style.display = "none"} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "0.9rem" : "1rem", fontWeight: 700, color: C.text }}>{activePhil.name}</div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: isMobile ? "0.78rem" : "0.85rem", color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activePhil.title}</div>
            {!isMobile && <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: C.blue }}>{activePhil.years} · {activePhil.era}</div>}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>{speaking && <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", color: C.blueLt }}>🔊</span>}</div>
      </div>

      {/* Sources bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 0.4rem", padding: "0.5rem 1rem", background: C.blueAlpha2, borderBottom: `1px solid ${C.borderFaint}`, alignItems: "center" }}>
        <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: `rgba(106,156,188,0.7)`, flexShrink: 0, marginRight: "0.3rem" }}>Primary Works: </span>
        {activePhil.primarySources.map((s, i) => (
          <span key={i} style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "0.55rem" : "0.58rem", letterSpacing: "0.05em", padding: "0.15rem 0.45rem", border: `1px solid rgba(106,156,188,0.2)`, color: `rgba(106,156,188,0.7)`, borderRadius: 1 }}>{s}</span>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.2rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user"
            ? { alignSelf: "flex-end", background: C.blueAlpha, border: `1px solid ${C.border}`, borderRadius: 2, padding: "0.7rem 1rem", maxWidth: isMobile ? "88%" : "75%" }
            : { alignSelf: "flex-start", background: "rgba(14,21,32,0.8)", border: `1px solid ${C.borderFaint}`, borderRadius: 2, padding: "0.9rem 1rem", maxWidth: isMobile ? "94%" : "85%", position: "relative" }}>
            {m.role === "assistant" && <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.15em", color: C.blue, marginBottom: "0.4rem" }}>{activePhil.name.split(" ")[0]}</div>}
            <div style={{ fontFamily: "'EB Garamond',Georgia,serif", fontSize: isMobile ? "1rem" : "1.05rem", lineHeight: 1.7, color: "rgba(212,200,168,0.9)" }}>{m.text}</div>
            {m.role === "assistant" && (
              <button onClick={() => { setSpeaking(true); speakText(m.text, activePhil.voiceProfile, () => setSpeaking(false)); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", marginTop: "0.4rem", opacity: 0.5, float: "right", minWidth: 32, minHeight: 32 }}>🔊</button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", background: "rgba(14,21,32,0.8)", border: `1px solid ${C.borderFaint}`, borderRadius: 2, padding: "0.9rem 1rem", maxWidth: "85%" }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.15em", color: C.blue, marginBottom: "0.4rem" }}>{activePhil.name.split(" ")[0]}</div>
            <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}><span className="typing"><span /><span /><span /></span></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: "0.5rem", padding: isMobile ? "0.8rem 1rem" : "1rem 1.5rem", borderTop: `1px solid ${C.borderFaint}`, background: `rgba(5,8,14,0.95)`, alignItems: "flex-end", position: "sticky", bottom: 0 }}>
        <button onMouseDown={startListening} onMouseUp={() => recognitionRef.current?.stop()} onTouchStart={startListening} onTouchEnd={() => recognitionRef.current?.stop()}
          style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${C.border}`, background: listening ? "#1A3A5A" : C.blueAlpha, cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", color: C.blueLt }}>
          {listening ? "🔴" : "🎙️"}
        </button>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={`Address ${activePhil.name.split(" ")[0]}…`}
          style={{ flex: 1, background: "rgba(14,21,32,0.8)", border: `1px solid ${C.border}`, borderRadius: 2, color: C.text, fontFamily: "'Crimson Text',Georgia,serif", fontSize: "1rem", padding: "0.6rem 0.8rem", resize: "none", outline: "none", lineHeight: 1.5 }}
          rows={2} />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", padding: isMobile ? "0.6rem 0.9rem" : "0.6rem 1.2rem", background: C.blueBtn, color: C.text, border: "none", borderRadius: 1, cursor: "pointer", flexShrink: 0, minHeight: 44 }}>
          Send
        </button>
      </div>

      <div style={{ fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", fontSize: isMobile ? "0.7rem" : "0.75rem", color: "rgba(212,200,168,0.3)", textAlign: "center", padding: "0.5rem 1rem 1rem", lineHeight: 1.5 }}>
        All responses drawn exclusively from verified primary works of {activePhil.name} ({activePhil.years}).
      </div>
    </div>
  );

  return null;
}

// ── PHILOSOPHER CARD ──────────────────────────────────────────────────────────
function PhilCard({ phil, onClick, isMobile }) {
  const [err, setErr] = useState(false);
  return (
    <div onClick={onClick}
      style={{ background: "rgba(10,15,24,0.8)", border: `1px solid ${phil.color}55`, borderRadius: 2, cursor: "pointer", overflow: "hidden", transition: "transform 0.25s,box-shadow 0.25s", display: "flex", flexDirection: "column" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.5)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ height: isMobile ? 160 : 220, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: `${phil.color}18` }}>
        {!err
          ? <img src={phil.portrait} alt={phil.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", filter: "sepia(30%) contrast(1.05)" }} onError={() => setErr(true)} />
          : <div style={{ fontFamily: "'Cinzel',serif", fontSize: "3rem", fontWeight: 700, opacity: 0.6, color: phil.color }}>{phil.name.split(" ").map(w => w[0]).join("")}</div>}
      </div>
      <div style={{ padding: "0.8rem" }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "0.78rem" : "0.85rem", fontWeight: 700, color: "#D4C8A8", marginBottom: "0.3rem" }}>{phil.name}</div>
        <div style={{ fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", fontSize: isMobile ? "0.8rem" : "0.85rem", color: "rgba(212,200,168,0.6)", lineHeight: 1.35, marginBottom: "0.4rem" }}>{phil.title}</div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#6A9CBC" }}>{phil.years}</div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.58rem", letterSpacing: "0.1em", color: phil.color, marginTop: "0.3rem" }}>{phil.tradition}</div>
      </div>
    </div>
  );
}
