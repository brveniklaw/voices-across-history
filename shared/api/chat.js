// POST /api/chat — a conversation turn with one figure.
// Only signed-in members with active access may chat. The figure's instructions live on the server,
// so visitors can't substitute their own prompt, and each member has a daily fair-use limit.
import { admin, getUser, accessFor, readJson, DAILY_MESSAGE_LIMIT } from './_lib.js';
import { FIGURES, COLLECTION } from '../figures.js';

const MODELS = [process.env.ANTHROPIC_MODEL, 'claude-sonnet-5-5', 'claude-sonnet-4-5', 'claude-opus-4-5'].filter(Boolean);

const HOUSE_RULES = `

How to conduct every conversation:
- Speak in the first person, in the voice and manner of your era, but in clear modern English the visitor can follow.
- Draw only on your documented writings, speeches and correspondence named above, and on facts of your own life. When you draw on a specific work, name it naturally (for example "as I wrote in…").
- If asked about events, technologies or people after your lifetime, say plainly that they lie beyond your time; you may reason from your recorded principles, but say that you are doing so.
- If the record is silent or uncertain, say so rather than inventing. Never fabricate quotations.
- If a visitor sincerely asks, acknowledge that you are an AI interpretation created by IntexiaU for learning, grounded in the historical record — not the person themselves.
- Keep replies to about 250 words unless the visitor asks for more. Be a generous teacher: end with a question or a thought that invites further inquiry when it fits.
- Decline requests for harmful, hateful or explicit content, staying in character.`;

function cleanMessages(list) {
  const out = [];
  for (const m of Array.isArray(list) ? list.slice(-14) : []) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m?.content ?? m?.text ?? '').slice(0, 4000).trim();
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

async function callClaude(system, messages) {
  let lastErr = '';
  for (const model of MODELS) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 900, system, messages }),
    });
    if (r.ok) return { data: await r.json(), model };
    lastErr = await r.text();
    // Try the next model only if this one isn't available; otherwise stop.
    if (!(r.status === 404 || (r.status === 400 && /model/i.test(lastErr)))) break;
  }
  throw new Error(lastErr || 'Model unavailable');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  const access = await accessFor(user);
  if (!access.active) return res.status(402).json({ error: 'membership_required' });

  const { figureId, messages } = readJson(req);
  const figure = FIGURES.find((f) => f.id === figureId);
  if (!figure) return res.status(400).json({ error: 'Unknown figure.' });
  const history = cleanMessages(messages);
  if (!history.length) return res.status(400).json({ error: 'Please ask a question.' });

  if (!access.staff) {
    const { data: count, error } = await admin.rpc('vah_bump_usage', { p_email: access.email, p_limit: DAILY_MESSAGE_LIMIT });
    if (error) console.error('usage error', error);
    if (count === -1) return res.status(429).json({ error: 'daily_limit', limit: DAILY_MESSAGE_LIMIT });
  }

  try {
    const system = `${figure.systemPrompt}\n\nYou are part of "${COLLECTION.name}", a Voices Across History™ collection by IntexiaU.${HOUSE_RULES}`;
    const { data } = await callClaude(system, history);
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return res.status(200).json({ text: text || 'I find I cannot speak to that from my record.' });
  } catch (err) {
    console.error('Anthropic error:', String(err).slice(0, 500));
    return res.status(502).json({ error: 'The conversation could not be completed. Please try again.' });
  }
}
