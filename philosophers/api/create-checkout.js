// api/create-checkout.js — Vercel Serverless Function
// Creates a Stripe Checkout session for the $9.99/month subscription

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalizedEmail = email.toLowerCase().trim();
  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    // Only brand-new users get the free trial; returning users are charged right away.
    const { data: existing } = await supabase
      .from('vah_users')
      .select('id, access_type, trial_expires_at, subscription_end')
      .eq('email', normalizedEmail)
      .single();

    // One subscription covers every collection. If this email already has active access
    // (from any collection, a promo code, or a subscription), don't start a second checkout.
    if (existing && hasActiveAccess(existing)) {
      return res.status(200).json({
        access: {
          email: normalizedEmail,
          access_type: existing.access_type,
          trial_expires_at: existing.trial_expires_at || null,
          subscription_end: existing.subscription_end || null
        }
      });
    }

    const config = {
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: normalizedEmail,
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1
      }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: { app: 'philosophers' }
    };

    if (!existing) {
      config.subscription_data = { trial_period_days: 7 };
    }

    const session = await stripe.checkout.sessions.create(config);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Unable to create checkout session.' });
  }
}

function hasActiveAccess(u) {
  const now = new Date();
  if (u.access_type === 'permanent') return true;
  if (u.access_type === 'subscribed') return !u.subscription_end || new Date(u.subscription_end) > now;
  if (u.access_type === 'trial' || u.access_type === 'promo_trial') {
    return !!u.trial_expires_at && new Date(u.trial_expires_at) > now;
  }
  return false;
}
