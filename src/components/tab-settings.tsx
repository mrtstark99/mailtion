"use client";

import React, { useState, useEffect } from "react";
import { Settings, Shield, RefreshCw, Copy, Check, Trash2, Send, Mail } from "lucide-react";
import { useToast } from "./toast";

export function TabSettings() {
  const { toast } = useToast();
  const [domain, setDomain] = useState<string>("mailtion.com");
  const [catchAllMode, setCatchAllMode] = useState<string>("auto_create");
  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [autoCleanupDays, setAutoCleanupDays] = useState<string>("30");
  const [resendApiKey, setResendApiKey] = useState<string>("");
  const [resendFromEmail, setResendFromEmail] = useState<string>("Mailtion <no-reply@mailtion.com>");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [testEmailTo, setTestEmailTo] = useState<string>("");
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/v1/settings");
        const data = await res.json();
        if (res.ok) {
          setDomain(data.domain || "mailtion.com");
          setCatchAllMode(data.catch_all_mode || "auto_create");
          setWebhookSecret(data.webhook_secret || "");
          setAutoCleanupDays(data.auto_cleanup_days || "30");
          setResendApiKey(data.resend_api_key || "");
          setResendFromEmail(data.resend_from_email || "Mailtion <no-reply@mailtion.com>");
        }
      } catch {
        toast("Failed to load settings", "error");
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          catch_all_mode: catchAllMode,
          webhook_secret: webhookSecret.trim(),
          auto_cleanup_days: autoCleanupDays,
          resend_api_key: resendApiKey.trim(),
          resend_from_email: resendFromEmail.trim(),
        }),
      });

      if (res.ok) {
        toast("System settings saved successfully!", "success");
      } else {
        toast("Failed to save settings", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const generateNewSecret = () => {
    const newSec = "mlt_sec_" + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    setWebhookSecret(newSec);
    toast("Generated new Webhook Secret Key. Remember to save and update wrangler.toml!");
  };

  const copySecret = () => {
    navigator.clipboard.writeText(webhookSecret);
    setCopiedSecret(true);
    toast("Copied Webhook Secret to clipboard");
    setTimeout(() => setCopiedSecret(false), 1500);
  };

  const handleSendTest = async () => {
    if (!testEmailTo.trim() || !testEmailTo.includes("@")) {
      toast("Please enter a valid recipient email address", "error");
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch("/api/v1/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmailTo.trim(),
          subject: "[Mailtion Test] Resend Connection Test",
          bodyText: "Hello! This is a verification test message dispatched via Resend from your self-hosted Mailtion platform.",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast("Test email sent successfully via Resend!", "success");
      } else {
        toast(data.error || "Failed to send test email", "error");
      }
    } catch {
      toast("Network connection error", "error");
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Resend Email Sending Configuration */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
          <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4.5 w-4.5 text-blue-500" />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Outbound Email Delivery (Resend API)
              </h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
              Outbound
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Resend API Key (re_...)
              </label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_xxxxxxxxxxxx"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Used to dispatch OTP registration codes, password resets, and outbound messages.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Default Sender Display &amp; Address (From)
              </label>
              <input
                type="text"
                value={resendFromEmail}
                onChange={(e) => setResendFromEmail(e.target.value)}
                placeholder="Mailtion <no-reply@mailtion.com>"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Must match a domain verified in your Resend account.
              </p>
            </div>
          </div>

          {/* Test Email Dispatch Form */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Send Test Email
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2 max-w-lg">
              <input
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest || !resendApiKey}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>{isSendingTest ? "Sending..." : "Test Send"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
          <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              General Domain &amp; Storage Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                System Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Auto-Cleanup Old Messages (Days, 0 = Keep forever)
              </label>
              <input
                type="number"
                min={0}
                value={autoCleanupDays}
                onChange={(e) => setAutoCleanupDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save All Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default TabSettings;
