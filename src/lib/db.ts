import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "mailtion.db");

// Singleton connection
declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: DatabaseSync | undefined;
}

function getDatabase(): DatabaseSync {
  if (process.env.NODE_ENV === "production") {
    return createDb();
  }
  if (!global.__dbInstance) {
    global.__dbInstance = createDb();
  }
  return global.__dbInstance;
}

function createDb(): DatabaseSync {
  const db = new DatabaseSync(dbPath);

  // High performance PRAGMAs for SQLite on VPS
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA cache_size = -64000"); // 64MB cache

  // Initialize Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      name TEXT,
      address TEXT UNIQUE NOT NULL,
      local_part TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT 'mailtion.com',
      tag TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_tag ON mailboxes(tag);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_status ON mailboxes(status);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_created ON mailboxes(created_at DESC);
  `);

  // Migration: Ensure 'name' column exists if db was already created
  try {
    db.exec("ALTER TABLE mailboxes ADD COLUMN name TEXT;");
  } catch {
    // Column already exists
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      from_addr TEXT NOT NULL,
      from_name TEXT,
      to_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      raw_headers TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      otp_code TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to_addr ON messages(to_addr);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      permissions TEXT NOT NULL DEFAULT 'all',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Default settings if not already set
  const initSettings = [
    { key: "domain", value: "mailtion.com" },
    { key: "catch_all_mode", value: "auto_create" },
    { key: "webhook_secret", value: "mailtion_secret_" + Math.random().toString(36).substring(2, 10) },
    { key: "telegram_bot_token", value: "" },
    { key: "telegram_chat_id", value: "" },
    { key: "telegram_enabled", value: "0" },
    { key: "discord_webhook_url", value: "" },
    { key: "discord_enabled", value: "0" },
    { key: "auto_cleanup_days", value: "30" }
  ];

  const checkStmt = db.prepare("SELECT key FROM settings WHERE key = ?");
  const insertStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");

  for (const s of initSettings) {
    const existing = checkStmt.get(s.key);
    if (!existing) {
      insertStmt.run(s.key, s.value);
    }
  }

  return db;
}

// Lazy singleton - only connect when first called, not at import time
let _db: DatabaseSync | null = null;

export function getDb() {
  if (!_db) {
    _db = getDatabase();
  }
  return _db;
}

// Keep backward compat export as a Proxy
export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    return getDb()[prop as keyof DatabaseSync];
  },
});
