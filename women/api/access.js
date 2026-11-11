// GET /api/access — membership state for the signed-in visitor.
import { getUser, accessFor } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  return res.status(200).json({ access: await accessFor(user) });
}
