// api/notify.js — Vercel Serverless Function
// Adds an email to the vah_notify waitlist in Supabase

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

  const { error } = await supabase
    .from('vah_notify')
    .upsert({ email: email.toLowerCase().trim() }, { onConflict: 'email' });

  if (error) {
    console.error('Supabase notify error:', error);
    return res.status(500).json({ error: 'Unable to save email. Please try again.' });
  }

  return res.status(200).json({ success: true });
}
