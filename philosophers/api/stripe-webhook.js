// api/stripe-webhook.js — Vercel Serverless Function
// Handles Stripe subscription lifecycle events and keeps Supabase in sync

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel requires raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const obj = event.data.object;

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const email = obj.customer_email?.toLowerCase().trim();
        const customerId = obj.customer;
        const subscriptionId = obj.subscription;
        if (!email) break;
        await supabase.from('vah_users').upsert({
          email,
          access_type: 'subscribed',
          subscribed_at: new Date().toISOString(),
          subscription_end: null,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'email' });
        await logEvent(supabase, email, 'created', event.id, null);
        break;
      }

      case 'customer.subscription.updated': {
        const customerId = obj.customer;
        const status = obj.status;
        const periodEnd = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : null;
        const updates = {
          stripe_subscription_id: obj.id,
          last_seen_at: new Date().toISOString()
        };
        if (status === 'active' || status === 'trialing') {
          updates.access_type = 'subscribed';
          updates.subscription_end = null;
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          updates.subscription_end = periodEnd;
        }
        await supabase.from('vah_users').update(updates)
          .eq('stripe_customer_id', customerId);
        await logEventByCustomer(supabase, customerId, 'renewed', event.id, null);
        break;
      }

      case 'customer.subscription.deleted': {
        const customerId = obj.customer;
        const periodEnd = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : new Date().toISOString();
        await supabase.from('vah_users').update({
          subscription_end: periodEnd,
          last_seen_at: new Date().toISOString()
        }).eq('stripe_customer_id', customerId);
        await logEventByCustomer(supabase, customerId, 'cancelled', event.id, null);
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = obj.customer;
        const amountDue = obj.amount_due;
        await logEventByCustomer(supabase, customerId, 'failed', event.id, amountDue);
        break;
      }
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    // Still return 200 so Stripe doesn't retry
  }

  return res.status(200).json({ received: true });
}

async function logEvent(supabase, email, eventType, stripeEventId, amountCents) {
  const { data: user } = await supabase
    .from('vah_users').select('id').eq('email', email).single();
  if (!user) return;
  await supabase.from('vah_subscription_events').insert({
    user_id: user.id, event_type: eventType,
    stripe_event_id: stripeEventId, amount_cents: amountCents
  });
}

async function logEventByCustomer(supabase, customerId, eventType, stripeEventId, amountCents) {
  const { data: user } = await supabase
    .from('vah_users').select('id').eq('stripe_customer_id', customerId).single();
  if (!user) return;
  await supabase.from('vah_subscription_events').insert({
    user_id: user.id, event_type: eventType,
    stripe_event_id: stripeEventId, amount_cents: amountCents
  });
}
