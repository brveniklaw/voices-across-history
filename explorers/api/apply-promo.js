// POST /api/apply-promo — redeems a Voices promo code, or joins a class or co-op code, for the signed-in visitor.
import { admin, getUser, accessFor, readJson } from './_lib.js';

const GROUP_ERRORS = {
  full: 'This class code has no seats left. Ask your teacher or co-op leader for help.',
  expired: 'This class code has ended.',
  not_started: 'This class code isn’t open yet.',
};

async function joinGroup(code, user, email) {
  const { data, error } = await admin.rpc('vah_join_group', { p_code: code, p_email: email, p_user: user.id });
  if (error || !data) return null; // group tables not set up yet, or no such code
  if (data.error === 'invalid') return null;
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first.' });
  const code = String(readJson(req).code || '').toUpperCase().trim();
  if (!code) return res.status(400).json({ error: 'Please enter a promo code.' });

  const { data: promo } = await admin.from('vah_promo_codes').select('*').eq('code', code).eq('is_active', true).maybeSingle();
  if (!promo) {
    const email = user.email.toLowerCase().trim();
    const joined = await joinGroup(code, user, email);
    if (!joined) return res.status(404).json({ error: 'That code isn’t valid.' });
    if (joined.error) return res.status(410).json({ error: GROUP_ERRORS[joined.error] || 'That code can’t be used right now.' });
    return res.status(200).json({ access: await accessFor(user), joined: { name: joined.name, kind: joined.kind } });
  }
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
