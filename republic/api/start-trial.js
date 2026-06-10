// api/start-trial.js — Vercel Serverless Function
// Creates a 7-day trial user record in Supabase (or returns existing user's access state)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const { data: existing } = await supabase
    .from('vah_users')
    .select('*')
    .eq('email', normalizedEmail)
    .single();

  if (existing) {
    // Return their current access state so the client can sync
    return res.status(200).json({
      success: true,
      access_type: existing.access_type,
      expires_at: existing.trial_expires_at,
      subscription_end: existing.subscription_end
    });
  }

  // New user — start 7-day trial
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('vah_users').insert({
    email: normalizedEmail,
    access_type: 'trial',
    trial_started_at: new Date().toISOString(),
    trial_expires_at: expiresAt,
    last_seen_at: new Date().toISOString()
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Unable to start trial. Please try again.' });
  }

  return res.status(200).json({ success: true, access_type: 'trial', expires_at: expiresAt });
}
