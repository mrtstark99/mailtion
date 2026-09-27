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
  onSelectTab: (tab: string) => void;
  onOpenInboxForMailbox: (address: string) => void;
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
      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold text-white ${colors[idx]}`}
    >
      {letter}
    </div>
  );
}

export function TabOverview({
  stats,
  recentMessages,
  onSelectTab,
  onOpenInboxForMailbox,
  onQuickGenerate,
}: TabOverviewProps) {
  return (
    <div className="space-y-4 sm:space-y-6 font-sans">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Mailboxes</span>
            <Mail className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats?.activeMailboxes ?? 0}
            </span>
            <span className="text-[11px] sm:text-sm text-zinc-500 font-medium">/ {stats?.totalMailboxes ?? 0}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Today</span>
            <Inbox className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-emerald-500" />
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats?.todayMessages ?? 0}
            </span>
            <span className="text-[11px] sm:text-sm text-emerald-600 dark:text-emerald-400 font-semibold">new</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Unread</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats?.unreadMessages ?? 0}
            </span>
            <span className="text-[11px] sm:text-sm text-zinc-500 font-medium">/ {stats?.totalMessages ?? 0} total</span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4.5 w-4.5 text-amber-500" />
            <span className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-200">
              Quick Actions
            </span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => onQuickGenerate(20)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-[0.98] text-center"
            >
              + Generate 20
            </button>
            <button
              onClick={() => onQuickGenerate(50)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-[0.98] text-center"
            >
              + Generate 50
            </button>
            <button
              onClick={() => onSelectTab("generator")}
              className="col-span-2 sm:col-auto rounded-lg bg-zinc-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all shadow-xs active:scale-[0.98] text-center"
            >
              Custom Generator &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity / Inbound Feed */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 px-4 sm:px-5 py-3 sm:py-4 dark:border-zinc-800 gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-zinc-600 dark:text-zinc-400" />
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Recent Inbound Messages
            </h3>
          </div>
          <button
            onClick={() => onSelectTab("inbox")}
            className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors self-start sm:self-auto"
          >
            <span>View All Messages</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentMessages.length === 0 ? (
          <div className="py-12 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 px-4">
            No incoming messages yet. Emails sent to your mailboxes will appear here automatically.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {recentMessages.map((msg) => {
              const isUnread = msg.is_read === 0;
              return (
                <div
                  key={msg.id}
                  onClick={() => onOpenInboxForMailbox(msg.to_addr)}
                  className={`flex cursor-pointer items-start gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-3 sm:py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                    isUnread ? "bg-white dark:bg-zinc-900" : ""
                  }`}
                >
                  <Avatar name={msg.from_name} addr={msg.from_addr} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs sm:text-sm ${
                          isUnread
                            ? "font-bold text-zinc-900 dark:text-zinc-100"
                            : "font-medium text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {msg.from_name || msg.from_addr}
                      </span>
                      <span className="shrink-0 text-[10px] sm:text-[11px] text-zinc-400 font-medium">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 truncate text-xs sm:text-sm ${
                        isUnread
                          ? "font-semibold text-zinc-800 dark:text-zinc-200"
                          : "text-zinc-500 dark:text-zinc-500"
                      }`}
                    >
                      {msg.subject || "(No subject)"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                      <span>To: {msg.to_addr}</span>
                      {msg.otp_code && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.2 font-mono font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                          OTP: {msg.otp_code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TabOverview;
