// POST /api/chat — a conversation turn with one figure.
// Only signed-in members with active access may chat. The figure's instructions live on the server,
// so visitors can't substitute their own prompt, and each member has a daily fair-use limit.
import { getUser, accessFor, readJson, DAILY_MESSAGE_LIMIT, HOUSE_RULES, CITATION_RULES, TODAY_RULES, splitSources, callClaude, replyText, bumpUsage, recordGroupTurn } from './_lib.js';
import { FIGURES, COLLECTION } from '../figures.js';

const withSources = (text, sources) => (sources.length ? `${text}\n\nSources: ${sources.join('; ')}` : text);

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  const access = await accessFor(user);
  if (!access.active) return res.status(402).json({ error: 'membership_required' });
  const { figureId, messages, mode } = readJson(req);
  const today = mode === 'today';
  const figure = FIGURES.find((f) => f.id === figureId);
  if (!figure) return res.status(400).json({ error: 'Unknown figure.' });
  const history = cleanMessages(messages);
  if (!history.length) return res.status(400).json({ error: 'Please ask a question.' });
  if (!(await bumpUsage(access))) return res.status(429).json({ error: 'daily_limit', limit: DAILY_MESSAGE_LIMIT });
  try {
    const system = `${figure.systemPrompt}\n\nYou are part of "${COLLECTION.name}", a Voices Across History™ collection by IntexiaU.${HOUSE_RULES}${today ? TODAY_RULES : ''}${CITATION_RULES}`;
    const { data } = await callClaude(system, history, 1000);
    const { text: body, sources } = splitSources(replyText(data));
    const text = body || 'I find I cannot speak to that from my record.';
    await recordGroupTurn(access, { app: COLLECTION.id, figureId: figure.id, question: (today ? "Today's issues: " : '') + history[history.length - 1].content, answer: withSources(text, sources) });
    return res.status(200).json({ text, sources, mode: today ? 'today' : 'record' });
  } catch (err) {
    console.error('Anthropic error:', String(err).slice(0, 500));
    return res.status(502).json({ error: 'The conversation could not be completed. Please try again.' });
  }
}
