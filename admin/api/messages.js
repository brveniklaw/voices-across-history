// api/messages.js — GET all messages / PATCH update status+note
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from './_verify.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('vah_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ messages: data });
  }

  if (req.method === 'PATCH') {
    const { id, status, admin_note } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required.' });
    const updates = {};
    if (status) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;
    const { error } = await supabase.from('vah_messages').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
