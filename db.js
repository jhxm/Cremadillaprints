// db.js — database initialisation and query helpers
const { createClient } = require('@libsql/client');
const path = require('path');

const db = createClient({
  url: 'file:' + path.join(__dirname, 'orders.db'),
});

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_num   TEXT    NOT NULL UNIQUE,
      status      TEXT    NOT NULL DEFAULT 'pending',
      paypal_order_id TEXT,

      -- customer
      email       TEXT    NOT NULL,
      first_name  TEXT    NOT NULL,
      last_name   TEXT    NOT NULL,

      -- shipping address
      address     TEXT    NOT NULL,
      address2    TEXT,
      city        TEXT    NOT NULL,
      state       TEXT    NOT NULL,
      zip         TEXT    NOT NULL,
      shipping_method TEXT NOT NULL DEFAULT 'standard',

      -- financials (stored in cents to avoid float issues)
      subtotal_cents  INTEGER NOT NULL,
      shipping_cents  INTEGER NOT NULL,
      tax_cents       INTEGER NOT NULL,
      total_cents     INTEGER NOT NULL,

      -- items as JSON blob
      items_json  TEXT    NOT NULL,

      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log('✅  Database ready (orders.db)');
}

// ── helpers ────────────────────────────────────────────────────────────────

async function createOrder(data) {
  const result = await db.execute({
    sql: `INSERT INTO orders
            (order_num, status, email, first_name, last_name,
             address, address2, city, state, zip, shipping_method,
             subtotal_cents, shipping_cents, tax_cents, total_cents, items_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      data.orderNum,
      'pending',
      data.email,
      data.firstName,
      data.lastName,
      data.address,
      data.address2 || '',
      data.city,
      data.state,
      data.zip,
      data.shippingMethod,
      data.subtotalCents,
      data.shippingCents,
      data.taxCents,
      data.totalCents,
      JSON.stringify(data.items),
    ],
  });
  return result.lastInsertRowid;
}

async function setPaypalOrderId(orderNum, paypalOrderId) {
  await db.execute({
    sql: `UPDATE orders SET paypal_order_id = ?, updated_at = datetime('now') WHERE order_num = ?`,
    args: [paypalOrderId, orderNum],
  });
}

async function markOrderPaid(orderNum) {
  await db.execute({
    sql: `UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE order_num = ?`,
    args: [orderNum],
  });
}

async function getOrder(orderNum) {
  const result = await db.execute({
    sql: `SELECT * FROM orders WHERE order_num = ?`,
    args: [orderNum],
  });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { ...row, items: JSON.parse(row.items_json) };
}

async function listOrders(limit = 50) {
  const result = await db.execute({
    sql: `SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(r => ({ ...r, items: JSON.parse(r.items_json) }));
}

module.exports = { initDb, createOrder, setPaypalOrderId, markOrderPaid, getOrder, listOrders };
