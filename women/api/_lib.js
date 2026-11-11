// Shared server helpers for every Voices Across History collection.
// Identity comes from the visitor's IntexiaU account (Supabase Auth); access comes from vah_users,
// so one membership covers every collection. Copied into each app by scripts/sync-shared.sh.
import { createClient } from '@supabase/supabase-js';

export const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DAILY_MESSAGE_LIMIT = Number(process.env.VAH_DAILY_LIMIT || 100);
export const HUB_ORIGIN = 'https://voicesacrosshistory.intexiau.com';

// Returns the signed-in Supabase user for a request, or null.
export async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user;
}

export function hasActiveAccess(u) {
  if (!u) return false;
  const now = new Date();
  if (u.access_type === 'permanent') return true;
  if (u.access_type === 'subscribed') return !u.subscription_end || new Date(u.subscription_end) > now;
  if (u.access_type === 'trial' || u.access_type === 'promo_trial') {
    return !!u.trial_expires_at && new Date(u.trial_expires_at) > now;
  }
  return false;
}

// Membership state for a signed-in user. IntexiaU site admins always have access.
export async function accessFor(user) {
  const email = user.email.toLowerCase().trim();
  const [{ data: row }, { data: staff }] = await Promise.all([
    admin.from('vah_users').select('email, access_type, trial_expires_at, subscription_end, auth_user_id').eq('email', email).maybeSingle(),
    admin.from('site_admins').select('user_id').eq('user_id', user.id).is('revoked_at', null).maybeSingle(),
  ]);
  if (row && !row.auth_user_id) {
    await admin.from('vah_users').update({ auth_user_id: user.id, last_seen_at: new Date().toISOString() }).eq('email', email);
  }
  const group = await groupFor(email);
  if (staff) return { email, access_type: 'permanent', staff: true, active: true, group };
  if (!row) {
    if (group) return { email, access_type: 'group', active: true, is_new: false, group };
    return { email, access_type: 'none', active: false, is_new: true };
  }
  const own = hasActiveAccess(row);
  return {
    email,
    access_type: !own && group ? 'group' : row.access_type,
    trial_expires_at: row.trial_expires_at,
    subscription_end: row.subscription_end,
    active: own || !!group,
    is_new: false,
    group,
  };
}

// ── CLASS & CO-OP CODES ─────────────────────────────────────────────────────
// A class or co-op code (vah_groups) opens every collection for its members while the group is
// active. The leader named on the group gets access too and can read members' conversations.
// If the group tables haven't been created yet, this quietly returns null.
function groupLive(g) {
  if (!g || !g.is_active) return false;
  const now = new Date();
  if (g.starts_at && new Date(g.starts_at) > now) return false;
  return !g.expires_at || new Date(g.expires_at) > now;
}

export async function groupFor(email) {
  try {
    const cols = 'id, name, kind, leader_email, starts_at, expires_at, is_active';
    const [{ data: led, error: e1 }, { data: joined, error: e2 }] = await Promise.all([
      admin.from('vah_groups').select(cols).eq('leader_email', email),
      admin.from('vah_group_members').select(`group_id, vah_groups(${cols})`).eq('email', email),
    ]);
    if (e1 || e2) return null;
    const lead = (led || []).find(groupLive);
    if (lead) return { id: lead.id, name: lead.name, kind: lead.kind, role: 'leader', expires_at: lead.expires_at };
    const m = (joined || []).map((r) => r.vah_groups).find(groupLive);
    if (m) return { id: m.id, name: m.name, kind: m.kind, role: 'member', expires_at: m.expires_at };
    return null;
  } catch {
    return null;
  }
}

// Saves one exchange for a class or co-op member so their leader can read it. Never blocks the reply.
export async function recordGroupTurn(access, turn) {
  if (!access?.group || access.group.role !== 'member') return;
  try {
    await admin.from('vah_group_turns').insert({
      group_id: access.group.id,
      email: access.email,
      app: turn.app,
      figure_id: turn.figureId,
      round_id: turn.roundId || null,
      question: String(turn.question || '').slice(0, 4000),
      answer: String(turn.answer || '').slice(0, 8000),
    });
  } catch (err) {
    console.error('group turn not saved', String(err).slice(0, 200));
  }
}

// ── CLAUDE ──────────────────────────────────────────────────────────────────
const MODELS = [process.env.ANTHROPIC_MODEL, 'claude-sonnet-5-5', 'claude-sonnet-4-5', 'claude-opus-4-5'].filter(Boolean);

export const HOUSE_RULES = `

How to conduct every conversation:
- Speak in the first person, in the voice and manner of your era, but in clear modern English the visitor can follow.
- Draw only on your documented writings, speeches and correspondence named above, and on facts of your own life. When you draw on a specific work, name it naturally (for example "as I wrote in…").
- If asked about events, technologies or people after your lifetime, say plainly that they lie beyond your time; you may reason from your recorded principles, but say that you are doing so.
- If the record is silent or uncertain, say so rather than inventing. Never fabricate quotations.
- If a visitor sincerely asks, acknowledge that you are an AI interpretation created by IntexiaU for learning, grounded in the historical record — not the person themselves.
- Keep replies to about 250 words unless the visitor asks for more. Be a generous teacher: end with a question or a thought that invites further inquiry when it fits.
- Decline requests for harmful, hateful or explicit content, staying in character.

How your words should sound (every reply may be read aloud by a voice):
- Talk the way a thoughtful person talks across a table: warm, flowing sentences in one to three short paragraphs, varying long and short sentences so it sounds like speech, not a document.
- Use plain prose only. No headings, bullet points, numbered lists, bold, italics, asterisks, emoji or stage directions such as *pauses* or (smiles).
- Never mention, name or spell out punctuation, symbols or formatting, and never describe how you are writing.
- Go easy on dashes, semicolons, brackets and quotation marks; use a comma or a new sentence instead. Quote yourself sparingly and only in a short phrase.
- Say dates, numbers and abbreviations the way you'd say them aloud ("in seventeen seventy-six", "the United States"), and use contractions where they sound natural.
- Answer the question directly first, then add colour from your life and writings. Don't open by repeating the question or by announcing what you're about to say.`;

// Every reply ends with a short list of the works it drew on; the server splits it off so the app can
// show it under the answer (it is never read aloud).
export const CITATION_RULES = `

Citing your sources:
- After your reply, add a line that says exactly SOURCES: and then one line for each of your own works you actually drew on, at most four, most important first.
- Write each as the work's usual title and, if you are sure of it, the year, for example: Federalist No. 10 (1787). Name a specific letter by writer, recipient and date only if you are certain of it.
- Cite only real works from your own documented record. Never invent a title, date, page or quotation. If you drew only on the general record of your life, write: The documented record of my life.
- The SOURCES list is the only place a list is allowed. Don't mention it in the reply itself.`;

// "Today's issues": the visitor asks how the figure might approach a question that arose after their lifetime.
export const TODAY_RULES = `

Today's issues mode:
- The visitor is asking how you might think about a question from our own time, which came after your lifetime. Open with one short, natural sentence acknowledging that this lies beyond your day and that you'll reason from what you wrote and believed.
- Then reason from your documented principles, naming the writings they come from, and show how those principles apply. Make clear these are inferences from your record, not things you actually said.
- On contested political or social questions, don't tell the visitor what to believe and don't endorse any party, candidate or current policy. Show how your principles could cut more than one way, name the tradeoffs a person of your convictions would weigh, and say where your own writings were silent or would leave honest people disagreeing.
- Close by inviting the visitor to weigh the question for themselves.`;

export function splitSources(raw = '') {
  const text = String(raw);
  const m = text.match(/\n?\s*\**\s*SOURCES?\s*:?\s*\**\s*\n([\s\S]*)$/i);
  if (!m) return { text: text.trim(), sources: [] };
  const sources = m[1].split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*+/g, '').trim())
    .filter((l) => l && l.length <= 200)
    .slice(0, 4);
  return { text: text.slice(0, m.index).trim(), sources };
}

export async function callClaude(system, messages, maxTokens = 900) {
  let lastErr = '';
  for (const model of MODELS) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
    if (r.ok) return { data: await r.json(), model };
    lastErr = await r.text();
    // Try the next model only if this one isn't available; otherwise stop.
    if (!(r.status === 404 || (r.status === 400 && /model/i.test(lastErr)))) break;
  }
  throw new Error(lastErr || 'Model unavailable');
}

export const replyText = (data) => (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

// Counts one figure reply against the member's daily fair-use limit. Returns false when the limit is reached.
export async function bumpUsage(access) {
  if (access.staff) return true;
  const { data: count, error } = await admin.rpc('vah_bump_usage', { p_email: access.email, p_limit: DAILY_MESSAGE_LIMIT });
  if (error) console.error('usage error', error);
  return count !== -1;
}

// Where Stripe should send the visitor back to: the same collection, on an approved origin.
export function returnUrl(req, returnPath) {
  const origin = String(req.headers.origin || '');
  const ok = origin === HUB_ORIGIN || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
  const path = typeof returnPath === 'string' && /^\/[a-z-]+\/$/.test(returnPath) ? returnPath : '/';
  return (ok ? origin : HUB_ORIGIN) + path;
}

export function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
