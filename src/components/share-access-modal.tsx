"use client";

import React, { useEffect, useState } from "react";
import { X, Link2, Copy, Check, Loader2, UserX, ShieldCheck } from "lucide-react";
import { useToast } from "./toast";
import { formatFullDate } from "@/lib/utils";

interface AccessStatus {
  account: { username: string; createdAt: string } | null;
  pendingInvite: { expiresAt: string } | null;
}

interface ShareAccessModalProps {
  mailbox: { id: string; address: string };
  onClose: () => void;
  onChanged: () => void;
}

export function ShareAccessModal({ mailbox, onClose, onChanged }: ShareAccessModalProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`/api/v1/mailboxes/${mailbox.id}/access`);
        const data = await res.json();
        if (res.ok) {
          setStatus(data);
        } else {
          toast(data.error || "Failed to load sharing status", "error");
          onClose();
        }
      } catch {
        toast("Connection error", "error");
      }
    }
    loadStatus();
  }, [mailbox.id, onClose, toast]);

  const generateLink = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/mailboxes/${mailbox.id}/access`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to generate link", "error");
        return;
      }
      // The token sits in the fragment so it is never sent to the server or logged
      setLink(`${window.location.origin}/mailbox-access#${data.token}`);
      setCopied(false);
      setStatus((prev) => ({ account: prev?.account ?? null, pendingInvite: { expiresAt: data.expiresAt } }));
      onChanged();
    } catch {
      toast("Connection error", "error");
    } finally {
      setBusy(false);
    }
  };

  const revokeAccess = async () => {
    if (!confirm(`Revoke shared access to ${mailbox.address}? The shared account will be signed out and any unused link stops working.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/mailboxes/${mailbox.id}/access`, { method: "DELETE" });
      if (res.ok) {
        toast("Shared access revoked");
        setStatus({ account: null, pendingInvite: null });
        setLink(null);
        onChanged();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to revoke access", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast("Link copied");
  };

  const hasAccess = Boolean(status?.account || status?.pendingInvite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Share Mailbox Access</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Send a one-time link to let someone set a password and sign in to read{" "}
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{mailbox.address}</span>{" "}
            only. They cannot see your other mailboxes, delete emails, or change settings.
          </p>

          {!status ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              {status.account && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Shared account active: <span className="font-mono">{status.account.username}</span>
                    </p>
                    <p className="mt-0.5 opacity-80">
                      Set up {formatFullDate(status.account.createdAt)}. A new link lets them reset their password.
                    </p>
                  </div>
                </div>
              )}

              {status.pendingInvite && !link && (
                <p className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
                  An unused link expires {formatFullDate(status.pendingInvite.expiresAt)}. For security it can&apos;t be shown
                  again — generating a new link disables the old one.
                </p>
              )}

              {link && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300">Access link</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-mono text-[11px] text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Works once and expires {status.pendingInvite ? formatFullDate(status.pendingInvite.expiresAt) : "in 7 days"}.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {hasAccess ? (
                  <button
                    type="button"
                    onClick={revokeAccess}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 cursor-pointer"
                  >
                    <UserX className="h-4 w-4" />
                    <span>Revoke access</span>
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={generateLink}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  <span>{hasAccess ? "Generate new link" : "Generate link"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
