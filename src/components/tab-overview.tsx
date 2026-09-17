"use client";

import React from "react";
import { Mail, Inbox, Zap, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface StatsData {
  totalMailboxes: number;
  activeMailboxes: number;
  totalMessages: number;
  unreadMessages: number;
  todayMessages: number;
  tags: { tag: string; count: number }[];
}

interface MessageItem {
  id: string;
  mailbox_id?: string;
  mailbox_name?: string | null;
  from_addr: string;
  from_name: string | null;
  to_addr: string;
  subject: string;
  is_read: number;
  otp_code: string | null;
  created_at: string;
}

interface TabOverviewProps {
  stats: StatsData | null;
  recentMessages: MessageItem[];
  onNavigateTab: (tab: string) => void;
  onOpenMessage: (id: string) => void;
  onQuickGenerate: (count: number) => void;
}

function Avatar({ name, addr }: { name: string | null; addr: string }) {
  const letter = (name || addr).charAt(0).toUpperCase();
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  const idx = addr.charCodeAt(0) % colors.length;
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[idx]}`}
    >
      {letter}
    </div>
  );
}

export function TabOverview({
  stats,
  recentMessages,
  onNavigateTab,
  onOpenMessage,
  onQuickGenerate,
}: TabOverviewProps) {

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-bold uppercase tracking-wider">Hộp thư</span>
            <Mail className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats?.activeMailboxes ?? 0}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 font-medium">/ {stats?.totalMailboxes ?? 0} tổng</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-bold uppercase tracking-wider">Nhận hôm nay</span>
            <Inbox className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats?.todayMessages ?? 0}
            </span>
            <span className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-semibold">tin mới</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-bold uppercase tracking-wider">Chưa đọc</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats?.unreadMessages ?? 0}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 font-medium">/ {stats?.totalMessages ?? 0} tổng</span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-amber-500" />
            <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Thao tác nhanh
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onQuickGenerate(20)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
            >
              + Tạo nhanh 20 mail
            </button>
            <button
              onClick={() => onQuickGenerate(50)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-[0.98]"
            >
              + Tạo nhanh 50 mail
            </button>
            <button
              onClick={() => onNavigateTab("generator")}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all shadow-xs active:scale-[0.98]"
            >
              Tùy chỉnh tạo mail &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity / Inbound Feed */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Inbox className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-400" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Email nhận gần đây
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab("inbox")}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
          >
            <span>Xem tất cả hộp thư</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recentMessages.length === 0 ? (
          <div className="py-14 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Chưa có email nào đến. Bạn có thể bấm nút &quot;Thử nhận mail&quot; phía trên để kiểm tra ngay.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {recentMessages.map((msg) => {
              const isUnread = msg.is_read === 0;
              return (
                <div
                  key={msg.id}
                  onClick={() => onOpenMessage(msg.id)}
                  className={`flex cursor-pointer items-start gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                    isUnread ? "bg-white dark:bg-zinc-900" : ""
                  }`}
                >
                  <Avatar name={msg.from_name} addr={msg.from_addr} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          isUnread
                            ? "font-bold text-zinc-900 dark:text-zinc-100"
                            : "font-medium text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {msg.from_name || msg.from_addr}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-400 font-medium">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 truncate text-sm ${
                        isUnread
                          ? "font-semibold text-zinc-800 dark:text-zinc-200"
                          : "text-zinc-500 dark:text-zinc-500"
                      }`}
                    >
                      {msg.subject || "(Không có tiêu đề)"}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-400">
                      → {msg.mailbox_name ? <strong className="font-sans text-zinc-500 mr-1">{msg.mailbox_name}</strong> : null}{msg.to_addr}
                    </div>
                  </div>
                  {isUnread && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integration & Automation shortcuts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          onClick={() => onNavigateTab("webhooks")}
          className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-2xs"
        >
          <div>
            <div className="text-xs font-medium text-zinc-500">Thông báo tự động</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Telegram & Discord
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <span>Cấu hình</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab("apikeys")}
          className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-2xs"
        >
          <div>
            <div className="text-xs font-medium text-zinc-500">Dành cho Tool / Bot</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              API Tokens & Automation
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <span>Quản lý khóa</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab("cloudflare")}
          className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-2xs"
        >
          <div>
            <div className="text-xs font-medium text-zinc-500">Hạ tầng Cloudflare</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Email Worker Router
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <span>Xem hướng dẫn</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
