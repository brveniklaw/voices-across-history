// Shared server helpers for every Voices Across History collection.
// Identity comes from the visitor's IntexiaU account (Supabase Auth); access comes from vah_users,
// so one membership covers every collection. Copied into each app by scripts/sync-shared.sh.
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

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
// One model for every reply (override with ANTHROPIC_MODEL). The client reads ANTHROPIC_API_KEY.
const anthropic = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
// How hard the model thinks before replying. "medium" answers noticeably faster than the model's
// default ("high") for conversation; set REPLY_EFFORT to low, medium or high to tune it.
const EFFORT = ['low', 'medium', 'high'].includes(process.env.REPLY_EFFORT) ? process.env.REPLY_EFFORT : 'medium';
const takesEffort = (m) => /^claude-(sonnet|opus|haiku|fable|mythos)-5/.test(m);
// If the model declines a request on safety grounds, the API retries it on a fallback model
// within the same call, so the visitor gets an answer instead of silence.
const takesFallbacks = (m) => /^claude-(sonnet-5-5|opus-5|fable-5|mythos-5)/.test(m);

// Current models think before replying, and that thinking counts toward max_tokens, so the cap is
// generous; how long a reply is comes from the instructions (about 250 words in chat, 150 at a
// roundtable). onText receives the visible reply as it's written, for streaming to the visitor.
export async function generateReply(system, messages, onText) {
  const params = { model: MODEL, max_tokens: 16000, system, messages };
  if (takesEffort(MODEL)) params.output_config = { effort: EFFORT };
  if (takesFallbacks(MODEL)) Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  const stream = anthropic.beta.messages.stream(params);
  if (onText) stream.on('text', onText);
  return stream.finalMessage();
}

// Streams a reply to the browser as newline-delimited JSON when the browser asks for it
// (Accept: application/x-ndjson): "delta" lines carry new visible text, then one "done" or "error"
// line ends it. The SOURCES list at the end of a reply is held back, never shown mid-stream.
// Returns null for older clients, which get the usual single JSON response instead.
export function openReplyStream(req, res) {
  if (!String(req.headers?.accept || '').includes('application/x-ndjson')) return null;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  let full = '';
  let sent = 0;
  const line = (obj) => JSON.stringify(obj) + '\n';
  return {
    text(delta) {
      full += delta;
      const visible = visibleSoFar(full);
      if (visible.length > sent) { res.write(line({ type: 'delta', text: visible.slice(sent) })); sent = visible.length; }
    },
    done(payload) { res.end(line({ type: 'done', ...payload })); },
    fail(status, payload) { res.end(line({ type: 'error', status, ...payload })); },
  };
}

// The part of a reply that's safe to show while it's still being written: everything before the
// SOURCES line, minus a last partial line that might turn out to be its start.
function visibleSoFar(full) {
  const m = full.match(/(?:^|\n)[ \t]*\**[ \t]*SOURCES?\b/i);
  let out = m ? full.slice(0, m.index) : full;
  const nl = out.lastIndexOf('\n');
  const tail = out.slice(nl + 1).replace(/[\s*]/g, '').toUpperCase();
  if (tail && tail.length <= 8 && 'SOURCES:'.startsWith(tail)) out = out.slice(0, nl + 1);
  return out;
}

// Keeps only citations that name a work on the figure's own list of primary sources, shown with
// the list's wording, so the app never presents an invented or misdated title as a source.
export function listedSources(sources, figure) {
  const norm = (t) => String(t).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const kept = [];
  for (const s of sources) {
    const t = norm(s);
    if (t.length < 3) continue;
    const hit = (figure.primarySources || []).find((p) => { const n = norm(p); return n && (n.includes(t) || t.includes(n)); });
    if (hit && !kept.includes(hit)) kept.push(hit);
  }
  return kept.length ? kept : [GENERAL_RECORD];
}
export const GENERAL_RECORD = 'The documented record of my life';

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
// Citations come only from the figure's own list of primary sources (figures.js), copied exactly,
// so they can be checked; the server drops anything else (listedSources).
export const citationRules = (figure) => `

Citing your sources:
- After your reply, add a line that says exactly SOURCES: and then one line for each work you actually drew on, at most four, most important first.
- Choose only from this list of your works, and copy each title exactly as it is written here:
${(figure.primarySources || []).map((s) => `  ${s}`).join('\n')}
- If you drew only on the general record of your life, write: The documented record of my life.
- In the reply itself, name works the same way. Don't give the day or month of a letter, speech or event unless you're certain of it; the year, or the work's name, is enough. Never invent a title, date or quotation.
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
  // The list must start on its own line, so the word "sources" inside a sentence is never mistaken for it.
  const m = text.match(/(?:^|\n)[ \t]*\**[ \t]*SOURCES?[ \t]*\**[ \t]*:?[ \t]*\**[ \t]*\n([\s\S]*)$/i);
  if (!m) return { text: text.trim(), sources: [] };
  const sources = m[1].split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*+/g, '').trim())
    .filter((l) => l && l.length <= 200)
    .slice(0, 4);
  return { text: text.slice(0, m.index).trim(), sources };
}


export const replyText = (data) => (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

// Turns a finished model message into what the visitor sees: the reply (ended at its last full
// sentence if it ran long), and its sources, limited to the figure's listed works.
export function finishReply(message, figure) {
  const { text: body, sources } = splitSources(replyText(message));
  const whole = message?.stop_reason === 'max_tokens' ? (body.match(/^[\s\S]*[.!?]["”’)]?(?=\s|$)/)?.[0] || body) : body;
  const fallback = message?.stop_reason === 'refusal'
    ? 'That is not a question I can take up. Perhaps you would ask me something else.'
    : 'I find I cannot speak to that from my record.';
  return { text: whole || fallback, sources: whole ? listedSources(sources, figure) : [] };
}

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
