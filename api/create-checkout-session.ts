import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
  apiVersion: '2026-04-22.dahlia',
});

const PLANS: Record<string, { name: string; amount: number; description: string }> = {
  pro: {
    name: 'PhysioCore Pro',
    amount: 1200,
    description: 'Full AI physiotherapy platform — pose tracking, nutrition, clinical tools',
  },
  yoga: {
    name: 'PhysioCore Yoga',
    amount: 1900,
    description: 'Yoga-focused plan with Sanskrit cues, hold timers, and AI trainer',
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan } = req.body as { plan?: string };

  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "yoga".' });
  }

  const origin = req.headers.origin ?? 'https://app-dteam1-mmcv.vercel.app';
  const config = PLANS[plan];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' },
            product_data: {
              name: config.name,
              description: config.description,
            },
            unit_amount: config.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/pricing?success=true&plan=${plan}`,
      cancel_url: `${origin}/pricing?cancelled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error';
    return res.status(500).json({ error: message });
  }
}
