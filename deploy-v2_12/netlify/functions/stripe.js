// netlify/functions/stripe.js
// Handles Stripe checkout session creation and payment verification

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const VALID_PRICES = {
  'price_1TINstE6hsQz4KGlVyRloVaR': true,  // Individual $29.99/mo
  'price_1TINsuE6hsQz4KGlrjQHk4yO': true,  // Individual Annual $134.99/yr
  'price_1TINsuE6hsQz4KGlL8sSNlGE': true,  // Team $124.99/mo
  'price_1TINsvE6hsQz4KGl2q96gPHV': true,  // Team Pro $234.99/mo
  'price_1TINsvE6hsQz4KGl3jAfgtvT': true,  // Enterprise $398.99/mo
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { action, session_id, price_id } = JSON.parse(event.body || '{}');

  // ── CREATE CHECKOUT SESSION ──────────────────────────────────────────────
  if (action === 'create_checkout') {
    // Validate price ID — never trust client input
    const priceToUse = VALID_PRICES[price_id] ? price_id : 'price_1TINstE6hsQz4KGlVyRloVaR';

    try {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'mode': 'subscription',
          'line_items[0][price]': priceToUse,
          'line_items[0][quantity]': '1',
          'success_url': 'https://fuelcertsolutions.net/app?session_id={CHECKOUT_SESSION_ID}',
          'cancel_url': 'https://fuelcertsolutions.net/app?cancelled=true',
          'allow_promotion_codes': 'true'
        }).toString()
      });

      const session = await response.json();

      if (session.error) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: session.error.message }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── VERIFY PAYMENT ───────────────────────────────────────────────────────
  if (action === 'verify_session') {
    if (!session_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No session_id provided' }) };
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` }
      });

      const session = await response.json();

      if (session.error) {
        return { statusCode: 400, headers, body: JSON.stringify({ valid: false }) };
      }

      const valid = session.payment_status === 'paid' || session.status === 'complete';
      return { statusCode: 200, headers, body: JSON.stringify({ valid, customer: session.customer }) };

    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};
