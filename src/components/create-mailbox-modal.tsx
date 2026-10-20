"use client";

import React, { useState, useEffect } from "react";
import { X, Dices, Mail, Plus, Loader2, Sparkles, Layers, AlertCircle } from "lucide-react";
import { useToast } from "./toast";

interface CreateMailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: {
    id?: string;
    username: string;
    role: string;
    maxMailboxes?: number;
  } | null;
}

export function CreateMailboxModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
}: CreateMailboxModalProps) {
  const { toast } = useToast();

  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentCount, setCurrentCount] = useState<number | null>(null);

  const isAdmin = currentUser?.role === "admin";
  const maxQuota = isAdmin ? 999999 : (currentUser?.maxMailboxes ?? 1);

  // Fetch current mailboxes count when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch("/api/v1/mailboxes?limit=1")
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.total === "number") {
            setCurrentCount(data.total);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isAtLimit = !isAdmin && currentCount !== null && currentCount >= maxQuota;
  const isSingleOnly = !isAdmin && maxQuota <= 1;

  const generateRandom = () => {
    const prefix = currentUser?.username ? `${currentUser.username}_` : "box_";
    const rand = Math.random().toString(36).substring(2, 7);
    setLocalPart(`${prefix}${rand}`);
  };

  const handleQuickTag = (tagText: string) => {
    setTag(tagText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAtLimit || isSingleOnly) {
      toast("Your account quota does not allow creating additional mailboxes.", "error");
      return;
    }

    let cleanLocal = localPart.trim().replace(/@mailtion\.com$/i, "").toLowerCase();
    if (!cleanLocal) {
      cleanLocal = `mail_${Math.random().toString(36).substring(2, 8)}`;
    }

    if (!/^[a-z0-9._-]+$/.test(cleanLocal)) {
      toast("Email prefix can only contain letters, numbers, dots, hyphens, and underscores.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localPart: cleanLocal,
          name: displayName.trim() || undefined,
          tag: tag.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast(`Mailbox created: ${data.item?.address || cleanLocal + "@mailtion.com"}`, "success");
        setLocalPart("");
        setDisplayName("");
        setTag("");
        setNote("");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Failed to create mailbox", "error");
      }
    } catch {
      toast("Network error creating mailbox", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Add New Email Address
              </h3>
              <p className="text-xs text-zinc-400">
                Create an alias to receive emails directly into your inbox.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quota Banner */}
        <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <Layers className="h-3.5 w-3.5 text-blue-500" />
            <span>Account Quota:</span>
          </div>
          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
            {currentCount !== null ? currentCount : "..."} / {isAdmin ? "Unlimited" : maxQuota} Mailboxes
          </span>
        </div>

        {/* Limit Warning if applicable */}
        {isSingleOnly ? (
          <div className="mt-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold">Single Mailbox Account</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                Standard accounts are limited to 1 primary email address. Contact an administrator to upgrade your account quota for multi-mailbox privileges.
              </p>
            </div>
          </div>
        ) : isAtLimit ? (
          <div className="mt-3 p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Quota Limit Reached</p>
              <p className="mt-0.5 text-rose-700 dark:text-rose-400/90 leading-relaxed">
                You have reached your maximum limit of {maxQuota} email addresses. Please request an administrator to expand your mailbox quota.
              </p>
            </div>
          </div>
        ) : null}

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Email Prefix (Local Part)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  disabled={isAtLimit || isSingleOnly}
                  value={localPart}
                  onChange={(e) =>
                    setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
                  }
                  placeholder="e.g. dev.work, alias"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-3.5 pr-32 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 font-mono disabled:opacity-50 transition-all"
                />
                <span className="absolute right-3 top-3 text-xs text-zinc-400 font-mono select-none">
                  @mailtion.com
                </span>
              </div>
              <button
                type="button"
                disabled={isAtLimit || isSingleOnly}
                onClick={generateRandom}
                title="Generate random name"
                className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer disabled:opacity-50 transition-colors shrink-0"
              >
                <Dices className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Random</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Display Name <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              disabled={isAtLimit || isSingleOnly}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Work Mail, Dev Testing..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 disabled:opacity-50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Tag <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              disabled={isAtLimit || isSingleOnly}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. work, notify, social..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 disabled:opacity-50 transition-all"
            />
            {/* Quick Tag Pills */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-zinc-400 font-medium">Suggestions:</span>
              {["work", "social", "verify", "dev", "billing"].map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isAtLimit || isSingleOnly}
                  onClick={() => handleQuickTag(t)}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Note <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <textarea
              disabled={isAtLimit || isSingleOnly}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Private note about this address..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 disabled:opacity-50 transition-all resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isAtLimit || isSingleOnly}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Create Mailbox</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
