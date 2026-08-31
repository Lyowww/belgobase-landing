/** Customer-facing brand contact — used only in confirmation emails. */
const CUSTOMER_EMAIL_SITE_URL = "https://belgobase.com";
const CUSTOMER_EMAIL_SUPPORT = "legal@belgobase.be";
const CUSTOMER_EMAIL_PHONE = "+32 488 13 96 64";

export type DemoRequestEmailFields = {
  name: string;
  email: string;
  company: string;
  phone: string | null;
  requestType: "sample" | "custom";
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requestLabel(requestType: DemoRequestEmailFields["requestType"]): string {
  return requestType === "custom" ? "Contact request" : "Demo request";
}

/** Internal notification with all submitted fields. */
export function buildAdminNotificationHtml(fields: DemoRequestEmailFields): string {
  const name = escapeHtml(fields.name);
  const email = escapeHtml(fields.email);
  const company = escapeHtml(fields.company);
  const phone = fields.phone ? escapeHtml(fields.phone) : null;
  const heading =
    fields.requestType === "custom" ? "New Contact Request" : "New Demo Request";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #1e3a5f;">${heading}</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 120px;">Name</td>
          <td style="padding: 8px 0; font-weight: 600;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Email</td>
          <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #0a66c2;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Company</td>
          <td style="padding: 8px 0; font-weight: 600;">${company}</td>
        </tr>
        ${
          phone
            ? `<tr>
          <td style="padding: 8px 0; color: #64748b;">Phone</td>
          <td style="padding: 8px 0;">${phone}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Data usage</td>
          <td style="padding: 8px 0;">Confirmed</td>
        </tr>
      </table>
    </div>
  `.trim();
}

/**
 * Customer-facing confirmation — branded, table-based for email clients.
 */
export function buildCustomerConfirmationHtml(
  fields: DemoRequestEmailFields,
): string {
  const name = escapeHtml(fields.name);
  const company = escapeHtml(fields.company);
  const label = requestLabel(fields.requestType);
  const year = new Date().getFullYear();
  const supportEmail = escapeHtml(CUSTOMER_EMAIL_SUPPORT);
  const supportPhone = escapeHtml(CUSTOMER_EMAIL_PHONE);
  const homeUrl = escapeHtml(CUSTOMER_EMAIL_SITE_URL);

  const isDemo = fields.requestType === "sample";
  const title = isDemo
    ? "We've received your demo request"
    : "We've received your message";
  const intro = isDemo
    ? `Thanks for your interest in BelgoBase, ${name}. Your demo request for <strong style="color:#111827;">${company}</strong> is in our inbox — our team will reach out shortly to schedule a walkthrough.`
    : `Thanks for contacting BelgoBase, ${name}. We've received your message from <strong style="color:#111827;">${company}</strong> and will get back to you soon.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #0a66c2 100%); padding: 32px 36px;">
              <p style="margin:0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.75);">
                BelgoBase
              </p>
              <h1 style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:24px; line-height:1.3; font-weight:700; color:#ffffff;">
                ${escapeHtml(title)}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 36px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; font-size:16px; line-height:1.65;">
              <p style="margin:0 0 20px;">${intro}</p>
              <p style="margin:0 0 8px; font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#64748b;">
                Your ${escapeHtml(label)}
              </p>
            </td>
          </tr>

          <!-- Summary card -->
          <tr>
            <td style="padding: 0 36px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
                <tr>
                  <td style="padding: 20px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#111827;">
                    <p style="margin:0 0 10px;"><span style="color:#64748b; display:inline-block; min-width:88px;">Name</span> <strong>${name}</strong></p>
                    <p style="margin:0 0 10px;"><span style="color:#64748b; display:inline-block; min-width:88px;">Company</span> <strong>${company}</strong></p>
                    <p style="margin:0;"><span style="color:#64748b; display:inline-block; min-width:88px;">Email</span> ${escapeHtml(fields.email)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next steps -->
          <tr>
            <td style="padding: 0 36px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; font-size:15px; line-height:1.65;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#64748b;">
                What happens next
              </p>
              <ol style="margin:0; padding-left:20px; color:#475569;">
                <li style="margin-bottom:8px;">We'll review your request and match you with the right specialist.</li>
                <li style="margin-bottom:8px;">You'll hear from us by email${fields.phone ? " or phone" : ""} to find a time that works.</li>
                <li style="margin-bottom:0;">We'll show how BelgoBase fits your Belgian targeting workflow.</li>
              </ol>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 36px 40px;" align="left">
              <a href="${homeUrl}" style="display:inline-block; background-color:#0a66c2; color:#ffffff; text-decoration:none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:600; padding:12px 22px; border-radius:8px;">
                Visit BelgoBase
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding: 24px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:13px; line-height:1.6; color:#64748b;">
              <p style="margin:0 0 4px; font-weight:600; color:#1e3a5f;">BelgoBase</p>
              <p style="margin:0 0 4px;">Questions? Reply to this email or write to <a href="mailto:${supportEmail}" style="color:#0a66c2; text-decoration:none;">${supportEmail}</a></p>
              <p style="margin:0 0 12px;">${supportPhone}</p>
              <p style="margin:0; color:#94a3b8; font-size:12px;">&copy; ${year} BelgoBase. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function customerConfirmationSubject(
  requestType: DemoRequestEmailFields["requestType"],
): string {
  return requestType === "custom"
    ? "We've received your message — BelgoBase"
    : "We've received your demo request — BelgoBase";
}

export function adminNotificationSubject(
  requestType: DemoRequestEmailFields["requestType"],
  company: string,
): string {
  const label = requestType === "custom" ? "Contact Request" : "Demo Request";
  return `[BelgoBase] ${label} — ${company}`;
}
