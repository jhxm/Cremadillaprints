// paypal.js — PayPal Orders API v2 (no SDK needed, plain fetch)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ── get an OAuth token ────────────────────────────────────────────────────
async function getAccessToken() {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ── create a PayPal order ─────────────────────────────────────────────────
async function createPayPalOrder({ orderNum, totalCents, items }) {
  const token = await getAccessToken();

  const itemsPayload = items.map(i => ({
  name: i.title || i.name || `Print #${i.id}`,
  quantity: String(i.qty),
  unit_amount: {
    currency_code: 'USD',
    value: (i.salePrice || i.price).toFixed(2),
  },
  category: 'PHYSICAL_GOODS',
}));

  const totalDollars = (totalCents / 100).toFixed(2);

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: orderNum,
        description: 'Cremadillaprints order',
        amount: {
          currency_code: 'USD',
          value: totalDollars,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              // sum of (price * qty) for all items
              value: (items.reduce((s, i) => s + (i.salePrice || i.price) * i.qty, 0)).toFixed(2),
            },
          },
        },
        items: itemsPayload,
      },
    ],
    application_context: {
      brand_name: 'Cremadillaprints',
      shipping_preference: 'NO_SHIPPING', // we collect shipping ourselves
      user_action: 'PAY_NOW',
    },
  };

  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': orderNum, // idempotency key
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${text}`);
  }

  return await res.json(); // { id, status, links, ... }
}

// ── capture a PayPal order (charge the card) ─────────────────────────────
async function capturePayPalOrder(paypalOrderId) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal capture failed: ${text}`);
  }

  return await res.json(); // { id, status: 'COMPLETED', ... }
}

module.exports = { createPayPalOrder, capturePayPalOrder };
