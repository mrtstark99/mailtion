import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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

  const mailboxColumns = db.prepare("PRAGMA table_info(mailboxes)").all() as { name: string }[];
  const addMailboxColumn = (name: string, definition: string) => {
    if (!mailboxColumns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE mailboxes ADD COLUMN ${definition}`);
    }
  };
  addMailboxColumn("name", "name TEXT");
  addMailboxColumn("user_id", "user_id TEXT");
  addMailboxColumn("is_primary", "is_primary INTEGER DEFAULT 0");
  addMailboxColumn("forward_to", "forward_to TEXT");
  addMailboxColumn("is_forward_enabled", "is_forward_enabled INTEGER DEFAULT 1");
  db.exec("CREATE INDEX IF NOT EXISTS idx_mailboxes_user_id ON mailboxes(user_id);");

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

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);
    CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON auth_codes(code);
  `);

  const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const addUserColumn = (name: string, definition: string) => {
    if (!userColumns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${definition}`);
    }
  };
  addUserColumn("email", "email TEXT");
  addUserColumn("role", "role TEXT NOT NULL DEFAULT 'user'");
  addUserColumn("is_verified", "is_verified INTEGER NOT NULL DEFAULT 1");
  addUserColumn("recovery_email", "recovery_email TEXT");
  addUserColumn("status", "status TEXT NOT NULL DEFAULT 'active'");
  addUserColumn("max_mailboxes", "max_mailboxes INTEGER NOT NULL DEFAULT 1");
  addUserColumn("auto_forward", "auto_forward INTEGER NOT NULL DEFAULT 1");
  // Shared-access accounts (role = 'mailbox') can only read this one mailbox and are removed with it
  addUserColumn("mailbox_id", "mailbox_id TEXT REFERENCES mailboxes(id) ON DELETE CASCADE");

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mailbox_id_unique
    ON users(mailbox_id)
    WHERE mailbox_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS mailbox_invites (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mailbox_invites_mailbox_id ON mailbox_invites(mailbox_id);
  `);

  // Partial unique index so that each recovery email can only register 1 user account
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_email_unique 
    ON users(lower(recovery_email)) 
    WHERE recovery_email IS NOT NULL AND recovery_email != '';
  `);

  // Update existing users to enforce mailbox quotas:
  // - Admin: unlimited (999999)
  // - Multi accounts: 100 mailboxes
  // - Standard users: 1 mailbox
  try {
    db.prepare("UPDATE users SET max_mailboxes = 999999 WHERE role = 'admin'").run();
    db.prepare("UPDATE users SET max_mailboxes = 100 WHERE role = 'multi' AND (max_mailboxes IS NULL OR max_mailboxes < 100)").run();
    db.prepare("UPDATE users SET max_mailboxes = 1 WHERE role = 'user' AND max_mailboxes IS NULL").run();
    db.prepare("UPDATE users SET auto_forward = 1 WHERE auto_forward IS NULL").run();

    // Ensure standard single-mailbox users (role = 'user' with quota 1) keep only their primary mailbox
    db.prepare(`
      DELETE FROM mailboxes 
      WHERE user_id IN (SELECT id FROM users WHERE role = 'user' AND COALESCE(max_mailboxes, 1) <= 1)
      AND (is_primary IS NULL OR is_primary != 1)
      AND user_id IN (
        SELECT user_id FROM mailboxes WHERE is_primary = 1 GROUP BY user_id
      )
    `).run();
  } catch {}

  // Default settings if not already set
  const initSettings = [
    { key: "domain", value: "mailtion.com" },
    { key: "catch_all_mode", value: "auto_create" },
    { key: "webhook_secret", value: process.env.WEBHOOK_SECRET || crypto.randomBytes(32).toString("hex") },
    { key: "telegram_bot_token", value: "" },
    { key: "telegram_chat_id", value: "" },
    { key: "telegram_enabled", value: "0" },
    { key: "discord_webhook_url", value: "" },
    { key: "discord_enabled", value: "0" },
    { key: "auto_cleanup_days", value: "30" },
    { key: "resend_api_key", value: process.env.RESEND_API_KEY || "" },
    { key: "resend_from_email", value: "Mailtion <no-reply@mailtion.com>" }
  ];

  const checkStmt = db.prepare("SELECT key FROM settings WHERE key = ?");
  const insertStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  const updateStmt = db.prepare("UPDATE settings SET value = ? WHERE key = ?");

  for (const s of initSettings) {
    const existing = checkStmt.get(s.key);
    if (!existing) {
      insertStmt.run(s.key, s.value);
    } else if (s.key === "resend_api_key" && process.env.RESEND_API_KEY) {
      // Environment configuration intentionally overrides any previous value.
      updateStmt.run(s.value, s.key);
    }
  }

  // Provision an initial administrator only when an explicit password is supplied.
  const checkAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!checkAdmin && initialAdminPassword) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(initialAdminPassword, Buffer.from(salt, "hex"), 10_000, 32, "sha256").toString("hex");
    db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, role, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      crypto.randomUUID(),
      "admin",
      passwordHash,
      salt
    );
    console.log("[Auth] Initial administrator account created from INITIAL_ADMIN_PASSWORD");
  } else if (!checkAdmin) {
    console.warn("[Auth] No admin user exists. Set INITIAL_ADMIN_PASSWORD once to provision one.");
  } else {
    try {
      db.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin'").run();
      db.prepare("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''").run();
      db.prepare("UPDATE users SET email = 'admin@mailtion.com' WHERE username = 'admin' AND (email IS NULL OR email = '')").run();
      const adminRow = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: string } | undefined;
      if (adminRow) {
        db.prepare(`
          INSERT OR IGNORE INTO mailboxes (id, user_id, name, address, local_part, domain, tag, status, is_primary, created_at, updated_at)
          VALUES (?, ?, 'Admin', 'admin@mailtion.com', 'admin', 'mailtion.com', 'admin', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(crypto.randomUUID(), adminRow.id);
      }
    } catch {}
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
// Includes .transaction() polyfill for better-sqlite3 compatibility
export const db = new Proxy({} as DatabaseSync & {
  transaction: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
}, {
  get(_target, prop) {
    const instance = getDb();
    if (prop === "transaction") {
      return (fn: (...args: unknown[]) => void) => {
        return (...args: unknown[]) => {
          instance.exec("BEGIN");
          try {
            fn(...args);
            instance.exec("COMMIT");
          } catch (e) {
            instance.exec("ROLLBACK");
            throw e;
          }
        };
      };
    }
    const val = instance[prop as keyof DatabaseSync];
    return typeof val === "function" ? val.bind(instance) : val;
  },
});
