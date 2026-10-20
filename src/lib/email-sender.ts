import { Resend, type Attachment } from "resend";
import { db } from "./db";

export function getResendClient(): { client: Resend | null; fromEmail: string } {
  let apiKey = process.env.RESEND_API_KEY || "";
  let fromEmail = "Mailtion <noreply@mailtion.com>";

  try {
    const keyRow = db.prepare("SELECT value FROM settings WHERE key = ?").get("resend_api_key") as { value: string } | undefined;
    if (keyRow?.value) apiKey = keyRow.value;

    const fromRow = db.prepare("SELECT value FROM settings WHERE key = ?").get("resend_from_email") as { value: string } | undefined;
    if (fromRow?.value) fromEmail = fromRow.value;
  } catch (err) {
    console.error("[EmailSender] Error reading settings from db:", err);
  }

  if (!apiKey) {
    return { client: null, fromEmail };
  }

  return { client: new Resend(apiKey), fromEmail };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  attachments,
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Attachment[];
}) {
  const { client, fromEmail } = getResendClient();
  if (!client) {
    throw new Error("Resend API Key is not configured. Please configure it in Settings.");
  }

  const sender = from || fromEmail;

  try {
    const payload: {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
      text: string;
      reply_to?: string;
      attachments?: Attachment[];
    } = {
      from: sender,
      to,
      subject,
      html: html || (text ? `<p>${text.replace(/\n/g, "<br/>")}</p>` : ""),
      text: text || "",
    };
    if (replyTo) {
      payload.reply_to = replyTo;
    }
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const result = await client.emails.send(payload);

    if (result.error) {
      // If domain verification error, try with onboarding@resend.dev as fallback
      if (
        result.error.message.toLowerCase().includes("domain") ||
        result.error.message.toLowerCase().includes("verify")
      ) {
        console.warn("[EmailSender] Retrying with onboarding@resend.dev fallback due to domain check:", result.error.message);
        const fallbackPayload: {
          from: string;
          to: string | string[];
          subject: string;
          html: string;
          text: string;
          reply_to?: string;
          attachments?: Attachment[];
        } = {
          from: "Mailtion <onboarding@resend.dev>",
          to,
          subject,
          html: html || (text ? `<p>${text.replace(/\n/g, "<br/>")}</p>` : ""),
          text: text || "",
        };
        if (replyTo) {
          fallbackPayload.reply_to = replyTo;
        }
        if (attachments && attachments.length > 0) {
          fallbackPayload.attachments = attachments;
        }
        const fallbackResult = await client.emails.send(fallbackPayload);
        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message);
        }
        return fallbackResult.data;
      }
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(errMsg);
  }
}

export async function sendForwardedEmail({
  to,
  originalTo,
  originalFrom,
  originalFromName,
  subject,
  html,
  text,
  otpCode,
  attachments,
}: {
  to: string;
  originalTo: string;
  originalFrom: string;
  originalFromName?: string;
  subject: string;
  html?: string;
  text?: string;
  otpCode?: string;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    size?: number;
    content?: string | null;
  }>;
}) {
  const fromDisplay = originalFromName ? `${originalFromName} <${originalFrom}>` : originalFrom;
  const fwdSubject = subject ? `[Mailtion Fwd] ${subject}` : `[Mailtion Fwd] Email to ${originalTo}`;

  // Process attachments
  const emailAttachments: Attachment[] = [];
  let totalBytes = 0;
  const maxBytes = 25 * 1024 * 1024; // 25MB safety threshold for Resend

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (!att.content) continue;
      try {
        let buf: Buffer;
        if (Buffer.isBuffer(att.content)) {
          buf = att.content;
        } else if (typeof att.content === "string") {
          const cleanBase64 = att.content.replace(/^data:[^;]+;base64,/, "").trim();
          buf = Buffer.from(cleanBase64, "base64");
        } else {
          continue;
        }

        if (totalBytes + buf.length > maxBytes) {
          console.warn(`[AutoForward] Skipping attachment "${att.filename}" as total payload exceeds 25MB limit.`);
          continue;
        }

        totalBytes += buf.length;
        emailAttachments.push({
          filename: att.filename || "attachment",
          contentType: att.contentType || "application/octet-stream",
          content: buf,
        });
      } catch (err) {
        console.error(`[AutoForward] Failed to prepare attachment "${att.filename}":`, err);
      }
    }
  }

  const headerBannerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px;">
        📬 Mailtion Auto-Forward Notice
      </div>
      <table style="font-size: 13px; color: #1e293b; border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 2px 0; color: #64748b; width: 140px;"><strong>Mailtion Mailbox:</strong></td>
          <td style="padding: 2px 0;"><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${originalTo}</code></td>
        </tr>
        <tr>
          <td style="padding: 2px 0; color: #64748b;"><strong>Sender:</strong></td>
          <td style="padding: 2px 0;">${fromDisplay}</td>
        </tr>
        ${
          otpCode
            ? `<tr>
                <td style="padding: 2px 0; color: #64748b;"><strong>OTP / Code:</strong></td>
                <td style="padding: 2px 0;"><span style="font-size: 16px; font-weight: 700; color: #2563eb; background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${otpCode}</span></td>
              </tr>`
            : ""
        }
        ${
          emailAttachments.length > 0
            ? `<tr>
                <td style="padding: 2px 0; color: #64748b;"><strong>Attachments:</strong></td>
                <td style="padding: 2px 0;">📎 ${emailAttachments.map((a) => a.filename).join(", ")}</td>
              </tr>`
            : ""
        }
      </table>
    </div>
  `;

  const finalHtml = `
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        ${headerBannerHtml}
        <div style="font-size: 14px; line-height: 1.6; color: #334155;">
          ${html || (text ? `<p style="white-space: pre-wrap;">${text}</p>` : "<p>(No content)</p>")}
        </div>
      </body>
    </html>
  `;

  const fallbackText = `[Mailtion Auto-Forward]
Mailtion Mailbox: ${originalTo}
Sender: ${fromDisplay}
${otpCode ? `OTP Code: ${otpCode}\n` : ""}${
  emailAttachments.length > 0
    ? `Attachments: ${emailAttachments.map((a) => a.filename).join(", ")}\n`
    : ""
}--------------------------------------------------

${text || "(No content)"}`;

  return await sendEmail({
    to,
    subject: fwdSubject,
    html: finalHtml,
    text: fallbackText,
    replyTo: originalFrom,
    attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
  });
}

export async function sendAuthOtpEmail({
  to,
  otp,
  type,
}: {
  to: string;
  otp: string;
  type: "register" | "forgot_password";
}) {
  const isRegister = type === "register";
  const title = isRegister ? "Verify Your Email Address" : "Reset Your Password";
  const desc = isRegister
    ? "Thank you for signing up with Mailtion! Please use the verification code below to complete your registration:"
    : "We received a request to reset the password for your Mailtion account. Please use the verification code below to proceed:";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px 12px; color: #18181b; }
          .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e4e4e7; }
          .logo { text-align: center; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 700; text-align: center; color: #09090b; margin-bottom: 12px; }
          .desc { font-size: 14px; line-height: 1.6; color: #52525b; text-align: center; margin-bottom: 24px; }
          .otp-box { background: #f4f4f5; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; letter-spacing: 8px; font-size: 32px; font-weight: 800; font-family: monospace; color: #2563eb; }
          .warning { font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.6; border-top: 1px solid #f4f4f5; padding-top: 18px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <span style="font-size: 24px; font-weight: 800; color: #09090b; letter-spacing: -0.5px;">Mailtion</span>
          </div>
          <div class="title">${title}</div>
          <div class="desc">${desc}</div>
          <div class="otp-box">${otp}</div>
          <div class="warning">
            This verification code is valid for <strong>15 minutes</strong>.<br/>
            If you did not request this code, you can safely ignore this email. Never share this code with anyone.
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `[Mailtion] ${isRegister ? "Registration Verification Code" : "Password Reset Code"}: ${otp}`,
    html,
    text: `Your Mailtion ${isRegister ? "verification" : "password reset"} code is: ${otp}. It will expire in 15 minutes.`,
  });
}
