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
      .select('id')
      .eq('email', normalizedEmail)
      .single();

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
      metadata: { app: 'republic' }
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
