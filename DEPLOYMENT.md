# Voices Across History™ — Deployment Guide
**IntexiaU Institute Platform**

---

## Platform Structure

```
voices-across-history/
├── hub/                    → Platform landing page (static HTML, no build needed)
│   └── index.html
├── republic/               → Voices of the Republic (React/Vite)
│   ├── api/chat.js         → Vercel serverless function
│   ├── src/App.jsx
│   ├── src/main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── philosophers/           → Voices of the Philosophers (React/Vite)
│   ├── api/chat.js
│   ├── src/App.jsx
│   ├── src/main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── inventors/              → Voices of the Inventors (Coming Soon scaffold)
    ├── api/chat.js
    ├── src/App.jsx
    └── (same structure)
```

---

## Four Separate GitHub Repos

Create one GitHub repo per app:

| Repo Name | Contents |
|---|---|
| `voices-across-history-hub` | hub/ folder contents |
| `voices-of-the-republic` | republic/ folder contents |
| `voices-of-the-philosophers` | philosophers/ folder contents |
| `voices-of-the-inventors` | inventors/ folder contents |

---

## Four Separate Vercel Projects

### Hub (Static)
1. New project → import `voices-across-history-hub`
2. Framework: **Other** (static)
3. No env vars needed
4. Domain: `voices-across-history.vercel.app` or custom

### Republic, Philosophers, Inventors (React/Vite)
For each:
1. New project → import repo
2. Framework: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable:

```
ANTHROPIC_API_KEY = sk-ant-your-key-here
```

---

## Supabase (Shared Project)

Use one Supabase project for all apps. Run this SQL to set up user tracking:

```sql
-- Shared users table for all Voices Across History apps
CREATE TABLE vah_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  app TEXT NOT NULL CHECK (app IN ('republic', 'philosophers', 'inventors')),
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notify list for Inventors coming soon
CREATE TABLE vah_notify (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Connecting the Platform

After deployment, update the hub `index.html` collection card links:

```html
<!-- Replace relative links with actual Vercel URLs -->
<a href="https://voices-of-the-republic.vercel.app" ...>
<a href="https://voices-of-the-philosophers.vercel.app" ...>
<a href="https://voices-of-the-inventors.vercel.app" ...>
```

---

## Custom Domains (Optional)

If using custom domains via SiteGround DNS:

| App | Suggested Domain |
|---|---|
| Hub | voicesacrosshistory.com |
| Republic | republic.voicesacrosshistory.com |
| Philosophers | philosophers.voicesacrosshistory.com |
| Inventors | inventors.voicesacrosshistory.com |

---

## Founders Included — Voices of the Republic

**Founders (11):**
Washington · Hamilton · Jefferson · Madison · John Adams · Franklin · Monroe · John Jay · Thomas Paine · Samuel Adams · Patrick Henry

**Founding Wives (2):**
Abigail Adams · Dolley Madison
*Responses restricted to verified letters and documented correspondence only.*

---

## Philosophers Included — Voices of the Philosophers

Socrates/Plato · Aristotle · Marcus Aurelius · Epictetus · John Locke · Rousseau · Kant · Nietzsche · Emerson · Thoreau · John Stuart Mill · David Hume

---

## Voice Notes

- Uses **Web Speech API** (browser built-in, free, no API key)
- Voice selection attempts to match gender and era where possible
- Speak-to-agent via microphone uses **Web Speech Recognition API** (Chrome/Edge)
- Portrait images sourced from Wikimedia Commons, Library of Congress, White House Collection — all public domain with attribution
- If a portrait fails to load, graceful fallback to styled initials

---

## Source Integrity

Every agent system prompt explicitly restricts responses to verified primary sources only. If a user asks something outside the documented record, the agent is instructed to say so plainly rather than speculate. This is the platform's core integrity promise.

---

*Voices Across History™ is a trademark of IntexiaU Corp. An IntexiaU Institute Platform.*
