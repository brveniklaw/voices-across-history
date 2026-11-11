// POST /api/roundtable — one figure's turn at a roundtable of two or three figures from this collection.
// The app calls this once per figure, in order, passing the shared transcript so each figure can
// answer the visitor and respond to what the others said. Each reply counts as one message.
import { getUser, accessFor, readJson, DAILY_MESSAGE_LIMIT, HOUSE_RULES, CITATION_RULES, TODAY_RULES, splitSources, callClaude, replyText, bumpUsage, recordGroupTurn } from './_lib.js';
import { FIGURES, COLLECTION } from '../figures.js';

const withSources = (text, sources) => (sources.length ? `${text}\n\nSources: ${sources.join('; ')}` : text);

const nameOf = (id) => FIGURES.find((f) => f.id === id)?.name;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  const access = await accessFor(user);
  if (!access.active) return res.status(402).json({ error: 'membership_required' });

  const { figureId, panel, transcript, roundId, mode } = readJson(req);
  const today = mode === 'today';
  const ids = Array.isArray(panel) ? [...new Set(panel.map(String))] : [];
  if (ids.length < 2 || ids.length > 3 || !ids.every(nameOf)) return res.status(400).json({ error: 'Choose two or three voices.' });
  const figure = FIGURES.find((f) => f.id === figureId);
  if (!figure || !ids.includes(figure.id)) return res.status(400).json({ error: 'Unknown figure.' });

  const lines = (Array.isArray(transcript) ? transcript.slice(-12) : [])
    .map((t) => ({ speaker: String(t?.speaker || ''), text: String(t?.text || '').slice(0, 2500).trim() }))
    .filter((t) => t.text && (t.speaker === 'visitor' || ids.includes(t.speaker)));
  const question = [...lines].reverse().find((t) => t.speaker === 'visitor');
  if (!question) return res.status(400).json({ error: 'Please put a question to the table.' });
  if (!(await bumpUsage(access))) return res.status(429).json({ error: 'daily_limit', limit: DAILY_MESSAGE_LIMIT });

  const others = ids.filter((id) => id !== figure.id).map(nameOf);
  const roundRules = `

This is a roundtable. You share the table with ${others.join(' and ')}, and a visitor is putting questions to all of you.
- Answer the visitor's latest question in your own voice, from your own record.
- Where your documented views agree or disagree with what the others have just said, say so directly and by name. Disagree with courtesy but without softening what you actually held.
- Never speak for the others or invent what they said; respond only to the words in the transcript.
- Keep this turn to about 150 words so the others have room to answer.`;
  const system = `${figure.systemPrompt}\n\nYou are part of "${COLLECTION.name}", a Voices Across History™ collection by IntexiaU.${HOUSE_RULES}${today ? TODAY_RULES : ''}${roundRules}${CITATION_RULES}`;
  const record = lines.map((t) => `[${t.speaker === 'visitor' ? 'Visitor' : nameOf(t.speaker)}]: ${t.text}`).join('\n\n');
  const prompt = `The roundtable so far:\n\n${record}\n\nIt is now your turn, ${figure.name}. Answer the visitor's latest question, and respond to the others where it fits.`;

  try {
    const { data } = await callClaude(system, [{ role: 'user', content: prompt }], 700);
    const { text: body, sources } = splitSources(replyText(data));
    const text = body || 'I find I cannot speak to that from my record.';
    await recordGroupTurn(access, { app: COLLECTION.id, figureId: figure.id, roundId: String(roundId || '').slice(0, 64), question: (today ? "Today's issues: " : '') + question.text, answer: withSources(text, sources) });
    return res.status(200).json({ text, sources, mode: today ? 'today' : 'record' });
  } catch (err) {
    console.error('Anthropic error:', String(err).slice(0, 500));
    return res.status(502).json({ error: 'The roundtable could not continue. Please try again.' });
  }
}
