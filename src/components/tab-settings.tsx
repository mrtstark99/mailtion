"use client";

import React, { useState, useEffect } from "react";
import { Settings, Shield, RefreshCw, Copy, Check, Trash2 } from "lucide-react";
import { useToast } from "./toast";

export function TabSettings() {
  const { toast } = useToast();
  const [domain, setDomain] = useState<string>("mailtion.com");
  const [catchAllMode, setCatchAllMode] = useState<string>("auto_create");
  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [autoCleanupDays, setAutoCleanupDays] = useState<string>("30");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);

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
        }
      } catch {
        toast("Không thể tải cài đặt", "error");
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
        }),
      });

      if (res.ok) {
        toast("Đã lưu thiết lập hệ thống!", "success");
      } else {
        toast("Lỗi khi lưu thiết lập", "error");
      }
    } catch {
      toast("Lỗi kết nối", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const generateNewSecret = () => {
    const newSec = "mlt_sec_" + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    setWebhookSecret(newSec);
    toast("Đã tạo Secret Key mới. Nhớ bấm Lưu và cập nhật vào wrangler.toml!");
  };

  const copySecret = () => {
    navigator.clipboard.writeText(webhookSecret);
    setCopiedSecret(true);
    toast("Đã chép Webhook Secret");
    setTimeout(() => setCopiedSecret(false), 1500);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Core System Settings */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
          <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Cấu hình Tên miền & Tiếp nhận Thư
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Tên miền chính (Domain)
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mailtion.com"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Chế độ Catch-All (Khi nhận mail gửi tới địa chỉ lạ)
              </label>
              <select
                value={catchAllMode}
                onChange={(e) => setCatchAllMode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              >
                <option value="auto_create" className="dark:bg-zinc-900">
                  Tự động tạo hộp thư mới & nhận thư (Khuyên dùng)
                </option>
                <option value="drop" className="dark:bg-zinc-900">
                  Chỉ nhận mail đã tạo trước (Hủy các mail lạ)
                </option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Webhook Secret (Bảo mật giao tiếp giữa Cloudflare Worker & Dashboard)
            </label>
            <div className="mt-1 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
              <input
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <button
                type="button"
                onClick={copySecret}
                className="flex items-center gap-1 px-3 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-l border-zinc-200 dark:border-zinc-700"
              >
                {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Chép</span>
              </button>
              <button
                type="button"
                onClick={generateNewSecret}
                className="flex items-center gap-1 px-3 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-l border-zinc-200 dark:border-zinc-700"
              >
                <span>Tạo mới</span>
              </button>
            </div>
          </div>
        </div>

        {/* Maintenance & Storage */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
          <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Dọn dẹp & Lưu trữ SQLite
            </h3>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Tự động dọn dẹp email cũ hơn
            </label>
            <select
              value={autoCleanupDays}
              onChange={(e) => setAutoCleanupDays(e.target.value)}
              className="mt-1 w-full sm:w-64 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
            >
              <option value="7" className="dark:bg-zinc-900">7 ngày</option>
              <option value="14" className="dark:bg-zinc-900">14 ngày</option>
              <option value="30" className="dark:bg-zinc-900">30 ngày (Mặc định)</option>
              <option value="90" className="dark:bg-zinc-900">90 ngày</option>
              <option value="0" className="dark:bg-zinc-900">Không bao giờ tự động xóa</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
