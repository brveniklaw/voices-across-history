// Shared server helpers for every Voices Across History collection.
// Identity comes from the visitor's IntexiaU account (Supabase Auth); access comes from vah_users,
// so one membership covers every collection. Copied into each app by scripts/sync-shared.sh.
import { createClient } from '@supabase/supabase-js';

export const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DAILY_MESSAGE_LIMIT = Number(process.env.VAH_DAILY_LIMIT || 100);
export const HUB_ORIGIN = 'https://voicesacrosshistory.intexiau.com';

// Returns the signed-in Supabase user for a request, or null.
export async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user;
}

export function hasActiveAccess(u) {
  if (!u) return false;
  const now = new Date();
  if (u.access_type === 'permanent') return true;
  if (u.access_type === 'subscribed') return !u.subscription_end || new Date(u.subscription_end) > now;
  if (u.access_type === 'trial' || u.access_type === 'promo_trial') {
    return !!u.trial_expires_at && new Date(u.trial_expires_at) > now;
  }
  return false;
}

// Membership state for a signed-in user. IntexiaU site admins always have access.
export async function accessFor(user) {
  const email = user.email.toLowerCase().trim();
  const [{ data: row }, { data: staff }] = await Promise.all([
    admin.from('vah_users').select('email, access_type, trial_expires_at, subscription_end, auth_user_id').eq('email', email).maybeSingle(),
    admin.from('site_admins').select('user_id').eq('user_id', user.id).is('revoked_at', null).maybeSingle(),
  ]);
  if (row && !row.auth_user_id) {
    await admin.from('vah_users').update({ auth_user_id: user.id, last_seen_at: new Date().toISOString() }).eq('email', email);
  }
  if (staff) return { email, access_type: 'permanent', staff: true, active: true };
  if (!row) return { email, access_type: 'none', active: false, is_new: true };
  return {
    email,
    access_type: row.access_type,
    trial_expires_at: row.trial_expires_at,
    subscription_end: row.subscription_end,
    active: hasActiveAccess(row),
    is_new: false,
  };
}

// Where Stripe should send the visitor back to: the same collection, on an approved origin.
export function returnUrl(req, returnPath) {
  const origin = String(req.headers.origin || '');
  const ok = origin === HUB_ORIGIN || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
  const path = typeof returnPath === 'string' && /^\/[a-z-]+\/$/.test(returnPath) ? returnPath : '/';
  return (ok ? origin : HUB_ORIGIN) + path;
}

export function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
