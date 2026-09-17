"use client";

import React, { useState, useEffect } from "react";
import { Send, Check, ShieldCheck, Copy, Bell, MessageSquare } from "lucide-react";
import { useToast } from "./toast";

export function TabWebhooks() {
  const { toast } = useToast();
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(false);
  const [telegramToken, setTelegramToken] = useState<string>("");
  const [telegramChatId, setTelegramChatId] = useState<string>("");

  const [discordEnabled, setDiscordEnabled] = useState<boolean>(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("");

  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/v1/settings");
        const data = await res.json();
        if (res.ok) {
          setTelegramEnabled(data.telegram_enabled === "1");
          setTelegramToken(data.telegram_bot_token || "");
          setTelegramChatId(data.telegram_chat_id || "");
          setDiscordEnabled(data.discord_enabled === "1");
          setDiscordWebhookUrl(data.discord_webhook_url || "");
          setWebhookSecret(data.webhook_secret || "");
        }
      } catch {
        toast("Không thể tải cài đặt thông báo", "error");
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
          telegram_enabled: telegramEnabled ? "1" : "0",
          telegram_bot_token: telegramToken.trim(),
          telegram_chat_id: telegramChatId.trim(),
          discord_enabled: discordEnabled ? "1" : "0",
          discord_webhook_url: discordWebhookUrl.trim(),
        }),
      });

      if (res.ok) {
        toast("Đã lưu cấu hình thông báo thành công!");
      } else {
        toast("Lỗi khi lưu cài đặt", "error");
      }
    } catch {
      toast("Lỗi kết nối", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const testTelegram = async () => {
    if (!telegramToken || !telegramChatId) {
      toast("Vui lòng nhập Token và Chat ID trước khi test", "error");
      return;
    }
    setIsTestingTelegram(true);
    try {
      const text = `🔔 <b>mailtion.com Test Alert</b>\n\nThông báo kiểm tra kết nối Telegram Bot thành công!`;
      const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text,
          parse_mode: "HTML",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast("Đã gửi tin nhắn test đến Telegram thành công!");
      } else {
        toast(`Lỗi Telegram: ${data.description}`, "error");
      }
    } catch {
      toast("Không thể kết nối API Telegram", "error");
    } finally {
      setIsTestingTelegram(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Telegram Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Thông báo qua Telegram Bot
                </h3>
              </div>
            </div>

            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-zinc-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-zinc-900 peer-checked:after:translate-x-full dark:bg-zinc-700 dark:peer-checked:bg-zinc-100 dark:peer-checked:after:bg-zinc-900" />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Bot Token (tạo từ @BotFather)
              </label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqr..."
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Chat ID (Group ID hoặc ID cá nhân)
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="-100123456789 hoặc 987654321"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={testTelegram}
              disabled={isTestingTelegram || !telegramToken}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              {isTestingTelegram ? "Đang gửi..." : "Gửi tin nhắn thử nghiệm"}
            </button>
          </div>
        </div>

        {/* Discord Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Thông báo qua Discord Webhook
                </h3>
              </div>
            </div>

            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={discordEnabled}
                onChange={(e) => setDiscordEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-zinc-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-zinc-900 peer-checked:after:translate-x-full dark:bg-zinc-700 dark:peer-checked:bg-zinc-100 dark:peer-checked:after:bg-zinc-900" />
            </label>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Webhook URL
            </label>
            <input
              type="text"
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Đang lưu..." : "Lưu cấu hình thông báo"}
          </button>
        </div>
      </form>
    </div>
  );
}
