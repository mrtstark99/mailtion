import PostalMime from "postal-mime";

export interface Env {
  DASHBOARD_WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
  INDEX_DAYS?: string;
  MAIL_BUCKET: R2Bucket;
  DB: D1Database;
}

type Status = "pending" | "delivered" | "dropped" | "failed";

interface DeliveryResult {
  status: Status;
  error?: string;
}

interface InboundRow {
  id: string;
  received_at: string;
  envelope_from: string;
  envelope_to: string;
  subject: string | null;
  size: number;
  r2_key: string | null;
  status: Status;
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  delivered_at: string | null;
}

type WebhookPayload = Awaited<ReturnType<typeof buildPayload>>;

// Gói Workers Free giới hạn 50 subrequest và rất ít CPU mỗi lần chạy → đẩy lại theo lô nhỏ
const REPLAY_BATCH = 10;
const RESTORE_BATCH = 10;
const WEBHOOK_TIMEOUT_MS = 20_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Archive job: 03:00 Tokyo = 18:00 UTC (cron của Cloudflare luôn tính theo UTC)
const ARCHIVE_CRON = "0 18 * * *";
const TOKYO_OFFSET_MS = 9 * 3_600_000;

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function webhookUrl(env: Env): string {
  return env.DASHBOARD_WEBHOOK_URL || "https://mailtion.com/api/webhook/email";
}

// eml/YYYY/MM/DD/<id>.eml — chia theo ngày để /restore liệt kê được theo khoảng ngày
function emlKey(id: string, receivedAt: string): string {
  return `eml/${receivedAt.slice(0, 10).replaceAll("-", "/")}/${id}.eml`;
}

// Mọi mốc thời gian lưu/hiển thị theo giờ Tokyo, vd. 2026-11-03T01:53:14.633+09:00.
// Cùng một định dạng nên so sánh chuỗi trong D1 vẫn đúng thứ tự; ngày trong khoá R2 là ngày Tokyo.
function tokyoIso(ms: number = Date.now()): string {
  return new Date(ms + TOKYO_OFFSET_MS).toISOString().replace("Z", "+09:00");
}

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

async function buildPayload(
  raw: ArrayBuffer,
  envelopeTo: string,
  envelopeFrom: string,
  deliveryId: string,
  receivedAt: string
) {
  const parser = new PostalMime();
  const parsed = await parser.parse(raw);

  // Mailtion yêu cầu `to` là dạng STRING đơn (ví dụ: test@mailtion.com)
  const toAddress =
    envelopeTo ||
    (Array.isArray(parsed.to) ? parsed.to[0]?.address : (parsed.to as any)?.address) ||
    "";

  return {
    deliveryId,
    receivedAt,
    to: toAddress,
    from: parsed.from?.address || envelopeFrom,
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
}

async function deliver(env: Env, payload: WebhookPayload): Promise<DeliveryResult> {
  if (!env.WEBHOOK_SECRET) {
    return { status: "pending", error: "WEBHOOK_SECRET must be configured with `wrangler secret put WEBHOOK_SECRET`" };
  }
  try {
    const response = await fetch(webhookUrl(env), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-webhook-secret": env.WEBHOOK_SECRET,
        "x-mailtion-delivery-id": payload.deliveryId,
        "User-Agent": "Cloudflare-Email-Worker/1.0 (mailtion)",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (response.ok) {
      const result = (await response.json().catch(() => ({}))) as { status?: string };
      return { status: result.status === "dropped" || result.status === "rejected" ? "dropped" : "delivered" };
    }
    const errText = (await response.text().catch(() => "")).slice(0, 300);
    // 400 = payload hỏng, thử lại vô ích. Còn lại (5xx, 530 tunnel down, 401, 429) → chờ đẩy lại
    return {
      status: response.status === 400 ? "failed" : "pending",
      error: `HTTP ${response.status} ${errText}`.trim(),
    };
  } catch (err) {
    return { status: "pending", error: String(err).slice(0, 300) };
  }
}

async function isMailtionOnline(env: Env): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl(env), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "online";
  } catch {
    return false;
  }
}

async function updateStatus(env: Env, id: string, result: DeliveryResult): Promise<void> {
  const now = tokyoIso();
  const done = result.status === "delivered" || result.status === "dropped";
  await env.DB.prepare(
    `UPDATE inbound SET status = ?, attempts = attempts + 1, last_error = ?, last_attempt_at = ?,
       delivered_at = CASE WHEN ? THEN ? ELSE delivered_at END
     WHERE id = ?`
  )
    .bind(result.status, result.error ?? null, now, done ? 1 : 0, now, id)
    .run();
}

async function replayRow(env: Env, row: InboundRow): Promise<Status> {
  const obj = row.r2_key ? await env.MAIL_BUCKET.get(row.r2_key) : null;
  let result: DeliveryResult;
  if (!obj) {
    result = { status: "failed", error: "Không tìm thấy bản gốc trên R2" };
  } else {
    try {
      const payload = await buildPayload(await obj.arrayBuffer(), row.envelope_to, row.envelope_from, row.id, row.received_at);
      result = await deliver(env, payload);
    } catch (err) {
      result = { status: "failed", error: `parse: ${String(err)}`.slice(0, 300) };
    }
  }
  await updateStatus(env, row.id, result);
  return result.status;
}

// Đẩy lại các thư đang chờ (cũ nhất trước) khi Mailtion online
async function replayPending(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM inbound WHERE status = 'pending' ORDER BY received_at LIMIT ?"
  )
    .bind(REPLAY_BATCH)
    .all<InboundRow>();
  if (results.length === 0) return { checked: 0, delivered: 0 };
  if (!(await isMailtionOnline(env))) return { checked: results.length, delivered: 0, skipped: "mailtion offline" };

  let delivered = 0;
  for (const row of results) {
    const status = await replayRow(env, row);
    if (status === "pending") break; // Mailtion vừa lỗi lại → để lượt cron sau
    if (status === "delivered") delivered++;
  }
  return { checked: results.length, delivered };
}

// Dồn chỉ mục cũ hơn INDEX_DAYS sang R2 (archive/index-YYYY-MM.jsonl) để D1 luôn nhỏ.
// File .eml vẫn giữ nguyên trên R2 làm backup.
async function archiveIndex(env: Env) {
  const days = Number(env.INDEX_DAYS) || 30;
  const cutoff = tokyoIso(Date.now() - days * 86_400_000);
  let archived = 0;

  for (let round = 0; round < 5; round++) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM inbound WHERE status != 'pending' AND received_at < ? ORDER BY received_at LIMIT 500"
    )
      .bind(cutoff)
      .all<InboundRow>();
    if (results.length === 0) break;

    const byMonth = new Map<string, string[]>();
    for (const row of results) {
      const month = row.received_at.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), JSON.stringify(row)]);
    }
    // R2 không có append: đọc file tháng rồi ghi lại. Lỗi giữa chừng có thể ghi trùng dòng (cùng id) — đọc thì lọc theo id
    for (const [month, lines] of byMonth) {
      const key = `archive/index-${month}.jsonl`;
      const existing = await env.MAIL_BUCKET.get(key);
      const prev = existing ? await existing.text() : "";
      await env.MAIL_BUCKET.put(key, prev + lines.join("\n") + "\n", {
        httpMetadata: { contentType: "application/x-ndjson" },
      });
    }
    await env.DB.batch(results.map((row) => env.DB.prepare("DELETE FROM inbound WHERE id = ?").bind(row.id)));
    archived += results.length;
  }
  return { archived, cutoff };
}

// Đẩy lại mọi .eml trong khoảng ngày từ R2 vào Mailtion (vd. khi DB Mailtion hỏng).
// An toàn khi lặp lại: Mailtion bỏ qua deliveryId đã có. Trả `next` để gọi tiếp khi chưa hết.
async function restore(env: Env, from: string, to: string, cursor?: string) {
  let [day, r2Cursor] = cursor ? cursor.split("|") : [from, ""];
  let ok = 0;
  let failed = 0;
  let budget = RESTORE_BATCH;

  while (day <= to) {
    // `include` có trong runtime nhưng bản @cloudflare/workers-types đang cài chưa khai báo
    const listOptions = {
      prefix: `eml/${day.replaceAll("-", "/")}/`,
      cursor: r2Cursor || undefined,
      limit: budget,
      include: ["customMetadata"],
    } as R2ListOptions;
    const list = await env.MAIL_BUCKET.list(listOptions);
    for (const item of list.objects) {
      const id = item.key.split("/").pop()!.replace(/\.eml$/, "");
      const meta = item.customMetadata ?? {};
      const obj = await env.MAIL_BUCKET.get(item.key);
      if (!obj) {
        failed++;
        continue;
      }
      try {
        const payload = await buildPayload(
          await obj.arrayBuffer(),
          meta.to ?? "",
          meta.from ?? "",
          id,
          meta.receivedAt ?? `${day}T00:00:00.000+09:00`
        );
        const result = await deliver(env, payload);
        if (result.status === "pending") {
          // Mailtion không nhận → dừng, gọi lại với cùng cursor (thư đã giao sẽ được bỏ qua)
          return { ok, failed, next: cursor ?? null, error: result.error };
        }
        if (result.status === "failed") failed++;
        else ok++;
      } catch {
        failed++;
      }
    }
    budget -= list.objects.length;
    if (list.truncated) return { ok, failed, next: `${day}|${list.cursor}` };
    day = nextDay(day);
    r2Cursor = "";
    if (budget <= 0) return { ok, failed, next: day <= to ? `${day}|` : null };
  }
  return { ok, failed, next: null };
}

async function bufferStats(env: Env) {
  const since24 = tokyoIso(Date.now() - 86_400_000);
  const row = await env.DB.prepare(
    `SELECT
       SUM(status = 'pending') AS pending,
       MIN(CASE WHEN status = 'pending' THEN received_at END) AS oldest_pending,
       SUM(status = 'failed') AS failed,
       SUM(status IN ('delivered', 'dropped') AND delivered_at >= ?) AS delivered_24h,
       COUNT(*) AS stored,
       SUM(size) AS stored_bytes
     FROM inbound`
  )
    .bind(since24)
    .first<Record<string, number | string | null>>();
  return {
    pending: Number(row?.pending ?? 0),
    oldest_pending: row?.oldest_pending ?? null,
    failed: Number(row?.failed ?? 0),
    delivered_24h: Number(row?.delivered_24h ?? 0),
    // Số thư còn trong chỉ mục D1 (INDEX_DAYS gần nhất)
    stored: Number(row?.stored ?? 0),
    stored_bytes: Number(row?.stored_bytes ?? 0),
    index_days: Number(env.INDEX_DAYS) || 30,
  };
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const id = crypto.randomUUID();
    const receivedAt = tokyoIso();
    const raw = await new Response(message.raw).arrayBuffer();
    const key = emlKey(id, receivedAt);

    // Lưu bản gốc lên R2 song song với việc giao cho Mailtion
    const stored = env.MAIL_BUCKET.put(key, raw, {
      httpMetadata: { contentType: "message/rfc822" },
      customMetadata: { from: message.from, to: message.to, receivedAt },
    }).then(
      () => true,
      (err) => {
        console.error("[mailtion] R2 put failed:", err);
        return false;
      }
    );

    let subject: string | null = null;
    let result: DeliveryResult;
    try {
      const payload = await buildPayload(raw, message.to, message.from, id, receivedAt);
      subject = payload.subject;
      result = await deliver(env, payload);
    } catch (err) {
      result = { status: "failed", error: `parse: ${String(err)}`.slice(0, 300) };
    }
    const inR2 = await stored;

    if (!inR2 && result.status !== "delivered" && result.status !== "dropped") {
      // Không có bản sao và Mailtion chưa nhận → báo lỗi cho người gửi thay vì mất thư trong im lặng
      console.error(`[mailtion] Rejecting <${message.to}>: no backup and delivery ${result.status}: ${result.error}`);
      message.setReject("Temporary failure, please retry later");
      return;
    }

    const now = tokyoIso();
    const done = result.status === "delivered" || result.status === "dropped";
    try {
      await env.DB.prepare(
        `INSERT INTO inbound (id, received_at, envelope_from, envelope_to, subject, size, r2_key, status, attempts, last_error, last_attempt_at, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
        .bind(id, receivedAt, message.from, message.to, subject, raw.byteLength, inR2 ? key : null,
          result.status, result.error ?? null, now, done ? now : null)
        .run();
    } catch (err) {
      // Bản gốc vẫn ở R2 → lấy lại được bằng POST /restore
      console.error(`[mailtion] D1 insert failed for ${key}:`, err);
    }

    if (result.status === "pending") {
      console.error(`[mailtion] Buffered <${message.to}> for retry: ${result.error}`);
    } else {
      console.log(`[mailtion] Email to <${message.to}> ${result.status}${result.error ? `: ${result.error}` : ""}`);
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const job =
      controller.cron === ARCHIVE_CRON
        ? archiveIndex(env).then((r) => console.log(`[mailtion] Archived ${r.archived} index rows older than ${r.cutoff}`))
        : replayPending(env).then((r) => {
            if (r.delivered) console.log(`[mailtion] Replayed ${r.delivered}/${r.checked} buffered emails`);
          });
    ctx.waitUntil(job);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && (url.pathname === "/sync" || url.pathname === "/restore")) {
      if (!env.WEBHOOK_SECRET || request.headers.get("x-webhook-secret") !== env.WEBHOOK_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }
      if (url.pathname === "/sync") return json(await replayPending(env));

      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? from;
      if (!DAY_RE.test(from) || !DAY_RE.test(to) || from > to) {
        return json({ error: "from/to phải có dạng YYYY-MM-DD và from <= to" }, 400);
      }
      return json(await restore(env, from, to, url.searchParams.get("cursor") ?? undefined));
    }

    let buffer: unknown;
    try {
      buffer = await bufferStats(env);
    } catch (err) {
      buffer = { error: String(err) };
    }
    return json({
      worker: "mailtion-email-router",
      status: "running",
      timestamp: tokyoIso(),
      buffer,
    });
  },
} satisfies ExportedHandler<Env>;
