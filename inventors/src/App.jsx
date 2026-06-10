import { useState, useEffect } from "react";

const COMING_SOON = [
  { name: "Thomas Edison",    years: "1847–1931", icon: "💡", note: "Notebooks, patents, letters, diary" },
  { name: "Nikola Tesla",     years: "1856–1943", icon: "⚡", note: "My Inventions, lectures, patents" },
  { name: "Marie Curie",      years: "1867–1934", icon: "⚗️", note: "Notebooks, Nobel addresses, correspondence" },
  { name: "Leonardo da Vinci",years: "1452–1519", icon: "🎨", note: "Codex Atlanticus, Leicester, Arundel, Windsor" },
  { name: "Alan Turing",      years: "1912–1954", icon: "💻", note: "Computing Machinery and Intelligence, papers" },
  { name: "Orville & Wilbur Wright", years: "1867–1948", icon: "✈️", note: "Diaries, letters, technical papers" },
  { name: "Galileo Galilei",  years: "1564–1642", icon: "🔭", note: "Sidereal Messenger, Dialogue, letters" },
  { name: "Isaac Newton",     years: "1643–1727", icon: "🍎", note: "Principia, Opticks, Cambridge notebooks" },
];

// Colors
const C = {
  bg: "#0A0E14",
  bgCard: "rgba(14,20,28,0.85)",
  text: "#D4D0C8",
  textMuted: "rgba(212,208,200,0.6)",
  brass: "#B87333",
  brassLt: "#D4965A",
  border: "rgba(184,115,51,0.2)",
  borderFaint: "rgba(184,115,51,0.12)",
  btn: "linear-gradient(135deg,#8A5A28,#6A3E18)",
};

export default function VoicesOfTheInventors() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!installPrompt) return;
    const shown = sessionStorage.getItem("vah_inv_install_shown");
    if (shown) return;
    const t = setTimeout(() => {
      setShowInstallBanner(true);
      sessionStorage.setItem("vah_inv_install_shown", "1");
    }, 30000);
    return () => clearTimeout(t);
  }, [installPrompt]);

  async function handleNotify() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(180deg,${C.bg} 0%,#101418 50%,${C.bg} 100%)`,
      color: C.text,
      fontFamily: "'Crimson Text',Georgia,serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", textAlign: "center",
      padding: isMobile ? "2rem 1.2rem 4rem" : "2rem 2rem 4rem"
    }}>

      {/* Header */}
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.35em", color: C.brass, marginBottom: "1rem", textTransform: "uppercase" }}>
        Voices Across History™
      </div>
      <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "clamp(2rem,8vw,3rem)" : "clamp(2.5rem,6vw,4.5rem)", fontWeight: 900, color: C.text, lineHeight: 1.05, marginBottom: "0.3rem" }}>
        Voices of the
      </h1>
      <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "clamp(2rem,8vw,3rem)" : "clamp(2.5rem,6vw,4.5rem)", fontWeight: 900, color: C.brassLt, lineHeight: 1.05, marginBottom: "1.5rem" }}>
        Inventors
      </h1>
      <div style={{ width: 80, height: 1, background: `linear-gradient(90deg,transparent,${C.brass},transparent)`, margin: "0 auto 1.5rem" }} />

      {/* Coming soon badge */}
      <div style={{ display: "inline-block", fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.2em", color: C.brass, border: `1px solid ${C.border}`, padding: "0.4rem 1.2rem", borderRadius: 1, marginBottom: "1.5rem" }}>
        COMING SOON
      </div>

      <p style={{ fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", fontSize: isMobile ? "1.05rem" : "clamp(1.1rem,2vw,1.3rem)", color: C.textMuted, maxWidth: 560, lineHeight: 1.7, marginBottom: "2.5rem" }}>
        The minds that built the modern world. Each inventor grounded exclusively in their own notebooks, patents, and correspondence.
      </p>

      {/* Inventor grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(200px,1fr))",
        gap: "0.8rem",
        maxWidth: 860,
        width: "100%",
        marginBottom: "3rem"
      }}>
        {COMING_SOON.map(inv => (
          <div key={inv.name} style={{ background: C.bgCard, border: `1px solid ${C.borderFaint}`, borderRadius: 2, padding: isMobile ? "1rem" : "1.2rem", textAlign: "left", transition: "border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.border}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.borderFaint}>
            <div style={{ fontSize: isMobile ? "1.5rem" : "1.8rem", marginBottom: "0.4rem" }}>{inv.icon}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: isMobile ? "0.72rem" : "0.8rem", fontWeight: 700, color: C.text, marginBottom: "0.2rem", lineHeight: 1.3 }}>{inv.name}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.58rem", letterSpacing: "0.1em", color: C.brass, marginBottom: "0.4rem" }}>{inv.years}</div>
            <div style={{ fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", fontSize: "0.78rem", color: "rgba(212,208,200,0.45)", lineHeight: 1.4 }}>{inv.note}</div>
          </div>
        ))}
      </div>

      {/* Notify form */}
      {!submitted ? (
        <div style={{ width: "100%", maxWidth: 440 }}>
          <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.2em", color: C.textMuted, marginBottom: "1rem", textTransform: "uppercase" }}>
            Be first to know when they speak
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleNotify()}
              placeholder="your@email.com"
              style={{ flex: 1, background: "rgba(14,20,28,0.9)", border: `1px solid ${C.border}`, borderRadius: 1, color: C.text, fontFamily: "'Crimson Text',Georgia,serif", fontSize: "1rem", padding: "0.75rem 1rem", outline: "none", minHeight: 48 }}
            />
            <button
              onClick={handleNotify}
              disabled={loading}
              style={{ fontFamily: "'Cinzel',serif", fontSize: "0.68rem", letterSpacing: "0.1em", padding: "0.75rem 1.2rem", background: loading ? "rgba(184,115,51,0.4)" : `linear-gradient(135deg,${C.brass},#7A5020)`, color: C.text, border: "none", borderRadius: 1, cursor: loading ? "default" : "pointer", flexShrink: 0, minHeight: 48, minWidth: 100 }}
            >
              {loading ? "…" : "Notify Me"}
            </button>
          </div>
          {error && (
            <p style={{ color: "#c0392b", fontFamily: "'Crimson Text',serif", fontSize: "0.9rem", marginTop: "0.5rem" }}>{error}</p>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.8rem" }}>⚙️</div>
          <p style={{ fontFamily: "'EB Garamond',Georgia,serif", fontStyle: "italic", color: C.brassLt, fontSize: "1.15rem", lineHeight: 1.6 }}>
            You'll be the first to know when the Inventors speak.
          </p>
        </div>
      )}

      <a href="/" style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", color: `rgba(184,115,51,0.5)`, textDecoration: "none", marginTop: "2.5rem" }}>
        ← Voices Across History™ Platform
      </a>

      {/* PWA install banner */}
      {showInstallBanner && installPrompt && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,14,20,0.97)", borderTop: `1px solid ${C.border}`, padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", zIndex: 200 }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: "0.7rem", letterSpacing: "0.1em", color: C.brassLt, marginBottom: "0.2rem" }}>ADD TO HOME SCREEN</div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontStyle: "italic", fontSize: "0.85rem", color: C.textMuted }}>Get notified the moment Inventors launches</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            <button onClick={() => { installPrompt.prompt(); setShowInstallBanner(false); }} style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.6rem 1rem", background: `linear-gradient(135deg,${C.brass},#7A5020)`, color: C.text, border: "none", cursor: "pointer", borderRadius: 1, minHeight: 44 }}>Install</button>
            <button onClick={() => setShowInstallBanner(false)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.brass, fontFamily: "'Cinzel',serif", fontSize: "0.65rem", padding: "0.6rem 0.8rem", cursor: "pointer", borderRadius: 1, minHeight: 44 }}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
