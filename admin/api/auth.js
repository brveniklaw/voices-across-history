// api/auth.js — Admin login
// ADMIN_PASSWORD env var must be a bcrypt hash of the admin password.
// Generate it with: node -e "const b=require('bcryptjs');console.log(b.hashSync('yourpassword',12))"

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD)
    .update(data).digest('hex');
  return `${data}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required.' });

  const hash = process.env.ADMIN_PASSWORD;
  if (!hash) return res.status(500).json({ error: 'Admin not configured.' });

  const valid = await bcrypt.compare(password, hash);
  if (!valid) return res.status(401).json({ error: 'Invalid password.' });

  const token = signToken({ admin: true, exp: Date.now() + 8 * 60 * 60 * 1000 });
  return res.status(200).json({ token });
}
