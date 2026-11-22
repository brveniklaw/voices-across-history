// POST /api/roundtable — one figure's turn at a roundtable of two or three figures, who may come
// from any collection. The app calls this once per figure, in order, passing the shared transcript
// so each figure can answer the visitor and respond to what the others said. Each reply counts as
// one message.
//
// Roundtables are presented as simulations. So that the figures can engage one another faithfully,
// each speaker is briefed on the others at the table: their lives, their documented works, and how
// the record portrays their views. That briefing lets a figure answer someone from another century
// on the strength of that person's actual record, rather than guessing.
import { getUser, accessFor, readJson, DAILY_MESSAGE_LIMIT, HOUSE_RULES, CITATION_RULES, TODAY_RULES, splitSources, callClaude, replyText, bumpUsage, recordGroupTurn } from './_lib.js';
import { COLLECTION } from '../figures.js';
import { ALL_FIGURES } from '../catalog/index.js';

const withSources = (text, sources) => (sources.length ? `${text}\n\nSources: ${sources.join('; ')}` : text);

const byId = (id) => ALL_FIGURES.find((f) => f.id === id);
const nameOf = (id) => byId(id)?.name;

// What one figure is told about a companion at the table. The companion's own instructions describe
// their record and views in the second person ("You are…"), so they're framed as such here.
function briefing(f) {
  const portrait = String(f.systemPrompt || '').slice(0, 1800);
  return [
    `${f.name} (${f.years}), ${f.title}.`,
    `Their documented works: ${f.primarySources.join('; ')}.`,
    f.accent ? `Their manner: ${f.accent}.` : '',
    `How the historical record portrays them (written as guidance to them): """${portrait}"""`,
  ].filter(Boolean).join('\n');
}

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
  const figure = byId(String(figureId));
  if (!figure || !ids.includes(figure.id)) return res.status(400).json({ error: 'Unknown figure.' });

  const lines = (Array.isArray(transcript) ? transcript.slice(-12) : [])
    .map((t) => ({ speaker: String(t?.speaker || ''), text: String(t?.text || '').slice(0, 2500).trim() }))
    .filter((t) => t.text && (t.speaker === 'visitor' || ids.includes(t.speaker)));
  const question = [...lines].reverse().find((t) => t.speaker === 'visitor');
  if (!question) return res.status(400).json({ error: 'Please put a question to the table.' });
  if (!(await bumpUsage(access))) return res.status(429).json({ error: 'daily_limit', limit: DAILY_MESSAGE_LIMIT });

  const companions = ids.filter((id) => id !== figure.id).map(byId);
  const others = companions.map((f) => f.name);
  const roundRules = `

This is a roundtable, presented to the visitor as a simulation: a speculative conversation that explores what each person at the table would most likely say. You share the table with ${others.join(' and ')}, and a visitor is putting questions to all of you.

What you know of your companions:
${companions.map((f) => `---\n${briefing(f)}`).join('\n')}
---

How to take part:
- Answer the visitor's latest question in your own voice, from your own record, giving the answer you would most plausibly give.
- You have been briefed on your companions' lives and documented works above, and may draw on that knowledge even if they lived after you or you could never have read them. At this table that knowledge is an exception to the rule about people beyond your time. If a companion lived after you, acknowledge naturally, once, that you know their work only through what has been set before you here. If they lived before you and their work was known in your day, you may speak of it as a reader of your time would.
- Engage with your companions by name. Where your documented views agree or disagree with theirs, say so directly and explain why from your own record. Disagree with courtesy but without softening what you actually held.
- When you refer to a companion's views, ground it in their documented record as briefed above, and frame it as your understanding ("as I understand your writings…"). Never invent what they wrote or said, never speak for them, and respond only to the words they actually said in the transcript.
- Keep this turn to about 150 words so the others have room to answer.`;
  const system = `${figure.systemPrompt}\n\nYou are taking part in a Voices Across History™ roundtable by IntexiaU.${HOUSE_RULES}${today ? TODAY_RULES : ''}${roundRules}${CITATION_RULES}`;
  const record = lines.map((t) => `[${t.speaker === 'visitor' ? 'Visitor' : nameOf(t.speaker)}]: ${t.text}`).join('\n\n');
  const prompt = `The roundtable so far:\n\n${record}\n\nIt is now your turn, ${figure.name}. Answer the visitor's latest question, and respond to the others where it fits.`;

  try {
    const { data } = await callClaude(system, [{ role: 'user', content: prompt }], 1000);
    const { text: body, sources } = splitSources(replyText(data));
    // If a reply ran past the length limit, end it at its last complete sentence rather than mid-thought.
    const whole = data?.stop_reason === 'max_tokens' ? (body.match(/^[\s\S]*[.!?]["”’)]?(?=\s|$)/)?.[0] || body) : body;
    const text = whole || 'I find I cannot speak to that from my record.';
    await recordGroupTurn(access, { app: COLLECTION.id, figureId: figure.id, roundId: String(roundId || '').slice(0, 64), question: (today ? "Today's issues: " : '') + question.text, answer: withSources(text, sources) });
    return res.status(200).json({ text, sources, mode: today ? 'today' : 'record' });
  } catch (err) {
    console.error('Anthropic error:', String(err).slice(0, 500));
    return res.status(502).json({ error: 'The roundtable could not continue. Please try again.' });
  }
}
