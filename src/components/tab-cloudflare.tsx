"use client";

import React, { useState } from "react";
import { Cloud, CheckCircle2, Copy, Check, ExternalLink, RefreshCw, Terminal, ShieldCheck } from "lucide-react";
import { useToast } from "./toast";

export function TabCloudflare() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  const copyValue = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    toast(`Đã chép: ${val}`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handlePingWebhook = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await fetch("/api/webhook/email");
      const data = await res.json();
      if (res.ok && data.status === "online") {
        setPingStatus("Online - Endpoint sẵn sàng nhận mail!");
        toast("Kết nối Webhook Inbound hoạt động tốt!", "success");
      } else {
        setPingStatus("Lỗi kết nối Webhook");
        toast("Webhook không phản hồi như mong đợi", "error");
      }
    } catch {
      setPingStatus("Không thể kết nối");
      toast("Lỗi mạng khi kiểm tra Webhook", "error");
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Status Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Tích hợp Cloudflare Email Worker (mailtion.com)
              </h2>
            </div>
          </div>

          <button
            onClick={handlePingWebhook}
            disabled={isPinging}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? "animate-spin" : ""}`} />
            <span>Kiểm tra trạng thái Webhook</span>
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
              Bật Email Routing
            </h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            Trên Cloudflare Dashboard, vào tên miền <strong>mailtion.com</strong> &rarr; <strong>Email Routing</strong> &rarr; Bấm <strong>Enable</strong> để tự tạo bản ghi MX và SPF.
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
            Mở thư mục <code>cloudflare-worker</code> trong mã nguồn dự án, chạy lệnh:
            <code className="block mt-1 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
              npx wrangler deploy
            </code>
          </p>
        </div>

        {/* Step 3 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
              3
            </span>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Đặt Catch-All Rule
            </h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            Tại mục <strong>Routing Rules</strong> &rarr; <strong>Catch-all address</strong>:
            Chọn Action là <strong>Send to a Worker</strong> &rarr; Chọn worker <code>mailtion-email-router</code>.
          </p>
        </div>
      </div>

      {/* Configuration Values to Copy */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Thông tin cấu hình wrangler.toml
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              DASHBOARD_WEBHOOK_URL
            </label>
            <div className="mt-1 flex rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60">
              <input
                readOnly
                value="https://<YOUR_VPS_DOMAIN_OR_IP>/api/webhook/email"
                className="w-full bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <button
                onClick={() =>
                  copyValue("https://<YOUR_VPS_DOMAIN_OR_IP>/api/webhook/email", "url")
                }
                className="flex items-center gap-1 px-3 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-l border-zinc-200 dark:border-zinc-700"
              >
                {copiedField === "url" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Sao chép</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
