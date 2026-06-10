// api/apply-promo.js — Vercel Serverless Function
// Validates a promo code and grants access to the user

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { code, email } = req.body;
  if (!code || !email) return res.status(400).json({ error: 'Missing code or email' });

  const { data: promo } = await supabase
    .from('vah_promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (!promo) return res.status(404).json({ error: 'Invalid or expired code' });

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This code has expired' });
  }

  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return res.status(410).json({ error: 'This code has reached its usage limit' });
  }

  const accessType = promo.type === 'permanent' ? 'permanent' : 'promo_trial';
  const expiresAt = promo.type === 'permanent'
    ? null
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('vah_users').upsert({
    email: email.toLowerCase().trim(),
    access_type: accessType,
    trial_expires_at: expiresAt,
    promo_code_used: code.toUpperCase().trim(),
    last_seen_at: new Date().toISOString()
  }, { onConflict: 'email' });

  await supabase.from('vah_promo_codes')
    .update({ uses_count: promo.uses_count + 1 })
    .eq('id', promo.id);

  return res.status(200).json({ success: true, access_type: accessType, expires_at: expiresAt });
}
