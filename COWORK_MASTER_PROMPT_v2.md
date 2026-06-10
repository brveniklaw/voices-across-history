# Voices Across History™ — Cowork Master Deployment Prompt v2.0
# IntexiaU Institute Platform | Paste this entire prompt into Cowork

---

## OPERATING INSTRUCTIONS FOR COWORK

You are deploying Voices Across History™ — a multi-app AI-powered educational platform
built by IntexiaU Corp under the IntexiaU Institute division. The platform consists of
four separate apps deployed as four separate Vercel projects sharing one Supabase project,
plus one admin dashboard deployed as a fifth Vercel project.

**Your operating principles:**
- Work autonomously. Make reasonable decisions without stopping to ask questions you can resolve yourself.
- Only pause and flag Andrea when you hit a genuine blocker that requires a credential, external account action, or a strategic decision you cannot make on her behalf.
- Complete each session fully before declaring it done. Verify live URLs work before closing a session.
- Never guess at API keys, credentials, or environment variables — flag those as blockers immediately.
- Prefer clean rewrites over accumulated patches when something isn't working after two attempts.
- All agent responses must be grounded in primary sources only — this is the platform's core integrity promise and must never be compromised.

---

## PLATFORM OVERVIEW

**Platform Brand:** Voices Across History™ (trademark of IntexiaU Corp)
**Platform tagline:** Hear Them. Question Them. Learn From Them.
**Owner:** Andrea Brvenik, Founder & CEO, IntexiaU Corp
**Division:** IntexiaU Institute and Innovations
**Tech Stack:** Vercel (hosting) · Supabase (shared DB/auth) · Stripe (subscriptions) · GitHub (5 repos) · Anthropic API via Vercel serverless proxy · Web Speech API (voice, free, no key needed)

---

## FIVE APPS — FIVE GITHUB REPOS — FIVE VERCEL PROJECTS

| App | GitHub Repo Name | Vercel Project | Framework |
|---|---|---|---|
| Platform Hub | `voices-across-history-hub` | voices-across-history | Static (Other) |
| Voices of the Republic | `voices-of-the-republic` | voices-of-the-republic | Vite |
| Voices of the Philosophers | `voices-of-the-philosophers` | voices-of-the-philosophers | Vite |
| Voices of the Inventors | `voices-of-the-inventors` | voices-of-the-inventors | Vite |
| Admin Dashboard | `voices-across-history-admin` | voices-across-history-admin | Vite |

All five apps share one Supabase project and one Stripe account.

---

## PRICING MODEL — CONFIRMED

**$9.99 per month** — single subscription unlocks ALL three collections (Republic, Philosophers, Inventors).
No per-collection pricing. One subscription = full platform access.

**Promo / Voucher Codes (two types):**
- **7-Day Trial Code** — gives free access for 7 days, then converts to paid subscription prompt
- **Permanent Access Code** — gives lifetime access, never expires, never requires payment

Both code types are generated and managed from the Admin Dashboard.

**Display pricing prominently on:**
- The platform hub landing page (below collection cards)
- Each collection app's landing page (before entering the gallery)
- The paywall screen shown to users whose trial has expired

---

## PWA — DOWNLOADABLE / INSTALLABLE

Every collection app (Republic, Philosophers, Inventors) must be built as a Progressive Web App (PWA) so users can install it to their home screen on mobile and desktop like a native app.

**PWA requirements per app:**
1. `manifest.json` at root with:
   - `name`: full app name (e.g. "Voices of the Republic")
   - `short_name`: short version (e.g. "Republic")
   - `start_url`: `/`
   - `display`: `standalone`
   - `background_color`: app's primary background color
   - `theme_color`: app's accent color (gold for Republic, blue for Philosophers, brass for Inventors)
   - `icons`: at minimum a 192x192 and 512x512 PNG — generate simple text-on-color icons if no logo provided
2. `service-worker.js` at root — cache shell for offline support
3. `<link rel="manifest" href="/manifest.json">` in each app's `index.html`
4. `<meta name="theme-color">` in each app's `index.html`
5. Add `vite-plugin-pwa` to devDependencies in each app's `package.json`
6. Configure PWA plugin in `vite.config.js`

**Install prompt behavior:** Show a subtle "Add to Home Screen" banner at the bottom of the landing page after 30 seconds. Do not show it immediately or aggressively. The banner should match the app's design aesthetic — not a generic browser prompt.

**The Hub (static HTML) does NOT need PWA.**
**The Admin Dashboard does NOT need PWA.**

---

## MOBILE-FIRST DESIGN REQUIREMENTS

Every collection app must be fully functional and readable on mobile (375px minimum width). Apply these rules throughout all app code:

- **Typography:** Minimum 16px body text. Minimum 14px for labels/captions. Never smaller.
- **Touch targets:** All buttons and interactive elements minimum 44px height.
- **Portrait cards in gallery:** Single column on mobile (<640px), two columns on tablet (640–1024px), auto-fill grid on desktop.
- **Chat interface on mobile:** Full-screen chat view. Input row fixed to bottom. Message area scrollable. No horizontal overflow.
- **Mic button:** Thumb-reachable — positioned in the input row, not floating.
- **Sources bar:** Wraps gracefully on mobile, does not overflow.
- **Founder/philosopher cards:** Portrait image 160px height on mobile (not 220px).
- **Landing page hero:** Single column on mobile, centered text, no side-by-side elements.
- **Test at 375px width before declaring any session complete.**

---

## SOURCE FILES

Andrea has downloaded the following files from Claude.ai. They are the starting point.
These files need the PWA layer, mobile fixes, subscription gate, and promo code system added
during deployment — they are not yet production-complete as downloaded.

```
voices-across-history/
├── DEPLOYMENT.md
├── hub/index.html                       ← Needs pricing section added
├── republic/
│   ├── src/App.jsx                      ← Needs subscription gate + mobile fixes + PWA
│   ├── src/main.jsx
│   ├── api/chat.js                      ← Shared Anthropic proxy (already correct)
│   ├── index.html                       ← Needs PWA meta tags added
│   ├── vite.config.js                   ← Needs PWA plugin added
│   └── package.json                     ← Needs vite-plugin-pwa added
├── philosophers/
│   ├── src/App.jsx                      ← Needs subscription gate + mobile fixes + PWA
│   └── (same structure)
└── inventors/
    ├── src/App.jsx                      ← Coming Soon scaffold
    └── (same structure)
```

---

## CREDENTIALS YOU WILL NEED (Andrea provides these — flag as blocker if missing)

- `ANTHROPIC_API_KEY` — starts with `sk-ant-` — Republic, Philosophers, Inventors, Admin
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` — all five apps
- `SUPABASE_SERVICE_ROLE_KEY` — Admin Dashboard only (elevated DB access)
- `STRIPE_SECRET_KEY` — Republic, Philosophers, Inventors, Admin
- `STRIPE_WEBHOOK_SECRET` — for Stripe webhook endpoint
- `VITE_STRIPE_PUBLISHABLE_KEY` — client-side Stripe
- `ADMIN_PASSWORD` — bcrypt-hashed password for admin dashboard login (Andrea sets this)
- GitHub account access
- Vercel account access

---

## SUPABASE SCHEMA — RUN THIS FIRST IN SESSION 5

Run the complete schema in Supabase SQL editor before any auth/payment work:

```sql
-- ── USERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vah_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  name             TEXT,
  access_type      TEXT NOT NULL DEFAULT 'trial'
                   CHECK (access_type IN ('trial','subscribed','promo_trial','permanent')),
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  subscribed_at    TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  promo_code_used  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROMO CODES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vah_promo_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('trial_7day','permanent')),
  max_uses     INTEGER DEFAULT 1,      -- NULL = unlimited
  uses_count   INTEGER DEFAULT 0,
  created_by   TEXT DEFAULT 'admin',
  expires_at   TIMESTAMPTZ,            -- NULL = never expires
  is_active    BOOLEAN DEFAULT TRUE,
  note         TEXT,                   -- admin memo about this code
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUBSCRIPTIONS LOG ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vah_subscription_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES vah_users(id),
  event_type TEXT NOT NULL,  -- created, renewed, cancelled, failed, promo_applied
  stripe_event_id TEXT,
  amount_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEEDBACK ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vah_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app        TEXT NOT NULL CHECK (app IN ('republic','philosophers','inventors')),
  agent_id   TEXT NOT NULL,
  user_id    UUID REFERENCES vah_users(id),
  rating     INTEGER CHECK (rating IN (1, -1)),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTACT / MESSAGES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vah_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES vah_users(id),
  email      TEXT NOT NULL,
  name       TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT DEFAULT 'unread' CHECK (status IN ('unread','read','replied','archived')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFY LIST (Inventors waitlist) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vah_notify (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE vah_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vah_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vah_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE vah_messages ENABLE ROW LEVEL SECURITY;

-- Public can insert their own user record and feedback
CREATE POLICY "Public insert users"    ON vah_users    FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert feedback" ON vah_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert messages" ON vah_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert notify"   ON vah_notify   FOR INSERT WITH CHECK (true);

-- Service role (admin) has full access — enforced via SUPABASE_SERVICE_ROLE_KEY
```

---

## STRIPE SETUP — ONE PRODUCT, MONTHLY SUBSCRIPTION

In Stripe dashboard, create ONE product:

**Product:** "Voices Across History™ — Full Platform Access"
**Price:** $9.99 / month recurring
**Price ID:** Save this — it goes into env vars as `VITE_STRIPE_PRICE_ID`

No per-collection products. No lifetime products. Monthly only.

**Webhook:** Create a Stripe webhook pointing to `https://[republic-app-url]/api/stripe-webhook`
Events to listen for:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

---

## PROMO CODE SYSTEM

**How it works:**
1. Admin creates codes in the Admin Dashboard (type: `trial_7day` or `permanent`)
2. Codes are stored in `vah_promo_codes` Supabase table
3. On each collection app's landing page, below the pricing section, there is a small "Have a promo code?" link
4. Clicking it reveals a simple text input + "Apply" button
5. On apply, the app calls `POST /api/apply-promo` with `{ code, email }`
6. The serverless function:
   - Looks up the code in `vah_promo_codes`
   - Validates: exists, is_active=true, not expired, uses_count < max_uses (or max_uses is null)
   - If valid: creates or updates user record with appropriate access_type, increments uses_count
   - Returns: `{ success: true, access_type: 'promo_trial' | 'permanent', expires_at }`
7. App stores access state in localStorage and grants access accordingly

**Code format:** Admin-defined. Suggested format: `VAH-XXXX-XXXX` (e.g. `VAH-2026-FREE`, `VAH-PRESS-01`). No auto-generation required — admin types the code they want.

**`api/apply-promo.js` serverless function** (add to each collection app):
```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code, email } = req.body;
  if (!code || !email) return res.status(400).json({ error: 'Missing code or email' });

  const { data: promo } = await supabase
    .from('vah_promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (!promo) return res.status(404).json({ error: 'Invalid or expired code' });
  if (promo.expires_at && new Date(promo.expires_at) < new Date())
    return res.status(410).json({ error: 'This code has expired' });
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses)
    return res.status(410).json({ error: 'This code has reached its usage limit' });

  const accessType = promo.type === 'permanent' ? 'permanent' : 'promo_trial';
  const expiresAt = promo.type === 'permanent' ? null :
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('vah_users').upsert({
    email,
    access_type: accessType,
    trial_expires_at: expiresAt,
    promo_code_used: code
  }, { onConflict: 'email' });

  await supabase.from('vah_promo_codes')
    .update({ uses_count: promo.uses_count + 1 })
    .eq('id', promo.id);

  return res.status(200).json({ success: true, access_type: accessType, expires_at: expiresAt });
}
```

---

## ADMIN DASHBOARD — FIFTH APP

**URL:** `admin.voicesacrosshistory.com` (or `voices-across-history-admin.vercel.app` until domain is live)
**Access:** Password-protected. Single admin password set via `ADMIN_PASSWORD` env var.
**Auth:** Simple — hash comparison on login, JWT stored in sessionStorage. No Supabase auth needed for admin.
**Uses:** `SUPABASE_SERVICE_ROLE_KEY` for full database read/write access.

**Five dashboard views:**

### View 1 — Subscribers
- Total active subscribers (count)
- Monthly recurring revenue (MRR = active subscribers × $9.99)
- Table: email, name, access_type, subscribed_at, subscription_end, stripe_customer_id
- Filter by: active / trial / promo / permanent / cancelled
- Action: click any user to see their full record and subscription events
- Export to CSV button

### View 2 — Promo Codes
- Table of all promo codes: code, type, uses_count / max_uses, expires_at, is_active, note
- **Create New Code** form:
  - Code text (admin types it, e.g. `VAH-PRESS-2026`)
  - Type: 7-Day Trial or Permanent Access (dropdown)
  - Max Uses: number or "Unlimited" toggle
  - Expiry Date: date picker or "Never" toggle
  - Note: free text memo
  - Submit → inserts to `vah_promo_codes`
- Toggle active/inactive per code
- Delete code button (with confirmation)

### View 3 — Messages / Contact
- Table of all messages from `vah_messages`: name, email, subject, preview, status, date
- Filter by: unread / read / replied / archived
- Click to open full message
- Status update buttons: Mark Read, Mark Replied, Archive
- Admin note field (internal memo, not sent to user)
- Unread count badge on nav tab

### View 4 — Feedback
- Aggregate ratings per agent per app (thumbs up % / thumbs down %)
- Bar chart: top-rated agents and lowest-rated agents across platform
- Filter by app (Republic / Philosophers / Inventors)
- Raw feedback table with agent_id, rating, comment, date
- Export to CSV button

### View 5 — Platform Health
- All four live app URLs with status indicators (green/red — ping each URL)
- Supabase connection status
- Stripe webhook last received timestamp
- Total users (all time)
- New users this week / this month
- Inventors waitlist count (from `vah_notify`)

**Admin Dashboard tech:**
- React/Vite
- Supabase client with `SUPABASE_SERVICE_ROLE_KEY` for full access
- Recharts for bar charts (already available in React artifact env)
- Tailwind for utility layout
- No Anthropic API needed
- No PWA needed

---

## SESSION PLAN (REVISED — 8 SESSIONS)

### SESSION 1 — Hub + Pricing Section
**Goal:** Hub live with pricing prominently displayed.

1. Add pricing section to `hub/index.html` between the collection cards and documents section:
   - Headline: "One Subscription. All Three Collections."
   - Price display: **$9.99 / month** in large Cinzel serif
   - Sub-copy: "Unlimited conversations with every founder, philosopher, and inventor in the library."
   - Three bullet features: Primary Sources Only · Voice + Text · Mobile & Desktop
   - CTA button: "Start Free — 7 Days on Us" linking to Republic landing page (first app)
   - Small text: "Have a promo code? Redeem at any collection app."
   - Design: gold accent on dark parchment, consistent with existing hub aesthetic
2. Deploy hub to Vercel (static)
3. Verify pricing section renders correctly on mobile (375px)
4. Note live URL

**Session 1 complete when:** Hub live, pricing section visible and mobile-friendly.

---

### SESSION 2 — Voices of the Republic (Full + PWA + Mobile + Subscription)
**Goal:** Republic live, subscription gate working, PWA installable, mobile-optimized.

1. Add `vite-plugin-pwa` to `package.json` devDependencies
2. Update `vite.config.js` with PWA plugin config:
   - App name: "Voices of the Republic"
   - Short name: "Republic"
   - Theme color: `#B8892A` (gold)
   - Background color: `#100C06`
   - Icons: generate 192×192 and 512×512 from initials "VR" on dark background if no logo
3. Add PWA meta tags and manifest link to `index.html`
4. Add subscription/access gate to `App.jsx`:
   - On landing page: show pricing below the "Enter the Hall of Founders" button
     - "$9.99/month — All Collections" in Cinzel gold
     - "Start Free — 7 Days" CTA button
     - "Have a promo code?" link that expands inline input
   - Gate logic: check localStorage for `vah_access` record
     - No record → start 7-day trial on email capture, write to Supabase
     - Trial active → allow full access
     - Trial expired + not paid → show paywall with Stripe checkout button
     - Subscribed → allow full access
     - Permanent promo → allow full access, no expiry
5. Apply all mobile-first design rules (typography, touch targets, card sizing, chat layout)
6. Add `api/apply-promo.js` serverless function
7. Add `api/create-checkout.js` serverless function
8. Add `api/stripe-webhook.js` serverless function (handles subscription events, updates Supabase)
9. Deploy to Vercel with all env vars:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PRICE_ID`
10. Verify: PWA install prompt appears after 30s, chat works, promo code applies, trial gate works
11. Test Stripe checkout with card `4242 4242 4242 4242`
12. Update hub Republic card href to live URL

**Session 2 complete when:** Republic live, PWA installable, subscription gate functional, mobile passes at 375px.

---

### SESSION 3 — Voices of the Philosophers (Full + PWA + Mobile + Subscription)
**Goal:** Same as Session 2, applied to Philosophers app.

1. Apply identical PWA, mobile, subscription gate, and promo code treatment as Session 2
2. PWA theme color: `#4A7A9B` (slate blue)
3. Background color: `#080B10`
4. Same three serverless functions (`apply-promo`, `create-checkout`, `stripe-webhook`)
5. Same env vars as Republic
6. Deploy, verify, update hub Philosophers card href

**Session 3 complete when:** Philosophers live with identical access/PWA/mobile treatment as Republic.

---

### SESSION 4 — Inventors Coming Soon + Admin Dashboard Build
**Goal:** Inventors scaffold live. Admin Dashboard built and deployed.

**Part A — Inventors:**
1. Apply PWA shell and mobile fixes to Inventors coming-soon scaffold
2. Wire the email notify form to write to `vah_notify` Supabase table
3. Deploy with env vars
4. Update hub Inventors card href

**Part B — Admin Dashboard:**
1. Build React/Vite app with five views (Subscribers, Promo Codes, Messages, Feedback, Platform Health) as specified above
2. Password login screen — checks against `ADMIN_PASSWORD` env var (bcrypt)
3. Nav sidebar with tab labels and unread message badge
4. Deploy to Vercel as `voices-across-history-admin`
5. Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`
6. Verify all five views load and Supabase data populates (may be empty tables at this stage — that is expected)
7. Create one test promo code (`VAH-TEST-7DAY` — type: trial_7day) and verify it appears in the Promo Codes view
8. Verify the test code can be redeemed in the Republic app

**Session 4 complete when:** All five apps live, admin dashboard functional, test promo code redeemable end-to-end.

---

### SESSION 5 — Supabase Schema + Full Auth Verification
**Goal:** All auth/trial/subscription flows verified end-to-end across all apps.

1. Run the complete Supabase schema SQL (provided above)
2. Verify all six tables exist with correct columns and RLS policies
3. End-to-end test all user flows:
   - New visitor → email capture → 7-day trial starts → `vah_users` record created
   - Trial user → Stripe checkout → subscription created → `vah_users.access_type` = 'subscribed'
   - Cancelled subscription → `subscription_end` set → user sees paywall after end date
   - Promo code `VAH-TEST-7DAY` → 7-day access, uses_count increments
   - Promo code `VAH-TEST-PERM` (create this) → permanent access, no expiry
4. Verify Stripe webhook receives and processes events correctly
5. Verify admin dashboard Subscribers view shows test user records
6. Verify admin dashboard Promo Codes view shows both test codes with correct uses_count

**Session 5 complete when:** All six user flows verified, Supabase data accurate, admin dashboard reflects real data.

---

### SESSION 6 — Stripe Live + Payments Verified
**Goal:** Stripe switched from test to live mode, real payment processed.

1. Switch all Stripe env vars from `sk_test_` to `sk_live_` across all apps
2. Update `VITE_STRIPE_PUBLISHABLE_KEY` to live publishable key
3. Update `STRIPE_WEBHOOK_SECRET` to live webhook secret
4. Redeploy all three collection apps and admin dashboard
5. Process one real $9.99 test purchase (Andrea does this herself — this requires her card)
6. Verify subscription record appears in admin dashboard
7. Verify webhook event logged in `vah_subscription_events`

**FLAG THIS SESSION AS A BLOCKER:** Andrea must personally complete the real payment test. Cowork cannot process a real payment. Prepare all steps, verify test mode is working perfectly, then flag Andrea to complete the live payment test.

**Session 6 complete when:** Andrea confirms live payment processed and subscription shows in dashboard.

---

### SESSION 7 — Inventors Full Build
**Goal:** Replace coming-soon scaffold with fully functional Inventors app.

**8 agents to build:**
| Inventor | Years | Primary Sources |
|---|---|---|
| Thomas Edison | 1847–1931 | Laboratory notebooks, patents, letters, diary |
| Nikola Tesla | 1856–1943 | My Inventions, lectures, patents, The Problem of Increasing Human Energy |
| Marie Curie | 1867–1934 | PhD thesis, Nobel Prize addresses, Pierre Curie biography, research notebooks |
| Leonardo da Vinci | 1452–1519 | Codex Atlanticus, Codex Leicester, Codex Arundel, Windsor Notebooks |
| Alan Turing | 1912–1954 | Computing Machinery and Intelligence (1950), On Computable Numbers (1936), Morphogenesis paper, letters |
| Orville & Wilbur Wright | 1867–1948 | Diaries, letters, How We Made the First Flight, technical papers |
| Galileo Galilei | 1564–1642 | Sidereal Messenger, Dialogue, Letters on Sunspots |
| Isaac Newton | 1643–1727 | Principia Mathematica, Opticks, letters, Cambridge notebooks |

**Design:** Brass and blueprint aesthetic — dark navy/charcoal `#0A0E14`, copper/brass accent `#B87333`, mechanical-era typography (Cinzel + Crimson Text consistent with platform).

**Same PWA, mobile, subscription gate, and promo code treatment as Republic and Philosophers.**

**Session 7 complete when:** All 8 inventors live, all agents respond from primary sources, voice works, PWA installable, subscription gate active.

---

### SESSION 8 — Domain, Polish, Launch Readiness
**Goal:** Platform production-ready for public launch.

**Domain setup (if Andrea has purchased voicesacrosshistory.com):**
1. Vercel custom domains:
   - Hub → `voicesacrosshistory.com` + `www.voicesacrosshistory.com`
   - Republic → `republic.voicesacrosshistory.com`
   - Philosophers → `philosophers.voicesacrosshistory.com`
   - Inventors → `inventors.voicesacrosshistory.com`
   - Admin → `admin.voicesacrosshistory.com`
2. SiteGround DNS: CNAME records per subdomain via cPanel Zone Editor
3. Verify SSL on all five domains
4. Update all cross-app links to use custom domains

**Polish checklist:**
- [ ] Mobile pass on all three collection apps at 375px — every screen
- [ ] PWA install prompt timing verified (30s after landing, not on every visit)
- [ ] All portrait images verified (load or fallback gracefully)
- [ ] All founding document and location links work
- [ ] Promo code UI is clean and readable on mobile
- [ ] Paywall screen readable and payment button accessible on mobile
- [ ] Open Graph meta tags on all apps for social sharing
- [ ] Admin dashboard accessible and password-protected
- [ ] Stripe webhook active and receiving events
- [ ] Inventors waitlist email count visible in admin Platform Health view
- [ ] Full end-to-end user journey tested: hub → collection → trial → chat → voice → mic → promo code path

**Launch readiness report (deliver to Andrea):**
- All five live URLs
- Supabase project ID
- Stripe product + price IDs
- Sample promo codes created and ready to distribute
- Any known issues and their workarounds
- Recommended first social/newsletter announcement URL

**Session 8 complete when:** Andrea has launch readiness report and platform is fully live.

---

## AGENT INTEGRITY RULES — NON-NEGOTIABLE

1. **Primary sources only.** Every system prompt restricts the agent to its verified primary source corpus. The agent must never speculate or answer from general knowledge when primary sources do not cover the question.
2. **Honest limitation acknowledgment.** When asked something outside the documented record, the agent says so plainly.
3. **Founding wives sourcing.** Abigail Adams and Dolley Madison flagged in UI as "Primary Sources Only." Agents reflect this honestly.
4. **No modern opinions.** Agents do not express opinions on current events, modern politics, or contemporary figures.
5. **Portrait attribution.** All portraits are public domain. Attribution displayed in chat view.

---

## DECISIONS ALREADY MADE — DO NOT RELITIGATE

- **Render is retired.** `voices-of-the-republic.onrender.com` is being replaced. Do not use Render.
- **Vercel only.** All five apps on Vercel. No Cloudflare, no Render.
- **Shared Supabase.** One project for all five apps.
- **Web Speech API.** Voice output and mic input are browser built-in. No paid voice service.
- **$9.99/month — one subscription, all collections.** Not per-collection. Not lifetime. Monthly recurring.
- **PWA on all three collection apps.** Hub and Admin do not need PWA.
- **Mobile-first.** Every collection app must pass 375px width test.
- **Two promo code types only:** 7-day trial and permanent access. No other types.
- **Admin dashboard is password-only.** No user-facing auth system for admin.

---

## BLOCKER ESCALATION PROTOCOL

Stop and flag Andrea only when:
- A credential or API key is needed that has not been provided
- A GitHub, Vercel, Supabase, or Stripe account action requires her direct login
- Session 6 live payment test (always a blocker — Andrea must personally execute)
- A Vercel deployment fails repeatedly (3+ attempts) for an unclear reason
- A strategic or content decision goes beyond what this document covers

For everything else — decide, document in your session report, keep moving.

---

*Voices Across History™ is a trademark of IntexiaU Corp.*
*An IntexiaU Institute and Innovations Platform.*
*© 2026 IntexiaU Corp. All rights reserved.*
