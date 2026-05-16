// netlify/functions/stripe.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const ALLOWED_PRICE_IDS = new Set([
  'price_1TINstE6hsQz4KGlVyRloVaR',
  'price_1TINsuE6hsQz4KGlrjQHk4yO',
  'price_1TINsuE6hsQz4KGlL8sSNlGE',
  'price_1TINsvE6hsQz4KGl2q96gPHV',
  'price_1TINsvE6hsQz4KGl3jAfgtvT',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const origin = event.headers.origin || event.headers.referer || 'https://fuelcert.com';
  const baseUrl = origin.replace(/\/$/, '').split('/app')[0].split('/wv')[0];

  try {
    if (body.action === 'create_checkout') {
      const { price_id } = body;
      if (!price_id || !ALLOWED_PRICE_IDS.has(price_id)) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid price' }) };
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: price_id, quantity: 1 }],
        success_url: `${baseUrl}/app?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/app?cancelled=true`,
        allow_promotion_codes: true,
      });
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ url: session.url }) };
    }

    if (body.action === 'verify_session') {
      const { session_id } = body;
      if (!session_id || typeof session_id !== 'string') {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ valid: false }) };
      }
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const valid = session.payment_status === 'paid' || session.status === 'complete';
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ valid }) };
    }

    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
