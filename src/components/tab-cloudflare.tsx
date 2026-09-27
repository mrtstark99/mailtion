"use client";

import React, { useState } from "react";
import { Cloud, CheckCircle2, Copy, Check, RefreshCw } from "lucide-react";
import { useToast } from "./toast";

export function TabCloudflare() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  const copyValue = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    toast(`Copied: ${val}`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handlePingWebhook = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await fetch("/api/webhook/email");
      const data = await res.json();
      if (res.ok && data.status === "online") {
        setPingStatus("Online - Inbound email endpoint is healthy and receiving messages!");
        toast("Inbound webhook connection is operational!", "success");
      } else {
        setPingStatus("Webhook connection error");
        toast("Webhook endpoint did not respond as expected", "error");
      }
    } catch {
      setPingStatus("Connection failed");
      toast("Network error while checking webhook", "error");
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Overview Status Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Cloudflare Email Worker Integration (mailtion.com)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Real-time email forwarding from Cloudflare Email Routing directly into Mailtion VPS.
              </p>
            </div>
          </div>

          <button
            onClick={handlePingWebhook}
            disabled={isPinging}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? "animate-spin" : ""}`} />
            <span>Check Webhook Status</span>
          </button>
        </div>

        {pingStatus && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{pingStatus}</span>
          </div>
        )}
      </div>

      {/* 3 Step Deployment Guide */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Step 1 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
              1
            </span>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Enable Email Routing
            </h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            In your Cloudflare Dashboard, select <strong>mailtion.com</strong> &rarr; <strong>Email Routing</strong> &rarr; Click <strong>Enable</strong> to auto-configure MX and SPF records.
          </p>
        </div>

        {/* Step 2 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
              2
            </span>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Deploy Email Worker
            </h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            Deploy the Worker in the <code>cloudflare-worker/</code> folder using Wrangler. It catches inbound emails, parses MIME, and pushes to Mailtion VPS webhook.
          </p>
        </div>

        {/* Step 3 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
              3
            </span>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Configure Catch-All
            </h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            In Routing Rules, create a <strong>Catch-all rule</strong> pointing to your Email Worker. Any incoming email to <code>*@mailtion.com</code> will be captured instantly.
          </p>
        </div>
      </div>

      {/* Webhook Endpoint Specs */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Inbound Webhook Endpoint
        </h3>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Webhook URL
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value="https://mailtion.com/api/webhook/email"
              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 outline-none select-all"
            />
            <button
              onClick={() => copyValue("https://mailtion.com/api/webhook/email", "url")}
              className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              title="Copy URL"
            >
              {copiedField === "url" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-zinc-500" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TabCloudflare;
