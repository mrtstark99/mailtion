import PostalMime from "postal-mime";

export interface Env {
  DASHBOARD_WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
}

interface CloudflareEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
}

interface ExecContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Chuyển ArrayBuffer hoặc Uint8Array sang Base64 tối ưu bộ nhớ bằng chunking 32KB
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunk
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export default {
  async email(
    message: CloudflareEmailMessage,
    env: Env,
    ctx: ExecContext
  ): Promise<void> {
    try {
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      const parser = new PostalMime();
      const parsed = await parser.parse(rawBuffer);

      // Mailtion yêu cầu `to` là dạng STRING đơn (ví dụ: test@mailtion.com)
      const toAddress =
        message.to ||
        (Array.isArray(parsed.to) ? parsed.to[0]?.address : (parsed.to as any)?.address) ||
        "";
      const fromAddress = parsed.from?.address || message.from;

      const payload = {
        to: toAddress,
        from: fromAddress,
        fromName: parsed.from?.name || "",
        subject: parsed.subject || "(No Subject)",
        text: parsed.text || "",
        html: parsed.html || "",
        rawHeaders: JSON.stringify(parsed.headers || []),
        attachments: (parsed.attachments || []).map((att: any) => ({
          filename: att.filename || "attachment",
          contentType: att.mimeType || "application/octet-stream",
          size: att.content ? (att.content.byteLength || att.content.length || 0) : 0,
          content:
            att.content && (att.content.byteLength || att.content.length || 0) < 10_000_000
              ? arrayBufferToBase64(att.content)
              : null,
        })),
      };

      const webhookUrl =
        env.DASHBOARD_WEBHOOK_URL || "https://mailtion.com/api/webhook/email";
      const webhookSecret = env.WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error("WEBHOOK_SECRET must be configured with `wrangler secret put WEBHOOK_SECRET`");
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-webhook-secret": webhookSecret,
          "User-Agent": "Cloudflare-Email-Worker/1.0 (mailtion)",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`[mailtion] Webhook failed ${response.status}: ${errText}`);
      } else {
        console.log(`[mailtion] Forwarded email to <${toAddress}> successfully`);
      }
    } catch (err) {
      console.error("[mailtion] Error processing email in worker:", err);
    }
  },

  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(
      JSON.stringify({
        worker: "mailtion-email-router",
        status: "running",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  },
};
