// netlify/functions/stripe.js
// Stripe Checkout handler for FuelCert Solutions
// Handles: create_checkout and verify_session actions

exports.handler = async function(event, context) {

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('Missing STRIPE_SECRET_KEY env var');
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Server configuration error.' })
    };
  }

  // Lazy-load Stripe
  const Stripe = require('stripe');
  const stripe = Stripe(stripeKey);

  try {
    const body = JSON.parse(event.body);
    const { action } = body;

    // ── CREATE CHECKOUT SESSION ──────────────────────────────
    if (action === 'create_checkout') {
      const { price_id } = body;
      if (!price_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Missing price_id.' })
        };
      }

      // Determine success/cancel URLs from the request origin
      const origin = event.headers.origin || event.headers.referer || 'https://fuelcertsolutions.net';
      const baseUrl = origin.replace(/\/$/, '');

      // Figure out which app is calling (md or wv) based on referer
      const referer = event.headers.referer || '';
      const appPath = referer.includes('/wv') ? '/wv' : '/app';
      const successUrl = `${baseUrl}${appPath}?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl  = `${baseUrl}${appPath}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: price_id, quantity: 1 }],
        success_url: successUrl,
        cancel_url:  cancelUrl,
        allow_promotion_codes: true,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ url: session.url })
      };
    }

    // ── VERIFY SESSION ───────────────────────────────────────
    if (action === 'verify_session') {
      const { session_id } = body;
      if (!session_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ valid: false, error: 'Missing session_id.' })
        };
      }

      const session = await stripe.checkout.sessions.retrieve(session_id);
      const valid = session.payment_status === 'paid' || session.status === 'complete';

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ valid })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Unknown action.' })
    };

  } catch (err) {
    console.error('Stripe function error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Server error. Please try again.' })
    };
  }
};
