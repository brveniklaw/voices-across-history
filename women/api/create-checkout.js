// POST /api/create-checkout — starts the $9.99/month membership (7-day free trial for new members).
// One membership covers every collection; if the visitor already has access, no checkout is created.
import Stripe from 'stripe';
import { getUser, accessFor, returnUrl, readJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first.' });
  const { returnPath, collection } = readJson(req);

  const access = await accessFor(user);
  if (access.active) return res.status(200).json({ access });

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!process.env.STRIPE_SECRET_KEY || !priceId) return res.status(503).json({ error: 'Membership sign-up is not available right now.' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const back = returnUrl(req, returnPath);
    const config = {
      mode: 'subscription',
      customer_email: access.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${back}?checkout=success`,
      cancel_url: `${back}?checkout=cancelled`,
      metadata: { app: String(collection || 'voices').slice(0, 40), auth_user_id: user.id },
    };
    if (access.is_new) config.subscription_data = { trial_period_days: 7 };
    const session = await stripe.checkout.sessions.create(config);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Unable to start checkout. Please try again.' });
  }
}
