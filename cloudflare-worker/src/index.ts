// @ts-ignore
import PostalMime from "postal-mime";

export interface Env {
  DASHBOARD_WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
}

interface EmailMessage {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream;
}

interface ExecContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  /**
   * Xử lý sự kiện khi có thư gửi đến mailtion.com qua Cloudflare Email Routing
   */
  async email(message: EmailMessage, env: Env, ctx: ExecContext): Promise<void> {
    try {
      // 1. Đọc luồng raw email từ Cloudflare
      const rawEmail = await new Response(message.raw).arrayBuffer();

      // 2. Parse cấu trúc MIME với postal-mime
      const parser = new PostalMime();
      const parsed = await parser.parse(rawEmail);

      // 3. Chuẩn bị payload gửi về Dashboard VPS
      const payload = {
        to: message.to,
        from: parsed.from?.address || message.from,
        fromName: parsed.from?.name || "",
        subject: parsed.subject || "(No Subject)",
        text: parsed.text || "",
        html: parsed.html || "",
        headers: parsed.headers || [],
        attachments: (parsed.attachments || []).map((att) => ({
          filename: att.filename || "attachment",
          contentType: att.mimeType || "application/octet-stream",
          size: att.content ? att.content.byteLength : 0,
          // Đính kèm có thể chuyển thành Base64 nếu dung lượng < 2MB
          content: att.content && att.content.byteLength < 2000000 
            ? arrayBufferToBase64(att.content) 
            : null
        }))
      };

      // 4. Gửi HTTP POST Webhook tới Dashboard Server
      const response = await fetch(env.DASHBOARD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": env.WEBHOOK_SECRET,
          "User-Agent": "Cloudflare-Email-Worker/mailtion.com"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`Webhook forward failed with status ${response.status}`);
      }
    } catch (error) {
      console.error("Lỗi khi xử lý inbound email:", error);
    }
  },

  /**
   * Endpoint HTTP phụ trợ để test ping hoặc kiểm tra trạng thái Worker
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response(JSON.stringify({
      worker: "mailtion-email-router",
      status: "running",
      domain: "mailtion.com",
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
