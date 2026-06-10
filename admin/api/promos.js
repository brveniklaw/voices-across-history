// api/promos.js — CRUD for promo codes (GET / POST / PATCH / DELETE)
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from './_verify.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('vah_promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ promos: data });
  }

  if (req.method === 'POST') {
    const { code, type, max_uses, expires_at, note } = req.body;
    if (!code || !type) return res.status(400).json({ error: 'Code and type are required.' });

    const { error } = await supabase.from('vah_promo_codes').insert({
      code: code.toUpperCase().trim(),
      type,
      max_uses: max_uses ?? null,
      expires_at: expires_at || null,
      note: note || null,
      is_active: true,
      uses_count: 0,
      created_by: 'admin'
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { id, is_active, note } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required.' });
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (note !== undefined) updates.note = note;
    const { error } = await supabase.from('vah_promo_codes').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required.' });
    const { error } = await supabase.from('vah_promo_codes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
