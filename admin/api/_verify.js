// api/_verify.js — Shared token verification (imported by all admin API routes)
import crypto from 'crypto';

export function verifyToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const expected = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD)
    .update(data).digest('hex');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.admin === true && payload.exp > Date.now();
  } catch { return false; }
}
