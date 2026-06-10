# Cremadillaprints — Backend

Node.js backend for Cremadillaprints. Handles order storage (SQLite),
PayPal payment processing, and confirmation emails via Resend.

---

## Stack

| Layer    | Tech                        |
|----------|-----------------------------|
| Server   | Express.js                  |
| Database | SQLite (via @libsql/client) |
| Payments | PayPal Orders API v2        |
| Email    | Resend                      |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create your .env file

```bash
cp .env.example .env
```

Then open `.env` and fill in your keys:

```
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox
RESEND_API_KEY=re_your_key
FROM_EMAIL=orders@cremadillaprints.com
ADMIN_EMAIL=you@cremadillaprints.com
PORT=3001
FRONTEND_URL=http://localhost:5500
```

### 3. Get your PayPal credentials

1. Go to https://developer.paypal.com/dashboard/
2. Log in and click **Apps & Credentials**
3. Click **Create App** → give it a name → select **Merchant**
4. Copy the **Client ID** and **Secret** into your `.env`
5. Use `PAYPAL_MODE=sandbox` for testing, `live` for real charges

Also update the PayPal JS SDK script tag in `cremadillaprints.html`:
```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID&...">
```
Replace `YOUR_PAYPAL_CLIENT_ID` with your actual Client ID.

### 4. Get your Resend API key

1. Go to https://resend.com and create an account
2. Add and verify your sending domain (e.g. cremadillaprints.com)
3. Go to **API Keys** → **Create API Key**
4. Paste it into `RESEND_API_KEY` in your `.env`
5. Set `FROM_EMAIL` to an address on your verified domain

### 5. Start the server

```bash
# Production
npm start

# Development (auto-restarts on file changes — Node 18+)
npm run dev
```

You should see:
```
✅  Database ready (orders.db)
🖨  Cremadillaprints backend running on http://localhost:3001
   PayPal mode: sandbox
```

### 6. Serve the frontend

Open `cremadillaprints.html` via a local server (not file://), e.g.:

```bash
# Python
python3 -m http.server 5500

# Node
npx serve . -p 5500

# VS Code
Use the Live Server extension
```

Then visit http://localhost:5500/cremadillaprints.html

---

## API Endpoints

### `POST /api/checkout/create`
Creates a pending order in the database and a PayPal order.

**Request body:**
```json
{
  "shipping": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "address": "123 Main St",
    "address2": "",
    "city": "Miami",
    "state": "FL",
    "zip": "33101"
  },
  "items": [
    { "id": 1, "qty": 2 },
    { "id": 5, "qty": 1 }
  ],
  "shippingMethod": "standard"
}
```

**Response:**
```json
{
  "orderNum": "CP-482910",
  "paypalOrderId": "3TW12345XY...",
  "totals": {
    "subtotal": 126.00,
    "shipping": 6.00,
    "tax": 8.82,
    "total": 140.82
  }
}
```

### `POST /api/checkout/capture`
Captures the PayPal payment, marks the order paid, and sends emails.

**Request body:**
```json
{
  "orderNum": "CP-482910",
  "paypalOrderId": "3TW12345XY..."
}
```

**Response:**
```json
{ "success": true, "orderNum": "CP-482910" }
```

### `GET /api/orders/:orderNum`
Fetches a single order (safe fields only, no PayPal internals).

### `GET /api/admin/orders`
Lists the 100 most recent orders.
⚠️ Add authentication before exposing this in production.

### `GET /health`
Health check. Returns `{ ok: true }`.

---

## Testing payments (sandbox)

1. Set `PAYPAL_MODE=sandbox` in `.env`
2. Go to https://developer.paypal.com/dashboard/accounts
3. Use one of the auto-created **Personal sandbox accounts** as the buyer
4. When the PayPal popup appears, log in with that sandbox account
5. Approve the payment — it will complete without any real charge

---

## Going live (production checklist)

- [ ] Set `PAYPAL_MODE=live` and use your live PayPal credentials
- [ ] Replace `YOUR_PAYPAL_CLIENT_ID` in the HTML script tag with your live Client ID
- [ ] Verify your sending domain in Resend
- [ ] Set `FRONTEND_URL` to your real domain for CORS
- [ ] Add authentication to `GET /api/admin/orders`
- [ ] Run behind HTTPS (use a reverse proxy like nginx or deploy to Railway/Render)
- [ ] Back up `orders.db` regularly (or swap to Postgres for scale)

---

## File structure

```
cremadillaprints-backend/
├── server.js        ← Express app, all routes
├── db.js            ← SQLite setup and query helpers
├── paypal.js        ← PayPal Orders API (create + capture)
├── email.js         ← Resend emails (confirmation + admin)
├── .env.example     ← Copy to .env and fill in your keys
├── package.json
└── orders.db        ← Created automatically on first run
```
