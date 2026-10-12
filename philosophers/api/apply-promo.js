// POST /api/apply-promo — redeems a Voices promo code for the signed-in visitor.
import { admin, getUser, accessFor, readJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first.' });
  const code = String(readJson(req).code || '').toUpperCase().trim();
  if (!code) return res.status(400).json({ error: 'Please enter a promo code.' });

  const { data: promo } = await admin.from('vah_promo_codes').select('*').eq('code', code).eq('is_active', true).maybeSingle();
  if (!promo) return res.status(404).json({ error: 'That code isn’t valid.' });
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.status(410).json({ error: 'This code has expired.' });
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) return res.status(410).json({ error: 'This code has reached its usage limit.' });

  const current = await accessFor(user);
  if (current.access_type === 'permanent' || current.access_type === 'subscribed') {
    if (current.active) return res.status(200).json({ access: current, note: 'You already have full access.' });
  }

  const email = current.email;
  const permanent = promo.type === 'permanent';
  const expiresAt = permanent ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from('vah_users').upsert({
    email,
    auth_user_id: user.id,
    access_type: permanent ? 'permanent' : 'promo_trial',
    trial_expires_at: expiresAt,
    promo_code_used: code,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'email' });
  if (error) return res.status(500).json({ error: 'Unable to apply the code. Please try again.' });
  await admin.from('vah_promo_codes').update({ uses_count: (promo.uses_count || 0) + 1 }).eq('id', promo.id);
  return res.status(200).json({ access: await accessFor(user) });
}
