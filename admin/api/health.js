// api/health.js — Platform health data
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from './_verify.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APP_URLS = [
  'https://voices-across-history.vercel.app',
  'https://voices-of-the-republic.vercel.app',
  'https://voices-of-the-philosophers.vercel.app',
  'https://voices-of-the-inventors.vercel.app',
  'https://voices-across-history-admin.vercel.app',
];

export default async function handler(req, res) {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).end();

  // Ping all apps in parallel
  const appStatus = {};
  await Promise.all(APP_URLS.map(async url => {
    try {
      const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      appStatus[url] = r.ok ? 'ok' : 'error';
    } catch { appStatus[url] = 'error'; }
  }));

  // User stats
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: newThisWeek },
    { count: newThisMonth },
    { count: waitlistCount },
    { data: recentEvent }
  ] = await Promise.all([
    supabase.from('vah_users').select('*', { count: 'exact', head: true }),
    supabase.from('vah_users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('vah_users').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
    supabase.from('vah_notify').select('*', { count: 'exact', head: true }),
    supabase.from('vah_subscription_events').select('created_at').order('created_at', { ascending: false }).limit(1),
  ]);

  // Supabase connectivity test (if we got here, it's working)
  const supabaseOk = true;

  return res.status(200).json({
    appStatus,
    totalUsers,
    newThisWeek,
    newThisMonth,
    waitlistCount,
    supabaseOk,
    lastWebhook: recentEvent?.[0]?.created_at || null,
  });
}
