// GET /api/group — for a class or co-op leader: their group, its members, and recent conversations.
// Only the leader named on the group can read it. Members are told on joining that their leader can read their conversations.
import { admin, getUser, accessFor } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  const access = await accessFor(user);
  const g = access.group;
  if (!g || g.role !== 'leader') return res.status(403).json({ error: 'Only the class or co-op leader can see this page.' });

  const [{ data: group }, { data: members }, { data: turns }] = await Promise.all([
    admin.from('vah_groups').select('id, code, name, kind, seats, starts_at, expires_at').eq('id', g.id).maybeSingle(),
    admin.from('vah_group_members').select('email, joined_at').eq('group_id', g.id).order('joined_at', { ascending: true }),
    admin.from('vah_group_turns').select('id, email, app, figure_id, round_id, question, answer, created_at').eq('group_id', g.id).order('created_at', { ascending: false }).limit(200),
  ]);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  return res.status(200).json({ group, members: members || [], turns: turns || [] });
}
