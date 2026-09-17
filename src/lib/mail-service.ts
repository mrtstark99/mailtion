import { db } from "./db";
import { extractOtpCode } from "./utils";
import crypto from "crypto";

export interface Mailbox {
  id: string;
  name: string | null;
  address: string;
  local_part: string;
  domain: string;
  tag: string | null;
  note: string | null;
  status: "active" | "paused" | "expired";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
  unread_count?: number;
}

export interface Message {
  id: string;
  mailbox_id: string;
  mailbox_name?: string | null;
  from_addr: string;
  from_name: string | null;
  to_addr: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  raw_headers: string | null;
  is_read: number;
  has_attachments: number;
  otp_code: string | null;
  created_at: string;
  mailbox_tag?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size: number;
  content?: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string;
  created_at: string;
  last_used_at: string | null;
}

// -------------------------------------------------------------
// Settings
// -------------------------------------------------------------
export function getSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function updateSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

// -------------------------------------------------------------
// Mailboxes
// -------------------------------------------------------------
export function getMailboxes(options: {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  status?: string;
} = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses = "WHERE 1=1";
  const params: unknown[] = [];

  if (options.search) {
    whereClauses += " AND (m.address LIKE ? OR m.name LIKE ? OR m.note LIKE ? OR m.tag LIKE ?)";
    const term = `%${options.search}%`;
    params.push(term, term, term, term);
  }

  if (options.tag) {
    whereClauses += " AND m.tag = ?";
    params.push(options.tag);
  }

  if (options.status) {
    whereClauses += " AND m.status = ?";
    params.push(options.status);
  }

  const countQuery = `SELECT COUNT(*) as total FROM mailboxes m ${whereClauses}`;
  const totalRow = db.prepare(countQuery).get(...params) as { total: number };
  const total = totalRow ? totalRow.total : 0;

  const dataQuery = `
    SELECT 
      m.*,
      COUNT(msg.id) as message_count,
      SUM(CASE WHEN msg.is_read = 0 THEN 1 ELSE 0 END) as unread_count
    FROM mailboxes m
    LEFT JOIN messages msg ON m.id = msg.mailbox_id
    ${whereClauses}
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(dataQuery).all(...params, limit, offset) as Mailbox[];

  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export function getMailboxByAddress(address: string): Mailbox | null {
  const row = db.prepare("SELECT * FROM mailboxes WHERE address = ?").get(address.toLowerCase().trim());
  return (row as Mailbox) || null;
}

export function createMailbox(data: {
  name?: string;
  localPart: string;
  domain?: string;
  tag?: string;
  note?: string;
  expiryHours?: number;
}): Mailbox {
  const domain = data.domain || getSettings()["domain"] || "mailtion.com";
  const cleanLocal = data.localPart.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const address = `${cleanLocal}@${domain}`.toLowerCase();

  const existing = getMailboxByAddress(address);
  if (existing) {
    if (data.name && existing.name !== data.name) {
      db.prepare("UPDATE mailboxes SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(data.name, existing.id);
    }
    return getMailboxByAddress(address)!;
  }

  const id = crypto.randomUUID();
  let expiresAt: string | null = null;
  if (data.expiryHours && data.expiryHours > 0) {
    const d = new Date(Date.now() + data.expiryHours * 3600 * 1000);
    expiresAt = d.toISOString();
  }

  db.prepare(`
    INSERT INTO mailboxes (id, name, address, local_part, domain, tag, note, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    id,
    data.name ? data.name.trim() : null,
    address,
    cleanLocal,
    domain,
    data.tag || null,
    data.note || null,
    expiresAt
  );

  return getMailboxByAddress(address)!;
}

export function createBulkMailboxes(options: {
  count?: number;
  mode: "random" | "pattern" | "custom";
  pattern?: string; // e.g. "client_{i}"
  prefix?: string;  // e.g. "temp"
  customList?: string; // newline separated
  domain?: string;
  tag?: string;
  note?: string;
  expiryHours?: number;
}): Mailbox[] {
  const domain = options.domain || getSettings()["domain"] || "mailtion.com";
  const results: Mailbox[] = [];
  const generatedNames: string[] = [];

  if (options.mode === "custom" && options.customList) {
    const lines = options.customList.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Allow user to input full email or just localPart
      const local = line.includes("@") ? line.split("@")[0] : line;
      generatedNames.push(local);
    }
  } else if (options.mode === "pattern") {
    const count = Math.min(1000, Math.max(1, options.count || 10));
    const basePattern = options.pattern || "user_{i}";
    for (let i = 1; i <= count; i++) {
      const name = basePattern.includes("{i}") 
        ? basePattern.replace("{i}", i.toString().padStart(2, "0"))
        : `${basePattern}_${i.toString().padStart(2, "0")}`;
      generatedNames.push(name);
    }
  } else {
    // Random mode
    const count = Math.min(1000, Math.max(1, options.count || 10));
    const prefix = options.prefix ? `${options.prefix.toLowerCase().replace(/[^a-z0-9]/g, "")}_` : "";
    for (let i = 0; i < count; i++) {
      const randomStr = crypto.randomBytes(4).toString("hex");
      generatedNames.push(`${prefix}${randomStr}`);
    }
  }

  // Insert transaction
  const insertStmt = db.prepare(`
    INSERT INTO mailboxes (id, address, local_part, domain, tag, note, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    ON CONFLICT(address) DO NOTHING
  `);

  let expiresAt: string | null = null;
  if (options.expiryHours && options.expiryHours > 0) {
    const d = new Date(Date.now() + options.expiryHours * 3600 * 1000);
    expiresAt = d.toISOString();
  }

  const transaction = db.transaction((names: string[]) => {
    for (const name of names) {
      const cleanLocal = name.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      if (!cleanLocal) continue;
      const address = `${cleanLocal}@${domain}`.toLowerCase();
      const id = crypto.randomUUID();
      insertStmt.run(id, address, cleanLocal, domain, options.tag || null, options.note || null, expiresAt);
    }
  });

  transaction(generatedNames);

  // Retrieve created
  for (const name of generatedNames) {
    const cleanLocal = name.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!cleanLocal) continue;
    const address = `${cleanLocal}@${domain}`.toLowerCase();
    const mb = getMailboxByAddress(address);
    if (mb) results.push(mb);
  }

  return results;
}

export function toggleMailboxStatus(id: string, status: "active" | "paused" | "expired") {
  db.prepare("UPDATE mailboxes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
}

export function deleteMailbox(id: string) {
  db.prepare("DELETE FROM mailboxes WHERE id = ?").run(id);
}

export function deleteBulkMailboxes(ids: string[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`DELETE FROM mailboxes WHERE id IN (${placeholders})`).run(...ids);
}

// -------------------------------------------------------------
// Messages & Inbound Webhook Handling
// -------------------------------------------------------------
export function getMessages(options: {
  page?: number;
  limit?: number;
  mailboxId?: string;
  mailboxAddress?: string;
  search?: string;
  unreadOnly?: boolean;
} = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses = "WHERE 1=1";
  const params: unknown[] = [];

  if (options.mailboxId) {
    whereClauses += " AND m.mailbox_id = ?";
    params.push(options.mailboxId);
  } else if (options.mailboxAddress) {
    whereClauses += " AND m.to_addr = ?";
    params.push(options.mailboxAddress.toLowerCase().trim());
  }

  if (options.unreadOnly) {
    whereClauses += " AND m.is_read = 0";
  }

  if (options.search) {
    whereClauses += " AND (m.subject LIKE ? OR m.from_addr LIKE ? OR m.from_name LIKE ? OR m.body_text LIKE ? OR m.otp_code LIKE ?)";
    const term = `%${options.search}%`;
    params.push(term, term, term, term, term);
  }

  const countQuery = `SELECT COUNT(*) as total FROM messages m ${whereClauses}`;
  const totalRow = db.prepare(countQuery).get(...params) as { total: number };
  const total = totalRow ? totalRow.total : 0;

  const dataQuery = `
    SELECT 
      m.*,
      mb.name as mailbox_name,
      mb.tag as mailbox_tag
    FROM messages m
    LEFT JOIN mailboxes mb ON m.mailbox_id = mb.id
    ${whereClauses}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(dataQuery).all(...params, limit, offset) as Message[];

  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export function getMessageById(id: string): (Message & { attachments: Attachment[] }) | null {
  const msg = db.prepare(`
    SELECT 
      m.*,
      mb.name as mailbox_name,
      mb.tag as mailbox_tag
    FROM messages m
    LEFT JOIN mailboxes mb ON m.mailbox_id = mb.id
    WHERE m.id = ?
  `).get(id) as Message | undefined;

  if (!msg) return null;

  const attachments = db.prepare("SELECT * FROM attachments WHERE message_id = ?").all(id) as Attachment[];
  return { ...msg, attachments };
}

export function markMessageRead(id: string, isRead: boolean = true) {
  db.prepare("UPDATE messages SET is_read = ? WHERE id = ?").run(isRead ? 1 : 0, id);
}

export function deleteMessage(id: string) {
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);
}

export function deleteBulkMessages(ids: string[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...ids);
}

export async function processInboundEmail(payload: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  rawHeaders?: string;
  attachments?: Array<{ filename: string; contentType: string; size: number; content?: string }>;
}) {
  const toAddr = payload.to.toLowerCase().trim();
  const settings = getSettings();
  let mailbox = getMailboxByAddress(toAddr);

  if (!mailbox) {
    if (settings["catch_all_mode"] === "drop") {
      // Reject / drop email for non-existent mailboxes
      return { status: "dropped", reason: "Mailbox does not exist and catch-all is set to drop" };
    }
    // Auto-create mailbox on the fly!
    const parts = toAddr.split("@");
    mailbox = createMailbox({
      localPart: parts[0],
      domain: parts[1] || settings["domain"] || "mailtion.com",
      note: "Auto-created by Inbound Email"
    });
  }

  if (mailbox.status === "paused") {
    return { status: "rejected", reason: "Mailbox is currently paused" };
  }

  const messageId = crypto.randomUUID();
  const textContent = payload.text || "";
  const htmlContent = payload.html || "";
  const otpCode = extractOtpCode(`${payload.subject} ${textContent}`);
  const hasAttachments = payload.attachments && payload.attachments.length > 0 ? 1 : 0;

  db.prepare(`
    INSERT INTO messages (
      id, mailbox_id, from_addr, from_name, to_addr, subject, body_text, body_html, raw_headers, is_read, has_attachments, otp_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    messageId,
    mailbox.id,
    payload.from,
    payload.fromName || null,
    toAddr,
    payload.subject || "(No Subject)",
    textContent,
    htmlContent,
    payload.rawHeaders || null,
    hasAttachments,
    otpCode
  );

  // Attachments
  if (payload.attachments && payload.attachments.length > 0) {
    const attStmt = db.prepare(`
      INSERT INTO attachments (id, message_id, filename, content_type, size, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const att of payload.attachments) {
      attStmt.run(
        crypto.randomUUID(),
        messageId,
        att.filename || "file",
        att.contentType || "application/octet-stream",
        att.size || 0,
        att.content || null
      );
    }
  }

  // Telegram Notification
  if (settings["telegram_enabled"] === "1" && settings["telegram_bot_token"] && settings["telegram_chat_id"]) {
    try {
      const otpText = otpCode ? `\n🔢 <b>Mã OTP:</b> <code>${otpCode}</code>` : "";
      const text = `📬 <b>Mail Mới Đến mailtion.com!</b>\n\n` +
        `📥 <b>Tới:</b> <code>${toAddr}</code>\n` +
        `👤 <b>Từ:</b> ${payload.fromName ? `${payload.fromName} &lt;${payload.from}&gt;` : payload.from}\n` +
        `📝 <b>Tiêu đề:</b> ${payload.subject || "(Trống)"}` +
        otpText;

      fetch(`https://api.telegram.org/bot${settings["telegram_bot_token"]}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings["telegram_chat_id"],
          text,
          parse_mode: "HTML"
        })
      }).catch(err => console.error("Telegram notification error:", err));
    } catch (e) {
      console.error("Telegram notify failed:", e);
    }
  }

  // Discord Notification
  if (settings["discord_enabled"] === "1" && settings["discord_webhook_url"]) {
    try {
      fetch(settings["discord_webhook_url"], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `📬 Mail mới tới: ${toAddr}`,
            description: payload.subject || "(Trống)",
            fields: [
              { name: "Người gửi", value: payload.from, inline: true },
              ...(otpCode ? [{ name: "Mã OTP", value: `\`${otpCode}\``, inline: true }] : [])
            ],
            color: 0x3b82f6,
            timestamp: new Date().toISOString()
          }]
        })
      }).catch(err => console.error("Discord notification error:", err));
    } catch (e) {
      console.error("Discord notify failed:", e);
    }
  }

  return { status: "success", messageId, mailboxId: mailbox.id, otpCode };
}

// -------------------------------------------------------------
// Stats
// -------------------------------------------------------------
export function getSystemStats() {
  const totalMailboxes = (db.prepare("SELECT COUNT(*) as count FROM mailboxes").get() as { count: number }).count;
  const activeMailboxes = (db.prepare("SELECT COUNT(*) as count FROM mailboxes WHERE status = 'active'").get() as { count: number }).count;
  const totalMessages = (db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number }).count;
  const unreadMessages = (db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_read = 0").get() as { count: number }).count;
  
  // Messages today
  const todayMessages = (db.prepare(`
    SELECT COUNT(*) as count FROM messages 
    WHERE date(created_at) = date('now')
  `).get() as { count: number }).count;

  // Recent tags
  const tags = db.prepare(`
    SELECT tag, COUNT(*) as count FROM mailboxes 
    WHERE tag IS NOT NULL AND tag != ''
    GROUP BY tag ORDER BY count DESC LIMIT 10
  `).all() as { tag: string; count: number }[];

  return {
    totalMailboxes,
    activeMailboxes,
    totalMessages,
    unreadMessages,
    todayMessages,
    tags
  };
}

// -------------------------------------------------------------
// API Keys
// -------------------------------------------------------------
export function getApiKeys(): ApiKey[] {
  return db.prepare("SELECT * FROM api_keys ORDER BY created_at DESC").all() as ApiKey[];
}

export function createApiKey(name: string, permissions: string = "all"): ApiKey {
  const id = crypto.randomUUID();
  const token = `mlt_live_${crypto.randomBytes(24).toString("hex")}`;
  
  db.prepare(`
    INSERT INTO api_keys (id, name, key, permissions)
    VALUES (?, ?, ?, ?)
  `).run(id, name, token, permissions);

  return db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as ApiKey;
}

export function deleteApiKey(id: string) {
  db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
}

export function validateApiKey(token: string): boolean {
  if (!token) return false;
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  const row = db.prepare("SELECT id FROM api_keys WHERE key = ?").get(cleanToken) as { id: string } | undefined;
  if (row) {
    db.prepare("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
    return true;
  }
  return false;
}
