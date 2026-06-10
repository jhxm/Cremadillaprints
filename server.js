// server.js — Cremadillaprints backend
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const { initDb, createOrder, setPaypalOrderId, markOrderPaid, getOrder, listOrders } = require('./db');
const { createPayPalOrder, capturePayPalOrder } = require('./paypal');
const { sendConfirmationEmail, sendAdminNotification } = require('./email');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── middleware ────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── request logger ────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.path}`);
  next();
});

// ── helpers ───────────────────────────────────────────────────────────────
function generateOrderNum() {
  return 'CP-' + Math.floor(100000 + Math.random() * 900000);
}

function validateCheckoutBody(body) {
  const { shipping, items } = body;
  if (!shipping || !items || !items.length) return 'Missing shipping or items.';
  const req = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zip'];
  for (const f of req) {
    if (!shipping[f] || !String(shipping[f]).trim()) return `Missing shipping field: ${f}`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── STEP 1: Create a pending order + PayPal order ─────────────────────────
// Called when the customer hits "Place Order" on the payment page.
// Returns a PayPal order ID the frontend passes to the PayPal JS SDK.
app.post('/api/checkout/create', async (req, res) => {
  try {
    const err = validateCheckoutBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const { shipping, items, shippingMethod = 'standard' } = req.body;

    // ── Calculate totals (server-side, never trust client totals) ──────────
    const SHIPPING_RATES = { standard: 600, express: 1400 }; // cents
    const TAX_RATE = 0.07;

    // Validate each item against our known product list
    const VALID_PRICES = {
      1: 48, 2: 72, 3: 38, 4: 55, 5: 30, // 5 is sale price
      6: 85, 7: 32, 8: 65, 9: 95,
    };
    for (const item of items) {
      if (!VALID_PRICES[item.id]) return res.status(400).json({ error: `Unknown product id ${item.id}` });
      if (item.qty < 1 || item.qty > 20) return res.status(400).json({ error: 'Invalid quantity' });
    }

    const subtotalCents = items.reduce((s, i) => s + VALID_PRICES[i.id] * i.qty * 100, 0);
    const shippingCents = SHIPPING_RATES[shippingMethod] || SHIPPING_RATES.standard;
    const taxCents      = Math.round(subtotalCents * TAX_RATE);
    const totalCents    = subtotalCents + shippingCents + taxCents;

    const orderNum = generateOrderNum();

    // ── Save pending order to DB ───────────────────────────────────────────
    await createOrder({
      orderNum,
      email:          shipping.email,
      firstName:      shipping.firstName,
      lastName:       shipping.lastName,
      address:        shipping.address,
      address2:       shipping.address2 || '',
      city:           shipping.city,
      state:          shipping.state,
      zip:            shipping.zip,
      shippingMethod,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      items,
    });

    // ── Create PayPal order ────────────────────────────────────────────────
    const paypalOrder = await createPayPalOrder({
      orderNum,
      totalCents,
      items: items.map(i => ({ ...i, price: VALID_PRICES[i.id] })),
    });

    await setPaypalOrderId(orderNum, paypalOrder.id);

    res.json({
      orderNum,
      paypalOrderId: paypalOrder.id,
      totals: {
        subtotal: subtotalCents / 100,
        shipping: shippingCents / 100,
        tax:      taxCents / 100,
        total:    totalCents / 100,
      },
    });

  } catch (e) {
    console.error('create error:', e);
    res.status(500).json({ error: 'Failed to create order. Please try again.' });
  }
});

// ── STEP 2: Capture payment after PayPal approval ─────────────────────────
// Called after the customer approves the PayPal popup.
// Captures the payment, marks order paid, sends emails.
app.post('/api/checkout/capture', async (req, res) => {
  try {
    const { orderNum, paypalOrderId } = req.body;
    if (!orderNum || !paypalOrderId) {
      return res.status(400).json({ error: 'Missing orderNum or paypalOrderId' });
    }

    const order = await getOrder(orderNum);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') {
      // Idempotent — already processed
      return res.json({ success: true, orderNum, alreadyPaid: true });
    }

    // ── Charge the card via PayPal ─────────────────────────────────────────
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== 'COMPLETED') {
      return res.status(402).json({ error: 'Payment not completed', status: capture.status });
    }

    // ── Mark order paid ────────────────────────────────────────────────────
    await markOrderPaid(orderNum);

    // ── Send emails (non-blocking — don't fail the order if email fails) ───
    const paidOrder = await getOrder(orderNum);
    sendConfirmationEmail(paidOrder).catch(e => console.error('Confirmation email failed:', e));
    sendAdminNotification(paidOrder).catch(e => console.error('Admin email failed:', e));

    res.json({ success: true, orderNum });

  } catch (e) {
    console.error('capture error:', e);
    res.status(500).json({ error: 'Payment capture failed. Please contact support.' });
  }
});

// ── Order lookup (for confirmation page) ──────────────────────────────────
app.get('/api/orders/:orderNum', async (req, res) => {
  try {
    const order = await getOrder(req.params.orderNum);
    if (!order) return res.status(404).json({ error: 'Not found' });
    // Strip sensitive data before returning to frontend
    const { paypal_order_id, ...safe } = order;
    res.json(safe);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── Admin: list recent orders ──────────────────────────────────────────────
// In production, add authentication middleware before this route!
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await listOrders(100);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────
(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`\n🖨  Cremadillaprints backend running on http://localhost:${PORT}`);
    console.log(`   PayPal mode: ${process.env.PAYPAL_MODE || 'sandbox'}`);
    console.log(`   Frontend:    ${process.env.FRONTEND_URL || '(any origin)'}\n`);
  });
})();
