// api/groups.js — class & co-op codes (GET / POST / PATCH). Needs the vah_groups migration applied.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from './_verify.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const newCode = (kind) => `${kind === 'coop' ? 'COOP' : 'CLASS'}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const notReady = (error) => error && /vah_group|does not exist|schema cache/i.test(error.message || '');

export default async function handler(req, res) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const [{ data: groups, error }, { data: members }] = await Promise.all([
      supabase.from('vah_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('vah_group_members').select('group_id'),
    ]);
    if (notReady(error)) return res.status(200).json({ groups: [], notReady: true });
    if (error) return res.status(500).json({ error: error.message });
    const used = {};
    for (const m of members || []) used[m.group_id] = (used[m.group_id] || 0) + 1;
    return res.status(200).json({ groups: (groups || []).map((g) => ({ ...g, seats_used: used[g.id] || 0 })) });
  }

  if (req.method === 'POST') {
    const { name, kind, leader_email, seats, starts_at, expires_at, note, code } = req.body || {};
    const leader = String(leader_email || '').toLowerCase().trim();
    const k = kind === 'coop' ? 'coop' : 'class';
    const n = parseInt(seats, 10);
    if (!String(name || '').trim()) return res.status(400).json({ error: 'A name is required.' });
    if (!EMAIL.test(leader)) return res.status(400).json({ error: 'A valid leader email is required.' });
    if (!(n >= 1 && n <= 500)) return res.status(400).json({ error: 'Seats must be between 1 and 500.' });
    const wanted = String(code || '').toUpperCase().trim();
    if (wanted && !/^[A-Z0-9-]{4,40}$/.test(wanted)) return res.status(400).json({ error: 'Codes use letters, numbers and dashes, 4 to 40 long.' });
    const { data: clash } = await supabase.from('vah_promo_codes').select('id').eq('code', wanted || '-').maybeSingle();
    if (clash) return res.status(409).json({ error: 'That code is already a promo code.' });
    const { error } = await supabase.from('vah_groups').insert({
      code: wanted || newCode(k), name: String(name).trim(), kind: k, leader_email: leader, seats: n,
      starts_at: starts_at || new Date().toISOString(), expires_at: expires_at || null, note: note || null, is_active: true,
    });
    if (notReady(error)) return res.status(503).json({ error: 'Class codes need the database update applied first.' });
    if (error) return res.status(500).json({ error: error.code === '23505' ? 'That code is taken. Try another.' : error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { id, is_active, seats, expires_at, note } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID required.' });
    const updates = {};
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (seats !== undefined) updates.seats = parseInt(seats, 10);
    if (expires_at !== undefined) updates.expires_at = expires_at || null;
    if (note !== undefined) updates.note = note;
    const { error } = await supabase.from('vah_groups').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
