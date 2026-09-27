"use client";

import React, { useState, useEffect } from "react";
import { Send, X, Mail } from "lucide-react";
import { useToast } from "./toast";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFrom?: string;
  onSuccess?: () => void;
}

export function ComposeModal({ isOpen, onClose, defaultFrom, onSuccess }: ComposeModalProps) {
  const { toast } = useToast();
  const [fromAddr, setFromAddr] = useState("");
  const [toAddr, setToAddr] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [mailboxes, setMailboxes] = useState<{ id: string; address: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/v1/mailboxes?limit=50")
        .then((res) => res.json())
        .then((data) => {
          if (data.items) {
            setMailboxes(data.items);
            if (defaultFrom) {
              setFromAddr(defaultFrom);
            } else if (data.items.length > 0) {
              setFromAddr(data.items[0].address);
            } else {
              setFromAddr("no-reply@mailtion.com");
            }
          }
        })
        .catch(() => {
          setFromAddr(defaultFrom || "no-reply@mailtion.com");
        });
    }
  }, [isOpen, defaultFrom]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAddr.trim() || !subject.trim() || !bodyText.trim()) {
      toast("Please fill in recipient, subject and message body", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddr.trim() ? `Mailtion <${fromAddr.trim()}>` : undefined,
          to: toAddr.trim(),
          subject: subject.trim(),
          bodyText: bodyText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to send email", "error");
        setLoading(false);
        return;
      }

      toast("Email sent successfully via Resend!", "success");
      setLoading(false);
      setToAddr("");
      setSubject("");
      setBodyText("");
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      toast("Connection error", "error");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in font-sans">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Compose &amp; Send Email (Resend)
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Send outbound emails from @mailtion.com domain
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="mt-3.5 space-y-3 flex-1 flex flex-col overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              From
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fromAddr}
                onChange={(e) => setFromAddr(e.target.value)}
                placeholder="no-reply@mailtion.com"
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs sm:text-sm font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 outline-none"
              />
              {mailboxes.length > 0 && (
                <select
                  onChange={(e) => e.target.value && setFromAddr(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-transparent px-2.5 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300 outline-none max-w-[140px] truncate"
                >
                  <option value="">Select mailbox...</option>
                  {mailboxes.map((m) => (
                    <option key={m.id} value={m.address} className="dark:bg-zinc-900">
                      {m.name || m.address}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              To
            </label>
            <input
              type="email"
              value={toAddr}
              onChange={(e) => setToAddr(e.target.value)}
              placeholder="recipient@example.com"
              required
              className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              required
              className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-[160px]">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Message Content
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Write your email body here..."
              required
              className="flex-1 w-full rounded-lg border border-zinc-200 bg-transparent p-3 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none resize-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-400">
              Dispatched via Resend Cloud API
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{loading ? "Sending..." : "Send Message"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ComposeModal;
