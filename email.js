// email.js — send confirmation and admin notification via Resend
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── currency formatter ────────────────────────────────────────────────────
const usd = cents => `$${(cents / 100).toFixed(2)}`;

// ── customer confirmation email ───────────────────────────────────────────
async function sendConfirmationEmail(order) {
  const itemRows = order.items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2e271f;color:#f5eed8;font-family:Georgia,serif;">${i.title}</td>
      <td style="padding:10px 0;border-bottom:1px solid #2e271f;color:#7a6e5e;text-align:center;">×${i.qty}</td>
      <td style="padding:10px 0;border-bottom:1px solid #2e271f;color:#f5eed8;text-align:right;font-family:monospace;">$${(i.salePrice || i.price) * i.qty}</td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#1a1410;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1410;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#2e271f;border-radius:4px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#b84c1e;padding:28px 36px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#fdfaf2;letter-spacing:0.04em;text-transform:uppercase;">
              Cremadillaprints
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:rgba(253,250,242,0.7);letter-spacing:0.2em;text-transform:uppercase;">
              Handcrafted Art Prints
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;color:#f5eed8;font-weight:normal;">
              Order confirmed! 🎉
            </h1>
            <p style="margin:0 0 24px;font-size:13px;color:#7a6e5e;letter-spacing:0.15em;text-transform:uppercase;font-family:monospace;">
              ${order.order_num}
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:rgba(245,238,216,0.7);line-height:1.7;">
              Hi ${order.first_name}, thank you for your order. We'll start printing as soon as possible — 
              expect your prints to ship within 3–5 business days.
            </p>

            <!-- Items -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <thead>
                <tr>
                  <th style="padding-bottom:10px;border-bottom:1px solid #b84c1e;color:#b84c1e;font-family:monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-align:left;font-weight:normal;">Print</th>
                  <th style="padding-bottom:10px;border-bottom:1px solid #b84c1e;color:#b84c1e;font-family:monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-align:center;font-weight:normal;">Qty</th>
                  <th style="padding-bottom:10px;border-bottom:1px solid #b84c1e;color:#b84c1e;font-family:monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;text-align:right;font-weight:normal;">Price</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <!-- Totals -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7a6e5e;font-family:monospace;">Subtotal</td>
                <td style="padding:6px 0;font-size:13px;color:#7a6e5e;font-family:monospace;text-align:right;">${usd(order.subtotal_cents)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7a6e5e;font-family:monospace;">Shipping (${order.shipping_method})</td>
                <td style="padding:6px 0;font-size:13px;color:#7a6e5e;font-family:monospace;text-align:right;">${usd(order.shipping_cents)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7a6e5e;font-family:monospace;">Tax</td>
                <td style="padding:6px 0;font-size:13px;color:#7a6e5e;font-family:monospace;text-align:right;">${usd(order.tax_cents)}</td>
              </tr>
              <tr>
                <td colspan="2" style="border-top:1px solid rgba(245,238,216,0.1);padding-top:1px;"></td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;font-size:17px;color:#f5eed8;font-family:Georgia,serif;">Total charged</td>
                <td style="padding:12px 0 0;font-size:20px;color:#f5eed8;font-family:Georgia,serif;text-align:right;">${usd(order.total_cents)}</td>
              </tr>
            </table>

            <!-- Shipping address -->
            <div style="background:#1a1410;border-radius:3px;padding:18px 20px;margin-bottom:28px;">
              <p style="margin:0 0 8px;font-family:monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#b84c1e;">Ships to</p>
              <p style="margin:0;font-size:14px;color:rgba(245,238,216,0.75);line-height:1.7;">
                ${order.first_name} ${order.last_name}<br/>
                ${order.address}${order.address2 ? ', ' + order.address2 : ''}<br/>
                ${order.city}, ${order.state} ${order.zip}
              </p>
            </div>

            <p style="margin:0;font-size:13px;color:rgba(245,238,216,0.4);line-height:1.7;">
              Questions? Reply to this email or contact us at 
              <a href="mailto:${process.env.FROM_EMAIL}" style="color:#b84c1e;">${process.env.FROM_EMAIL}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(245,238,216,0.07);">
            <p style="margin:0;font-size:11px;color:#7a6e5e;font-family:monospace;letter-spacing:0.1em;">
              © 2026 Cremadillaprints · All prints handmade with care
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await resend.emails.send({
    from: `Cremadillaprints <${process.env.FROM_EMAIL}>`,
    to: order.email,
    subject: `Your order is confirmed — ${order.order_num}`,
    html,
  });

  return result;
}

// ── admin notification ────────────────────────────────────────────────────
async function sendAdminNotification(order) {
  const itemList = order.items.map(i => `• ${i.title} × ${i.qty} — $${(i.salePrice || i.price) * i.qty}`).join('\n');

  await resend.emails.send({
    from: `Cremadillaprints Orders <${process.env.FROM_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New order ${order.order_num} — ${usd(order.total_cents)}`,
    text: `
New order received!

Order: ${order.order_num}
Customer: ${order.first_name} ${order.last_name} <${order.email}>
Total: ${usd(order.total_cents)}

Items:
${itemList}

Ship to:
${order.first_name} ${order.last_name}
${order.address}${order.address2 ? ', ' + order.address2 : ''}
${order.city}, ${order.state} ${order.zip}
Method: ${order.shipping_method}
    `.trim(),
  });
}

module.exports = { sendConfirmationEmail, sendAdminNotification };
