import crypto from "crypto";
import { db } from "./db";

// Shared mailbox access: a Multi owner hands out a one-time link; whoever opens it sets a
// password and gets a role = 'mailbox' account that can only read that one mailbox.

export const INVITE_TTL_HOURS = 7 * 24;

export class MailboxAccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface MailboxAccessStatus {
  account: { username: string; createdAt: string } | null;
  pendingInvite: { expiresAt: string } | null;
}

interface InviteRow {
  id: string;
  mailbox_id: string;
  expires_at: string;
  address: string;
  local_part: string;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Shared-access accounts sign in with the mailbox's local part, so that username must be
 * free or already belong to this mailbox's own shared-access account.
 */
function assertUsernameAvailable(username: string, mailboxId: string) {
  const conflict = db.prepare(
    "SELECT id FROM users WHERE lower(username) = ? AND (mailbox_id IS NULL OR mailbox_id != ?)"
  ).get(username.toLowerCase(), mailboxId);
  if (conflict) {
    throw new MailboxAccessError(
      `The username "${username}" is already used by another account, so this mailbox cannot be shared.`,
      409
    );
  }
}

export function getMailboxAccessStatus(mailboxId: string): MailboxAccessStatus {
  const account = db.prepare(
    "SELECT username, created_at FROM users WHERE mailbox_id = ?"
  ).get(mailboxId) as { username: string; created_at: string } | undefined;
  const invite = db.prepare(
    "SELECT expires_at FROM mailbox_invites WHERE mailbox_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(mailboxId) as { expires_at: string } | undefined;

  return {
    account: account ? { username: account.username, createdAt: account.created_at } : null,
    pendingInvite:
      invite && new Date(invite.expires_at).getTime() > Date.now() ? { expiresAt: invite.expires_at } : null,
  };
}

/** Issues a fresh link token for the mailbox; any earlier unused link stops working. */
export function createMailboxInvite(mailbox: { id: string; local_part: string }, createdBy: string) {
  assertUsernameAvailable(mailbox.local_part, mailbox.id);

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();

  db.prepare("DELETE FROM mailbox_invites WHERE mailbox_id = ?").run(mailbox.id);
  db.prepare(`
    INSERT INTO mailbox_invites (id, mailbox_id, token_hash, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), mailbox.id, hashToken(token), createdBy, expiresAt);

  return { token, expiresAt };
}

/** Removes the shared-access account and any pending link; the owner keeps the mailbox. */
export function revokeMailboxAccess(mailboxId: string) {
  db.prepare("DELETE FROM mailbox_invites WHERE mailbox_id = ?").run(mailboxId);
  db.prepare("DELETE FROM users WHERE mailbox_id = ? AND role = 'mailbox'").run(mailboxId);
}

function findValidInvite(token: string): InviteRow {
  if (!token) {
    throw new MailboxAccessError("This access link is invalid.", 400);
  }
  const invite = db.prepare(`
    SELECT i.id, i.mailbox_id, i.expires_at, mb.address, mb.local_part
    FROM mailbox_invites i
    JOIN mailboxes mb ON mb.id = i.mailbox_id
    WHERE i.token_hash = ?
  `).get(hashToken(token)) as InviteRow | undefined;

  if (!invite) {
    throw new MailboxAccessError("This access link is invalid or has already been used.", 404);
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new MailboxAccessError("This access link has expired. Ask the mailbox owner for a new one.", 410);
  }
  return invite;
}

export function describeMailboxInvite(token: string) {
  const invite = findValidInvite(token);
  const account = db.prepare("SELECT id FROM users WHERE mailbox_id = ?").get(invite.mailbox_id);
  return { address: invite.address, username: invite.local_part, hasAccount: Boolean(account) };
}

/**
 * Consumes the link: creates the shared-access account, or resets its password when it
 * already exists. Returns the username to start a session for.
 */
export function acceptMailboxInvite(token: string, password: { hash: string; salt: string }): string {
  const invite = findValidInvite(token);
  assertUsernameAvailable(invite.local_part, invite.mailbox_id);

  const existing = db.prepare("SELECT id, username FROM users WHERE mailbox_id = ?").get(invite.mailbox_id) as
    | { id: string; username: string }
    | undefined;

  const apply = db.transaction(() => {
    if (existing) {
      db.prepare(`
        UPDATE users SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(password.hash, password.salt, existing.id);
    } else {
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, salt, role, is_verified, max_mailboxes, auto_forward, mailbox_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'mailbox', 1, 1, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(crypto.randomUUID(), invite.local_part, invite.address, password.hash, password.salt, invite.mailbox_id);
    }
    db.prepare("DELETE FROM mailbox_invites WHERE id = ?").run(invite.id);
  });
  apply();

  return existing ? existing.username : invite.local_part;
}
